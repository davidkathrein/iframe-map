import { get, put, type GetBlobResult } from "@vercel/blob";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPlaceId,
  FEATURES,
  ICON_KINDS,
  isClosedPolygon,
  isCoordinatePair,
  type PlaceRecord,
} from "../src/places.js";
import { isGoogleMapsUrl } from "./google-maps.js";

const CURRENT_PATH = "data/places.json";
const MAX_PLACES = 500;
const fallbackPlaces = JSON.parse(
  readFileSync(join(process.cwd(), "src/data/places.json"), "utf8"),
) as unknown;

function storageOptions() {
  return {
    token: process.env.S3_READ_WRITE_TOKEN,
    storeId: process.env.S3_STORE_ID,
  };
}

export type PlacesDocument = {
  places: PlaceRecord[];
  revision: string;
  source: "blob" | "fallback";
};

async function streamToText(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

async function currentBlob(): Promise<GetBlobResult | null> {
  if (!process.env.S3_STORE_ID) return null;
  return get(CURRENT_PATH, {
    access: "private",
    useCache: false,
    ...storageOptions(),
  });
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
      ...storageOptions(),
    });
  }

  const saved = await put(CURRENT_PATH, JSON.stringify(validated, null, 2), {
    access: "private",
    allowOverwrite: Boolean(current),
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...(current ? { ifMatch: current.blob.etag } : {}),
    ...storageOptions(),
  });

  return { conflict: false as const, revision: saved.etag };
}

export function validatePlaces(value: unknown): PlaceRecord[] {
  if (!Array.isArray(value) || value.length > MAX_PLACES) {
    throw new Error("Ungültiges Ortsverzeichnis.");
  }

  const ids = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Eintrag ${index + 1} ist ungültig.`);
    const place = entry as Record<string, unknown>;
    const providedId = typeof place.id === "string" ? place.id.trim() : undefined;
    const municipality = typeof place.municipality === "string" ? place.municipality.trim() : "";
    const name = typeof place.name === "string" ? place.name.trim() : "";
    const id = providedId || createPlaceId({ municipality, name });
    const icon = place.icon;
    const features = place.features;
    const description: string | undefined = typeof place.description === "string" ? place.description.trim() : undefined;
    const imageUrl: string | undefined = typeof place.imageUrl === "string" ? place.imageUrl.trim() : undefined;
    const googleMapsUrl: string | undefined = typeof place.googleMapsUrl === "string" ? place.googleMapsUrl.trim() : undefined;

    if (id.length > 120 || ids.has(id)) throw new Error(`Eintrag ${index + 1} hat keine eindeutige ID.`);
    ids.add(id);
    if (!municipality || municipality.length > 100 || !name || name.length > 160) {
      throw new Error(`Eintrag ${index + 1} benötigt Gemeinde und Name.`);
    }
    if (!ICON_KINDS.includes(icon as never)) throw new Error(`Eintrag ${index + 1} hat ein ungültiges Icon.`);
    if (!Array.isArray(features) || features.length === 0 || features.some((feature) => !FEATURES.includes(feature as never))) {
      throw new Error(`Eintrag ${index + 1} hat ungültige Merkmale.`);
    }
    if (place.coordinates !== undefined && !isCoordinatePair(place.coordinates)) {
      throw new Error(`Eintrag ${index + 1} hat ungültige Koordinaten.`);
    }
    if (place.polygon !== undefined && !isClosedPolygon(place.polygon)) {
      throw new Error(`Eintrag ${index + 1} hat ein ungültiges Polygon.`);
    }
    if (place.geometry !== undefined && place.geometry !== "point" && place.geometry !== "area") {
      throw new Error(`Eintrag ${index + 1} hat eine ungültige Geometrie.`);
    }
    if (place.description !== undefined && typeof place.description !== "string") {
      throw new Error(`Die Beschreibung von Eintrag ${index + 1} ist ungültig.`);
    }
    if (description !== undefined && description.length > 250) {
      throw new Error(`Die Beschreibung von Eintrag ${index + 1} ist zu lang.`);
    }
    if (place.imageUrl !== undefined && typeof place.imageUrl !== "string") {
      throw new Error(`Eintrag ${index + 1} hat eine ungültige Bild-URL.`);
    }
    if (imageUrl !== undefined) {
      if (imageUrl.length > 2000) throw new Error(`Eintrag ${index + 1} hat eine ungültige Bild-URL.`);
      try {
        const url = new URL(imageUrl);
        if (url.protocol !== "https:") throw new Error();
      } catch {
        throw new Error(`Eintrag ${index + 1} hat eine ungültige Bild-URL.`);
      }
    }
    if (place.googleMapsUrl !== undefined && typeof place.googleMapsUrl !== "string") {
      throw new Error(`Eintrag ${index + 1} hat einen ungültigen Google-Maps-Link.`);
    }
    if (googleMapsUrl !== undefined) {
      if (googleMapsUrl.length > 2000) {
        throw new Error(`Eintrag ${index + 1} hat einen ungültigen Google-Maps-Link.`);
      }
      if (!isGoogleMapsUrl(googleMapsUrl)) {
        throw new Error(`Eintrag ${index + 1} hat keinen gültigen Google-Maps-Link.`);
      }
    }

    return {
      id,
      municipality,
      name,
      icon: icon as PlaceRecord["icon"],
      features: Array.from(new Set(features)) as PlaceRecord["features"],
      ...(place.geometry ? { geometry: place.geometry as "point" | "area" } : {}),
      ...(description ? { description } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(googleMapsUrl ? { googleMapsUrl } : {}),
      ...(place.coordinates ? { coordinates: place.coordinates as [number, number] } : {}),
      ...(place.polygon ? { polygon: place.polygon as [number, number][] } : {}),
    };
  });
}
