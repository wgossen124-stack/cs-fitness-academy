// Small client for the Supabase database functions (no library needed)
(function () {
  const C = window.CONFIG || {};
  window.rpc = async function (fn, args) {
    if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) throw new Error('The academy is not connected to its database yet (config.js).');
    let r;
    try {
      r = await fetch(C.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + C.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(args || {}),
      });
    } catch (_) { throw new Error('No connection. Please check your internet and try again.'); }
    let data = null;
    const txt = await r.text();
    try { data = txt ? JSON.parse(txt) : null; } catch (_) {}
    if (!r.ok) {
      const msg = (data && (data.message || data.error)) || 'Something went wrong. Please try again.';
      const e = new Error(msg); e.code = msg; throw e;
    }
    return data;
  };
  window.store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };
  // apply branding
  document.addEventListener('DOMContentLoaded', () => { if (C.STUDIO_NAME) document.title = document.title.replace('EMS Trainer Academy', C.STUDIO_NAME + ' Coach Academy'); });
})();
