import assert from "node:assert/strict";
import test from "node:test";
import {
  isSameOrigin,
  loginRateLimit,
  recordFailedLogin,
} from "../server/auth.ts";
import { hasValidImageSignature } from "../server/images.ts";
import {
  FEATURES,
  FILTERS,
  isClosedPolygon,
  polygonForPlace,
  type PlaceRecord,
} from "./places.ts";

test("jedes Merkmal ist einzeln filterbar", () => {
  assert.ok(FILTERS.every((filter) => filter.features.length === 1));
  assert.deepEqual(
    new Set(FILTERS.flatMap((filter) => filter.features)),
    new Set(FEATURES),
  );
});

test("abgeleitete Flächen sind geschlossen und überall wiederverwendbar", () => {
  const place: PlaceRecord = {
    municipality: "Satteins",
    name: "Testort",
    icon: "nature",
    features: ["Wald & Natur"],
    geometry: "area",
    coordinates: [9.67, 47.21],
  };
  const polygon = polygonForPlace(place);
  assert.equal(isClosedPolygon(polygon), true);
  assert.deepEqual(polygon[0], polygon[polygon.length - 1]);
  assert.ok(polygon.flat().every((coordinate) => (String(coordinate).split(".")[1]?.length ?? 0) <= 6));
});

test("offene oder außerhalb der Welt liegende Polygone werden abgelehnt", () => {
  assert.equal(isClosedPolygon([[9, 47], [10, 47], [10, 48], [9, 48]]), false);
  assert.equal(isClosedPolygon([[200, 47], [10, 47], [10, 48], [200, 47]]), false);
  assert.equal(isClosedPolygon([[9, 47], [9, 47], [9, 47], [9, 47]]), false);
});

test("Bildtypen werden anhand ihrer Dateisignatur geprüft", () => {
  assert.equal(hasValidImageSignature("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff])), true);
  assert.equal(hasValidImageSignature("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(hasValidImageSignature("image/webp", new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), true);
  assert.equal(hasValidImageSignature("image/jpeg", new TextEncoder().encode("<html>")), false);
});

test("Same-Origin-Prüfung lehnt andere Protokolle und kaputte Origins ab", () => {
  assert.equal(isSameOrigin(new Request("https://example.com/api", { headers: { origin: "https://example.com" } })), true);
  assert.equal(isSameOrigin(new Request("https://example.com/api", { headers: { origin: "http://example.com" } })), false);
  assert.equal(isSameOrigin(new Request("https://example.com/api", { headers: { origin: "kein-url" } })), false);
});

test("wiederholte fehlgeschlagene Logins werden gedrosselt", () => {
  const request = new Request("https://example.com/api/session", {
    headers: { "x-forwarded-for": "192.0.2.10" },
  });
  assert.equal(loginRateLimit(request).limited, false);
  for (let attempt = 0; attempt < 5; attempt += 1) recordFailedLogin(request);
  assert.equal(loginRateLimit(request).limited, true);
  assert.ok(loginRateLimit(request).retryAfter > 0);
});
