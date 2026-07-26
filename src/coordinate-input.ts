export type CoordinateAxis = "longitude" | "latitude";

export function updateCoordinateFromInput(
  coordinates: [number, number],
  axis: CoordinateAxis,
  input: string,
): [number, number] | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  if (axis === "longitude" && (value < -180 || value > 180)) return null;
  if (axis === "latitude" && (value < -90 || value > 90)) return null;
  return axis === "longitude"
    ? [value, coordinates[1]]
    : [coordinates[0], value];
}
