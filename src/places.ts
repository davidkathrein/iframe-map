export const CATEGORIES = [
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
  { id: "nature", label: "Wald & Natur", categories: ["Wald & Natur"] },
  { id: "water", label: "Gewässer", categories: ["Gewässer"] },
  { id: "shade", label: "Schatten", categories: ["Schatten"] },
  { id: "rest", label: "Park & Ruhe", categories: ["Park & Ruhe"] },
  { id: "other", label: "Sonstige", categories: ["Aussicht & Höhe", "Familie & Spiel", "Geschichte & Kultur"] },
] as const satisfies ReadonlyArray<{ id: string; label: string; categories: readonly Category[] }>;

export type Category = (typeof CATEGORIES)[number];
export type Filter = (typeof FILTERS)[number]["id"];
export type IconKind = (typeof ICON_KINDS)[number];

export type PlaceRecord = {
  id?: string;
  municipality: string;
  name: string;
  icon: IconKind;
  features: Category[];
  geometry?: "point" | "area";
  description?: string;
  imageUrl?: string;
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

export function createPlaceId(place: Pick<PlaceRecord, "municipality" | "name">) {
  const slug = `${place.municipality}-${place.name}`
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
  return slug || `ort-${crypto.randomUUID()}`;
}

export function coordinatesForPlace(place: PlaceRecord): [number, number] {
  if (place.coordinates) return place.coordinates;
  const [longitude, latitude] = municipalityCenters[place.municipality] ?? [9.72, 47.2];
  const seed = hash(`${place.municipality}-${place.name}`);
  const longitudeOffset = ((seed % 1000) / 1000 - 0.5) * 0.018;
  const latitudeOffset = (((seed >>> 10) % 1000) / 1000 - 0.5) * 0.012;
  return [longitude + longitudeOffset, latitude + latitudeOffset];
}

export function normalizePlaces(records: PlaceRecord[]): Place[] {
  return records.map((place) => ({
    ...place,
    id: place.id ?? createPlaceId(place),
    coordinates: coordinatesForPlace(place),
    geometry: place.geometry ?? "point",
  }));
}

