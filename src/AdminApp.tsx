import { useEffect, useMemo, useState, type ClipboardEvent, type FormEvent } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Image,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  useMap,
} from "@/components/ui/map";
import {
  CATEGORIES,
  ICON_KINDS,
  coordinatesForPlace,
  createPlaceId,
  normalizePlaces,
  type PlaceRecord,
} from "./places";

type PlacesResponse = {
  places: PlaceRecord[];
  revision: string;
  source: "blob" | "fallback";
};

type Notice = { kind: "success" | "error"; text: string } | null;

const iconLabels = {
  water: "Gewässer",
  park: "Park & Ruhe",
  nature: "Wald & Natur",
  mountain: "Aussicht & Höhe",
  family: "Familie & Spiel",
  culture: "Geschichte & Kultur",
} as const;

function parsePastedCoordinates(value: string): [number, number] | null {
  const matches = value.trim().match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g);
  if (matches?.length !== 2) return null;

  const [latitude, longitude] = matches.map(Number);
  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90
    || Math.abs(longitude) > 180
  ) return null;

  return [longitude, latitude];
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw Object.assign(new Error(body.error ?? "Die Anfrage ist fehlgeschlagen."), { status: response.status });
  return body;
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await responseJson(await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }));
      onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-icon"><MapPin size={26} /></div>
        <p className="admin-eyebrow">Kühle Orte im Walgau</p>
        <h1>Datenpflege</h1>
        <p>Mit dem Pflegepasswort anmelden, um Orte und Kartenpositionen zu aktualisieren.</p>
        <label htmlFor="admin-password">Passwort</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          required
        />
        {error && <div className="admin-error"><AlertCircle size={16} />{error}</div>}
        <button className="admin-primary-button" type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="spin" size={18} /> : null}
          Anmelden
        </button>
        <a href="/">Zur öffentlichen Karte</a>
      </form>
    </main>
  );
}

function MapFocus({ place }: { place: PlaceRecord }) {
  const { map } = useMap();
  const coordinates = coordinatesForPlace(place);
  useEffect(() => {
    map?.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 13), duration: 700 });
  }, [map, place.id, coordinates[0], coordinates[1]]);
  return null;
}

function EditorMap({
  places,
  selected,
  onSelect,
  onMove,
}: {
  places: PlaceRecord[];
  selected: PlaceRecord;
  onSelect: (id: string) => void;
  onMove: (coordinates: [number, number]) => void;
}) {
  const normalized = normalizePlaces(places);
  const selectedCoordinates = coordinatesForPlace(selected);

  return (
    <div className="admin-map">
      <Map center={selectedCoordinates} zoom={13} minZoom={8} maxZoom={18} theme="light" attributionControl={{ compact: true }}>
        <MapFocus place={selected} />
        {normalized.map((place) => {
          const active = place.id === selected.id;
          return (
            <MapMarker
              key={place.id}
              longitude={place.coordinates[0]}
              latitude={place.coordinates[1]}
              anchor="bottom"
              draggable={active}
              onClick={() => onSelect(place.id)}
              onDragEnd={active ? ({ lng, lat }) => onMove([lng, lat]) : undefined}
            >
              <MarkerContent>
                <button
                  type="button"
                  className={active ? "admin-marker active" : "admin-marker"}
                  aria-label={active ? `${place.name} verschieben` : place.name}
                  title={active ? "Ziehen, um die Position zu ändern" : place.name}
                >
                  {active ? <MapPin size={20} /> : null}
                </button>
              </MarkerContent>
            </MapMarker>
          );
        })}
        <MapControls position="bottom-right" showCompass={false} showLocate showFullscreen={false} onLocate={({ longitude, latitude }) => onMove([longitude, latitude])} />
      </Map>
      <div className="admin-map-help">
        <MapPin size={16} />
        Grünen Punkt ziehen oder Standort-Schaltfläche verwenden
      </div>
    </div>
  );
}

function PlaceForm({
  place,
  onChange,
  onDelete,
}: {
  place: PlaceRecord;
  onChange: (patch: Partial<PlaceRecord>) => void;
  onDelete: () => void;
}) {
  const coordinates = coordinatesForPlace(place);
  const hasExactCoordinates = Boolean(place.coordinates);

  const setCoordinate = (index: 0 | 1, value: string) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    const next: [number, number] = [...coordinates];
    next[index] = number;
    onChange({ coordinates: next });
  };

  const pasteCoordinates = (event: ClipboardEvent<HTMLInputElement>) => {
    const next = parsePastedCoordinates(event.clipboardData.getData("text"));
    if (!next) return;
    event.preventDefault();
    onChange({ coordinates: next });
  };

  return (
    <div className="admin-form">
      <div className="admin-form-heading">
        <div>
          <span className={hasExactCoordinates ? "coordinate-state exact" : "coordinate-state"}>
            {hasExactCoordinates ? <Check size={13} /> : <AlertCircle size={13} />}
            {hasExactCoordinates ? "Position bestätigt" : "Position noch automatisch geschätzt"}
          </span>
          <h2>{place.name || "Neuer Ort"}</h2>
        </div>
        <button className="admin-icon-button danger" type="button" onClick={onDelete} title="Ort löschen"><Trash2 size={18} /></button>
      </div>

      <div className="admin-field-grid">
        <label>
          <span>Name</span>
          <input value={place.name} maxLength={160} onChange={(event) => onChange({ name: event.target.value })} required />
        </label>
        <label>
          <span>Gemeinde</span>
          <input value={place.municipality} maxLength={100} onChange={(event) => onChange({ municipality: event.target.value })} required />
        </label>
      </div>

      <label>
        <span>Kurzbeschreibung <small>{place.description?.length ?? 0}/500</small></span>
        <textarea
          value={place.description ?? ""}
          maxLength={500}
          rows={4}
          placeholder="Was macht diesen Ort besonders?"
          onChange={(event) => onChange({ description: event.target.value || undefined })}
        />
      </label>

      <div className="admin-field-grid">
        <label>
          <span>Anzeige-Icon</span>
          <select value={place.icon} onChange={(event) => onChange({ icon: event.target.value as PlaceRecord["icon"] })}>
            {ICON_KINDS.map((icon) => <option key={icon} value={icon}>{iconLabels[icon]}</option>)}
          </select>
        </label>
        <label>
          <span>Darstellung</span>
          <select value={place.geometry ?? "point"} onChange={(event) => onChange({ geometry: event.target.value as "point" | "area" })}>
            <option value="point">Punkt</option>
            <option value="area">Fläche</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend>Merkmale</legend>
        <div className="admin-feature-grid">
          {CATEGORIES.map((feature) => (
            <label className="admin-checkbox" key={feature}>
              <input
                type="checkbox"
                checked={place.features.includes(feature)}
                onChange={() => {
                  const features = place.features.includes(feature)
                    ? place.features.filter((item) => item !== feature)
                    : [...place.features, feature];
                  if (features.length) onChange({ features });
                }}
              />
              <span>{feature}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="admin-field-grid">
        <label>
          <span>Längengrad</span>
          <input
            type="number"
            step="0.000001"
            value={coordinates[0]}
            onChange={(event) => setCoordinate(0, event.target.value)}
            onPaste={pasteCoordinates}
          />
        </label>
        <label>
          <span>Breitengrad</span>
          <input
            type="number"
            step="0.000001"
            value={coordinates[1]}
            onChange={(event) => setCoordinate(1, event.target.value)}
            onPaste={pasteCoordinates}
          />
        </label>
      </div>

      <label>
        <span>Google-Maps-Link <small>optional</small></span>
        <input
          type="url"
          value={place.googleMapsUrl ?? ""}
          placeholder="https://www.google.com/maps/…"
          onChange={(event) => onChange({ googleMapsUrl: event.target.value.trim() || undefined })}
        />
      </label>
      <div className="admin-link-actions">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.municipality}`)}`}
          target="_blank"
          rel="noreferrer"
        >
          Ort in Google Maps suchen
        </a>
        {place.googleMapsUrl && <a href={place.googleMapsUrl} target="_blank" rel="noreferrer">Gespeicherten Link prüfen</a>}
      </div>

      <ImageUpload
        placeId={place.id ?? "neu"}
        imageUrl={place.imageUrl}
        onChange={(imageUrl) => onChange({ imageUrl })}
      />

      {place.geometry === "area" && (
        <p className="admin-hint">Bei Flächen wird hier der Mittelpunkt verschoben. Ein vorhandenes Polygon bleibt unverändert.</p>
      )}
    </div>
  );
}

function ImageUpload({
  placeId,
  imageUrl,
  onChange,
}: {
  placeId: string;
  imageUrl?: string;
  onChange: (imageUrl: string | undefined) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputId = `place-image-${placeId}`;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await responseJson<{ url: string }>(await fetch("/api/image", {
        method: "POST",
        body: form,
      }));
      onChange(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="admin-image-upload">
      <div className="admin-image-label">
        <span>Ortsbild</span>
        <small>JPG, PNG oder WebP · maximal 4 MB</small>
      </div>
      {imageUrl ? (
        <div className="admin-image-preview">
          <img src={imageUrl} alt="" />
          <button type="button" onClick={() => onChange(undefined)} title="Bild aus dem Ortseintrag entfernen">
            <X size={17} />
          </button>
        </div>
      ) : (
        <div className="admin-image-placeholder"><Image size={24} /><span>Noch kein Bild</span></div>
      )}
      <label className={uploading ? "admin-upload-button disabled" : "admin-upload-button"} htmlFor={inputId}>
        {uploading ? <Loader2 className="spin" size={17} /> : <Upload size={17} />}
        {uploading ? "Bild wird hochgeladen…" : imageUrl ? "Bild ersetzen" : "Bild auswählen und hochladen"}
      </label>
      <input
        id={inputId}
        className="admin-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {imageUrl && <p className="admin-upload-success"><Check size={14} />Bild hochgeladen – Ort noch speichern.</p>}
      {error && <p className="admin-upload-error"><AlertCircle size={14} />{error}</p>}
    </section>
  );
}

function Editor({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [places, setPlaces] = useState<PlaceRecord[]>([]);
  const [revision, setRevision] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const load = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const document = await responseJson<PlacesResponse>(await fetch("/api/places", { cache: "no-store" }));
      const withIds = document.places.map((place) => ({ ...place, id: place.id ?? createPlaceId(place) }));
      setPlaces(withIds);
      setRevision(document.revision);
      setSelectedId((current) => withIds.some((place) => place.id === current) ? current : withIds[0]?.id ?? "");
      setDirty(false);
    } catch (caught) {
      setNotice({ kind: "error", text: caught instanceof Error ? caught.message : "Laden fehlgeschlagen." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const selected = places.find((place) => place.id === selectedId);
  const filteredPlaces = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("de");
    if (!term) return places;
    return places.filter((place) => `${place.name} ${place.municipality}`.toLocaleLowerCase("de").includes(term));
  }, [places, search]);

  const changeSelected = (patch: Partial<PlaceRecord>) => {
    setPlaces((current) => current.map((place) => place.id === selectedId ? { ...place, ...patch } : place));
    setDirty(true);
    setNotice(null);
  };

  const addPlace = () => {
    const id = `ort-${crypto.randomUUID()}`;
    setPlaces((current) => [...current, {
      id,
      municipality: "",
      name: "Neuer Ort",
      icon: "nature",
      features: ["Wald & Natur"],
      geometry: "point",
      coordinates: [9.72, 47.2],
    }]);
    setSelectedId(id);
    setDirty(true);
  };

  const deleteSelected = () => {
    if (!selected || !window.confirm(`„${selected.name}“ wirklich löschen?`)) return;
    const index = places.findIndex((place) => place.id === selected.id);
    const remaining = places.filter((place) => place.id !== selected.id);
    setPlaces(remaining);
    setSelectedId(remaining[Math.min(index, remaining.length - 1)]?.id ?? "");
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const result = await responseJson<{ revision: string }>(await fetch("/api/places", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places, revision }),
      }));
      setRevision(result.revision);
      setDirty(false);
      setNotice({ kind: "success", text: "Änderungen wurden veröffentlicht." });
    } catch (caught) {
      const status = (caught as { status?: number })?.status;
      if (status === 401) onLoggedOut();
      setNotice({ kind: "error", text: caught instanceof Error ? caught.message : "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    if (dirty && !window.confirm("Ungespeicherte Änderungen verwerfen und abmelden?")) return;
    await fetch("/api/session", { method: "DELETE" });
    onLoggedOut();
  };

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Kühle Orte im Walgau</p>
          <h1>Datenpflege</h1>
        </div>
        <div className="admin-header-actions">
          {notice && <div className={`admin-notice ${notice.kind}`}>{notice.kind === "success" ? <Check size={16} /> : <AlertCircle size={16} />}{notice.text}</div>}
          <a className="admin-secondary-button" href="/"><ChevronLeft size={17} /> Karte</a>
          <button className="admin-secondary-button" type="button" onClick={logout}><LogOut size={17} /> Abmelden</button>
          <button className="admin-primary-button compact" type="button" onClick={save} disabled={!dirty || saving || loading}>
            {saving ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="admin-loading"><Loader2 className="spin" size={24} />Orte werden geladen…</div>
      ) : (
        <div className="admin-workspace">
          <aside className="admin-sidebar">
            <div className="admin-search">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ort oder Gemeinde suchen" />
            </div>
            <button className="admin-add-button" type="button" onClick={addPlace}><Plus size={17} />Neuen Ort anlegen</button>
            <div className="admin-place-count">{filteredPlaces.length} von {places.length} Orten</div>
            <div className="admin-place-list">
              {filteredPlaces.map((place) => (
                <button
                  type="button"
                  key={place.id}
                  className={place.id === selectedId ? "active" : ""}
                  onClick={() => setSelectedId(place.id!)}
                >
                  <span>{place.name}</span>
                  <small>{place.municipality || "Keine Gemeinde"} · {place.coordinates ? "bestätigt" : "geschätzt"}</small>
                </button>
              ))}
            </div>
          </aside>

          {selected ? (
            <section className="admin-content">
              <EditorMap
                places={places}
                selected={selected}
                onSelect={setSelectedId}
                onMove={(coordinates) => changeSelected({ coordinates })}
              />
              <PlaceForm place={selected} onChange={changeSelected} onDelete={deleteSelected} />
            </section>
          ) : (
            <div className="admin-empty">Kein Ort ausgewählt.</div>
          )}
        </div>
      )}
    </main>
  );
}

function AdminApp() {
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "anonymous">("checking");

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then((response) => responseJson<{ authenticated: boolean }>(response))
      .then(({ authenticated }) => setAuthState(authenticated ? "authenticated" : "anonymous"))
      .catch(() => setAuthState("anonymous"));
  }, []);

  if (authState === "checking") {
    return <main className="admin-login"><Loader2 className="spin" size={28} aria-label="Anmeldung wird geprüft" /></main>;
  }
  if (authState === "anonymous") {
    return <Login onSuccess={() => setAuthState("authenticated")} />;
  }
  return <Editor onLoggedOut={() => setAuthState("anonymous")} />;
}

export { AdminApp };
