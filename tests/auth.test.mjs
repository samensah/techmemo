import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { configuration, createAuthHandler, verifyGoogleIdToken } from '../lib/auth.mjs';

const env = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', AUTH_SECRET: 's'.repeat(48), APP_URL: 'https://techmemo-smoky.vercel.app' };
const { publicKey, privateKey } = await generateKeyPair('RS256');
const verifyGoogle = (token, audience) => verifyGoogleIdToken(token, audience, publicKey);
async function request(handler, action, { method = 'GET', cookie = '', query = {}, origin } = {}) {
  const headers = {};
  const res = { statusCode: 200, setHeader(name, value) { headers[name.toLowerCase()] = value; }, end(body = '') { this.body = body; } };
  await handler({ method, query: { action, ...query }, headers: { cookie, origin, host: 'attacker.example' } }, res);
  return { status: res.statusCode, headers, body: res.body, json: () => JSON.parse(res.body) };
}
const cookieValue = value => value.split(';')[0];
async function start(handler) {
  const result = await request(handler, 'start');
  return { cookie: cookieValue(result.headers['set-cookie']), url: new URL(result.headers.location), result };
}
async function googleToken(nonce, claims = {}, { audience = env.GOOGLE_CLIENT_ID, issuer = 'https://accounts.google.com', expiry = '1h' } = {}) {
  return new SignJWT({ sub: 'google-stable-subject', email: 'test@example.com', email_verified: true, name: 'Test User', nonce, ...claims })
    .setProtectedHeader({ alg: 'RS256' }).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expiry).sign(privateKey);
}

test('configuration requires all credentials, strong signing key and a canonical HTTPS origin', () => {
  assert(configuration(env));
  for (const key of Object.keys(env)) assert.equal(configuration({ ...env, [key]: '' }), null);
  for (const APP_URL of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path', 'invalid']) assert.equal(configuration({ ...env, APP_URL }), null);
  assert.equal(configuration({ ...env, AUTH_SECRET: 'short' }), null);
});
test('unconfigured service gives actionable errors without secrets', async () => {
  const handler = createAuthHandler({ env: {} });
  assert.deepEqual((await request(handler, 'session')).json(), { user: null, configured: false });
  assert.equal((await request(handler, 'start')).headers.location, '/?auth_error=not_configured#login');
});
test('start uses configured callback, signed secure flow cookie and PKCE', async () => {
  const a = await start(createAuthHandler({ env }));
  const b = await start(createAuthHandler({ env }));
  assert.equal(a.url.origin, 'https://accounts.google.com');
  assert.equal(a.url.searchParams.get('redirect_uri'), `${env.APP_URL}/api/auth/callback`);
  assert.equal(a.url.searchParams.get('scope'), 'openid email profile');
  assert.equal(a.url.searchParams.get('code_challenge_method'), 'S256');
  assert.notEqual(a.url.searchParams.get('state'), b.url.searchParams.get('state'));
  assert.match(a.result.headers['set-cookie'], /HttpOnly; Secure; SameSite=Lax; Max-Age=600/);
  assert(!a.result.headers.location.includes(env.GOOGLE_CLIENT_SECRET));
});
test('successful callback verifies identity, creates session, and logout clears it', async () => {
  let nonce, challenge;
  const handler = createAuthHandler({ env, verifyGoogle, exchange: async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert.equal(options.body.get('redirect_uri'), `${env.APP_URL}/api/auth/callback`);
    assert.equal(createHash('sha256').update(options.body.get('code_verifier')).digest('base64url'), challenge);
    return { ok: true, json: async () => ({ id_token: await googleToken(nonce) }) };
  } });
  const flow = await start(handler);
  nonce = flow.url.searchParams.get('nonce'); challenge = flow.url.searchParams.get('code_challenge');
  const callback = await request(handler, 'callback', { cookie: flow.cookie, query: { code: 'example-code', state: flow.url.searchParams.get('state') } });
  assert.equal(callback.headers.location, '/workspace.html');
  const sessionCookie = cookieValue(callback.headers['set-cookie'][1]);
  assert.match(callback.headers['set-cookie'][1], /HttpOnly; Secure; SameSite=Lax/);
  const session = await request(handler, 'session', { cookie: sessionCookie });
  assert.equal(session.json().user.id, 'google-stable-subject');
  assert.equal(session.json().user.email, 'test@example.com');
  assert.equal(session.headers['cache-control'], 'no-store');
  const tampered = await request(handler, 'session', { cookie: sessionCookie + 'tampered' });
  assert.equal(tampered.json().user, null);
  assert.equal((await request(handler, 'session', { cookie: flow.cookie })).json().user, null);
  assert.equal((await request(handler, 'logout', { method: 'POST', origin: 'https://evil.example' })).status, 403);
  const logout = await request(handler, 'logout', { method: 'POST', origin: env.APP_URL });
  assert(logout.headers['set-cookie'].every(c => c.endsWith('Max-Age=0')));
});
test('missing, tampered or mismatched state prevents token exchange', async () => {
  const handler = createAuthHandler({ env, exchange: () => { throw new Error('Must not exchange'); } });
  const flow = await start(handler);
  for (const options of [{}, { cookie: flow.cookie, query: { state: 'wrong', code: 'test' } }, { cookie: flow.cookie + 'x', query: { state: flow.url.searchParams.get('state'), code: 'test' } }]) {
    const result = await request(handler, 'callback', options);
    assert.equal(result.headers.location, '/?auth_error=failed#login');
    assert(!Array.isArray(result.headers['set-cookie']));
  }
});
test('callback rejects wrong nonce, unverified email, bad signature, audience, issuer and expired token', async () => {
  for (const problem of ['nonce', 'email', 'signature', 'audience', 'issuer', 'expiry', 'exchange']) {
    let nonce;
    const handler = createAuthHandler({ env, verifyGoogle, exchange: async () => ({ ok: problem !== 'exchange', json: async () => {
      let token = await googleToken(problem === 'nonce' ? 'wrong-nonce' : nonce,
        problem === 'email' ? { email_verified: false } : {},
        problem === 'audience' ? { audience: 'other-client' } : problem === 'issuer' ? { issuer: 'https://evil.example' } : problem === 'expiry' ? { expiry: '-1s' } : {});
      if (problem === 'signature') token = token.slice(0, -8) + 'AAAAAAAA';
      return { id_token: token };
    } }) });
    const flow = await start(handler); nonce = flow.url.searchParams.get('nonce');
    const result = await request(handler, 'callback', { cookie: flow.cookie, query: { code: 'test', state: flow.url.searchParams.get('state') } });
    assert.equal(result.headers.location, '/?auth_error=failed#login', problem);
    assert(!Array.isArray(result.headers['set-cookie']), problem);
  }
});
test('cancelled login clears flow and enforces methods', async () => {
  const handler = createAuthHandler({ env });
  const flow = await start(handler);
  assert.equal((await request(handler, 'callback', { cookie: flow.cookie, query: { state: flow.url.searchParams.get('state'), error: 'access_denied' } })).headers.location, '/?auth_error=cancelled#login');
  assert.equal((await request(handler, 'logout')).status, 405);
  assert.equal((await request(handler, 'start', { method: 'POST' })).status, 405);
  assert.equal((await request(handler, 'unknown')).status, 404);
});
