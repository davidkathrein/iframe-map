import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { isAuthenticated, isSameOrigin } from "../server/auth.js";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const MAX_IMAGE_BYTES = 4_000_000;
const imageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...jsonHeaders, ...init.headers },
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Ungültige Anfrage." }, { status: 403 });
  if (!isAuthenticated(request)) return json({ error: "Bitte erneut anmelden." }, { status: 401 });
  if (!process.env.BLOB_STORE_ID) {
    return json({ error: "Der öffentliche Bildspeicher ist nicht verbunden." }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File)) {
      return json({ error: "Bitte eine Bilddatei auswählen." }, { status: 400 });
    }

    const extension = imageTypes[value.type as keyof typeof imageTypes];
    if (!extension) {
      return json({ error: "Erlaubt sind JPG-, PNG- und WebP-Bilder." }, { status: 400 });
    }
    if (value.size === 0 || value.size > MAX_IMAGE_BYTES) {
      return json({ error: "Das Bild darf höchstens 4 MB groß sein." }, { status: 400 });
    }

    const pathname = `places/images/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const blob = await put(pathname, value, {
      access: "public",
      contentType: value.type,
      cacheControlMaxAge: 365 * 24 * 60 * 60,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      storeId: process.env.BLOB_STORE_ID,
    });

    return json({ url: blob.url });
  } catch (error) {
    console.error("Bild konnte nicht hochgeladen werden.", error);
    return json({ error: "Bild konnte nicht hochgeladen werden." }, { status: 500 });
  }
}

