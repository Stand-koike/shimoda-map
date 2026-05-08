/**
 * メイン index.html の既存 Map に神輿レイヤを追加する。
 * スケジュール時間外は非表示。時間内かつレイヤーパネル ON のときだけ表示。
 */
import { loadCheckpoints } from './services/checkpointService.js';
import { RouteService } from './services/routeService.js';
import { svgUrlToImageBitmap } from './services/mapService.js';

const CP_URL = new URL('../public/data/checkpoints.geojson', import.meta.url).href;
const SEG_URL = new URL('../public/data/route_segments.geojson', import.meta.url).href;
const ICON_URL = new URL('../public/icons/mikoshi.svg', import.meta.url).href;

const SOURCE_ROUTE = 'mikoshi-route-line';
const SOURCE_PROGRESS = 'mikoshi-route-progress';
const SOURCE_CP = 'mikoshi-checkpoints';
const SOURCE_MIKOSHI = 'mikoshi-position';

/** @type {import('mapbox-gl').Map | null} */
let map = null;
/** @type {RouteService | null} */
let routeService = null;
/** @type {number | null} */
let rafId = null;
let iconSize = 0.38;

const LAYER_IDS = [
  'mikoshi-layer-route',
  'mikoshi-layer-progress',
  'mikoshi-layer-checkpoints',
  'mikoshi-layer-symbol'
];

function scheduleActive(nowMs) {
  if (!routeService) return false;
  const sched = routeService.getSchedule();
  if (!sched.length) return false;
  return nowMs >= sched[0].tStart && nowMs <= sched[sched.length - 1].tEnd;
}

function userWantsLayer() {
  if (typeof window.__shimoda_getMikoshiLayerOn === 'function') {
    return window.__shimoda_getMikoshiLayerOn();
  }
  return true;
}

function applyCombinedVisibility() {
  if (!map) return;
  const now = Date.now();
  const show = scheduleActive(now) && userWantsLayer();
  const vis = show ? 'visible' : 'none';
  for (const id of LAYER_IDS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', vis);
    }
  }
}

function setMikoshiPoint(lng, lat, bearing) {
  if (!map?.getSource(SOURCE_MIKOSHI)) return;
  map.getSource(SOURCE_MIKOSHI).setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { bearing },
        geometry: { type: 'Point', coordinates: [lng, lat] }
      }
    ]
  });
  if (map.getLayer('mikoshi-layer-symbol')) {
    map.setLayoutProperty('mikoshi-layer-symbol', 'icon-size', iconSize);
  }
}

function setProgressFeat(feature) {
  if (!map?.getSource(SOURCE_PROGRESS)) return;
  if (!feature || !feature.geometry) {
    map.getSource(SOURCE_PROGRESS).setData({ type: 'FeatureCollection', features: [] });
    return;
  }
  const g = feature.geometry;
  const fc =
    g.type === 'LineString' && g.coordinates?.length >= 2
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: g }] }
      : { type: 'FeatureCollection', features: [] };
  map.getSource(SOURCE_PROGRESS).setData(fc);
}

function tick() {
  rafId = requestAnimationFrame(tick);
  if (!map || !routeService) return;
  applyCombinedVisibility();
  const now = Date.now();
  if (!scheduleActive(now)) {
    return;
  }
  const st = routeService.getState(now);
  const bearing = typeof st.bearing === 'number' ? st.bearing : 0;
  setMikoshiPoint(st.lng, st.lat, bearing);
  if (st.traversedLine && st.traversedLine.geometry) {
    setProgressFeat(st.traversedLine);
  } else {
    setProgressFeat(null);
  }
}

/**
 * @param {import('mapbox-gl').Map} mapboxMap
 */
export async function attachToMainMap(mapboxMap) {
  map = mapboxMap;
  try {
    const [{ fc: cpFc, byId: cpById }, segmentsFc] = await Promise.all([
      loadCheckpoints(CP_URL),
      fetch(SEG_URL).then((r) => {
        if (!r.ok) throw new Error(`route_segments ${r.status}`);
        return r.json();
      })
    ]);

    routeService = new RouteService(segmentsFc, cpById);
    const merged = routeService.getMergedRoute();
    const mergedFc = { type: 'FeatureCollection', features: [merged] };
    const initial = routeService.getState();

    if (!map.hasImage('mikoshi-icon')) {
      const canvas = await svgUrlToImageBitmap(ICON_URL, 128);
      const bitmap = await createImageBitmap(canvas);
      map.addImage('mikoshi-icon', bitmap, { pixelRatio: 2 });
    }

    if (!map.getSource(SOURCE_ROUTE)) {
      map.addSource(SOURCE_ROUTE, { type: 'geojson', data: mergedFc });
      map.addSource(SOURCE_PROGRESS, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addSource(SOURCE_CP, { type: 'geojson', data: cpFc });
      map.addSource(SOURCE_MIKOSHI, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { bearing: 0 },
              geometry: { type: 'Point', coordinates: [initial.lng, initial.lat] }
            }
          ]
        }
      });
    }

    if (!map.getLayer('mikoshi-layer-route')) {
      map.addLayer({
        id: 'mikoshi-layer-route',
        type: 'line',
        source: SOURCE_ROUTE,
        paint: { 'line-color': '#90caf9', 'line-width': 4, 'line-opacity': 0.92 }
      });
      map.addLayer({
        id: 'mikoshi-layer-progress',
        type: 'line',
        source: SOURCE_PROGRESS,
        paint: { 'line-color': '#1565c0', 'line-width': 5, 'line-opacity': 0.95 }
      });
      map.addLayer({
        id: 'mikoshi-layer-checkpoints',
        type: 'circle',
        source: SOURCE_CP,
        paint: {
          'circle-radius': 6,
          'circle-color': '#fff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0277bd'
        }
      });
      map.addLayer({
        id: 'mikoshi-layer-symbol',
        type: 'symbol',
        source: SOURCE_MIKOSHI,
        layout: {
          'icon-image': 'mikoshi-icon',
          'icon-size': iconSize,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-rotation-alignment': 'map',
          'icon-rotate': ['get', 'bearing']
        }
      });
    }

    window.__mikoshiApplyVisibility = applyCombinedVisibility;

    if (rafId == null) {
      rafId = requestAnimationFrame(tick);
    }
  } catch (e) {
    console.warn('[Mikoshi main map]', e);
  }
}

export { applyCombinedVisibility };
