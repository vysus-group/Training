/**
 * Vysus Grid Connection Training Platform — Engine
 * Gamification, scoring, persistence, time tracking, leaderboard
 * localStorage-first with Supabase sync for shared leaderboard/admin
 */
const TrainingEngine = (() => {
    'use strict';

    // ── Configuration ──────────────────────────────────────────────
    const CONFIG = {
        STORAGE_KEY: 'vysus_training',
        ADMIN_EMAILS: ['chris.marinelli@vysusgroup.com'],
        DOMAIN: '@vysusgroup.com',
        PASS_THRESHOLD: 0.7,
        SUPABASE_URL: 'https://ekytcurxudovqqvabmyp.supabase.co',
        SUPABASE_KEY: 'sb_publishable_QHn_8yCwCGLaimiqoJk95A_Fhd55iP0',
        FORMATIVE_XP: 10,
        FEEDBACK_XP: 25,
        STREAK_7_XP: 200,
        STREAK_30_XP: 1000,
        PERFECT_BONUS_MULT: 1.5
    };

    // ── Supabase Client (loaded dynamically) ───────────────────────
    let _sb = null;
    function loadSupabase() {
        return new Promise((resolve) => {
            if (_sb) { resolve(_sb); return; }
            if (window.supabase?.createClient) {
                _sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                resolve(_sb);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@supabase/supabase-js@2';
            script.onload = () => {
                try {
                    _sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                    resolve(_sb);
                } catch { resolve(null); }
            };
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
        });
    }

    // ── Level Definitions ──────────────────────────────────────────
    const LEVELS = [
        { name: 'Apprentice',        threshold: 0,     icon: '🔌', color: '#485559' },
        { name: 'Technician',        threshold: 500,   icon: '🔧', color: '#4b81ef' },
        { name: 'Power Analyst',     threshold: 1500,  icon: '📊', color: '#00E3A9' },
        { name: 'Grid Specialist',   threshold: 3000,  icon: '⚡', color: '#005454' },
        { name: 'Systems Expert',    threshold: 5500,  icon: '🔬', color: '#8e329c' },
        { name: 'Grid Architect',    threshold: 9000,  icon: '🏗️', color: '#f188f4' },
        { name: 'Principal Fellow',  threshold: 13000, icon: '🎓', color: '#f92d63' },
        { name: 'Grid Master',       threshold: 18000, icon: '👑', color: '#FFD700' }
    ];

    // ── Badge Definitions ──────────────────────────────────────────
    const BADGES = {
        first_steps:      { name: 'First Steps',       icon: '👣', desc: 'Complete your first module' },
        quick_learner:    { name: 'Quick Learner',      icon: '⚡', desc: 'Complete a module in under 30 minutes' },
        perfect_score:    { name: 'Perfect Score',      icon: '💯', desc: 'Score 100% on any assessment' },
        streak_7:         { name: 'Weekly Warrior',     icon: '🔥', desc: 'Maintain a 7-day streak' },
        streak_30:        { name: 'Monthly Master',     icon: '🌟', desc: 'Maintain a 30-day streak' },
        entry_master:     { name: 'Entry Master',       icon: '🟢', desc: 'Complete all Entry Level modules' },
        senior_scholar:   { name: 'Senior Scholar',     icon: '🔵', desc: 'Complete all Senior Level modules' },
        lead_authority:   { name: 'Lead Authority',     icon: '🟣', desc: 'Complete all Lead Level modules' },
        principal_lum:    { name: 'Principal Luminary',  icon: '🔴', desc: 'Complete all Principal Level modules' },
        feedback_champ:   { name: 'Feedback Champion',  icon: '💬', desc: 'Submit 10+ feedback items' },
        speed_demon:      { name: 'Speed Demon',        icon: '🏎️', desc: 'Complete 3 modules in one day' },
        night_owl:        { name: 'Night Owl',          icon: '🦉', desc: 'Complete a module after 8pm' },
        early_bird:       { name: 'Early Bird',         icon: '🐦', desc: 'Complete a module before 8am' },
        all_rounder:      { name: 'All-Rounder',        icon: '🌏', desc: 'Complete modules from all 4 levels' },
        perfectionist:    { name: 'Perfectionist',      icon: '✨', desc: 'Perfect score on 5+ modules' },
        knowledge_hunter: { name: 'Knowledge Hunter',   icon: '🎯', desc: 'Answer 50+ formative checks correctly' },
        grid_guardian:    { name: 'Grid Guardian',       icon: '🛡️', desc: 'Earn all other badges' }
    };

    // ── Module Registry ────────────────────────────────────────────
    const MODULES = {
        'ner-chapter5':       { name: 'NER Chapter 5 Introduction',         level: 'entry',     xp: 500,  order: 1,  file: 'modules/ner-chapter5/index.html' },
        'access-standards':   { name: 'Access Standards & GPS Framework',   level: 'entry',     xp: 600,  order: 2,  file: 'modules/access-standards/index.html' },
        'network-storage':    { name: 'Network Storage & SSD Workflow',     level: 'entry',     xp: 500,  order: 3,  file: 'modules/network-storage/index.html' },
        'way-of-working':     { name: 'Way of Working / WOW',              level: 'entry',     xp: 500,  order: 4,  file: 'modules/way-of-working/index.html' },
        'file-storage':       { name: 'File Storage Management',            level: 'entry',     xp: 500,  order: 5,  file: 'modules/file-storage/index.html' },
        'aemo-gps':           { name: 'AEMO GPS Document Process',          level: 'senior',    xp: 800,  order: 6,  file: 'modules/aemo-gps/index.html' },
        'gps-requirements':   { name: 'GPS Requirements Training',          level: 'senior',    xp: 900,  order: 7,  file: 'modules/gps-requirements/index.html' },
        'grid-code-hub':      { name: 'Grid Code Knowledge Hub',            level: 'senior',    xp: 800,  order: 8,  file: 'modules/grid-code-hub/index.html' },
        'dmat-ner':           { name: 'DMAT/NER Alignment Checklist',       level: 'senior',    xp: 700,  order: 9,  file: 'modules/dmat-ner/index.html' },
        'simulation':         { name: 'Simulation Assessment Guidelines',   level: 'senior',    xp: 900,  order: 10, file: 'modules/simulation/index.html' },
        'script-repo':        { name: 'Script Repository & Version Control',level: 'senior',    xp: 700,  order: 11, file: 'modules/script-repo/index.html' },
        'tech-hub':           { name: 'Technical Knowledge Hub',            level: 'senior',    xp: 800,  order: 12, file: 'modules/tech-hub/index.html' },
        'cross-platform':     { name: 'Cross-Platform Model Validation',    level: 'lead',      xp: 1000, order: 13, file: 'modules/cross-platform/index.html' },
        'auto-init':          { name: 'Automated Init Assessment',          level: 'lead',      xp: 1000, order: 14, file: 'modules/auto-init/index.html' },
        'project-mgmt':       { name: 'Project Management Template',        level: 'lead',      xp: 900,  order: 15, file: 'modules/project-mgmt/index.html' },
        'ms-project':         { name: 'MS Project Scoping Templates',       level: 'lead',      xp: 800,  order: 16, file: 'modules/ms-project/index.html' },
        'team-governance':    { name: 'Team Structure & Governance',        level: 'lead',      xp: 900,  order: 17, file: 'modules/team-governance/index.html' },
        'peace-framework':    { name: 'PEACE Framework',                    level: 'principal',  xp: 1200, order: 18, file: 'modules/peace-framework/index.html' },
        'talent-pipeline':    { name: 'Talent Pipeline / Intern Program',   level: 'principal',  xp: 1100, order: 19, file: 'modules/talent-pipeline/index.html' },
        '5.3.4A':             { name: '5.3.4A Letter',                      level: 'entry',     xp: 500,  order: 20, file: 'modules/5.3.4A Letter/index.html' },
        'data-request':       { name: 'Data Request',                       level: 'entry',     xp: 500,  order: 21, file: 'modules/Data Request/index.html' }
    };

    const LEVEL_MODULES = {
        entry:     ['ner-chapter5', 'access-standards', 'network-storage', 'way-of-working', 'file-storage', '5.3.4A', 'data-request'],
        senior:    ['aemo-gps', 'gps-requirements', 'grid-code-hub', 'dmat-ner', 'simulation', 'script-repo', 'tech-hub'],
        lead:      ['cross-platform', 'auto-init', 'project-mgmt', 'ms-project', 'team-governance'],
        principal: ['peace-framework', 'talent-pipeline']
    };

    // ── State ──────────────────────────────────────────────────────
    let _state = null;
    let _timeTracker = { section: null, started: null, elapsed: 0, paused: false };
    let _visibilityHandler = null;

    // ── Storage Layer ──────────────────────────────────────────────
    const Storage = {
        load() {
            try {
                const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch { return null; }
        },

        save(state) {
            try {
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state));
            } catch (e) {
                console.warn('Storage save failed:', e);
            }
        },

        getDefaultState(email, name) {
            return {
                user: { email, name, registered: new Date().toISOString() },
                xp: 0,
                level: 0,
                badges: [],
                streak: { current: 0, best: 0, lastActive: null, history: [] },
                modules: {},
                feedback: [],
                formativeCorrect: 0,
                formativeTotal: 0,
                settings: { notifications: true, theme: 'dark' }
            };
        },

        async syncToSupabase(state) {
            try {
                const sb = await loadSupabase();
                if (!sb) return;

                await sb.from('training_users').upsert({
                    email: state.user.email,
                    name: state.user.name,
                    xp: state.xp,
                    level: state.level,
                    badges: state.badges,
                    streak_current: state.streak.current,
                    streak_best: state.streak.best,
                    streak_last_active: state.streak.lastActive,
                    streak_history: state.streak.history,
                    formative_correct: state.formativeCorrect || 0,
                    formative_total: state.formativeTotal || 0
                }, { onConflict: 'email' });

                for (const [moduleId, mod] of Object.entries(state.modules || {})) {
                    await sb.from('training_progress').upsert({
                        email: state.user.email,
                        module_id: moduleId,
                        completed: mod.completed || false,
                        best_score: mod.bestScore || 0,
                        attempts: mod.attempts || 0,
                        current_section: mod.currentSection || 0,
                        sections_completed: mod.sectionsCompleted || [],
                        first_completed: mod.firstCompleted,
                        last_completed: mod.lastCompleted,
                        completed_at: mod.completedAt,
                        total_time: mod.totalTime || 0,
                        section_times: mod.sectionTimes || {},
                        formative_scores: mod.formativeScores || {},
                        assessment_answers: mod.assessmentAnswers || []
                    }, { onConflict: 'email,module_id' });
                }

                for (const fb of (state.feedback || [])) {
                    await sb.from('training_feedback').upsert({
                        id: fb.id,
                        email: state.user.email,
                        user_name: fb.userName || state.user.name,
                        module_id: fb.moduleId,
                        section_index: fb.sectionIndex || 0,
                        text: fb.text,
                        rating: fb.rating,
                        actioned: fb.actioned || false
                    }, { onConflict: 'id' });
                }
            } catch { /* silent — localStorage is primary */ }
        },

        async syncFromSupabase(email) {
            try {
                const sb = await loadSupabase();
                if (!sb) return null;

                const { data: user } = await sb.from('training_users')
                    .select('*').eq('email', email).single();
                if (!user) return null;

                const { data: progress } = await sb.from('training_progress')
                    .select('*').eq('email', email);
                const { data: feedback } = await sb.from('training_feedback')
                    .select('*').eq('email', email);

                const modules = {};
                (progress || []).forEach(p => {
                    modules[p.module_id] = {
                        completed: p.completed,
                        bestScore: p.best_score,
                        attempts: p.attempts,
                        currentSection: p.current_section,
                        sectionsCompleted: p.sections_completed || [],
                        firstCompleted: p.first_completed,
                        lastCompleted: p.last_completed,
                        completedAt: p.completed_at,
                        totalTime: p.total_time,
                        sectionTimes: p.section_times || {},
                        formativeScores: p.formative_scores || {},
                        assessmentAnswers: p.assessment_answers || [],
                        startedAt: p.started_at
                    };
                });

                return {
                    user: { email: user.email, name: user.name, registered: user.registered_at },
                    xp: user.xp,
                    level: user.level,
                    badges: user.badges || [],
                    streak: {
                        current: user.streak_current,
                        best: user.streak_best,
                        lastActive: user.streak_last_active,
                        history: user.streak_history || []
                    },
                    modules,
                    feedback: (feedback || []).map(f => ({
                        id: f.id, moduleId: f.module_id, sectionIndex: f.section_index,
                        text: f.text, rating: f.rating, user: f.email,
                        userName: f.user_name, timestamp: f.created_at, actioned: f.actioned
                    })),
                    formativeCorrect: user.formative_correct,
                    formativeTotal: user.formative_total
                };
            } catch { return null; }
        }
    };

    // ── User Management ────────────────────────────────────────────
    const User = {
        async login(email, name) {
            email = email.toLowerCase().trim();
            if (!email.endsWith(CONFIG.DOMAIN)) {
                return { ok: false, error: `Email must end with ${CONFIG.DOMAIN}` };
            }
            if (!name || name.trim().length < 2) {
                return { ok: false, error: 'Please enter your full name' };
            }

            let state = Storage.load();
            if (state && state.user && state.user.email === email) {
                state.user.name = name.trim();
                _state = state;
            } else {
                _state = Storage.getDefaultState(email, name.trim());
            }

            // Merge remote state (higher XP wins)
            const remote = await Storage.syncFromSupabase(email);
            if (remote && remote.xp > _state.xp) {
                remote.user.name = name.trim();
                _state = remote;
            }

            Streaks.updateLogin();
            _state._authenticated = true;
            Storage.save(_state);
            Storage.syncToSupabase(_state);
            return { ok: true, state: _state };
        },

        logout() {
            _state = null;
            try {
                const state = Storage.load();
                if (state) {
                    state._authenticated = false;
                    Storage.save(state);
                }
            } catch {}
        },

        current() {
            if (_state) return _state;
            _state = Storage.load();
            return _state;
        },

        isAdmin() {
            return _state && CONFIG.ADMIN_EMAILS.includes(_state.user.email);
        },

        isLoggedIn() {
            return !!User.current();
        }
    };

    // ── Auth (Password via Supabase RPC) ─────────────────────────
    const Auth = {
        async verifyPassword(email, hash) {
            try {
                const sb = await loadSupabase();
                if (!sb) return null; // null = server unavailable
                const { data, error } = await sb.rpc('verify_password', {
                    p_email: email.toLowerCase().trim(),
                    p_hash: hash
                });
                if (error) { console.error('verify_password error:', error); return null; }
                return data === true;
            } catch { return null; }
        },

        async registerPassword(email, hash) {
            email = email.toLowerCase().trim();
            if (!email.endsWith(CONFIG.DOMAIN)) {
                return { ok: false, error: `Email must end with ${CONFIG.DOMAIN}` };
            }
            try {
                const sb = await loadSupabase();
                if (!sb) return { ok: false, error: 'Could not connect to server.' };

                // Check if user already has a password
                const { data: existing } = await sb.rpc('check_user_exists', { p_email: email });
                if (existing) {
                    return { ok: false, error: 'Account already exists. Please sign in.' };
                }

                const { error } = await sb.rpc('register_password', {
                    p_email: email,
                    p_hash: hash
                });
                if (error) {
                    console.error('register_password error:', error);
                    return { ok: false, error: 'Registration failed. Please try again.' };
                }
                return { ok: true };
            } catch (err) {
                console.error('Registration error:', err);
                return { ok: false, error: 'Registration failed.' };
            }
        }
    };

    // ── XP & Leveling ──────────────────────────────────────────────
    const XP = {
        award(amount, reason) {
            if (!_state || amount <= 0) return;
            _state.xp += amount;
            const newLevel = XP.calculateLevel(_state.xp);
            const leveledUp = newLevel > _state.level;
            _state.level = newLevel;
            Storage.save(_state);
            Storage.syncToSupabase(_state);

            return { xp: amount, totalXp: _state.xp, level: LEVELS[newLevel], leveledUp, reason };
        },

        calculateLevel(xp) {
            let lvl = 0;
            for (let i = LEVELS.length - 1; i >= 0; i--) {
                if (xp >= LEVELS[i].threshold) { lvl = i; break; }
            }
            return lvl;
        },

        currentLevel() {
            return LEVELS[_state ? _state.level : 0];
        },

        nextLevel() {
            if (!_state) return LEVELS[1];
            const next = _state.level + 1;
            return next < LEVELS.length ? LEVELS[next] : null;
        },

        progressToNext() {
            if (!_state) return 0;
            const current = LEVELS[_state.level].threshold;
            const next = _state.level + 1 < LEVELS.length ? LEVELS[_state.level + 1].threshold : current;
            if (next === current) return 1;
            return (_state.xp - current) / (next - current);
        },

        total() {
            return _state ? _state.xp : 0;
        }
    };

    // ── Badge System ───────────────────────────────────────────────
    const BadgeSystem = {
        award(badgeId) {
            if (!_state || !BADGES[badgeId]) return null;
            if (_state.badges.includes(badgeId)) return null;
            _state.badges.push(badgeId);
            Storage.save(_state);
            return BADGES[badgeId];
        },

        has(badgeId) {
            return _state && _state.badges.includes(badgeId);
        },

        earned() {
            if (!_state) return [];
            return _state.badges.map(id => ({ id, ...BADGES[id] }));
        },

        all() {
            return Object.entries(BADGES).map(([id, b]) => ({
                id, ...b,
                earned: _state ? _state.badges.includes(id) : false
            }));
        },

        checkAndAward() {
            if (!_state) return [];
            const awarded = [];

            const completedModules = Object.entries(_state.modules)
                .filter(([_, m]) => m.completed);
            const completedIds = completedModules.map(([id]) => id);

            // First Steps
            if (completedModules.length >= 1) {
                const b = BadgeSystem.award('first_steps');
                if (b) awarded.push(b);
            }

            // Quick Learner (any module < 30 min)
            if (completedModules.some(([_, m]) => m.totalTime && m.totalTime < 1800)) {
                const b = BadgeSystem.award('quick_learner');
                if (b) awarded.push(b);
            }

            // Perfect Score
            if (completedModules.some(([_, m]) => m.bestScore === 100)) {
                const b = BadgeSystem.award('perfect_score');
                if (b) awarded.push(b);
            }

            // Perfectionist (5+ perfect)
            if (completedModules.filter(([_, m]) => m.bestScore === 100).length >= 5) {
                const b = BadgeSystem.award('perfectionist');
                if (b) awarded.push(b);
            }

            // Streaks
            if (_state.streak.current >= 7) {
                const b = BadgeSystem.award('streak_7');
                if (b) awarded.push(b);
            }
            if (_state.streak.current >= 30) {
                const b = BadgeSystem.award('streak_30');
                if (b) awarded.push(b);
            }

            // Level completion badges
            const checkLevel = (level, badge) => {
                if (LEVEL_MODULES[level].every(id => completedIds.includes(id))) {
                    const b = BadgeSystem.award(badge);
                    if (b) awarded.push(b);
                }
            };
            checkLevel('entry', 'entry_master');
            checkLevel('senior', 'senior_scholar');
            checkLevel('lead', 'lead_authority');
            checkLevel('principal', 'principal_lum');

            // All-Rounder (module from each level)
            const levelsCovered = new Set(completedIds.map(id => MODULES[id]?.level).filter(Boolean));
            if (levelsCovered.size >= 4) {
                const b = BadgeSystem.award('all_rounder');
                if (b) awarded.push(b);
            }

            // Feedback Champion
            if (_state.feedback.length >= 10) {
                const b = BadgeSystem.award('feedback_champ');
                if (b) awarded.push(b);
            }

            // Knowledge Hunter
            if (_state.formativeCorrect >= 50) {
                const b = BadgeSystem.award('knowledge_hunter');
                if (b) awarded.push(b);
            }

            // Speed Demon (3 completions same day)
            const completionDates = completedModules
                .map(([_, m]) => m.completedAt ? m.completedAt.substring(0, 10) : null)
                .filter(Boolean);
            const dateCounts = {};
            completionDates.forEach(d => dateCounts[d] = (dateCounts[d] || 0) + 1);
            if (Object.values(dateCounts).some(c => c >= 3)) {
                const b = BadgeSystem.award('speed_demon');
                if (b) awarded.push(b);
            }

            // Time-based badges
            const lastCompletion = completedModules
                .map(([_, m]) => m.completedAt)
                .filter(Boolean).sort().pop();
            if (lastCompletion) {
                const hour = new Date(lastCompletion).getHours();
                if (hour >= 20 || hour < 5) {
                    const b = BadgeSystem.award('night_owl');
                    if (b) awarded.push(b);
                }
                if (hour >= 5 && hour < 8) {
                    const b = BadgeSystem.award('early_bird');
                    if (b) awarded.push(b);
                }
            }

            // Grid Guardian (all other badges)
            const allOther = Object.keys(BADGES).filter(id => id !== 'grid_guardian');
            if (allOther.every(id => _state.badges.includes(id))) {
                const b = BadgeSystem.award('grid_guardian');
                if (b) awarded.push(b);
            }

            return awarded;
        }
    };

    // ── Streak Tracking ────────────────────────────────────────────
    const Streaks = {
        updateLogin() {
            if (!_state) return;
            const today = new Date().toISOString().substring(0, 10);
            const last = _state.streak.lastActive;

            if (last === today) return; // Already logged today

            if (last) {
                const lastDate = new Date(last);
                const todayDate = new Date(today);
                const diffDays = Math.floor((todayDate - lastDate) / 86400000);

                if (diffDays === 1) {
                    _state.streak.current++;
                } else if (diffDays > 1) {
                    _state.streak.current = 1;
                }
            } else {
                _state.streak.current = 1;
            }

            _state.streak.best = Math.max(_state.streak.best, _state.streak.current);
            _state.streak.lastActive = today;

            if (!_state.streak.history.includes(today)) {
                _state.streak.history.push(today);
                // Keep last 90 days
                if (_state.streak.history.length > 90) {
                    _state.streak.history = _state.streak.history.slice(-90);
                }
            }

            // Streak XP bonuses
            if (_state.streak.current === 7) XP.award(CONFIG.STREAK_7_XP, '7-day streak bonus');
            if (_state.streak.current === 30) XP.award(CONFIG.STREAK_30_XP, '30-day streak bonus');
        },

        current() {
            return _state ? _state.streak.current : 0;
        },

        best() {
            return _state ? _state.streak.best : 0;
        },

        history() {
            return _state ? _state.streak.history : [];
        }
    };

    // ── Module Tracking ────────────────────────────────────────────
    const Modules = {
        getProgress(moduleId) {
            if (!_state || !_state.modules[moduleId]) {
                return {
                    completed: false, bestScore: 0, attempts: 0,
                    currentSection: 0, sectionsCompleted: [],
                    firstCompleted: null, lastCompleted: null,
                    totalTime: 0, sectionTimes: {},
                    formativeScores: {}, assessmentAnswers: []
                };
            }
            return _state.modules[moduleId];
        },

        startModule(moduleId) {
            if (!_state) return;
            if (!_state.modules[moduleId]) {
                _state.modules[moduleId] = {
                    completed: false, bestScore: 0, attempts: 0,
                    currentSection: 0, sectionsCompleted: [],
                    firstCompleted: null, lastCompleted: null, completedAt: null,
                    totalTime: 0, sectionTimes: {},
                    formativeScores: {}, assessmentAnswers: [],
                    startedAt: new Date().toISOString()
                };
            }
            Storage.save(_state);
        },

        completeSection(moduleId, sectionIndex) {
            if (!_state) return;
            Modules.startModule(moduleId);
            const mod = _state.modules[moduleId];
            if (!mod.sectionsCompleted.includes(sectionIndex)) {
                mod.sectionsCompleted.push(sectionIndex);
            }
            mod.currentSection = Math.max(mod.currentSection, sectionIndex + 1);
            Storage.save(_state);
        },

        recordFormative(moduleId, sectionIndex, checkIndex, correct) {
            if (!_state) return;
            Modules.startModule(moduleId);
            const key = `s${sectionIndex}_c${checkIndex}`;
            _state.modules[moduleId].formativeScores[key] = correct;

            if (correct) {
                _state.formativeCorrect = (_state.formativeCorrect || 0) + 1;
                XP.award(CONFIG.FORMATIVE_XP, 'Formative check correct');
            }
            _state.formativeTotal = (_state.formativeTotal || 0) + 1;
            Storage.save(_state);
        },

        completeAssessment(moduleId, score, answers) {
            if (!_state || !MODULES[moduleId]) return null;
            Modules.startModule(moduleId);
            const mod = _state.modules[moduleId];
            const moduleDef = MODULES[moduleId];

            mod.attempts++;
            mod.assessmentAnswers = answers;
            const passed = score >= CONFIG.PASS_THRESHOLD * 100;
            const scorePercent = Math.round(score);

            if (passed && scorePercent > mod.bestScore) {
                mod.bestScore = scorePercent;
            }

            if (passed && !mod.completed) {
                mod.completed = true;
                mod.completedAt = new Date().toISOString();
                if (!mod.firstCompleted) mod.firstCompleted = mod.completedAt;
                mod.lastCompleted = mod.completedAt;

                // Award module XP
                let xpAmount = moduleDef.xp;
                if (scorePercent === 100) {
                    xpAmount = Math.round(xpAmount * CONFIG.PERFECT_BONUS_MULT);
                }
                const xpResult = XP.award(xpAmount, `Completed ${moduleDef.name}`);

                // Check for new badges
                const newBadges = BadgeSystem.checkAndAward();

                Storage.save(_state);
                Storage.syncToSupabase(_state);

                return {
                    passed: true,
                    score: scorePercent,
                    xpAwarded: xpResult,
                    newBadges,
                    firstCompletion: mod.attempts === 1
                };
            }

            Storage.save(_state);
            return { passed, score: scorePercent, xpAwarded: null, newBadges: [], firstCompletion: false };
        },

        isCompleted(moduleId) {
            return _state?.modules[moduleId]?.completed || false;
        },

        allCompleted() {
            if (!_state) return [];
            return Object.entries(_state.modules)
                .filter(([_, m]) => m.completed)
                .map(([id]) => id);
        },

        completionCount() {
            return Modules.allCompleted().length;
        },

        totalModules() {
            return Object.keys(MODULES).length;
        },

        registry() {
            return { ...MODULES };
        },

        getLevelModules(level) {
            return LEVEL_MODULES[level] || [];
        }
    };

    // ── Time Tracking ──────────────────────────────────────────────
    const TimeTracker = {
        startSection(moduleId, sectionIndex) {
            _timeTracker = {
                module: moduleId,
                section: sectionIndex,
                started: Date.now(),
                elapsed: 0,
                paused: false
            };
            TimeTracker._bindVisibility();
        },

        stopSection() {
            if (!_timeTracker.started) return 0;
            const elapsed = _timeTracker.elapsed + (
                _timeTracker.paused ? 0 : (Date.now() - _timeTracker.started)
            );
            const seconds = Math.round(elapsed / 1000);

            // Save to module state
            if (_state && _timeTracker.module) {
                Modules.startModule(_timeTracker.module);
                const mod = _state.modules[_timeTracker.module];
                const key = `section_${_timeTracker.section}`;
                mod.sectionTimes[key] = (mod.sectionTimes[key] || 0) + seconds;
                mod.totalTime = Object.values(mod.sectionTimes).reduce((a, b) => a + b, 0);
                Storage.save(_state);
            }

            _timeTracker = { section: null, started: null, elapsed: 0, paused: false };
            return seconds;
        },

        _bindVisibility() {
            if (_visibilityHandler) return;
            _visibilityHandler = () => {
                if (document.hidden) {
                    // Pause — accumulate elapsed so far
                    if (_timeTracker.started && !_timeTracker.paused) {
                        _timeTracker.elapsed += Date.now() - _timeTracker.started;
                        _timeTracker.paused = true;
                    }
                } else {
                    // Resume
                    if (_timeTracker.paused) {
                        _timeTracker.started = Date.now();
                        _timeTracker.paused = false;
                    }
                }
            };
            document.addEventListener('visibilitychange', _visibilityHandler);
        },

        getElapsed() {
            if (!_timeTracker.started) return 0;
            const extra = _timeTracker.paused ? 0 : (Date.now() - _timeTracker.started);
            return Math.round((_timeTracker.elapsed + extra) / 1000);
        },

        formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m}m ${s < 10 ? '0' : ''}${s}s`;
        }
    };

    // ── Feedback ───────────────────────────────────────────────────
    const Feedback = {
        submit(moduleId, sectionIndex, text, rating) {
            if (!_state || !text.trim()) return;
            const entry = {
                id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                moduleId,
                sectionIndex,
                text: text.trim(),
                rating, // 1-5 stars
                user: _state.user.email,
                userName: _state.user.name,
                timestamp: new Date().toISOString(),
                actioned: false
            };
            _state.feedback.push(entry);
            XP.award(CONFIG.FEEDBACK_XP, 'Feedback submitted');
            BadgeSystem.checkAndAward();
            Storage.save(_state);
            Storage.syncToSupabase(_state);
            return entry;
        },

        getForModule(moduleId) {
            if (!_state) return [];
            return _state.feedback.filter(f => f.moduleId === moduleId);
        },

        all() {
            return _state ? _state.feedback : [];
        }
    };

    // ── Leaderboard ────────────────────────────────────────────────
    const Leaderboard = {
        async getEntries() {
            // Try Supabase for multi-user leaderboard
            try {
                const sb = await loadSupabase();
                if (sb) {
                    const { data } = await sb.from('training_users')
                        .select('email, name, xp, level, badges, streak_current')
                        .order('xp', { ascending: false });

                    if (data && data.length) {
                        const { data: progress } = await sb.from('training_progress')
                            .select('email, completed').eq('completed', true);
                        const counts = {};
                        (progress || []).forEach(p => counts[p.email] = (counts[p.email] || 0) + 1);

                        return data.map(u => ({
                            name: u.name, email: u.email, xp: u.xp || 0,
                            level: LEVELS[u.level || 0], levelIndex: u.level || 0,
                            badges: (u.badges || []).length,
                            completedModules: counts[u.email] || 0,
                            streak: u.streak_current || 0
                        }));
                    }
                }
            } catch { /* fall through to local */ }

            // Fallback: current user only
            if (!_state) return [];
            return [{
                name: _state.user.name, email: _state.user.email,
                xp: _state.xp, level: LEVELS[_state.level], levelIndex: _state.level,
                badges: _state.badges.length, completedModules: Modules.completionCount(),
                streak: _state.streak.current
            }];
        }
    };

    // ── Admin Data Export ───────────────────────────────────────────
    const Admin = {
        isAdmin() {
            return User.isAdmin();
        },

        async getAllUserData() {
            // Try Supabase first for cross-user admin visibility
            try {
                const sb = await loadSupabase();
                if (sb) {
                    const { data: users } = await sb.from('training_users').select('*');
                    const { data: allProgress } = await sb.from('training_progress').select('*');
                    const { data: allFeedback } = await sb.from('training_feedback').select('*');

                    if (users && users.length) {
                        return users.map(u => {
                            const modules = {};
                            (allProgress || []).filter(p => p.email === u.email).forEach(p => {
                                modules[p.module_id] = {
                                    completed: p.completed, bestScore: p.best_score,
                                    attempts: p.attempts, currentSection: p.current_section,
                                    sectionsCompleted: p.sections_completed || [],
                                    firstCompleted: p.first_completed, lastCompleted: p.last_completed,
                                    completedAt: p.completed_at, totalTime: p.total_time,
                                    sectionTimes: p.section_times || {},
                                    formativeScores: p.formative_scores || {},
                                    assessmentAnswers: p.assessment_answers || [],
                                    startedAt: p.started_at
                                };
                            });
                            const feedback = (allFeedback || []).filter(f => f.email === u.email).map(f => ({
                                id: f.id, moduleId: f.module_id, sectionIndex: f.section_index,
                                text: f.text, rating: f.rating, user: f.email,
                                userName: f.user_name, timestamp: f.created_at, actioned: f.actioned
                            }));
                            return {
                                user: { email: u.email, name: u.name, registered: u.registered_at },
                                xp: u.xp, level: u.level, badges: u.badges || [],
                                streak: { current: u.streak_current, best: u.streak_best,
                                    lastActive: u.streak_last_active, history: u.streak_history || [] },
                                modules, feedback,
                                formativeCorrect: u.formative_correct, formativeTotal: u.formative_total
                            };
                        });
                    }
                }
            } catch { /* fall through to local */ }

            // Fallback: current user only
            return _state ? [_state] : [];
        },

        async getCompletionMatrix() {
            const users = await Admin.getAllUserData();
            const moduleIds = Object.keys(MODULES);
            return users.map(u => {
                const row = { name: u.user.name, email: u.user.email, xp: u.xp, level: LEVELS[u.level]?.name };
                moduleIds.forEach(id => {
                    const mod = u.modules?.[id];
                    row[id] = mod?.completed ? mod.bestScore : (mod?.attempts > 0 ? 'in-progress' : null);
                });
                return row;
            });
        },

        async exportCSV() {
            const matrix = await Admin.getCompletionMatrix();
            if (!matrix.length) return '';
            const headers = Object.keys(matrix[0]);
            const rows = matrix.map(row => headers.map(h => {
                const val = row[h];
                return typeof val === 'string' && val.includes(',') ? `"${val}"` : (val ?? '');
            }).join(','));
            return [headers.join(','), ...rows].join('\n');
        },

        async exportJSON() {
            return JSON.stringify(await Admin.getAllUserData(), null, 2);
        },

        async getAllFeedback() {
            // Try Supabase directly for all feedback
            try {
                const sb = await loadSupabase();
                if (sb) {
                    const { data } = await sb.from('training_feedback')
                        .select('*').order('created_at', { ascending: false });
                    if (data) {
                        return data.map(f => ({
                            id: f.id, moduleId: f.module_id, sectionIndex: f.section_index,
                            text: f.text, rating: f.rating, user: f.email,
                            userName: f.user_name, timestamp: f.created_at, actioned: f.actioned,
                            moduleName: MODULES[f.module_id]?.name || f.module_id
                        }));
                    }
                }
            } catch { /* fall through */ }
            const users = await Admin.getAllUserData();
            return users.flatMap(u => (u.feedback || []).map(f => ({
                ...f, moduleName: MODULES[f.moduleId]?.name || f.moduleId
            }))).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        },

        async getScoreAnalytics() {
            const users = await Admin.getAllUserData();
            const moduleIds = Object.keys(MODULES);
            return moduleIds.map(id => {
                const scores = users
                    .map(u => u.modules?.[id])
                    .filter(m => m?.completed)
                    .map(m => m.bestScore);
                return {
                    moduleId: id, moduleName: MODULES[id].name, level: MODULES[id].level,
                    completions: scores.length,
                    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
                    minScore: scores.length ? Math.min(...scores) : 0,
                    maxScore: scores.length ? Math.max(...scores) : 0,
                    attempts: users.reduce((sum, u) => sum + (u.modules?.[id]?.attempts || 0), 0)
                };
            });
        },

        async getTimeAnalytics() {
            const users = await Admin.getAllUserData();
            const moduleIds = Object.keys(MODULES);
            return moduleIds.map(id => {
                const times = users
                    .map(u => u.modules?.[id])
                    .filter(m => m?.totalTime > 0)
                    .map(m => m.totalTime);
                return {
                    moduleId: id, moduleName: MODULES[id].name,
                    sessions: times.length,
                    avgTime: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
                    minTime: times.length ? Math.min(...times) : 0,
                    maxTime: times.length ? Math.max(...times) : 0
                };
            });
        }
    };

    // ── UI Helpers ─────────────────────────────────────────────────
    const UI = {
        renderXPBar(container) {
            if (!_state || !container) return;
            const progress = XP.progressToNext();
            const level = XP.currentLevel();
            const next = XP.nextLevel();

            container.innerHTML = `
                <div class="xp-bar-wrapper">
                    <div class="xp-bar-label">
                        <span class="xp-level">${level.icon} ${level.name}</span>
                        <span class="xp-amount">${_state.xp.toLocaleString()} XP</span>
                    </div>
                    <div class="xp-bar-track">
                        <div class="xp-bar-fill" style="width:${Math.round(progress * 100)}%;background:${level.color}"></div>
                    </div>
                    ${next ? `<div class="xp-bar-next">Next: ${next.icon} ${next.name} (${next.threshold.toLocaleString()} XP)</div>` : '<div class="xp-bar-next">Maximum level reached!</div>'}
                </div>
            `;
        },

        renderBadgeGrid(container, earnedOnly = false) {
            if (!container) return;
            const badges = earnedOnly ? BadgeSystem.earned() : BadgeSystem.all();
            container.innerHTML = badges.map(b => `
                <div class="badge-item ${b.earned !== false ? 'earned' : 'locked'}" title="${b.desc}">
                    <span class="badge-icon">${b.icon}</span>
                    <span class="badge-name">${b.name}</span>
                </div>
            `).join('');
        },

        renderStreakCalendar(container) {
            if (!container || !_state) return;
            const history = _state.streak.history;
            const today = new Date();
            const cells = [];

            for (let i = 29; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().substring(0, 10);
                const active = history.includes(dateStr);
                const dayLabel = d.toLocaleDateString('en', { weekday: 'short' }).charAt(0);
                cells.push(`<div class="streak-cell ${active ? 'active' : ''}" title="${dateStr}">${dayLabel}</div>`);
            }

            container.innerHTML = `
                <div class="streak-header">
                    <span class="streak-fire">🔥 ${_state.streak.current}-day streak</span>
                    <span class="streak-best">Best: ${_state.streak.best} days</span>
                </div>
                <div class="streak-grid">${cells.join('')}</div>
            `;
        },

        showNotification(message, type = 'success', duration = 4000) {
            const existing = document.querySelector('.te-notification');
            if (existing) existing.remove();

            const colors = {
                success: '#00E3A9', warning: '#FFB800', error: '#f92d63',
                xp: '#4b81ef', badge: '#f188f4', level: '#FFD700'
            };

            const div = document.createElement('div');
            div.className = 'te-notification';
            div.style.cssText = `
                position:fixed;top:20px;right:20px;z-index:99999;
                background:rgba(26,39,68,0.95);backdrop-filter:blur(20px);
                border:1px solid ${colors[type] || colors.success};
                border-radius:16px;padding:16px 24px;color:white;
                font-family:Inter,sans-serif;font-size:14px;font-weight:600;
                box-shadow:0 8px 32px rgba(0,0,0,0.4);
                animation:slideInRight 0.4s ease;max-width:400px;
            `;
            div.textContent = message;
            document.body.appendChild(div);

            if (!document.querySelector('#te-notification-style')) {
                const style = document.createElement('style');
                style.id = 'te-notification-style';
                style.textContent = `
                    @keyframes slideInRight { from { transform:translateX(100px);opacity:0 } to { transform:translateX(0);opacity:1 } }
                    @keyframes slideOutRight { from { transform:translateX(0);opacity:1 } to { transform:translateX(100px);opacity:0 } }
                `;
                document.head.appendChild(style);
            }

            setTimeout(() => {
                div.style.animation = 'slideOutRight 0.4s ease forwards';
                setTimeout(() => div.remove(), 400);
            }, duration);
        },

        showXPGain(amount, reason) {
            UI.showNotification(`+${amount} XP — ${reason}`, 'xp');
        },

        showBadgeEarned(badge) {
            UI.showNotification(`${badge.icon} Badge Earned: ${badge.name}`, 'badge', 6000);
        },

        showLevelUp(level) {
            UI.showNotification(`${level.icon} Level Up! You are now a ${level.name}`, 'level', 8000);
        }
    };

    // ── Public API ─────────────────────────────────────────────────
    return {
        CONFIG, LEVELS, BADGES, MODULES, LEVEL_MODULES,
        User, Auth, XP, Badges: BadgeSystem, Streaks, Modules,
        TimeTracker, Feedback, Leaderboard, Admin, UI, Storage,

        init() {
            _state = Storage.load();
            loadSupabase(); // preload in background
            return _state;
        },

        getState() {
            return _state;
        }
    };
})();
