/* Project data is fetched with HTTP-only app sessions; no identity or project is taken from localStorage. */
(() => {
  const signature = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))) : item);
  const revisions = new Map(), baselines = new Map(), pending = new Map();
  let saving = null, failure = null;
  async function request(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(20000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || 'The project service is unavailable.'), { status: response.status });
    return data;
  }
  function status(text) { const el = document.querySelector('#project-save-status'); if (el) el.textContent = text; }
  async function drain() {
    while (pending.size) {
      const [id, data] = pending.entries().next().value;
      pending.delete(id);
      status('Saving…');
      try {
        const result = await request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify({ revision: revisions.get(id), data }) });
        revisions.set(id, result.revision); baselines.set(id, signature(data));
      } catch (err) { failure = err; pending.clear(); status('Not saved · reload required'); window.dispatchEvent(new CustomEvent('techmemo:save-error', { detail: err.message })); throw err; }
    }
    status('Saved');
  }
  function save(id, data) {
    if (failure) { status('Not saved · reload required'); return; }
    if (signature(data) === baselines.get(id) && !pending.has(id)) return;
    pending.set(id, structuredClone(data));
    if (!saving) {
      saving = drain().catch(() => {}).finally(() => { saving = null; });
    }
  }
  async function flush() { if (saving) await saving; if (failure) throw failure; }
  window.TechMemoProjects = {
    request, save, flush,
    get status() { return failure ? 'Not saved · reload required' : saving ? 'Saving…' : 'Saved'; },
    async load() {
      await flush();
      const result = await request('/api/projects');
      for (const p of result.projects) { revisions.set(p.id, p.revision); baselines.set(p.id, signature(p.data)); }
      return result.projects;
    },
    async create(fields) { await flush(); return request('/api/projects', { method: 'POST', body: JSON.stringify(fields) }); },
    async invite(id, email) { await flush(); return request(`/api/projects/${id}/invites`, { method: 'POST', body: JSON.stringify({ email }) }); },
    async accept(token) { return request('/api/projects/accept', { method: 'POST', body: JSON.stringify({ token }) }); }
  };
  window.addEventListener('beforeunload', event => { if (saving || failure) { event.preventDefault(); event.returnValue = ''; } });
})();
