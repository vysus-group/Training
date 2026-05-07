-- Run in the Supabase SQL editor for project ekytcurxudovqqvabmyp.
-- This restores the RPC expected by TrainingEngine.Auth.resetPassword().

create or replace function public.reset_password(p_email text, p_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.user_credentials
       set password_hash = p_hash
     where email = lower(trim(p_email));

    return found;
end;
$$;

grant execute on function public.reset_password(text, text) to anon, authenticated;
