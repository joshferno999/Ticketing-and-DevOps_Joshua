import type { CloudflareTrafficCountry } from "@emergence-devops/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import { useCloudflareTraffic } from "../../hooks/use-cloudflare-traffic";
import { useReachabilityLatency } from "../../hooks/use-reachability-latency";
import { cn } from "../../lib/utils";

const COUNTRIES_GEOJSON_URL =
  "https://cdn.jsdelivr.net/npm/three-globe/example/country-polygons/ne_110m_admin_0_countries.geojson";

type GlobeViewMode = "latency" | "traffic";

type GlobeHub = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  badgeMeta: string;
};

const REACHABILITY_HUBS: Omit<GlobeHub, "badgeMeta">[] = [
  { id: "n-california", label: "N. California", lat: 37.39, lng: -121.95 },
  { id: "oregon", label: "Oregon", lat: 45.52, lng: -122.68 },
  { id: "n-virginia", label: "N. Virginia", lat: 38.75, lng: -77.47 },
  { id: "ireland", label: "Ireland", lat: 53.35, lng: -6.26 },
  { id: "sao-paulo", label: "São Paulo", lat: -23.55, lng: -46.63 },
  { id: "singapore", label: "Singapore", lat: 1.35, lng: 103.82 },
  { id: "sydney", label: "Sydney", lat: -33.87, lng: 151.21 },
  { id: "tokyo", label: "Tokyo", lat: 35.68, lng: 139.69 }
];

function formatBadgeMeta(label: string, latencyMs: number | null | undefined) {
  const latency = latencyMs == null ? "—" : `${latencyMs} ms`;
  return `${label} · ${latency}`;
}

function createLiveBadgeElement(hub: GlobeHub) {
  const root = document.createElement("div");
  root.className = "landing-globe-html-root";
  root.dataset.hubId = hub.id;

  const offset = document.createElement("div");
  offset.className = "landing-globe-badge-offset";

  const badge = document.createElement("div");
  badge.className = `landing-globe-badge landing-globe-badge--${hub.id}`;
  badge.innerHTML = `
    <span class="landing-globe-badge-dot" aria-hidden="true"></span>
    <span class="landing-globe-badge-live">Live</span>
    <span class="landing-globe-badge-sep" aria-hidden="true"></span>
    <span class="landing-globe-badge-meta">${hub.badgeMeta}</span>
  `;

  offset.appendChild(badge);
  root.appendChild(offset);
  return root;
}

const EQUATOR_VIEW = { lat: 0, lng: -18, altitude: 2.2 };
const SPIN_Y_STEP = 0.0032;

export function LandingHeroGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const isDraggingRef = useRef(false);
  const spinAngleRef = useRef(0);
  const [viewMode, setViewMode] = useState<GlobeViewMode>("latency");
  const [size, setSize] = useState(360);
  const [countryFeatures, setCountryFeatures] = useState<CountryFeature[]>([]);
  const [globeInstance, setGlobeInstance] = useState<GlobeMethods | null>(null);
  const { probesById } = useReachabilityLatency();
  const { countries: trafficCountries, date: trafficDate, isLoading: trafficLoading, error: trafficError } =
    useCloudflareTraffic();

  const isTrafficMode = viewMode === "traffic";

  const trafficMaxCount = useMemo(
    () => Math.max(1, ...trafficCountries.map((country) => country.count)),
    [trafficCountries]
  );

  const globeHubs = useMemo<GlobeHub[]>(
    () =>
      REACHABILITY_HUBS.map((hub) => {
        const probe = probesById.get(hub.id);
        return {
          ...hub,
          badgeMeta: formatBadgeMeta(hub.label, probe?.latencyMs)
        };
      }),
    [probesById]
  );

  const globeMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        color: "#f4f5f7",
        emissive: "#eceef1",
        shininess: 8,
        transparent: true,
        opacity: 1
      }),
    []
  );

  const bindGlobe = useCallback((globe: GlobeMethods) => {
    const controls = globe.controls();
    const cameraDistance = globe.getGlobeRadius() * EQUATOR_VIEW.altitude;
    const equatorPolar = Math.PI / 2;

    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableRotate = true;
    controls.minDistance = cameraDistance;
    controls.maxDistance = cameraDistance;
    controls.minPolarAngle = equatorPolar;
    controls.maxPolarAngle = equatorPolar;
    controls.autoRotate = false;

    spinAngleRef.current = 0;
    globe.scene().rotation.y = 0;
    globe.pointOfView(EQUATOR_VIEW, 0);
    globe.resumeAnimation();
  }, []);

  const handleGlobeReady = useCallback(() => {
    const attachGlobe = () => {
      const globe = globeRef.current;
      if (!globe) {
        return;
      }

      bindGlobe(globe);
      setGlobeInstance(globe);
    };

    attachGlobe();
    window.requestAnimationFrame(attachGlobe);
  }, [bindGlobe]);

  useEffect(() => {
    let cancelled = false;

    void fetch(COUNTRIES_GEOJSON_URL)
      .then((response) => response.json())
      .then((data: { features: CountryFeature[] }) => {
        if (!cancelled) {
          setCountryFeatures(data.features);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCountryFeatures([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateSize = () => {
      const next = Math.min(container.clientWidth, container.clientHeight) || 360;
      setSize(next);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const onPointerDown = () => {
      isDraggingRef.current = true;
    };
    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);
    container.addEventListener("pointerleave", onPointerUp);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
      container.removeEventListener("pointerleave", onPointerUp);
    };
  }, []);

  useEffect(() => {
    if (globeInstance) {
      bindGlobe(globeInstance);
    }
  }, [globeInstance, countryFeatures, size, bindGlobe]);

  useEffect(() => {
    if (!globeInstance) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      return;
    }

    let frameId = 0;

    const spin = () => {
      if (!isDraggingRef.current) {
        spinAngleRef.current += SPIN_Y_STEP;
        globeInstance.scene().rotation.y = spinAngleRef.current;
      }

      frameId = window.requestAnimationFrame(spin);
    };

    globeInstance.resumeAnimation();
    frameId = window.requestAnimationFrame(spin);

    return () => window.cancelAnimationFrame(frameId);
  }, [globeInstance]);

  useEffect(() => {
    if (isTrafficMode) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    for (const hub of globeHubs) {
      const meta = container.querySelector<HTMLElement>(
        `.landing-globe-badge--${hub.id} .landing-globe-badge-meta`
      );
      if (meta) {
        meta.textContent = hub.badgeMeta;
      }
    }
  }, [globeHubs, isTrafficMode]);

  const htmlElement = useCallback((hub: object) => createLiveBadgeElement(hub as GlobeHub), []);

  const htmlElementVisibilityModifier = useCallback((element: HTMLElement, isVisible: boolean) => {
    const offset = element.querySelector<HTMLElement>(".landing-globe-badge-offset");
    if (offset) {
      offset.style.opacity = isVisible ? "1" : "0";
      offset.style.filter = isVisible ? "none" : "blur(5px)";
    }
    element.style.pointerEvents = "none";
  }, []);

  const trafficPointAltitude = useCallback((point: object) => {
    return (point as CloudflareTrafficCountry).altitude;
  }, []);

  const trafficPointRadius = useCallback(
    (point: object) => {
      const country = point as CloudflareTrafficCountry;
      return 0.55 + (country.count / trafficMaxCount) * 1.35;
    },
    [trafficMaxCount]
  );

  const trafficPointColor = useCallback(
    (point: object) => {
      const country = point as CloudflareTrafficCountry;
      const share = country.count / trafficMaxCount;
      if (share > 0.66) {
        return "#dc2626";
      }
      if (share > 0.33) {
        return "#ef4444";
      }
      return "#f87171";
    },
    [trafficMaxCount]
  );

  const trafficPointLabel = useCallback((point: object) => {
    const country = point as CloudflareTrafficCountry;
    return `<div class="landing-globe-traffic-tip"><strong>${country.countryName}</strong><br/>${country.count.toLocaleString()} requests</div>`;
  }, []);

  const trafficCaption = trafficLoading
    ? "Loading traffic…"
    : trafficError
      ? "Traffic unavailable"
      : trafficDate
        ? `Requests today (UTC ${trafficDate})`
        : "Requests by country";

  return (
    <div className="landing-globe-panel">
      <div className="landing-globe-controls">
        <div className="landing-globe-toggle" role="group" aria-label="Globe data source">
          <button
            type="button"
            className={cn("landing-globe-toggle-btn", !isTrafficMode && "landing-globe-toggle-btn--active")}
            aria-pressed={!isTrafficMode}
            onClick={() => setViewMode("latency")}
          >
            Latency
          </button>
          <button
            type="button"
            className={cn("landing-globe-toggle-btn", isTrafficMode && "landing-globe-toggle-btn--active")}
            aria-pressed={isTrafficMode}
            onClick={() => setViewMode("traffic")}
          >
            Traffic
          </button>
        </div>
        {isTrafficMode ? (
          <p className="landing-globe-toggle-caption">{trafficCaption}</p>
        ) : null}
      </div>
      <div ref={containerRef} className="landing-globe-stage">
        <Globe
          ref={globeRef}
          onGlobeReady={handleGlobeReady}
          width={size}
          height={size}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={globeMaterial}
          showAtmosphere
          atmosphereColor="#e4e7eb"
          atmosphereAltitude={0.14}
          animateIn={false}
          waitForGlobeReady={false}
          hexPolygonsData={countryFeatures}
          hexPolygonGeoJsonGeometry="geometry"
          hexPolygonUseDots
          hexPolygonColor={() => (isTrafficMode ? "#c8ced6" : "#2a3038")}
          hexPolygonAltitude={0.002}
          hexPolygonResolution={3}
          hexPolygonMargin={0.52}
          hexPolygonDotResolution={9}
          hexBinPointsData={[]}
          pointsData={isTrafficMode ? trafficCountries : globeHubs}
          pointLat="lat"
          pointLng="lng"
          pointColor={isTrafficMode ? trafficPointColor : () => "#ef233c"}
          pointAltitude={isTrafficMode ? trafficPointAltitude : 0.006}
          pointRadius={isTrafficMode ? trafficPointRadius : 0.28}
          pointResolution={isTrafficMode ? 28 : 18}
          pointsMerge={false}
          pointsTransitionDuration={isTrafficMode ? 900 : 0}
          pointLabel={isTrafficMode ? trafficPointLabel : undefined}
          arcsData={[]}
          htmlElementsData={isTrafficMode ? [] : globeHubs}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.006}
          htmlElement={htmlElement}
          htmlElementVisibilityModifier={htmlElementVisibilityModifier}
          htmlTransitionDuration={0}
        />
      </div>
    </div>
  );
}

type CountryFeature = {
  geometry: { type: string; coordinates: number[] | number[][] | number[][][] };
};
