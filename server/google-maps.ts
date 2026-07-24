const coordinateNumber = "-?\\d{1,3}(?:\\.\\d+)?";
const googleMapsHostname = /^(?:(?:www|maps)\.)?google\.(?:com|at|de|ch|it|fr|co\.uk)$/;
const googleRedirectHostname = /^(?:[a-z0-9-]+\.)*google\.(?:com|at|de|ch|it|fr|co\.uk)$/;

function validCoordinates(latitude: number, longitude: number): [number, number] | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return [Number(longitude.toFixed(7)), Number(latitude.toFixed(7))];
}

export function isGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && (
      hostname === "maps.app.goo.gl"
      || (hostname === "goo.gl" && url.pathname.startsWith("/maps"))
      || (googleMapsHostname.test(hostname) && url.pathname.startsWith("/maps"))
    );
  } catch {
    return false;
  }
}

function isSafeGoogleRedirect(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return url.protocol === "https:" && (
    hostname === "maps.app.goo.gl"
    || hostname === "goo.gl"
    || googleRedirectHostname.test(hostname)
  );
}

export function coordinatesFromGoogleMapsUrl(value: string): [number, number] | null {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the original value if it contains malformed percent encoding.
  }

  const atMatch = decoded.match(new RegExp(`/@(${coordinateNumber}),(${coordinateNumber})(?:,|/|$)`));
  if (atMatch) return validCoordinates(Number(atMatch[1]), Number(atMatch[2]));

  const placeDataMatch = decoded.match(new RegExp(`!3d(${coordinateNumber})!4d(${coordinateNumber})`));
  if (placeDataMatch) return validCoordinates(Number(placeDataMatch[1]), Number(placeDataMatch[2]));

  const alternateDataMatch = decoded.match(new RegExp(`!2d(${coordinateNumber})!3d(${coordinateNumber})`));
  if (alternateDataMatch) return validCoordinates(Number(alternateDataMatch[2]), Number(alternateDataMatch[1]));

  try {
    const url = new URL(decoded);
    for (const key of ["query", "ll", "destination"]) {
      const pair = url.searchParams.get(key)?.match(new RegExp(`^(${coordinateNumber}),\\s*(${coordinateNumber})$`));
      if (pair) return validCoordinates(Number(pair[1]), Number(pair[2]));
    }
  } catch {
    // The caller validates URLs separately.
  }

  return null;
}

export async function resolveGoogleMapsCoordinates(value: string) {
  if (!isGoogleMapsUrl(value)) throw new Error("Bitte einen gültigen Google-Maps-Link einfügen.");

  let currentUrl = new URL(value);
  for (let redirect = 0; redirect <= 6; redirect += 1) {
    const directCoordinates = coordinatesFromGoogleMapsUrl(currentUrl.href);
    if (directCoordinates) return directCoordinates;

    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; Walgau-Karte/1.0)",
      },
      signal: AbortSignal.timeout(8_000),
    });

    const location = response.headers.get("location");
    if (!location) break;
    const nextUrl = new URL(location, currentUrl);
    if (!isSafeGoogleRedirect(nextUrl)) throw new Error("Google Maps hat auf eine unerwartete Adresse weitergeleitet.");
    currentUrl = nextUrl;
  }

  throw new Error("In diesem Google-Maps-Link wurden keine Koordinaten gefunden.");
}
