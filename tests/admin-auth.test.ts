import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminCookie,
  adminSessionFromCookie,
  clearAdminCookie,
  createAdminSession,
  isValidAdminSession,
  verifyAdminPassword,
} from '../server/services/adminAuth';

test('admin session cookie requires a configured password, expires, and cannot be forged', (t) => {
  const previous = process.env.OFFICE_ADMIN_PASSWORD;
  delete process.env.OFFICE_ADMIN_PASSWORD;
  assert.equal(verifyAdminPassword('secret'), false);
  assert.equal(isValidAdminSession(undefined), false);

  process.env.OFFICE_ADMIN_PASSWORD = 'short7';
  assert.equal(verifyAdminPassword('short7'), false);
  process.env.OFFICE_ADMIN_PASSWORD = 'valid-8!';
  assert.equal(verifyAdminPassword('valid-8!'), true);

  process.env.OFFICE_ADMIN_PASSWORD = 'a-long-synthetic-admin-password';
  const now = Date.UTC(2026, 10, 10, 9);
  const token = createAdminSession(now);
  assert.equal(verifyAdminPassword('a-long-synthetic-admin-password'), true);
  assert.equal(verifyAdminPassword('incorrect-password'), false);
  assert.equal(isValidAdminSession(token, now), true);
  assert.equal(isValidAdminSession(`${token}x`, now), false);
  assert.equal(isValidAdminSession(token, now + 9 * 60 * 60 * 1000), false);
  assert.equal(adminSessionFromCookie(`theme=dark; office_admin_session=${token}`), token);
  assert.match(adminCookie(token, true), /HttpOnly; SameSite=Strict; Path=\/api\/workflow; Max-Age=28800; Secure/);
  assert.match(clearAdminCookie(false), /Max-Age=0/);

  t.after(() => {
    if (previous === undefined) delete process.env.OFFICE_ADMIN_PASSWORD;
    else process.env.OFFICE_ADMIN_PASSWORD = previous;
  });
});
