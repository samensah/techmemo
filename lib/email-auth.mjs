/* Supabase Auth owns account persistence, password hashing, email tokens and rate limits. */
const CONFIRM_COOKIE = '__Host-tm_confirm';
const message = 'If this address can be registered, a verification email has been requested. Check your inbox and spam folder, then verify before logging in. Already registered? Log in instead.';
const clearCookie = `${CONFIRM_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
const json = (res, status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
const redirect = (res, url) => { res.statusCode = 303; res.setHeader('Location', url); res.end(); };

export function emailConfiguration(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;
  try {
    const url = new URL(env.SUPABASE_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return { origin: url.origin, key: env.SUPABASE_PUBLISHABLE_KEY };
  } catch { return null; }
}
function readBody(req) {
  if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string' && Buffer.byteLength(req.body) <= 8192) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}
const validEmail = email => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = password => typeof password === 'string' && password.length >= 12 && Buffer.byteLength(password) <= 128;
function confirmationPage(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm your email | TechMemo</title><style>body{font:17px/1.6 system-ui;color:#163d35;max-width:450px;margin:12vh auto;padding:24px}button{background:#216b4e;color:white;padding:14px 24px;border:0;border-radius:6px;font:inherit;cursor:pointer}a{color:#216b4e}</style><h1>Confirm your email</h1><p>Select the button to verify your TechMemo email address. You can then log in with your password.</p><form method="post" action="/api/auth/verify"><button type="submit">Confirm email address</button></form><p><a href="/#login">Back to login</a></p></html>`);
}
export function createEmailAuthHandler({ env, exchange, seal, unseal, issueSession }) {
  return async (req, res, config) => {
    const action = req.query.action;
    const allowed = action === 'verify' ? ['GET', 'POST'] : ['POST'];
    if (!allowed.includes(req.method)) { res.setHeader('Allow', allowed.join(', ')); return json(res, 405, { error: 'Method not allowed' }); }
    const provider = emailConfiguration(env);
    if (!config || !provider) return json(res, 503, { error: 'Email accounts are not configured yet. Please try again later or use Google sign-in.' });
    if (req.method === 'POST' && req.headers.origin !== config.origin) return json(res, 403, { error: 'Invalid origin' });
    const call = async (path, body) => {
      const response = await exchange(`${provider.origin}/auth/v1/${path}`, { method: 'POST',
        headers: { apikey: provider.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };
    try {
      if (action === 'verify') {
        if (req.method === 'GET') {
          const tokenHash = req.query.token_hash;
          if (typeof tokenHash !== 'string' || !/^[a-zA-Z0-9_-]{20,256}$/.test(tokenHash)) return redirect(res, '/?email_error=verification#login');
          const token = await seal({ tokenHash }, config);
          res.setHeader('Set-Cookie', `${CONFIRM_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
          // GET never consumes the email token: scanners must not verify accounts automatically.
          return confirmationPage(res);
        }
        res.setHeader('Set-Cookie', clearCookie);
        const rawCookie = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(`${CONFIRM_COOKIE}=`));
        let confirmation;
        try { confirmation = await unseal(rawCookie?.slice(CONFIRM_COOKIE.length + 1) || '', config); }
        catch { return redirect(res, '/?email_error=verification#login'); }
        const { response, data } = await call('verify', { token_hash: confirmation.tokenHash, type: 'email' });
        if (!response.ok || !data.user?.email_confirmed_at) return redirect(res, '/?email_error=verification#login');
        // Verification does not log in the browser. Require the user's password next.
        return redirect(res, '/?email_verified=1#login');
      }
      const body = readBody(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!validEmail(email)) return json(res, 400, { error: 'Enter a valid email address.' });
      if (action !== 'resend' && !validPassword(body.password)) return json(res, 400, { error: 'Use a password of at least 12 characters and no more than 128 bytes.' });
      if (action === 'signup' && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 150)) return json(res, 400, { error: 'Enter your full name (up to 150 characters).' });
      const path = action === 'signup' ? 'signup' : action === 'resend' ? 'resend' : 'token?grant_type=password';
      const payload = action === 'signup' ? { email, password: body.password, data: { full_name: body.name.trim() } } : action === 'resend' ? { type: 'signup', email } : { email, password: body.password };
      const { response, data } = await call(path, payload);
      if (response.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(data.code)) return json(res, 429, { error: 'Too many attempts. Please wait before trying again.' });
      if (action === 'login') {
        if (!response.ok || !data.access_token || !data.user?.id || !data.user?.email || !data.user?.email_confirmed_at) return json(res, 401, { error: 'Unable to log in. Check your email and password, and verify your email first.' });
        const user = data.user;
        res.setHeader('Set-Cookie', await issueSession({ sub: `email:${user.id}`, email: user.email,
          name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.slice(0, 150) : user.email, provider: 'email' }, config));
        return json(res, 200, { ok: true, redirect: '/workspace.html' });
      }
      if (!response.ok) {
        // Do not expose duplicate-user responses or account existence.
        if (data.code === 'user_already_exists') return json(res, 200, { message });
        if (data.code === 'weak_password') return json(res, 400, { error: 'This password does not meet the account security requirements. Choose a stronger password.' });
        return json(res, 503, { error: 'The verification email could not be requested. Please try again later.' });
      }
      if (action === 'signup' && data.access_token) return json(res, 503, { error: 'Email confirmation must be enabled by the site administrator before signup can be used.' });
      return json(res, 200, { message });
    } catch {
      if (action === 'verify') return redirect(res, '/?email_error=verification#login');
      return json(res, 503, { error: 'The account service is temporarily unavailable. Please try again.' });
    }
  };
}
