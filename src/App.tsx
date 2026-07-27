import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import MapLibreGL from "maplibre-gl";
import {
  Check,
  ChevronsUpDown,
  Info,
  Landmark,
  MapPin,
  Mountain,
  PersonStanding,
  Search,
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
  coordinatesForPlacesBounds,
  normalizePlaces,
  placeMatchesQuery,
  polygonForPlace,
  type Filter,
  type IconKind,
  type Place,
  type PlaceRecord,
} from "./places";
import { usePresenceValue } from "./use-presence-value";

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

function FilterAutoZoom({
  places,
  revision,
  filterPanelOpen,
}: {
  places: Place[];
  revision: number;
  filterPanelOpen: boolean;
}) {
  const { map, isLoaded } = useMap();
  const handledRevisionRef = useRef(0);
  const closedRevisionRef = useRef(0);

  useEffect(() => {
    if (!map || !isLoaded || revision === 0) return;
    const needsInitialFit = handledRevisionRef.current !== revision;
    const needsClosedFit = !filterPanelOpen && closedRevisionRef.current !== revision;
    if (!needsInitialFit && !needsClosedFit) return;

    handledRevisionRef.current = revision;
    if (!filterPanelOpen) closedRevisionRef.current = revision;

    const coordinates = coordinatesForPlacesBounds(places);
    if (coordinates.length === 0) return;

    const container = map.getContainer();
    const width = container.clientWidth;
    const height = container.clientHeight;
    const mobile = width < 1024;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700;
    const padding = mobile
      ? {
          top: 72,
          right: 36,
          bottom: filterPanelOpen ? Math.min(360, Math.round(height * 0.45)) : 72,
          left: 36,
        }
      : {
          top: 64,
          right: filterPanelOpen ? Math.min(410, Math.round(width * 0.38)) : 64,
          bottom: 64,
          left: 64,
        };

    if (coordinates.length === 1) {
      map.flyTo({
        center: coordinates[0],
        zoom: Math.min(13, map.getMaxZoom()),
        duration,
        essential: false,
      });
      return;
    }

    const bounds = coordinates.slice(1).reduce(
      (currentBounds, coordinate) => currentBounds.extend(coordinate),
      new MapLibreGL.LngLatBounds(coordinates[0], coordinates[0]),
    );
    const maxZoom = places.length > 24 ? 10.5 : places.length > 12 ? 11.5 : 13;
    map.fitBounds(bounds, {
      padding,
      maxZoom,
      duration,
      essential: false,
    });
  }, [filterPanelOpen, isLoaded, map, places, revision]);

  return null;
}

function SelectedPlaceAutoZoom({
  place,
  revision,
}: {
  place: Place | null;
  revision: number;
}) {
  const { map, isLoaded } = useMap();
  const handledRevisionRef = useRef(0);

  useEffect(() => {
    if (!map || !isLoaded || !place || revision === 0 || handledRevisionRef.current === revision) return;
    handledRevisionRef.current = revision;

    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700;
    const mobile = map.getContainer().clientWidth < 680;
    map.stop();

    if (place.geometry === "point") {
      map.flyTo({
        center: place.coordinates,
        zoom: Math.min(15, map.getMaxZoom()),
        offset: [0, mobile ? -80 : -20],
        duration,
        essential: false,
      });
      return;
    }

    const coordinates = coordinatesForPlacesBounds([place]);
    const bounds = coordinates.slice(1).reduce(
      (currentBounds, coordinate) => currentBounds.extend(coordinate),
      new MapLibreGL.LngLatBounds(coordinates[0], coordinates[0]),
    );
    map.fitBounds(bounds, {
      padding: mobile
        ? { top: 72, right: 36, bottom: 300, left: 36 }
        : { top: 72, right: 72, bottom: 72, left: 420 },
      maxZoom: 14,
      duration,
      essential: false,
    });
  }, [isLoaded, map, place, revision]);

  return null;
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedPlace = places.find((place) => place.id === selectedId) ?? null;
  const matchingPlaces = useMemo(
    () => places.filter((place) => placeMatchesQuery(place, query)),
    [places, query],
  );

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const openList = () => {
    if (open) return;
    setQuery("");
    const selectedIndex = places.findIndex((place) => place.id === selectedId);
    setActiveIndex(Math.max(0, selectedIndex));
    setOpen(true);
  };
  const selectMatchingPlace = (index: number) => {
    const place = matchingPlaces[index];
    if (!place) return;
    setOpen(false);
    setQuery("");
    onSelect(place);
  };
  const activeOptionId = matchingPlaces[activeIndex]
    ? `${listboxId}-option-${matchingPlaces[activeIndex].id}`
    : undefined;

  return (
    <div ref={containerRef} className="relative mt-4 border-t border-slate-200 pt-4">
      <label htmlFor={`${listboxId}-input`} className="block text-sm font-bold text-emerald-950">
        Ort direkt auswählen
      </label>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
        <input
          id={`${listboxId}-input`}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={open ? activeOptionId : undefined}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          placeholder={`${places.length} passende Orte durchsuchen`}
          value={open ? query : selectedPlace ? `${selectedPlace.name} · ${selectedPlace.municipality}` : ""}
          onFocus={openList}
          onClick={openList}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) {
                openList();
                return;
              }
              setActiveIndex((current) => Math.min(current + 1, Math.max(0, matchingPlaces.length - 1)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) {
                openList();
                return;
              }
              setActiveIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === "Home" && open) {
              event.preventDefault();
              setActiveIndex(0);
            } else if (event.key === "End" && open) {
              event.preventDefault();
              setActiveIndex(Math.max(0, matchingPlaces.length - 1));
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              selectMatchingPlace(activeIndex);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setQuery("");
            }
          }}
          onBlur={(event) => {
            if (!containerRef.current?.contains(event.relatedTarget)) setOpen(false);
          }}
        />
        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Passende Orte"
          className="absolute bottom-full left-0 right-0 z-40 mb-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl lg:bottom-auto lg:top-full lg:mb-0 lg:mt-1"
        >
          {matchingPlaces.length > 0 ? matchingPlaces.map((place, index) => (
            <li
              key={place.id}
              id={`${listboxId}-option-${place.id}`}
              role="option"
              aria-selected={place.id === selectedId}
              className={`flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                index === activeIndex ? "bg-emerald-50 text-emerald-950" : "text-slate-700"
              }`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => selectMatchingPlace(index)}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{place.name}</span>
                <span className="block truncate text-xs text-slate-500">{place.municipality}</span>
              </span>
              {place.id === selectedId && <Check className="mt-1 shrink-0 text-emerald-700" size={16} aria-hidden="true" />}
            </li>
          )) : (
            <li className="px-3 py-4 text-center text-sm text-slate-500">
              Kein passender Ort gefunden
            </li>
          )}
        </ul>
      )}
      <span className="sr-only" aria-live="polite">
        {open && `${matchingPlaces.length} ${matchingPlaces.length === 1 ? "Ort" : "Orte"} gefunden`}
      </span>
    </div>
  );
}

function App() {
  const [places, setPlaces] = useState<Place[]>(() => normalizePlaces(rawPlaces as PlaceRecord[]));
  const [activeFilters, setActiveFilters] = useState<Filter[]>([]);
  const [filterRevision, setFilterRevision] = useState(0);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [placeSelectionRevision, setPlaceSelectionRevision] = useState(0);
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
  const placePresence = usePresenceValue(selectedPlace, 240);
  const filterPresence = usePresenceValue(filterPanelOpen ? true : null, 280);
  const infoPresence = usePresenceValue(infoOpen ? true : null, 200);
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
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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
    setPlaceSelectionRevision((current) => current + 1);
    setFilterPanelOpen(false);
  };
  const toggleFilter = (filter: Filter) => {
    setActiveFilters((current) => current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]);
    setFilterRevision((current) => current + 1);
  };
  const resetFilters = () => {
    if (activeFilters.length === 0) return;
    setActiveFilters([]);
    setFilterRevision((current) => current + 1);
  };

  return (
    <main className="map-shell">
      <Map ariaLabel="Karte der kühlen Orte im Walgau" center={[9.72, 47.2]} zoom={9.3} minZoom={8} maxZoom={16} theme="light" attributionControl={false}>
        <AdaptiveAttribution />
        <FilterAutoZoom places={visiblePlaces} revision={filterRevision} filterPanelOpen={filterPanelOpen} />
        <SelectedPlaceAutoZoom place={selectedPlace} revision={placeSelectionRevision} />
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

      {filterPresence.renderedValue !== null && (
        <>
          <div
            className="filter-popover absolute right-2 top-[4.75rem] z-20 hidden w-[360px] rounded-2xl border border-white/70 bg-white/95 p-4 shadow-[0_12px_32px_rgba(19,57,47,.2)] backdrop-blur lg:block md:top-[5.25rem]"
            data-state={filterPresence.visible ? "open" : "closed"}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="m-0 text-base font-extrabold text-emerald-950">Orte filtern</h2>
              {activeFilters.length > 0 && <button type="button" className="text-sm font-semibold text-emerald-800 underline" onClick={resetFilters}>Zurücksetzen</button>}
            </div>
            <FilterOptions activeFilters={activeFilters} onToggle={toggleFilter} />
            <PlaceSelect places={visiblePlaces} selectedId={selectedPlaceId} onSelect={selectPlaceFromPanel} />
          </div>

          <div
            ref={mobileFilterDialogRef}
            className="filter-dialog fixed inset-0 z-30 lg:hidden"
            data-state={filterPresence.visible ? "open" : "closed"}
            role="dialog"
            aria-modal="true"
            aria-label="Orte filtern"
            aria-hidden={!filterPresence.visible}
          >
            <div
              className="filter-backdrop absolute inset-0 bg-slate-950/25"
              data-state={filterPresence.visible ? "open" : "closed"}
              aria-hidden="true"
              onClick={() => setFilterPanelOpen(false)}
            />
            <section
              className="filter-sheet absolute inset-x-0 bottom-0 max-h-[calc(100%-1rem)] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl"
              data-state={filterPresence.visible ? "open" : "closed"}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="m-0 text-lg font-extrabold text-emerald-950">Orte filtern</h2>
                <button ref={mobileFilterCloseRef} type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Filter schließen" onClick={() => setFilterPanelOpen(false)}><X size={19} /></button>
              </div>
              <FilterOptions activeFilters={activeFilters} onToggle={toggleFilter} />
              <PlaceSelect places={visiblePlaces} selectedId={selectedPlaceId} onSelect={selectPlaceFromPanel} />
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button type="button" className="rounded-xl border border-emerald-800 px-4 py-3 text-sm font-bold text-emerald-800" onClick={resetFilters}>Zurücksetzen</button>
                <button type="button" className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white" onClick={() => setFilterPanelOpen(false)}>Übernehmen</button>
              </div>
            </section>
          </div>
        </>
      )}

      {infoPresence.renderedValue !== null && (
        <aside
          className="info-popover absolute left-2 top-[4.9rem] z-20 w-[min(360px,calc(100%-2rem))] rounded-2xl bg-white p-5 shadow-2xl md:top-[5.25rem]"
          data-state={infoPresence.visible ? "open" : "closed"}
          aria-hidden={!infoPresence.visible}
        >
          <button className="absolute right-3 top-3 rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Hinweise schließen" onClick={() => setInfoOpen(false)}><X size={18} /></button>
          <h2 className="m-0 pr-8 text-lg font-extrabold text-emerald-950">Gut unterwegs</h2>
          <p className="mb-0 mt-2 text-sm leading-6 text-slate-600">Bitte nimm Rücksicht auf Natur, Anrainer:innen und geltende Zutrittsregeln. Die Orte laden zum verantwortungsvollen Entdecken ein.</p>
        </aside>
      )}

      {placePresence.renderedValue && (
        <PlaceCard
          place={placePresence.renderedValue}
          visible={placePresence.visible}
          onClose={() => setSelectedPlaceId(null)}
        />
      )}
    </main>
  );
}

function PlaceCard({ place, visible, onClose }: { place: Place; visible: boolean; onClose: () => void }) {
  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.coordinates[1]},${place.coordinates[0]}`)}`;
  return (
    <aside
      className="place-card absolute bottom-4 left-2 right-2 z-20 mx-auto max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_18px_55px_rgba(18,54,45,.35)] md:bottom-6 md:left-2 md:right-auto md:w-[380px]"
      data-state={visible ? "open" : "closed"}
    >
      {place.imageUrl && <img src={place.imageUrl} alt="" className="h-44 w-full object-cover" />}
      <div className="p-5">
        <button className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-600 shadow hover:bg-white" aria-label="Ortskarte schließen" onClick={onClose}><X size={18} /></button>
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-700"><PlaceIcon icon={place.icon} size={16} /> {place.municipality}</div>
        <h2 className="mb-2 mt-1 text-2xl font-extrabold tracking-tight text-emerald-950">{place.name}</h2>
        {place.description && <p className="m-0 text-sm leading-6 text-slate-600">{place.description}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">{place.features.map((feature) => <span key={feature} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{feature}</span>)}</div>
        <a className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white no-underline hover:bg-emerald-900" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={17} /> Route in Google Maps planen</a>
      </div>
    </aside>
  );
}

export { App };
