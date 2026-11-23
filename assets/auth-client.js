/* Server account controls remain separate from fictional workspace personas. */
(async () => {
  if (location.protocol === 'file:') return;
  const workspace = location.pathname.endsWith('/workspace.html');
  let session;
  try {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return;
    session = await response.json();
  } catch { return; }
  if (!session.user && !workspace) return;

  async function logout(button, status) {
    button.disabled = true;
    try {
      const result = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!result.ok) throw new Error('Sign out failed');
      location.assign('/#login');
    } catch { status.textContent = 'Could not log out. Please try again.'; button.disabled = false; }
  }
  if (workspace && session.user) {
    const user = session.user;
    const parts = (user.name || user.email).trim().split(/\s+/);
    const initials = (parts[0][0] + (parts.length > 1 ? parts.at(-1)[0] : parts[0][1] || '')).toUpperCase();
    const account = document.createElement('div');
    account.className = 'workspace-account';
    account.innerHTML = `<button type="button" class="account-trigger" aria-expanded="false" aria-controls="account-popup" aria-label="Open account menu"><span class="account-initials" aria-hidden="true"></span><span class="account-first-name"></span><span class="account-chevron" aria-hidden="true">⌃</span></button>
      <div id="account-popup" class="account-popup" hidden><div class="account-details"><strong></strong><span></span></div><div class="account-links"><button type="button" data-account="profile">Profile</button><button type="button" data-account="settings">Settings</button><a href="index.html#resources">Help</a><a href="index.html#pricing">Upgrade Plan</a></div><button type="button" class="account-logout"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M9 5H4v14h5M10 12h11m-4-4 4 4-4 4"/></svg>Log out</button><p class="account-error" role="status"></p></div>`;
    const trigger = account.querySelector('.account-trigger');
    const popup = account.querySelector('.account-popup');
    account.querySelector('.account-initials').textContent = initials;
    account.querySelector('.account-first-name').textContent = parts[0];
    account.querySelector('.account-details strong').textContent = user.name || user.email;
    account.querySelector('.account-details span').textContent = user.email;
    function close(focus = false) { popup.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (focus) trigger.focus(); }
    trigger.addEventListener('click', () => { const open = popup.hidden; popup.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); });
    document.addEventListener('click', e => { if (!account.contains(e.target)) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !popup.hidden) { e.preventDefault(); close(true); } });
    account.addEventListener('focusout', e => { if (!account.contains(e.relatedTarget)) close(); });
    account.querySelector('.account-logout').addEventListener('click', e => logout(e.currentTarget, account.querySelector('.account-error')));
    account.querySelectorAll('[data-account]').forEach(button => button.addEventListener('click', () => {
      close();
      const profile = button.dataset.account === 'profile';
      const dialog = document.createElement('dialog');
      dialog.className = 'account-dialog';
      dialog.setAttribute('aria-labelledby', 'account-dialog-title');
      dialog.innerHTML = `<h2 id="account-dialog-title">${profile ? 'Profile' : 'Settings'}</h2><dl></dl>${profile ? '' : '<p>Your account session lasts up to eight hours. Password changes and other account settings are not available yet.</p>'}<form method="dialog"><button>Close</button></form>`;
      const fields = profile ? [['Name', user.name], ['Email address', user.email], ['Sign-in method', user.provider === 'google' ? 'Google' : 'Email and password']] : [['Account', user.email], ['Workspace storage', 'This browser · Demo data']];
      const list = dialog.querySelector('dl');
      for (const [name, value] of fields) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = name; dd.textContent = value || 'Not provided'; list.append(dt, dd); }
      dialog.addEventListener('close', () => { dialog.remove(); trigger.focus(); });
      document.body.append(dialog);
      dialog.showModal();
    }));
    const mount = () => { const slot = document.querySelector('#workspace-account'); if (slot) { close(); slot.replaceChildren(account); } };
    window.addEventListener('techmemo:workspace-render', mount);
    mount();
    return;
  }

  // The public site and unsigned demo retain their existing account status controls.
  const bar = document.createElement('div');
  bar.className = 'account-bar';
  bar.setAttribute('aria-label', 'Account session');
  const label = document.createElement('span');
  label.textContent = session.user ? `Signed in as ${session.user.name} (${session.user.email})` : 'Demo mode · You are not signed in';
  bar.append(label);
  if (session.user) {
    const button = document.createElement('button');
    button.textContent = 'Sign out'; button.type = 'button';
    button.addEventListener('click', () => logout(button, label));
    bar.append(button);
  } else {
    const link = document.createElement('a'); link.href = '/#login'; link.textContent = 'Log in'; bar.append(link);
  }
  document.body.prepend(bar);
})();
