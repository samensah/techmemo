import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { createEmailAuthHandler } from './email-auth.mjs';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const FLOW_COOKIE = '__Host-tm_oauth';
const SESSION_COOKIE = '__Host-tm_session';
const SESSION_AGE = 8 * 60 * 60;
const issuer = 'techmemo';
const random = () => randomBytes(32).toString('base64url');

export function sessionConfiguration(env = process.env) {
  const { AUTH_SECRET: secret, APP_URL: appUrl } = env;
  if (!secret || Buffer.byteLength(secret) < 32 || !appUrl) return null;
  try {
    const url = new URL(appUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return { key: new TextEncoder().encode(secret), origin: url.origin };
  } catch { return null; }
}

export function configuration(env = process.env) {
  const base = sessionConfiguration(env);
  return base && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { ...base, clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } : null;
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(item => {
    const index = item.indexOf('=');
    return index < 0 ? ['', ''] : [item.slice(0, index).trim(), item.slice(index + 1).trim()];
  }));
}
function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
async function sign(payload, config, audience, age) {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuer(issuer)
    .setAudience(audience).setIssuedAt().setExpirationTime(`${age}s`).sign(config.key);
}
async function verify(token, config, audience) {
  return (await jwtVerify(token, config.key, { algorithms: ['HS256'], issuer, audience })).payload;
}
function json(res, code, value) { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); }
function redirect(res, location) { res.statusCode = 303; res.setHeader('Location', location); res.end(); }

export async function verifyGoogleIdToken(token, audience, keys = googleKeys) {
  return (await jwtVerify(token, keys, { algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'], audience })).payload;
}

// Dependencies can be replaced in tests; production always verifies Google's signature and claims.
export function createAuthHandler({ env = process.env, exchange = fetch, verifyGoogle = verifyGoogleIdToken } = {}) {
  const emailHandler = createEmailAuthHandler({ env, exchange,
    seal: (payload, config) => sign(payload, config, 'email-confirm', 600),
    unseal: (token, config) => verify(token, config, 'email-confirm'),
    issueSession: async (user, config) => cookie(SESSION_COOKIE, await sign(user, config, 'session', SESSION_AGE), SESSION_AGE)
  });
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const action = req.query?.action;
    if (['signup', 'login', 'resend', 'verify'].includes(action)) return emailHandler(req, res, sessionConfiguration(env));
    if (!['start', 'callback', 'session', 'logout'].includes(action)) return json(res, 404, { error: 'Not found' });
    const method = action === 'logout' ? 'POST' : 'GET';
    if (req.method !== method) { res.setHeader('Allow', method); return json(res, 405, { error: 'Method not allowed' }); }
    const config = ['start', 'callback'].includes(action) ? configuration(env) : sessionConfiguration(env);
    if (!config) {
      if (action === 'session') return json(res, 200, { user: null, configured: false });
      if (action === 'start' || action === 'callback') return redirect(res, '/?auth_error=not_configured#login');
      return json(res, 503, { error: 'Google sign-in is not configured' });
    }
    // Always use the configured canonical origin for callbacks, never a supplied Host header.
    if (action === 'start') {
      const nonce = random(), state = random(), verifier = random();
      res.setHeader('Set-Cookie', cookie(FLOW_COOKIE, await sign({ nonce, state, verifier }, config, 'oauth-flow', 600), 600));
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: `${config.origin}/api/auth/callback`,
        response_type: 'code', scope: 'openid email profile', state, nonce,
        code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' }).toString();
      return redirect(res, url.href);
    }
    if (action === 'callback') {
      // Consume the browser flow cookie on both success and failure.
      res.setHeader('Set-Cookie', cookie(FLOW_COOKIE, '', 0));
      try {
        const flow = await verify(cookies(req)[FLOW_COOKIE] || '', config, 'oauth-flow');
        if (typeof req.query.state !== 'string' || req.query.state !== flow.state) throw new Error('Invalid state');
        if (req.query.error) return redirect(res, '/?auth_error=cancelled#login');
        if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 4096) throw new Error('Invalid code');
        const result = await exchange('https://oauth2.googleapis.com/token', { method: 'POST',
          signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code: req.query.code, client_id: config.clientId, client_secret: config.clientSecret,
            redirect_uri: `${config.origin}/api/auth/callback`, grant_type: 'authorization_code', code_verifier: flow.verifier }) });
        if (!result.ok) throw new Error('Token exchange failed');
        const tokens = await result.json();
        const identity = await verifyGoogle(tokens.id_token, config.clientId);
        if (identity.nonce !== flow.nonce || identity.email_verified !== true || typeof identity.sub !== 'string' || !identity.sub ||
            typeof identity.email !== 'string' || !identity.email || identity.email.length > 320) throw new Error('Invalid identity');
        const session = await sign({ sub: identity.sub, email: identity.email,
          name: typeof identity.name === 'string' ? identity.name.slice(0, 150) : identity.email, provider: 'google' }, config, 'session', SESSION_AGE);
        res.setHeader('Set-Cookie', [cookie(FLOW_COOKIE, '', 0), cookie(SESSION_COOKIE, session, SESSION_AGE)]);
        return redirect(res, '/workspace.html');
      } catch {
        // Never echo authorization codes, tokens, Google errors or secrets into responses/logs.
        return redirect(res, '/?auth_error=failed#login');
      }
    }
    if (action === 'session') {
      try {
        const session = await verify(cookies(req)[SESSION_COOKIE] || '', config, 'session');
        return json(res, 200, { configured: true, user: { id: session.sub, email: session.email, name: session.name, provider: session.provider } });
      } catch {
        res.setHeader('Set-Cookie', cookie(SESSION_COOKIE, '', 0));
        return json(res, 200, { configured: true, user: null });
      }
    }
    if (req.headers.origin !== config.origin) return json(res, 403, { error: 'Invalid origin' });
    res.setHeader('Set-Cookie', [cookie(SESSION_COOKIE, '', 0), cookie(FLOW_COOKIE, '', 0)]);
    return json(res, 200, { ok: true });
  };
}

// Only verified, signed app sessions supply the project API identity.
export async function readSession(req, env = process.env) {
  const config = sessionConfiguration(env);
  if (!config) return null;
  try {
    const session = await verify(cookies(req)[SESSION_COOKIE] || '', config, 'session');
    if (typeof session.sub !== 'string' || typeof session.email !== 'string') return null;
    return { id: session.sub, email: session.email.toLowerCase(), name: session.name || session.email };
  } catch { return null; }
}
