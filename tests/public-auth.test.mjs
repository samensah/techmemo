import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../assets/public.js', import.meta.url), 'utf8');
function screen(route, reply = { ok: true, message: 'Check your email.' }) {
  const listeners = {}, status = { textContent: '' }, button = { disabled: false }, password = { value: 'a-unique-password' };
  const main = { innerHTML: '', addEventListener(type, fn) { listeners[type] = fn; } };
  let sent, redirect, resets = 0;
  const values = new Map([['email', 'ava@example.com'], ['name', 'Ava Morgan'], ['password', password.value]]);
  const form = { dataset: { mode: route }, querySelector: s => s === '[type="submit"]' ? button : password, reset() { resets++; } };
  const document = { title: '', querySelector: s => s === '#main' ? main : s === '#auth-status' ? status : { classList: { remove() {} }, setAttribute() {}, addEventListener() {} }, querySelectorAll: () => [] };
  const location = { hash: `#${route}`, search: '', protocol: 'https:', assign(url) { redirect = url; } };
  const history = { replaceState(_state, _title, url) { const updated = new URL(url, 'https://techmemo-smoky.vercel.app'); location.hash = updated.hash; location.search = updated.search; } };
  vm.runInNewContext(source, { document, location, history, window: { scrollTo() {}, addEventListener() {} }, URLSearchParams, AbortSignal,
    FormData: class { get(key) { return values.get(key); } },
    fetch: async (url, options) => { sent = { url, options }; return { ok: reply.ok, json: async () => reply }; }
  });
  return { main, status, button, password, submit: () => listeners.submit({ preventDefault() {}, target: form }),
    sent: () => sent, redirect: () => redirect, resets: () => resets };
}
test('registration sends name/email/password over POST and waits for verification rather than opening workspace', async () => {
  const page = screen('register');
  assert.match(page.main.innerHTML, /minlength="12"/);
  await page.submit();
  assert.equal(page.sent().url, '/api/auth/signup');
  assert.equal(page.sent().options.method, 'POST');
  assert.deepEqual(JSON.parse(page.sent().options.body), { name: 'Ava Morgan', email: 'ava@example.com', password: 'a-unique-password' });
  assert.equal(page.redirect(), undefined);
  assert.equal(page.status.textContent, 'Check your email.');
  assert.equal(page.password.value, '');
  assert.equal(page.resets(), 1);
});
test('login redirects only on success; failed login displays message and allows retry', async () => {
  const good = screen('login'); await good.submit();
  assert.equal(good.redirect(), '/workspace.html');
  const bad = screen('login', { ok: false, error: 'Verify your email first.' }); await bad.submit();
  assert.equal(bad.redirect(), undefined);
  assert.equal(bad.status.textContent, 'Verify your email first.');
  assert.equal(bad.button.disabled, false);
  assert.equal(bad.password.value, '');
});
test('resend route only requests an email address', async () => {
  const page = screen('resend');
  assert(!page.main.innerHTML.includes('id="password"'));
  await page.submit();
  assert.equal(page.sent().url, '/api/auth/resend');
  assert.deepEqual(JSON.parse(page.sent().options.body), { email: 'ava@example.com' });
});

test('default Supabase email return discards tokens and shows login without creating a session', () => {
  const page = screen('access_token=sensitive-token&refresh_token=sensitive-refresh&type=signup');
  assert.match(page.main.innerHTML, /Welcome back/);
  assert.match(page.status.textContent, /confirmation link has been processed/);
  assert(!page.main.innerHTML.includes('sensitive-token'));
  assert.equal(page.sent(), undefined);
  assert.equal(page.redirect(), undefined);
});
test('expired default confirmation links show a safe resend message', () => {
  const page = screen('error=access_denied&error_code=otp_expired&error_description=sensitive-error');
  assert.match(page.main.innerHTML, /Welcome back/);
  assert.match(page.status.textContent, /invalid or has expired/);
  assert(!page.status.textContent.includes('sensitive-error'));
});
