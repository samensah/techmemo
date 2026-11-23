import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthHandler } from '../lib/auth.mjs';
import { emailConfiguration } from '../lib/email-auth.mjs';

const env = { AUTH_SECRET: 'k'.repeat(48), APP_URL: 'https://techmemo-smoky.vercel.app', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key' };
const account = { id: 'persistent-user-id', email: 'ava@example.com', email_confirmed_at: '2026-11-23T12:00:00Z', user_metadata: { full_name: 'Ava Morgan' } };
const response = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
async function request(handler, action, { method = 'POST', origin = env.APP_URL, body = {}, cookie = '', query = {} } = {}) {
  const headers = {};
  const res = { statusCode: 200, setHeader(name, value) { headers[name.toLowerCase()] = value; }, end(body = '') { this.body = body; } };
  await handler({ method, query: { action, ...query }, headers: { cookie, origin }, body }, res);
  return { status: res.statusCode, headers, body: res.body, json: () => JSON.parse(res.body) };
}
const signup = { name: ' Ava Morgan ', email: ' Ava@Example.com ', password: 'long-unique-password-123' };

test('signup persists normalized email and full name through provider without issuing a session', async () => {
  let calls = 0;
  const handler = createAuthHandler({ env, exchange: async (url, options) => {
    calls++;
    assert.equal(url, `${env.SUPABASE_URL}/auth/v1/signup`);
    assert.equal(options.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
    assert.deepEqual(JSON.parse(options.body), { email: 'ava@example.com', password: signup.password, data: { full_name: 'Ava Morgan' } });
    return response(200, { id: account.id });
  } });
  const result = await request(handler, 'signup', { body: signup });
  assert.equal(result.status, 200);
  assert.match(result.json().message, /verification email/);
  assert.equal(result.headers['set-cookie'], undefined);
  assert(!result.body.includes(signup.password));
  assert.equal(calls, 1);
});
test('registration validation and origin/method checks happen before provider requests', async () => {
  let calls = 0;
  const handler = createAuthHandler({ env, exchange: async () => { calls++; throw new Error(); } });
  for (const body of [{ ...signup, name: '' }, { ...signup, email: 'invalid' }, { ...signup, password: 'short' }, { ...signup, password: '😀'.repeat(40) }, { ...signup, name: 'x'.repeat(151) }]) {
    assert.equal((await request(handler, 'signup', { body })).status, 400);
  }
  assert.equal((await request(handler, 'signup', { method: 'GET', body: signup })).status, 405);
  assert.equal((await request(handler, 'signup', { origin: 'https://evil.example', body: signup })).status, 403);
  assert.equal((await request(handler, 'signup', { origin: '', body: signup })).status, 403);
  assert.equal(calls, 0);
});
test('verified password login works without Google credentials and uses shared HTTP-only session/logout', async () => {
  const handler = createAuthHandler({ env, exchange: async (url) => {
    assert.equal(url, `${env.SUPABASE_URL}/auth/v1/token?grant_type=password`);
    return response(200, { access_token: 'provider-token-never-exposed', refresh_token: 'refresh-never-exposed', user: account });
  } });
  const result = await request(handler, 'login', { body: { email: account.email, password: signup.password } });
  assert.equal(result.status, 200);
  assert.equal(result.json().redirect, '/workspace.html');
  assert.match(result.headers['set-cookie'], /HttpOnly; Secure; SameSite=Lax/);
  assert(!result.headers['set-cookie'].includes('provider-token'));
  assert(!result.body.includes('provider-token'));
  const session = await request(handler, 'session', { method: 'GET', cookie: result.headers['set-cookie'].split(';')[0] });
  assert.deepEqual(session.json().user, { id: `email:${account.id}`, email: account.email, name: 'Ava Morgan', provider: 'email' });
  assert.equal((await request(handler, 'logout')).status, 200);
});
test('wrong passwords and unverified accounts never get a session', async () => {
  for (const providerResponse of [response(400, { code: 'invalid_credentials' }), response(200, { access_token: 'token', user: { ...account, email_confirmed_at: null } })]) {
    const handler = createAuthHandler({ env, exchange: async () => providerResponse });
    const result = await request(handler, 'login', { body: { email: account.email, password: signup.password } });
    assert.equal(result.status, 401);
    assert.equal(result.headers['set-cookie'], undefined);
  }
});
test('verification GET does not consume tokens; explicit confirmation POST verifies and redirects to password login', async () => {
  let calls = 0;
  const tokenHash = 'a'.repeat(64);
  const handler = createAuthHandler({ env, exchange: async (url, options) => {
    calls++;
    assert.equal(url, `${env.SUPABASE_URL}/auth/v1/verify`);
    assert.deepEqual(JSON.parse(options.body), { token_hash: tokenHash, type: 'email' });
    return response(200, { user: account, access_token: 'do-not-expose' });
  } });
  const page = await request(handler, 'verify', { method: 'GET', query: { token_hash: tokenHash } });
  assert.equal(calls, 0);
  assert.match(page.body, /method="post"/);
  assert(!page.body.includes(tokenHash));
  assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
  const verified = await request(handler, 'verify', { cookie: page.headers['set-cookie'].split(';')[0] });
  assert.equal(calls, 1);
  assert.equal(verified.headers.location, '/?email_verified=1#login');
  assert.match(verified.headers['set-cookie'], /Max-Age=0/);
  assert(!verified.body.includes('do-not-expose'));
});
test('missing/tampered confirmation cookie and invalid links fail without consuming provider tokens', async () => {
  let calls = 0;
  const handler = createAuthHandler({ env, exchange: async () => { calls++; return response(403, {}); } });
  for (const cookie of ['', '__Host-tm_confirm=invalid']) {
    assert.equal((await request(handler, 'verify', { cookie })).headers.location, '/?email_error=verification#login');
  }
  assert.equal((await request(handler, 'verify', { method: 'GET', query: { token_hash: '<script>alert(1)</script>' } })).headers.location, '/?email_error=verification#login');
  assert.equal(calls, 0);
  const page = await request(handler, 'verify', { method: 'GET', query: { token_hash: 'a'.repeat(64) } });
  const expired = await request(handler, 'verify', { cookie: page.headers['set-cookie'].split(';')[0] });
  assert.equal(expired.headers.location, '/?email_error=verification#login');
});
test('duplicate signup, resend, provider limits and mail failures report safely', async () => {
  let route;
  const run = async (action, providerResponse) => request(createAuthHandler({ env, exchange: async (url) => { route = url; return providerResponse; } }), action, { body: signup });
  assert.equal((await run('signup', response(422, { code: 'user_already_exists' }))).json().message, (await run('signup', response(200, {}))).json().message);
  assert.equal((await run('resend', response(200, {}))).status, 200);
  assert.equal(route, `${env.SUPABASE_URL}/auth/v1/resend`);
  assert.equal((await run('signup', response(429, {}))).status, 429);
  assert.equal((await run('signup', response(500, { message: 'sensitive upstream details' }))).status, 503);
  assert.equal((await run('signup', response(200, { access_token: 'auto-confirm-misconfigured' }))).status, 503);
  assert.equal((await run('signup', response(422, { code: 'weak_password' }))).status, 400);
});
test('missing email config and network failures never claim success', async () => {
  assert.equal(emailConfiguration({ ...env, SUPABASE_URL: 'http://unsafe.example' }), null);
  assert.equal((await request(createAuthHandler({ env: { ...env, SUPABASE_PUBLISHABLE_KEY: '' } }), 'signup', { body: signup })).status, 503);
  const result = await request(createAuthHandler({ env, exchange: async () => { throw new Error('private stack'); } }), 'signup', { body: signup });
  assert.equal(result.status, 503);
  assert(!result.body.includes('private stack'));
});
