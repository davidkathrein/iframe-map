import { isAuthenticated, isSameOrigin } from "../server/auth.js";
import { resolveGoogleMapsCoordinates } from "../server/google-maps.js";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...jsonHeaders, ...init.headers },
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Ungültige Anfrage." }, { status: 403 });
  if (!isAuthenticated(request)) return json({ error: "Bitte erneut anmelden." }, { status: 401 });

  try {
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== "string") return json({ error: "Google-Maps-Link fehlt." }, { status: 400 });
    const coordinates = await resolveGoogleMapsCoordinates(body.url);
    return json({ coordinates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Koordinaten konnten nicht ermittelt werden.";
    return json({ error: message }, { status: 422 });
  }
}

