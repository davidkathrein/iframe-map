import { clearSessionCookie, createSessionCookie, isAuthenticated, isSameOrigin, isValidPassword } from "../server/auth.js";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...jsonHeaders, ...init.headers },
  });
}

export function GET(request: Request) {
  return json({ authenticated: isAuthenticated(request) });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Ungültige Anfrage." }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  if (!isValidPassword((body as { password?: unknown })?.password)) {
    return json({ error: "Das Passwort ist nicht korrekt." }, { status: 401 });
  }
  return json(
    { authenticated: true },
    { headers: { "Set-Cookie": createSessionCookie() } },
  );
}

export function DELETE(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Ungültige Anfrage." }, { status: 403 });
  return json(
    { authenticated: false },
    { headers: { "Set-Cookie": clearSessionCookie() } },
  );
}
