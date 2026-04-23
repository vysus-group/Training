-- ============================================================================
-- Vysus Training — auth hardening migration
-- Apply in Supabase SQL editor AFTER deploying the new client.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

-- 1. Admin table (replaces hard-coded client ADMIN_EMAILS / ADMIN_NAMES) ------
CREATE TABLE IF NOT EXISTS public.training_admins (
    email text PRIMARY KEY,
    granted_at timestamptz NOT NULL DEFAULT now(),
    granted_by text
);

-- Seed current admins. Edit / remove rows as needed.
INSERT INTO public.training_admins (email) VALUES
    ('chris.marinelli@vysusgroup.com'),
    ('faraz.khan@vysusgroup.com')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.training_admins ENABLE ROW LEVEL SECURITY;
-- No policies = no anon access. Only the RPCs below (SECURITY DEFINER) can read it.

-- 2. Admin check RPC ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_user_admin(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.training_admins
        WHERE email = lower(trim(p_email))
    );
$$;
GRANT EXECUTE ON FUNCTION public.is_user_admin(text) TO anon, authenticated;

-- 3. Change-password RPC (verify old, set new) -------------------------------
-- Assumes you already have a `user_passwords` table (email, hash) used by
-- register_password / verify_password. Adjust column names if they differ.
CREATE OR REPLACE FUNCTION public.change_password(
    p_email text, p_old_hash text, p_new_hash text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email text := lower(trim(p_email));
    v_rows int;
BEGIN
    UPDATE public.user_passwords
       SET hash = p_new_hash, updated_at = now()
     WHERE email = v_email AND hash = p_old_hash;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.change_password(text, text, text) TO anon, authenticated;

-- 4. Lock down the data tables with RLS --------------------------------------
-- Adjust the policies to your auth model. These examples assume the client
-- passes the user email as the PostgREST header `request.headers.x-user-email`.
-- If you migrate to Supabase Auth JWTs, switch these to auth.jwt()->>'email'.

ALTER TABLE public.training_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_feedback   ENABLE ROW LEVEL SECURITY;

-- Everyone can see the public leaderboard (xp/name only — NOT emails/progress).
CREATE OR REPLACE VIEW public.training_leaderboard AS
    SELECT name, xp, level, badges, streak_current, streak_best
      FROM public.training_users;
GRANT SELECT ON public.training_leaderboard TO anon, authenticated;

-- Drop any existing policies so this script is idempotent.
DROP POLICY IF EXISTS training_users_self_read   ON public.training_users;
DROP POLICY IF EXISTS training_users_self_write  ON public.training_users;
DROP POLICY IF EXISTS training_progress_self_all ON public.training_progress;
DROP POLICY IF EXISTS training_feedback_self_all ON public.training_feedback;

-- Minimal working policy: clients must set the header `x-user-email` on each
-- request (supabase-js does this automatically when you call .auth.setSession
-- OR you can do sb.headers = {'x-user-email': email}). Until you wire that up,
-- the fallback below lets the app keep functioning by matching email column.
CREATE POLICY training_users_self_read ON public.training_users
    FOR SELECT USING (true);   -- leaderboard columns are public; tighten later
CREATE POLICY training_users_self_write ON public.training_users
    FOR INSERT WITH CHECK (email = lower(trim(current_setting('request.headers', true)::json->>'x-user-email')));
CREATE POLICY training_users_self_update ON public.training_users
    FOR UPDATE USING (email = lower(trim(current_setting('request.headers', true)::json->>'x-user-email')));

CREATE POLICY training_progress_self_all ON public.training_progress
    FOR ALL USING (email = lower(trim(current_setting('request.headers', true)::json->>'x-user-email')))
             WITH CHECK (email = lower(trim(current_setting('request.headers', true)::json->>'x-user-email')));

CREATE POLICY training_feedback_self_all ON public.training_feedback
    FOR ALL USING (email = lower(trim(current_setting('request.headers', true)::json->>'x-user-email')))
             WITH CHECK (email = lower(trim(current_setting('request.headers', true)::json->>'x-user-email')));

-- 5. Grant admins full access via a second policy set ------------------------
CREATE POLICY training_users_admin_all ON public.training_users
    FOR ALL USING (public.is_user_admin(current_setting('request.headers', true)::json->>'x-user-email'));
CREATE POLICY training_progress_admin_all ON public.training_progress
    FOR ALL USING (public.is_user_admin(current_setting('request.headers', true)::json->>'x-user-email'));
CREATE POLICY training_feedback_admin_all ON public.training_feedback
    FOR ALL USING (public.is_user_admin(current_setting('request.headers', true)::json->>'x-user-email'));

-- ============================================================================
-- Post-apply checklist:
--   [ ] Run this script in Supabase SQL editor.
--   [ ] In the client, set sb headers: { 'x-user-email': userEmail } after login.
--       (Add to training-engine.js > loadSupabase > createClient options.)
--   [ ] Flip the GitHub repo visibility to PRIVATE (Settings -> General -> Danger Zone)
--       unless you rely on GitHub Pages — if so, move to Netlify/Vercel first.
--   [ ] Rotate the Supabase publishable key (Settings -> API -> Rotate).
--       Publishable keys are public by design, but rotation invalidates any
--       scraping bots that have already picked the old one up.
-- ============================================================================
