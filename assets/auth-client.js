/* Server session identity stays separate from the switchable fictional demo users. */
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
  const bar = document.createElement('div');
  bar.className = 'account-bar';
  bar.setAttribute('aria-label', 'Account session');
  const label = document.createElement('span');
  label.textContent = session.user ? `Signed in as ${session.user.name} (${session.user.email}) · Fictional demo workspace` : 'Demo mode · You are not signed in';
  bar.append(label);
  if (session.user) {
    const button = document.createElement('button');
    button.textContent = 'Sign out';
    button.type = 'button';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const result = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        if (!result.ok) throw new Error('Sign out failed');
        location.assign('/#login');
      } catch { label.textContent = 'Could not sign out. Please try again.'; button.disabled = false; }
    });
    bar.append(button);
  } else {
    const link = document.createElement('a');
    link.href = '/#login';
    link.textContent = 'Log in';
    bar.append(link);
  }
  document.body.prepend(bar);
})();
