export const FEATURES = [
  "Gewässer",
  "Schatten",
  "Park & Ruhe",
  "Wald & Natur",
  "Aussicht & Höhe",
  "Familie & Spiel",
  "Geschichte & Kultur",
] as const;

export const ICON_KINDS = [
  "water",
  "park",
  "nature",
  "mountain",
  "family",
  "culture",
] as const;

export const FILTERS = [
  { id: "water", label: "Gewässer", features: ["Gewässer"] },
  { id: "shade", label: "Schatten", features: ["Schatten"] },
  { id: "rest", label: "Park & Ruhe", features: ["Park & Ruhe"] },
  { id: "nature", label: "Wald & Natur", features: ["Wald & Natur"] },
  { id: "height", label: "Aussicht & Höhe", features: ["Aussicht & Höhe"] },
  { id: "family", label: "Familie & Spiel", features: ["Familie & Spiel"] },
  { id: "culture", label: "Geschichte & Kultur", features: ["Geschichte & Kultur"] },
] as const satisfies ReadonlyArray<{ id: string; label: string; features: readonly PlaceFeature[] }>;

export type PlaceFeature = (typeof FEATURES)[number];
export type Filter = (typeof FILTERS)[number]["id"];
export type IconKind = (typeof ICON_KINDS)[number];

export type PlaceRecord = {
  id?: string;
  municipality: string;
  name: string;
  icon: IconKind;
  features: PlaceFeature[];
  geometry?: "point" | "area";
  description?: string;
  imageUrl?: string;
  googleMapsUrl?: string;
  coordinates?: [number, number];
  polygon?: [number, number][];
};

export type Place = Omit<PlaceRecord, "id" | "coordinates" | "geometry"> & {
  id: string;
  coordinates: [number, number];
  geometry: "point" | "area";
};

const municipalityCenters: Record<string, [number, number]> = {
  Göfis: [9.635, 47.233],
  Satteins: [9.672, 47.215],
  Röns: [9.671, 47.218],
  Schnifis: [9.677, 47.204],
  Düns: [9.712, 47.228],
  Dünserberg: [9.72, 47.24],
  Schlins: [9.7, 47.22],
  Bludesch: [9.735, 47.2],
  Ludesch: [9.78, 47.2],
  Thüringen: [9.77, 47.196],
  Nüziders: [9.8, 47.17],
  Bürs: [9.8, 47.15],
  Nenzing: [9.7, 47.18],
  Frastanz: [9.63, 47.22],
  Thüringerberg: [9.85, 47.2],
};

function hash(value: string) {
  return Array.from(value).reduce((sum, char) => ((sum * 31 + char.charCodeAt(0)) >>> 0), 7);
}

export function roundCoordinates([longitude, latitude]: [number, number]): [number, number] {
  return [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))];
}

export function createPlaceId(place: Pick<PlaceRecord, "municipality" | "name">) {
  const slug = `${place.municipality}-${place.name}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `ort-${crypto.randomUUID()}`;
}

export function coordinatesForPlace(place: PlaceRecord): [number, number] {
  if (place.coordinates) return place.coordinates;
  const [longitude, latitude] = municipalityCenters[place.municipality] ?? [9.72, 47.2];
  const seed = hash(`${place.municipality}-${place.name}`);
  const longitudeOffset = ((seed % 1000) / 1000 - 0.5) * 0.018;
  const latitudeOffset = (((seed >>> 10) % 1000) / 1000 - 0.5) * 0.012;
  return roundCoordinates([longitude + longitudeOffset, latitude + latitudeOffset]);
}

export function isCoordinatePair(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
    && value[0] >= -180 && value[0] <= 180
    && value[1] >= -90 && value[1] <= 90;
}

export function isClosedPolygon(value: unknown): value is [number, number][] {
  if (!Array.isArray(value) || value.length < 4 || value.length > 500 || !value.every(isCoordinatePair)) {
    return false;
  }
  const first = value[0];
  const last = value[value.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return false;

  const vertices = value.slice(0, -1);
  if (new Set(vertices.map(([longitude, latitude]) => `${longitude},${latitude}`)).size < 3) return false;
  const twiceArea = vertices.reduce((area, [longitude, latitude], index) => {
    const [nextLongitude, nextLatitude] = vertices[(index + 1) % vertices.length];
    return area + longitude * nextLatitude - nextLongitude * latitude;
  }, 0);
  return Math.abs(twiceArea) > 1e-12;
}

export function polygonForPlace(place: PlaceRecord): [number, number][] {
  if (place.polygon && place.polygon.length >= 4) return place.polygon;

  const [longitude, latitude] = coordinatesForPlace(place);
  const horizontal = 0.009;
  const vertical = 0.005;
  return [
    [longitude - horizontal, latitude - vertical],
    [longitude + horizontal, latitude - vertical * 0.6],
    [longitude + horizontal * 0.65, latitude + vertical],
    [longitude - horizontal * 0.7, latitude + vertical * 0.7],
    [longitude - horizontal, latitude - vertical],
  ].map((coordinate) => roundCoordinates(coordinate as [number, number]));
}

export function normalizePlaces(records: PlaceRecord[]): Place[] {
  return records.map((place) => ({
    ...place,
    id: place.id ?? createPlaceId(place),
    coordinates: coordinatesForPlace(place),
    geometry: place.geometry ?? "point",
  }));
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de");
}

export function placeMatchesQuery(place: Pick<PlaceRecord, "name" | "municipality">, query: string) {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return true;
  return normalizeSearchText(`${place.name} ${place.municipality}`).includes(normalizedQuery);
}
