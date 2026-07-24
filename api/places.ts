import { BlobPreconditionFailedError } from "@vercel/blob";
import { isAuthenticated, isSameOrigin } from "../server/auth.js";
import { readPlaces, writePlaces } from "../server/places.js";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...jsonHeaders, ...init.headers },
  });
}

export async function GET() {
  try {
    return json(await readPlaces());
  } catch (error) {
    console.error("Ortsverzeichnis konnte nicht geladen werden.", error);
    return json({ error: "Ortsverzeichnis konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Ungültige Anfrage." }, { status: 403 });
  if (!isAuthenticated(request)) return json({ error: "Bitte erneut anmelden." }, { status: 401 });

  try {
    const body = await request.json() as { places?: unknown; revision?: unknown };
    const result = await writePlaces(body.places, body.revision);
    if (result.conflict) {
      return json(
        { error: "Die Daten wurden zwischenzeitlich geändert. Bitte neu laden.", revision: result.revision },
        { status: 409 },
      );
    }
    return json({ saved: true, revision: result.revision });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) {
      return json({ error: "Die Daten wurden zwischenzeitlich geändert. Bitte neu laden." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
    console.error("Ortsverzeichnis konnte nicht gespeichert werden.", error);
    return json({ error: message }, { status: 400 });
  }
}
