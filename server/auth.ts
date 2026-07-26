import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "__Host-walgau_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_TRACKED_CLIENTS = 1_000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET muss mindestens 32 Zeichen lang sein.");
  }
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function parseCookies(request: Request) {
  const cookies = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    cookies.set(part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim()));
  }
  return cookies;
}

function loginKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export function loginRateLimit(request: Request) {
  const key = loginKey(request);
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.delete(key);
    return { limited: false, retryAfter: 0 };
  }
  return {
    limited: current.count >= MAX_LOGIN_ATTEMPTS,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function recordFailedLogin(request: Request) {
  const key = loginKey(request);
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.forEach((attempt, trackedKey) => {
      if (attempt.resetAt <= now) loginAttempts.delete(trackedKey);
    });
    if (loginAttempts.size >= MAX_TRACKED_CLIENTS) {
      const oldestKey = loginAttempts.keys().next().value;
      if (oldestKey) loginAttempts.delete(oldestKey);
    }
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  current.count += 1;
}

export function clearFailedLogins(request: Request) {
  loginAttempts.delete(loginKey(request));
}

export function delayFailedLogin() {
  return new Promise((resolve) => setTimeout(resolve, 750));
}

export function isValidPassword(password: unknown) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword || configuredPassword.length < 12 || typeof password !== "string") {
    return false;
  }
  return safeEqual(password, configuredPassword);
}

export function createSessionCookie() {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString("base64url");
  const token = `${payload}.${signature(payload)}`;
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function isAuthenticated(request: Request) {
  try {
    const token = parseCookies(request).get(COOKIE_NAME);
    if (!token) return false;
    const [payload, providedSignature] = token.split(".");
    if (!payload || !providedSignature || !safeEqual(signature(payload), providedSignature)) return false;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof session.exp === "number" && session.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
