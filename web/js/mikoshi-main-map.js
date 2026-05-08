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

/** URL で ?mikoshiPreview=1 のとき true（表示ウィンドウをわずかに前倒し） */
let previewUrlActive = false;

/** プレビュー早送り: アンカーと倍率（本番は約55分なのでこれが無いとほぼ動いて見えない） */
/** @type {{ anchorReal: number, anchorSched: number, speed: number } | null} */
let previewClock = null;

/** プレビュー時: 開始時刻の少し手前からルートを表示（秒）。通常運用では使わない */
const PREVIEW_PREROLL_MS = 120_000;

/** メインマップで ?mikoshiPreview=1 を付けると、スケジュールを「今」基準に寄せる */
function applyPreviewTimeShift(routeService) {
  try {
    const q = new URLSearchParams(window.location.search);
    const on =
      q.get('mikoshiPreview') === '1' ||
      q.get('mikoshiPreview') === 'true' ||
      q.get('mikoshiRehearsal') === '1';
    if (!on) return;
    previewUrlActive = true;
    const sched = routeService.getSchedule();
    if (!sched.length) return;
    const leadRaw = q.get('mikoshiLeadSec');
    const leadSec =
      leadRaw != null && leadRaw !== ''
        ? Math.max(0, Number(leadRaw))
        : 0;
    const shift = Date.now() + leadSec * 1000 - sched[0].tStart;
    routeService.applyTimeShift(shift);
    console.info(
      '[Mikoshi] プレビューモード ON。先頭通過を',
      leadSec === 0 ? '今' : `${leadSec}秒後`,
      '相当にシフトしました。'
    );
  } catch (err) {
    console.warn('[Mikoshi] プレビューシフト失敗', err);
  }
}

/** プレビュー中は「スケジュール上のいま」（時刻の早送り・終了後はループ）。通常は実時刻。 */
function scheduleNowMs() {
  if (!previewUrlActive || !previewClock || !routeService) return Date.now();
  const sched = routeService.getSchedule();
  if (!sched.length) return Date.now();
  const t0 = sched[0].tStart;
  const t1 = sched[sched.length - 1].tEnd;
  const span = t1 - t0;
  let t =
    previewClock.anchorSched +
    (Date.now() - previewClock.anchorReal) * previewClock.speed;
  if (span > 1 && t >= t1) {
    t = t0 + ((t - t0) % span);
  }
  return t;
}

function initPreviewClock(routeServiceInstance) {
  previewClock = null;
  if (!previewUrlActive || !routeServiceInstance) return;
  const sched = routeServiceInstance.getSchedule();
  if (!sched.length) return;
  const q = new URLSearchParams(window.location.search);
  const sp = q.get('mikoshiSpeed');
  const speed =
    sp != null && sp !== ''
      ? Math.max(1, Math.min(4000, Number(sp)))
      : 120;
  previewClock = {
    anchorReal: Date.now(),
    anchorSched: sched[0].tStart,
    speed
  };
  console.info(
    '[Mikoshi] プレビュー早送り',
    speed,
    '× 既定。速さは &mikoshiSpeed=（1〜4000）。本番当日は実時間。'
  );
}

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

function isWithinScheduleWindow() {
  if (!routeService) return false;
  const sched = routeService.getSchedule();
  if (!sched.length) return false;
  const t0 = sched[0].tStart;
  const t1 = sched[sched.length - 1].tEnd;
  const nowMs = scheduleNowMs();
  const startGate = previewUrlActive ? t0 - PREVIEW_PREROLL_MS : t0;
  return nowMs >= startGate && nowMs <= t1;
}

function userWantsLayer() {
  if (typeof window.__shimoda_getMikoshiLayerOn === 'function') {
    return window.__shimoda_getMikoshiLayerOn();
  }
  return true;
}

function applyCombinedVisibility() {
  if (!map) return;
  const show = isWithinScheduleWindow() && userWantsLayer();
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
  const now = scheduleNowMs();
  if (!isWithinScheduleWindow()) {
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
    applyPreviewTimeShift(routeService);
    initPreviewClock(routeService);
    const merged = routeService.getMergedRoute();
    const mergedFc = { type: 'FeatureCollection', features: [merged] };
    const initial = routeService.getState(scheduleNowMs());

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
    console.error('[Mikoshi main map] 初期化失敗', e, {
      cpUrl: CP_URL,
      segUrl: SEG_URL
    });
  }
}

export { applyCombinedVisibility };
