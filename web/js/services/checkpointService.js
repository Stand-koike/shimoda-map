/**
 * checkpoints.geojson の読込・checkpoint_id 索引・到着時刻(ms) の正規化
 */

function toMillis(isoOrUnknown) {
  if (isoOrUnknown == null || isoOrUnknown === '') return null;
  const t = Date.parse(String(isoOrUnknown));
  return Number.isNaN(t) ? null : t;
}

/**
 * @param {string} dataUrl GeoJSON URL
 * @returns {Promise<{ fc: import('geojson').FeatureCollection, byId: Map<string, { id: string, name: string, arrivalMs: number|null, feature: import('geojson').Feature }> }>}
 */
export async function loadCheckpoints(dataUrl) {
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error(`checkpoints fetch ${res.status}`);
  /** @type {import('geojson').FeatureCollection} */
  const fc = await res.json();
  const byId = new Map();
  for (const f of fc.features || []) {
    const id = f.properties?.checkpoint_id;
    if (!id) continue;
    byId.set(id, {
      id,
      name: f.properties?.checkpoint_name ?? id,
      arrivalMs: toMillis(f.properties?.arrival_time),
      feature: f
    });
  }
  return { fc, byId };
}

export { toMillis };
