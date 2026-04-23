/**
 * Vysus Auth Debug Panel
 * Floating bottom-right overlay that mirrors all DEBUG.log output + auth events.
 * Enable with:
 *   ?debug=1 on the URL
 *   localStorage.setItem('vysus_debug', '1')
 *   window.VYSUS_DEBUG = true  (before this script loads)
 */
(() => {
    'use strict';

    function enabled() {
        try {
            if (window.VYSUS_DEBUG === true) return true;
            if (new URLSearchParams(location.search).get('debug') === '1') return true;
            if (localStorage.getItem('vysus_debug') === '1') return true;
        } catch {}
        return false;
    }
    if (!enabled()) return;

    // Persist the flag so it survives redirects within the auth flow.
    try { localStorage.setItem('vysus_debug', '1'); } catch {}

    const panel = document.createElement('div');
    panel.id = 'vysus-debug-panel';
    panel.innerHTML = `
        <style>
            #vysus-debug-panel {
                position: fixed; bottom: 12px; right: 12px;
                width: 460px; max-width: calc(100vw - 24px);
                max-height: 50vh;
                background: rgba(0,0,0,0.92); color: #00E3A9;
                font-family: 'Consolas', 'Menlo', monospace; font-size: 11px; line-height: 1.4;
                border: 1px solid #00E3A9; border-radius: 8px;
                z-index: 99999; display: flex; flex-direction: column;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            }
            #vysus-debug-panel .dbg-hdr {
                display: flex; justify-content: space-between; align-items: center;
                padding: 6px 10px; border-bottom: 1px solid rgba(0,227,169,0.3);
                background: rgba(0,227,169,0.1); font-weight: 700; cursor: move;
            }
            #vysus-debug-panel .dbg-hdr button {
                background: transparent; border: 1px solid #00E3A9; color: #00E3A9;
                font-family: inherit; font-size: 10px; padding: 2px 8px; margin-left: 4px;
                border-radius: 4px; cursor: pointer;
            }
            #vysus-debug-panel .dbg-hdr button:hover { background: rgba(0,227,169,0.2); }
            #vysus-debug-panel .dbg-log {
                flex: 1; overflow-y: auto; padding: 6px 10px; white-space: pre-wrap; word-break: break-word;
            }
            #vysus-debug-panel .dbg-entry { border-bottom: 1px dashed rgba(0,227,169,0.15); padding: 3px 0; }
            #vysus-debug-panel .dbg-entry.warn { color: #ffb020; }
            #vysus-debug-panel .dbg-entry.err  { color: #ff4d6d; }
            #vysus-debug-panel .dbg-scope { color: #fff; }
            #vysus-debug-panel .dbg-ts { color: #888; }
            #vysus-debug-panel.collapsed .dbg-log { display: none; }
            #vysus-debug-panel.collapsed { width: 220px; }
        </style>
        <div class="dbg-hdr">
            <span>🐛 Vysus Auth Debug</span>
            <span>
                <button id="dbg-clear">clear</button>
                <button id="dbg-copy">copy</button>
                <button id="dbg-off">off</button>
                <button id="dbg-toggle">—</button>
            </span>
        </div>
        <div class="dbg-log" id="dbg-log"></div>
    `;
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel));
    if (document.body) document.body.appendChild(panel);

    function render() {
        const logEl = document.getElementById('dbg-log');
        if (!logEl) return;
        const entries = (window.vysusDebug && window.vysusDebug.dump && window.vysusDebug.dump()) || [];
        logEl.innerHTML = entries.slice(-200).map(e => {
            const cls = e.msg.startsWith('ERROR') ? 'err' : e.msg.startsWith('WARN') ? 'warn' : '';
            const data = e.data && Object.keys(e.data).length ? ' ' + JSON.stringify(e.data) : '';
            return `<div class="dbg-entry ${cls}"><span class="dbg-ts">${e.ts.slice(11,19)}</span> <span class="dbg-scope">[${e.scope}]</span> ${escapeHtml(e.msg)}${escapeHtml(data)}</div>`;
        }).join('');
        logEl.scrollTop = logEl.scrollHeight;
    }
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

    // Poll for new entries (cheap, debug-only)
    setInterval(render, 500);

    document.addEventListener('click', (e) => {
        if (e.target.id === 'dbg-clear') { window.vysusDebug?.clear(); render(); }
        if (e.target.id === 'dbg-copy') {
            const entries = window.vysusDebug?.dump() || [];
            navigator.clipboard.writeText(JSON.stringify(entries, null, 2)).then(() => {
                e.target.textContent = 'copied!';
                setTimeout(() => e.target.textContent = 'copy', 1200);
            });
        }
        if (e.target.id === 'dbg-off') {
            localStorage.removeItem('vysus_debug');
            panel.remove();
            location.reload();
        }
        if (e.target.id === 'dbg-toggle') {
            panel.classList.toggle('collapsed');
            e.target.textContent = panel.classList.contains('collapsed') ? '+' : '—';
        }
    });

    // Intercept fetch / console.error so page-level code shows up in the panel too.
    const origErr = console.error.bind(console);
    console.error = function(...args) {
        try { window.vysusDebug?.log('console', 'error: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')); } catch {}
        origErr(...args);
    };

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (e) => {
        window.vysusDebug?.error('window', 'unhandled rejection', e.reason);
    });
    window.addEventListener('error', (e) => {
        window.vysusDebug?.error('window', 'error: ' + e.message, { file: e.filename, line: e.lineno });
    });

    console.info('%c[Vysus] Auth debug panel loaded. Click "off" to disable.', 'color:#00E3A9');
})();
