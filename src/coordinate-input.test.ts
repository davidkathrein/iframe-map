import assert from "node:assert/strict";
import test from "node:test";
import { updateCoordinateFromInput } from "./coordinate-input.ts";

const initial: [number, number] = [9.621234, 47.199123];

test("Längengrad ändert ausschließlich die erste Koordinate", () => {
  assert.deepEqual(
    updateCoordinateFromInput(initial, "longitude", "9.700001"),
    [9.700001, 47.199123],
  );
});

test("Breitengrad ändert ausschließlich die zweite Koordinate", () => {
  assert.deepEqual(
    updateCoordinateFromInput(initial, "latitude", "47.250001"),
    [9.621234, 47.250001],
  );
});

test("deutsches Dezimalkomma wird unterstützt", () => {
  assert.deepEqual(
    updateCoordinateFromInput(initial, "longitude", "9,700001"),
    [9.700001, 47.199123],
  );
});

test("ungültige oder vertauschte Achsenwerte werden nicht übernommen", () => {
  assert.equal(updateCoordinateFromInput(initial, "longitude", ""), null);
  assert.equal(updateCoordinateFromInput(initial, "latitude", "120"), null);
});
