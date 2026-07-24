import { get, put, type GetBlobResult } from "@vercel/blob";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CATEGORIES = [
  "Gewässer",
  "Schatten",
  "Park & Ruhe",
  "Wald & Natur",
  "Aussicht & Höhe",
  "Familie & Spiel",
  "Geschichte & Kultur",
] as const;
const ICON_KINDS = ["water", "park", "nature", "mountain", "family", "culture"] as const;

type PlaceRecord = {
  id?: string;
  municipality: string;
  name: string;
  icon: (typeof ICON_KINDS)[number];
  features: Array<(typeof CATEGORIES)[number]>;
  geometry?: "point" | "area";
  description?: string;
  imageUrl?: string;
  coordinates?: [number, number];
  polygon?: [number, number][];
};

const CURRENT_PATH = "data/places.json";
const MAX_PLACES = 500;
const fallbackPlaces = JSON.parse(
  readFileSync(join(process.cwd(), "src/data/places.json"), "utf8"),
) as unknown;

export type PlacesDocument = {
  places: PlaceRecord[];
  revision: string;
  source: "blob" | "fallback";
};

async function streamToText(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

async function currentBlob(): Promise<GetBlobResult | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return null;
  return get(CURRENT_PATH, { access: "private", useCache: false });
}

export async function readPlaces(): Promise<PlacesDocument> {
  const result = await currentBlob();
  if (result?.statusCode === 200 && result.stream) {
    const parsed = JSON.parse(await streamToText(result.stream));
    const places = validatePlaces(parsed);
    return { places, revision: result.blob.etag, source: "blob" };
  }
  return {
    places: validatePlaces(fallbackPlaces),
    revision: "fallback",
    source: "fallback",
  };
}

export async function writePlaces(places: unknown, expectedRevision: unknown) {
  const validated = validatePlaces(places);
  const current = await currentBlob();
  const currentRevision = current?.blob.etag ?? "fallback";

  if (typeof expectedRevision !== "string" || expectedRevision !== currentRevision) {
    return { conflict: true as const, revision: currentRevision };
  }

  if (current?.statusCode === 200 && current.stream) {
    const backupBody = await streamToText(current.stream);
    await put(`data/history/places-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, backupBody, {
      access: "private",
      addRandomSuffix: true,
      contentType: "application/json",
    });
  }

  const saved = await put(CURRENT_PATH, JSON.stringify(validated, null, 2), {
    access: "private",
    allowOverwrite: Boolean(current),
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...(current ? { ifMatch: current.blob.etag } : {}),
  });

  return { conflict: false as const, revision: saved.etag };
}

function isCoordinatePair(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
    && value[0] >= -180 && value[0] <= 180
    && value[1] >= -90 && value[1] <= 90;
}

export function validatePlaces(value: unknown): PlaceRecord[] {
  if (!Array.isArray(value) || value.length > MAX_PLACES) {
    throw new Error("Ungültiges Ortsverzeichnis.");
  }

  const ids = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Eintrag ${index + 1} ist ungültig.`);
    const place = entry as Record<string, unknown>;
    const id = typeof place.id === "string" ? place.id.trim() : undefined;
    const municipality = typeof place.municipality === "string" ? place.municipality.trim() : "";
    const name = typeof place.name === "string" ? place.name.trim() : "";
    const icon = place.icon;
    const features = place.features;

    if (id && (id.length > 120 || ids.has(id))) throw new Error(`Eintrag ${index + 1} hat keine eindeutige ID.`);
    if (id) ids.add(id);
    if (!municipality || municipality.length > 100 || !name || name.length > 160) {
      throw new Error(`Eintrag ${index + 1} benötigt Gemeinde und Name.`);
    }
    if (!ICON_KINDS.includes(icon as never)) throw new Error(`Eintrag ${index + 1} hat ein ungültiges Icon.`);
    if (!Array.isArray(features) || features.length === 0 || features.some((feature) => !CATEGORIES.includes(feature as never))) {
      throw new Error(`Eintrag ${index + 1} hat ungültige Merkmale.`);
    }
    if (place.coordinates !== undefined && !isCoordinatePair(place.coordinates)) {
      throw new Error(`Eintrag ${index + 1} hat ungültige Koordinaten.`);
    }
    if (place.polygon !== undefined && (!Array.isArray(place.polygon) || place.polygon.length < 4 || place.polygon.length > 500 || !place.polygon.every(isCoordinatePair))) {
      throw new Error(`Eintrag ${index + 1} hat ein ungültiges Polygon.`);
    }
    if (place.geometry !== undefined && place.geometry !== "point" && place.geometry !== "area") {
      throw new Error(`Eintrag ${index + 1} hat eine ungültige Geometrie.`);
    }
    if (place.description !== undefined && (typeof place.description !== "string" || place.description.length > 500)) {
      throw new Error(`Die Beschreibung von Eintrag ${index + 1} ist zu lang.`);
    }
    if (place.imageUrl !== undefined) {
      if (typeof place.imageUrl !== "string" || place.imageUrl.length > 2000) throw new Error(`Eintrag ${index + 1} hat eine ungültige Bild-URL.`);
      try {
        const url = new URL(place.imageUrl);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        throw new Error(`Eintrag ${index + 1} hat eine ungültige Bild-URL.`);
      }
    }

    return {
      ...(id ? { id } : {}),
      municipality,
      name,
      icon: icon as PlaceRecord["icon"],
      features: Array.from(new Set(features)) as PlaceRecord["features"],
      ...(place.geometry ? { geometry: place.geometry as "point" | "area" } : {}),
      ...(place.description ? { description: place.description as string } : {}),
      ...(place.imageUrl ? { imageUrl: place.imageUrl as string } : {}),
      ...(place.coordinates ? { coordinates: place.coordinates as [number, number] } : {}),
      ...(place.polygon ? { polygon: place.polygon as [number, number][] } : {}),
    };
  });
}
