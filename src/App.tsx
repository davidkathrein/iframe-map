import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import MapLibreGL from "maplibre-gl";
import {
  Info,
  Landmark,
  MapPin,
  Mountain,
  PersonStanding,
  SlidersHorizontal,
  TreePine,
  Trees,
  Waves,
  X,
} from "lucide-react";
import {
  Map,
  MapClusterLayer,
  MapControls,
  MapGeoJSON,
  MapMarker,
  MarkerContent,
  useMap,
} from "@/components/ui/map";
import rawPlaces from "./data/places.json";
import {
  FILTERS,
  normalizePlaces,
  polygonForPlace,
  type Filter,
  type IconKind,
  type Place,
  type PlaceRecord,
} from "./places";

function areaGeometry(place: Place): Feature<Polygon, { id: string }> {
  return {
    type: "Feature",
    properties: { id: place.id },
    geometry: {
      type: "Polygon",
      coordinates: [polygonForPlace(place)],
    },
  };
}

const iconComponents = {
  water: Waves,
  park: TreePine,
  nature: Trees,
  mountain: Mountain,
  family: PersonStanding,
  culture: Landmark,
} as const;

function PlaceIcon({ icon, size = 19 }: { icon: IconKind; size?: number }) {
  const Icon = iconComponents[icon];
  return <Icon size={size} strokeWidth={2.4} aria-hidden="true" />;
}

function AdaptiveAttribution() {
  const { map } = useMap();

  useEffect(() => {
    if (!map) return;

    const container = map.getContainer();
    let control = new MapLibreGL.AttributionControl({ compact: false });
    map.addControl(control, "bottom-right");

    const removeInteractionListeners = () => {
      container.removeEventListener("pointerdown", collapse);
      container.removeEventListener("wheel", collapse);
      container.removeEventListener("keydown", collapse);
    };
    const collapse = () => {
      removeInteractionListeners();
      if (map.hasControl(control)) map.removeControl(control);
      control = new MapLibreGL.AttributionControl({ compact: true });
      map.addControl(control, "bottom-right");
    };

    container.addEventListener("pointerdown", collapse, { once: true });
    container.addEventListener("wheel", collapse, { once: true });
    container.addEventListener("keydown", collapse, { once: true });

    return () => {
      removeInteractionListeners();
      if (map.hasControl(control)) map.removeControl(control);
    };
  }, [map]);

  return null;
}

function descriptionFor(place: Place) {
  return place.description ?? `${place.name} in ${place.municipality} – ein angenehmer Ort mit ${place.features.join(", ").toLowerCase()}.`;
}

function MarkerLayer({ items, onSelect }: { items: Place[]; onSelect: (place: Place) => void }) {
  const { map } = useMap();
  const [zoom, setZoom] = useState(9);

  useEffect(() => {
    if (!map) return;
    const updateZoom = () => setZoom(map.getZoom());
    updateZoom();
    map.on("zoomend", updateZoom);
    return () => {
      map.off("zoomend", updateZoom);
    };
  }, [map]);

  if (zoom < 11) return null;
  return items.filter((place) => place.geometry === "point").map((place) => <PlaceMarker key={place.id} place={place} onSelect={onSelect} />);
}

function OverviewClusters({ items, onSelect }: { items: Place[]; onSelect: (place: Place) => void }) {
  const { map } = useMap();
  const [zoom, setZoom] = useState(9);
  useEffect(() => {
    if (!map) return;
    const updateZoom = () => setZoom(map.getZoom());
    updateZoom();
    map.on("zoomend", updateZoom);
    return () => { map.off("zoomend", updateZoom); };
  }, [map]);
  const data = useMemo<FeatureCollection<Point, { id: string }>>(() => ({
    type: "FeatureCollection",
    features: items.filter((place) => place.geometry === "point").map((place) => ({ type: "Feature", properties: { id: place.id }, geometry: { type: "Point", coordinates: place.coordinates } })),
  }), [items]);
  if (zoom >= 11) return null;
  return (
    <MapClusterLayer
      data={data}
      clusterMaxZoom={11}
      clusterRadius={62}
      clusterColors={["#168565", "#11775b", "#0e6049"]}
      clusterThresholds={[5, 12]}
      pointColor="#168565"
      onPointClick={(feature) => {
        const place = items.find((candidate) => candidate.id === feature.properties.id);
        if (place) onSelect(place);
      }}
    />
  );
}

function PlaceMarker({ place, onSelect }: { place: Place; onSelect: (place: Place) => void }) {
  return (
    <MapMarker longitude={place.coordinates[0]} latitude={place.coordinates[1]} anchor="bottom">
      <MarkerContent>
        <button className="marker-button" aria-label={place.name} onClick={() => onSelect(place)}>
          <PlaceIcon icon={place.icon} />
        </button>
      </MarkerContent>
    </MapMarker>
  );
}

function FilterOptions({ activeFilters, onToggle }: { activeFilters: Filter[]; onToggle: (filter: Filter) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const active = activeFilters.includes(filter.id);
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onToggle(filter.id)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${active ? "border-emerald-800 bg-emerald-100 text-emerald-950" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400"}`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

function PlaceSelect({
  places,
  selectedId,
  onSelect,
}: {
  places: Place[];
  selectedId: string | null;
  onSelect: (place: Place) => void;
}) {
  return (
    <label className="mt-4 block border-t border-slate-200 pt-4 text-sm font-bold text-emerald-950">
      Ort direkt auswählen
      <select
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700"
        value={selectedId ?? ""}
        onChange={(event) => {
          const place = places.find((candidate) => candidate.id === event.target.value);
          if (place) onSelect(place);
        }}
      >
        <option value="">{places.length} passende Orte</option>
        {places.map((place) => (
          <option key={place.id} value={place.id}>{place.name} · {place.municipality}</option>
        ))}
      </select>
    </label>
  );
}

function App() {
  const [places, setPlaces] = useState<Place[]>(() => normalizePlaces(rawPlaces as PlaceRecord[]));
  const [activeFilters, setActiveFilters] = useState<Filter[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const mobileFilterDialogRef = useRef<HTMLDivElement>(null);
  const mobileFilterCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/places", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Dynamische Ortsdaten nicht verfügbar.");
        return response.json() as Promise<{ places: PlaceRecord[] }>;
      })
      .then((document) => setPlaces(normalizePlaces(document.places)))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("Lokales Ortsverzeichnis wird verwendet.", error);
      });
    return () => controller.abort();
  }, []);

  const visiblePlaces = useMemo(() => {
    const selectedFilters = FILTERS.filter((filter) => activeFilters.includes(filter.id));
    return places.filter((place) => selectedFilters.length === 0 || selectedFilters.some((filter) => filter.features.some((feature) => place.features.includes(feature))));
  }, [activeFilters, places]);
  const selectedPlace = useMemo(
    () => visiblePlaces.find((place) => place.id === selectedPlaceId) ?? null,
    [selectedPlaceId, visiblePlaces],
  );
  const visibleAreas = useMemo<FeatureCollection<Polygon, { id: string }>>(
    () => ({ type: "FeatureCollection", features: visiblePlaces.filter((place) => place.geometry === "area").map(areaGeometry) }),
    [visiblePlaces],
  );

  useEffect(() => {
    if (selectedPlaceId && !selectedPlace) setSelectedPlaceId(null);
  }, [selectedPlace, selectedPlaceId]);

  useEffect(() => {
    if (!filterPanelOpen) return;

    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    if (mobile) mobileFilterCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilterPanelOpen(false);
        return;
      }
      if (!mobile || event.key !== "Tab") return;
      const focusable = Array.from(
        mobileFilterDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      filterButtonRef.current?.focus();
    };
  }, [filterPanelOpen]);

  const selectPlace = (place: Place) => setSelectedPlaceId(place.id);
  const selectPlaceFromPanel = (place: Place) => {
    selectPlace(place);
    setFilterPanelOpen(false);
  };
  const toggleFilter = (filter: Filter) => {
    setActiveFilters((current) => current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]);
  };

  return (
    <main className="map-shell">
      <Map ariaLabel="Karte der kühlen Orte im Walgau" center={[9.72, 47.2]} zoom={9.3} minZoom={8} maxZoom={16} theme="light" attributionControl={false}>
        <AdaptiveAttribution />
        <MapGeoJSON
          data={visibleAreas}
          id="cool-place-areas"
          promoteId="id"
          interactive
          fillPaint={{ "fill-color": "#2b9d7e", "fill-opacity": 0.24 }}
          fillHoverPaint={{ "fill-color": "#168565", "fill-opacity": 0.42 }}
          linePaint={{ "line-color": "#127157", "line-width": 2, "line-opacity": 0.8 }}
          onClick={(event) => {
            const id = event.feature.properties?.id;
            const place = visiblePlaces.find((candidate) => candidate.id === id);
            if (place) selectPlace(place);
          }}
        />
        <OverviewClusters items={visiblePlaces} onSelect={selectPlace} />
        <MarkerLayer items={visiblePlaces} onSelect={selectPlace} />
        <MapControls position="bottom-right" showCompass={false} showLocate={false} showFullscreen />
      </Map>

      <section className="absolute left-2 top-4 z-10 flex max-w-[calc(100%-8rem)] items-center gap-2 rounded-xl border border-white/70 bg-white/90 px-3 py-2 shadow-[0_6px_20px_rgba(19,57,47,.14)] backdrop-blur md:top-6">
        <div className="min-w-0">
          <h1 className="m-0 truncate text-sm font-extrabold tracking-tight text-emerald-950 md:text-base">Kühle Orte im Walgau</h1>
          <p className="m-0 truncate text-[11px] text-slate-600">Wasser, Schatten und Natur entdecken.</p>
        </div>
        <button className="rounded-full p-1 text-slate-500 hover:bg-emerald-50 hover:text-emerald-800" aria-label="Hinweise anzeigen" onClick={() => setInfoOpen(true)}>
          <Info size={16} />
        </button>
      </section>

      <button
        type="button"
        ref={filterButtonRef}
        className="absolute right-2 top-4 z-10 flex h-10 items-center gap-2 rounded-xl border border-white/70 bg-white/95 px-3 text-sm font-bold text-emerald-900 shadow-[0_6px_20px_rgba(19,57,47,.14)] transition hover:bg-emerald-50 md:top-6"
        aria-label={filterPanelOpen ? "Filter schließen" : "Filter anzeigen"}
        aria-expanded={filterPanelOpen}
        onClick={() => setFilterPanelOpen((open) => !open)}
      >
        <SlidersHorizontal size={17} aria-hidden="true" />
        Filter{activeFilters.length > 0 && ` · ${activeFilters.length}`}
      </button>

      {filterPanelOpen && (
        <>
          <div className="absolute right-2 top-[4.75rem] z-20 hidden w-[360px] rounded-2xl border border-white/70 bg-white/95 p-4 shadow-[0_12px_32px_rgba(19,57,47,.2)] backdrop-blur lg:block md:top-[5.25rem]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="m-0 text-base font-extrabold text-emerald-950">Orte filtern</h2>
              {activeFilters.length > 0 && <button type="button" className="text-sm font-semibold text-emerald-800 underline" onClick={() => setActiveFilters([])}>Zurücksetzen</button>}
            </div>
            <FilterOptions activeFilters={activeFilters} onToggle={toggleFilter} />
            <PlaceSelect places={visiblePlaces} selectedId={selectedPlaceId} onSelect={selectPlaceFromPanel} />
          </div>

          <div ref={mobileFilterDialogRef} className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Orte filtern">
            <div className="absolute inset-0 bg-slate-950/25" aria-hidden="true" onClick={() => setFilterPanelOpen(false)} />
            <section className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-5 shadow-2xl">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="m-0 text-lg font-extrabold text-emerald-950">Orte filtern</h2>
                <button ref={mobileFilterCloseRef} type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Filter schließen" onClick={() => setFilterPanelOpen(false)}><X size={19} /></button>
              </div>
              <FilterOptions activeFilters={activeFilters} onToggle={toggleFilter} />
              <PlaceSelect places={visiblePlaces} selectedId={selectedPlaceId} onSelect={selectPlaceFromPanel} />
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button type="button" className="rounded-xl border border-emerald-800 px-4 py-3 text-sm font-bold text-emerald-800" onClick={() => setActiveFilters([])}>Zurücksetzen</button>
                <button type="button" className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white" onClick={() => setFilterPanelOpen(false)}>Übernehmen</button>
              </div>
            </section>
          </div>
        </>
      )}

      {infoOpen && (
        <aside className="absolute left-2 top-[4.9rem] z-20 w-[min(360px,calc(100%-2rem))] rounded-2xl bg-white p-5 shadow-2xl md:top-[5.25rem]">
          <button className="absolute right-3 top-3 rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Hinweise schließen" onClick={() => setInfoOpen(false)}><X size={18} /></button>
          <h2 className="m-0 pr-8 text-lg font-extrabold text-emerald-950">Gut unterwegs</h2>
          <p className="mb-0 mt-2 text-sm leading-6 text-slate-600">Bitte nimm Rücksicht auf Natur, Anrainer:innen und geltende Zutrittsregeln. Die Orte laden zum verantwortungsvollen Entdecken ein.</p>
        </aside>
      )}

      {selectedPlace && <PlaceCard place={selectedPlace} onClose={() => setSelectedPlaceId(null)} />}
    </main>
  );
}

function PlaceCard({ place, onClose }: { place: Place; onClose: () => void }) {
  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.coordinates[1]},${place.coordinates[0]}`)}`;
  return (
    <aside className="absolute bottom-4 left-2 right-2 z-20 mx-auto max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_55px_rgba(18,54,45,.35)] md:bottom-6 md:left-2 md:right-auto md:w-[380px]">
      {place.imageUrl && <img src={place.imageUrl} alt="" className="h-44 w-full object-cover" />}
      <div className="p-5">
        <button className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-600 shadow hover:bg-white" aria-label="Ortskarte schließen" onClick={onClose}><X size={18} /></button>
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-700"><PlaceIcon icon={place.icon} size={16} /> {place.municipality}</div>
        <h2 className="mb-2 mt-1 text-2xl font-extrabold tracking-tight text-emerald-950">{place.name}</h2>
        <p className="m-0 text-sm leading-6 text-slate-600">{descriptionFor(place)}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{place.features.map((feature) => <span key={feature} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{feature}</span>)}</div>
        <a className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white no-underline hover:bg-emerald-900" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={17} /> Route in Google Maps planen</a>
      </div>
    </aside>
  );
}

export { App };
