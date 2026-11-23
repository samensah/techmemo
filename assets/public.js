/* Public screens. Account requests go to the same-origin authentication function. */
(() => {
  'use strict';
  const main = document.querySelector('#main');
  const google = '<span class="google-g" aria-hidden="true">G</span>';
  const featureCards = `<div class="cards"><article><span class="feature-icon">◎</span><h3>Bring the right people together</h3><p>Collect input from Finance, Legal and Sales in issue-specific workspaces, with group and private discussions.</p></article><article><span class="feature-icon">▤</span><h3>Build on approved evidence</h3><p>Choose the facts that belong in your memo. Private discussions need explicit evidence approval before drafting.</p></article><article><span class="feature-icon">↺</span><h3>Keep the whole story</h3><p>Generate a draft, review proposed changes and compare versions as your understanding of the issue evolves.</p></article></div>`;
  function home() { return `<section class="hero"><div class="hero-copy"><span class="eyebrow">A SHARED SPACE FOR TECHNICAL ACCOUNTING</span><h1>Complex accounting.<br>Clear thinking.<br><em>Better together.</em></h1><p>From the first question to the final memo. Bring your team, evidence and AI-assisted analysis into one collaborative workspace.</p><div class="hero-actions"><a href="#register" class="button primary">Get started</a><a href="workspace.html" class="text-link">Explore the demo</a></div><div class="hero-note"><span>✓ Collaborative by design</span><span>✓ Professional judgment at the centre</span></div></div><div class="preview" aria-label="Illustration of a TechMemo accounting memo"><div class="preview-bar"><span class="mini-logo">tm▪</span><strong>Revenue recognition review</strong><span class="draft">Working draft</span></div><div class="preview-body"><aside><span class="preview-selected">▤ &nbsp; Memo editor</span><span>▱ &nbsp; Evidence</span><span>◷ &nbsp; Version history</span><div class="preview-team"><b>YOUR TEAM</b><div><i>AM</i><i>DC</i><i>PS</i></div><small>Accounting · Legal · Sales</small></div></aside><div class="preview-paper"><span class="paper-label">TECHNICAL ACCOUNTING MEMORANDUM</span><h2>A clearer path to<br>your conclusion.</h2><span class="paper-standard">IFRS 15 · Revenue recognition</span><h4>Background &amp; facts</h4><div class="lines"><i></i><i></i><i></i></div><h4>Analysis &amp; considerations</h4><div class="lines"><i></i><i></i></div><div class="evidence-chip">✓ &nbsp; Supported by approved evidence</div></div></div><div class="preview-comment"><span class="comment-avatar">DC</span><div><strong>Daniel · Legal Counsel</strong><p>Contract terms reviewed. Evidence ready for approval.</p></div></div></div></section><section class="principles"><span>ONE CONNECTED WORKFLOW</span><p>Investigate <b>·</b> Collaborate <b>·</b> Draft <b>·</b> Review</p></section><section id="product" class="content-section"><span class="eyebrow">FROM QUESTION TO CONCLUSION</span><h2>The home for your accounting thinking.</h2><p class="section-intro">Less chasing documents and feedback. More time for the analysis that matters.</p>${featureCards}</section><section class="closing"><h2>Your next accounting memo starts here.</h2><a class="button primary" href="#register">Create your account</a><p>Explore the prototype with fictional data.</p></section>`; }
  function auth(mode) {
    const register = mode === 'register', sso = mode === 'sso', reset = mode === 'reset', resend = mode === 'resend';
    const heading = resend ? 'Resend verification email' : sso ? 'Work single sign-on' : reset ? 'Reset your password' : register ? 'Create your account' : 'Welcome back';
    return `<section class="auth-layout"><div class="auth-story"><span class="eyebrow">THINK CLEARLY. WORK TOGETHER.</span><h1>Your team.<br>Your evidence.<br><em>One workspace.</em></h1><p>Bring every conversation, source document and accounting judgment into the same story.</p><div class="story-note"><span>▤</span><p>From a complex accounting question to a memo your team can review and stand behind.</p></div></div><div class="auth-card"><a class="back-link" href="#home">Back to home</a><h2>${heading}</h2><p class="auth-intro">${resend ? 'Enter your signup email to request another verification link.' : sso ? 'Use your organization’s identity provider.' : reset ? 'Enter the email associated with your account.' : register ? 'Start your collaborative accounting workspace.' : 'Log in to your TechMemo workspace.'}</p><div class="prototype-note">Verify your email before your first password login. Work SSO is coming soon.</div>${!sso && !reset && !resend ? `<a class="button provider" href="/api/auth/start">${google}${register ? 'Sign up' : 'Log in'} with Google</a><div class="divider"><span>or use your email</span></div>` : ''}<form data-mode="${mode}">${register ? '<label for="name">Full name</label><input id="name" name="name" autocomplete="name" maxlength="150" required placeholder="Your full name">' : ''}<label for="email">${sso ? 'Work email' : 'Email address'}</label><input id="email" name="email" type="email" autocomplete="${sso || reset ? 'email' : 'username'}" required placeholder="you@company.com">${!sso && !reset && !resend ? `<div class="password-label"><label for="password">Password</label>${!register ? '<a href="#reset">Forgot password?</a>' : ''}</div><div class="password-field"><input id="password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" ${register ? 'minlength="12" maxlength="128"' : ''} required aria-describedby="password-help"><button type="button" class="show-password" aria-label="Show password" aria-pressed="false">Show</button></div><p class="input-help" id="password-help">${register ? 'Use at least 12 characters. Choose a unique password.' : 'Your email address must be verified before you can log in.'}</p>` : ''}<button class="button primary full" type="submit">${resend ? 'Resend verification email' : sso ? 'Continue with SSO' : reset ? 'Request reset link' : register ? 'Create account' : 'Log in'}</button></form><p id="auth-status" role="status" aria-live="polite"></p>${!sso && !reset && !resend ? '<p class="switch-auth"><a href="#resend">Resend verification email</a></p>' : ''}${!sso && !reset && !resend ? `<div class="divider"><span>work single sign-on</span></div><a class="button provider" href="#sso"><span aria-hidden="true">▦</span> Continue with work SSO</a><p class="switch-auth">${register ? 'Already have an account? <a href="#login">Log in</a>' : 'New to TechMemo? <a href="#register">Create an account</a>'}</p>` : '<p class="switch-auth"><a href="#login">Back to login</a></p>'}<a class="demo-link" href="workspace.html">Explore the demo workspace</a><p class="auth-fine">Accounts identify you. The workspace currently uses fictional, browser-local demo data.</p></div></section>`;
  }
  function pricing() { return `<section class="content-section standalone"><span class="eyebrow">ROOM FOR YOUR WHOLE TEAM</span><h1>A workspace that grows with you.</h1><p class="section-intro">TechMemo is in development. Plan names and features below are proposed; paid subscriptions are not available.</p><div class="cards pricing-cards">${[['Explore','Try the workflow','Explore fictional accounting issues, approved evidence and memo version history.','Open the demo','workspace.html'],['Team','Bring your team together','Planned shared workspaces, collaborative review and persistent evidence management.','Create an account','#register'],['Enterprise','Built around your organization','Planned organization SSO, tenant isolation and centrally managed access.','Explore work SSO','#sso']].map(([name,title,copy,cta,url])=>`<article><span class="eyebrow">${name}</span><h2>${title}</h2><p>${copy}</p><strong>${name==='Explore'?'Free prototype':'Pricing to be announced'}</strong><a class="button ${name==='Team'?'primary':'provider'}" href="${url}">${cta}</a></article>`).join('')}</div></section>`; }
  function resources() {return `<section class="content-section standalone resources"><span class="eyebrow">HELP &amp; RESOURCES</span><h1>A little guidance.<br>A clearer next step.</h1><p class="section-intro">Get familiar with the TechMemo prototype and the workflow we’re building.</p>${featureCards}<div class="faq"><h2>Your questions, answered.</h2><details open><summary>How do I try TechMemo?</summary><p>Choose “Explore the demo workspace” to open the existing prototype. Start with the revenue recognition issue, review the discussion and approve evidence before generating a draft.</p><a href="workspace.html">Open demo workspace</a></details><details><summary>Can I sign in with Google or my work account?</summary><p>Google and verified email/password sign-in use secure server sessions when configured. Password reset and enterprise SSO remain previews. Google sign-in does not enforce company domain or project invitation rules.</p></details><details><summary>How does private evidence approval work?</summary><p>A private conversation is not automatically used in a memo. Propose a specific excerpt as evidence, then approve it as the issue owner before generating a draft.</p></details><details><summary>Is the generated memo ready to use?</summary><p>The demo generates a template-based draft, with an optional experimental local model. Accounting professionals must validate the research, exercise judgment and approve conclusions.</p></details><details><summary>Where is demo data stored?</summary><p>The workspace uses browser-local storage and fictional identities. Use fictional data only. Production authentication and secure tenant isolation are planned.</p></details></div></section>`;}
  function render() {
    // Default Supabase confirmation emails return an implicit-flow fragment.
    // Discard provider tokens immediately; only password login can create our app session.
    const confirmation = new URLSearchParams(location.hash.slice(1));
    if (confirmation.has('access_token') || confirmation.has('refresh_token')) {
      history.replaceState(null, '', '/?email_confirmation=returned#login');
    } else if (confirmation.has('error') || confirmation.has('error_code')) {
      history.replaceState(null, '', '/?email_error=verification#login');
    }
    const route = location.hash.slice(1) || 'home';
    main.innerHTML = ['login','register','sso','reset','resend'].includes(route) ? auth(route) : route==='pricing' ? pricing() : route==='resources' ? resources() : home();
    document.title = `TechMemo | ${({login:'Log in',register:'Create your account',sso:'Work single sign-on',reset:'Reset password',resend:'Resend verification email',pricing:'Pricing',resources:'Help & Resources'})[route] || 'Technical accounting, together'}`;
    document.querySelectorAll('nav a').forEach(a => { if (a.hash === `#${route}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.querySelector('#navigation').classList.remove('open');
    document.querySelector('.menu-toggle').setAttribute('aria-expanded','false');
    const authError = new URLSearchParams(location.search).get('auth_error');
    const status = document.querySelector('#auth-status');
    if (status && authError) status.textContent = ({not_configured:'Google sign-in needs Google Cloud and Vercel configuration. You can still explore the demo.',cancelled:'Google sign-in was cancelled. Please try again.',failed:'Google sign-in could not be completed. Please try again.'})[authError] || 'Google sign-in could not be completed.';
    const params = new URLSearchParams(location.search);
    if (status && params.has('email_confirmation')) status.textContent = 'Your confirmation link has been processed. Log in with your email address and password to continue.';
    if (status && params.has('email_verified')) status.textContent = 'Your email is verified. Log in with your email address and password.';
    if (status && params.has('email_error')) status.textContent = 'This verification link is invalid or has expired. Request a new verification email.';
    if (route === 'product') document.querySelector('#product').scrollIntoView(); else window.scrollTo(0,0);
  }
  document.querySelector('.menu-toggle').addEventListener('click', e => { const open = document.querySelector('#navigation').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(open)); });
  main.addEventListener('click', e => {
    const toggle = e.target.closest('.show-password');
    if(toggle) {const input = document.querySelector('#password'), show = input.type === 'password'; input.type = show ? 'text' : 'password'; toggle.textContent = show ? 'Hide' : 'Show'; toggle.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} password`); toggle.setAttribute('aria-pressed', String(show));}
  });
  main.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target, mode = form.dataset.mode, status = document.querySelector('#auth-status');
    if (mode === 'sso' || mode === 'reset') {
      status.textContent = mode === 'sso' ? 'Work SSO requires your organization’s identity provider to be configured.' : 'Password reset is not connected yet. No email was sent.';
      return;
    }
    if (location.protocol === 'file:') { status.textContent = 'Open the deployed TechMemo website to create an account or log in.'; return; }
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = mode === 'register' ? 'Creating your account…' : mode === 'resend' ? 'Requesting verification email…' : 'Logging in…';
    const values = new FormData(form);
    const payload = { email: values.get('email') };
    if (mode !== 'resend') payload.password = values.get('password');
    if (mode === 'register') payload.name = values.get('name');
    try {
      const response = await fetch(`/api/auth/${mode === 'register' ? 'signup' : mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(payload), signal: AbortSignal.timeout(15000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The account service is unavailable. Please try again.');
      if (mode === 'login') { location.assign('/workspace.html'); return; }
      status.textContent = result.message || 'Check your inbox for the verification email.';
      form.reset();
    } catch (error) { status.textContent = error.name === 'TimeoutError' ? 'The request timed out. Please try again shortly.' : error.message; }
    finally { button.disabled = false; const password = form.querySelector('[name="password"]'); if (password) password.value = ''; }
  });
  window.addEventListener('hashchange', render);
  render();
})();
