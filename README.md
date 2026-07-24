# Kühle Orte im Walgau

Eigenständige, responsive iFrame-Karte für imwalgau.at. Die Karte basiert auf den lokalen [mapcn](https://www.mapcn.dev/)-Komponenten (MapLibre GL), nutzt die helle CARTO-Positron-Basiskarte und wird als statische Vercel-Anwendung ausgeliefert.

## Lokal starten

```bash
npm install
npm run dev
```

Der Produktions-Build wird mit `npm run build` erstellt.

## Orte pflegen

Die geschützte Pflegeoberfläche ist unter `/pflege` erreichbar. Dort können Orte
gesucht, ergänzt und gelöscht sowie Kartenpunkte direkt verschoben werden. Änderungen
werden ohne neues Deployment veröffentlicht.

### Vercel einmalig einrichten

1. Im Vercel-Projekt unter **Storage** einen privaten Blob Store erstellen und mit
   dem Projekt verbinden. Vercel setzt dadurch `BLOB_READ_WRITE_TOKEN`.
2. Unter **Settings → Environment Variables** ergänzen:
   - `ADMIN_PASSWORD`: ein starkes Passwort mit mindestens 12 Zeichen
   - `SESSION_SECRET`: ein zufälliger Wert mit mindestens 32 Zeichen
3. Das Projekt neu deployen.

Beim ersten Speichern wird der lokale Ausgangsstand in Blob übernommen. Vor späteren
Änderungen legt die API unter `data/history/` automatisch eine Sicherung an. Die
öffentliche Karte lädt den aktuellen Blob-Stand und fällt bei nicht verfügbarem Blob
auf [src/data/places.json](./src/data/places.json) zurück.

Das Pflegepasswort wird ausschließlich in der Vercel Function geprüft. Nach der
Anmeldung gilt ein signiertes, `HttpOnly`-geschütztes Sitzungscookie acht Stunden.

### Lokal testen

Die Kartenansicht funktioniert weiterhin mit `npm run dev`. Um auch die Functions
und die Pflegeoberfläche lokal zu testen, die Vercel CLI mit verknüpften
Umgebungsvariablen verwenden:

```bash
vercel env pull .env.local
vercel dev
```

Die versionierte Datei [src/data/places.json](./src/data/places.json) bleibt der
Ausgangsstand und Notfall-Fallback. Ein Eintrag kann diese optionalen Angaben enthalten:

```json
{
  "municipality": "Satteins",
  "name": "Baggersee",
  "icon": "water",
  "features": ["Gewässer", "Familie & Spiel"],
  "coordinates": [9.672, 47.215],
  "description": "Kurze Beschreibung mit höchstens etwa 250 Zeichen.",
  "imageUrl": "https://<blob-store>/orte/baggersee.jpg"
}
```

Ohne `coordinates` wird eine vorläufige Position aus Name und Gemeinde abgeleitet. Für präzise Kartenpunkte einfach `coordinates` im Format `[Längengrad, Breitengrad]` ergänzen.

Flächen erhalten zusätzlich `"geometry": "area"`. Optional kann ihre tatsächliche Geometrie als geschlossenes Polygon angegeben werden:

```json
"polygon": [[9.67, 47.21], [9.68, 47.21], [9.68, 47.22], [9.67, 47.21]]
```

Für Bilder die öffentliche Vercel-Blob-URL in `imageUrl` eintragen. Fehlt sie, bleibt die Ortskarte bewusst bildlos.

Erlaubte Anzeige-Icons sind `water`, `park`, `nature`, `mountain`, `family` und `culture`.

## iFrame einbetten

Nach dem Vercel-Deployment die Projekt-URL einsetzen:

```html
<iframe
  src="https://<dein-projekt>.vercel.app"
  title="Kühle Orte im Walgau"
  loading="lazy"
  allowfullscreen
  style="width: 100%; height: min(1040px, 88vh); min-height: 680px; border: 0"
></iframe>
```

Die Vercel-Konfiguration erlaubt die Einbettung durch `imwalgau.at` und `www.imwalgau.at` über `Content-Security-Policy: frame-ancestors`.
