import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const cookieName = 'office_admin_session';
const sessionLifetimeSeconds = 8 * 60 * 60;
const minimumPasswordLength = 8;

export class AdminAuthError extends Error {
  constructor(message: string, public readonly status = 503) {
    super(message);
  }
}

function adminPassword(): string {
  const password = process.env.OFFICE_ADMIN_PASSWORD;
  if (!password || password.length < minimumPasswordLength) {
    throw new AdminAuthError(`OFFICE_ADMIN_PASSWORD harus diatur dengan minimal ${minimumPasswordLength} karakter unik.`);
  }
  return password;
}

function sign(expiration: string): string {
  return createHmac('sha256', adminPassword()).update(expiration).digest('base64url');
}

export function adminConfigured(): boolean {
  return Boolean(process.env.OFFICE_ADMIN_PASSWORD && process.env.OFFICE_ADMIN_PASSWORD.length >= minimumPasswordLength);
}

export function verifyAdminPassword(candidate: unknown): boolean {
  if (typeof candidate !== 'string' || !adminConfigured()) return false;
  const expected = createHash('sha256').update(adminPassword()).digest();
  const actual = createHash('sha256').update(candidate).digest();
  return timingSafeEqual(actual, expected);
}

export function createAdminSession(now = Date.now()): string {
  const expiration = String(Math.floor(now / 1000) + sessionLifetimeSeconds);
  return `${expiration}.${sign(expiration)}`;
}

export function isValidAdminSession(token: string | undefined, now = Date.now()): boolean {
  if (!token || !adminConfigured()) return false;
  const [expiration, suppliedSignature, extra] = token.split('.');
  if (!expiration || !suppliedSignature || extra !== undefined || !/^\d{10,12}$/.test(expiration) ||
      Number(expiration) <= Math.floor(now / 1000)) return false;
  try {
    const expectedSignature = Buffer.from(sign(expiration));
    const actualSignature = Buffer.from(suppliedSignature);
    return expectedSignature.length === actualSignature.length && timingSafeEqual(actualSignature, expectedSignature);
  } catch {
    return false;
  }
}

export function adminSessionFromCookie(cookieHeader: string | undefined): string | undefined {
  const entry = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return entry?.slice(cookieName.length + 1);
}

export function adminCookie(token: string, secure: boolean): string {
  return `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api/workflow; Max-Age=${sessionLifetimeSeconds}${secure ? '; Secure' : ''}`;
}

export function clearAdminCookie(secure: boolean): string {
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api/workflow; Max-Age=0${secure ? '; Secure' : ''}`;
}
