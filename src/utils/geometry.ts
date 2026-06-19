import type { LngLatTuple, ImageCoords } from "../core/types";

export const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

export const lngLatToMercator = (lng: number, lat: number) => {
  const x = lng / 360 + 0.5;
  const sinLat = Math.sin(lat * (Math.PI / 180));
  const y = 0.5 - (0.25 * Math.log((1 + sinLat) / (1 - sinLat))) / Math.PI;
  return { x, y };
};

export const mercatorToLngLat = (x: number, y: number): LngLatTuple => {
  const lng = (x - 0.5) * 360;
  const n = Math.PI - 2 * Math.PI * y;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lng, lat];
};

export const calculateCentroid = (
  _map: any,
  corners: LngLatTuple[],
): LngLatTuple => {
  let sumX = 0,
    sumY = 0;
  if (corners.length === 0) return [0, 0];
  corners.forEach((c) => {
    const m = lngLatToMercator(c[0], c[1]);
    sumX += m.x;
    sumY += m.y;
  });
  return mercatorToLngLat(sumX / corners.length, sumY / corners.length);
};

export const rotateExistingCorners = (
  _map: any,
  corners: LngLatTuple[],
  centroid: LngLatTuple,
  angleDeltaDeg: number,
): LngLatTuple[] => {
  const centerM = lngLatToMercator(centroid[0], centroid[1]);
  const rad = angleDeltaDeg * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return corners.map((corner) => {
    const m = lngLatToMercator(corner[0], corner[1]);
    const dx = m.x - centerM.x;
    const dy = m.y - centerM.y;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return mercatorToLngLat(centerM.x + rx, centerM.y + ry);
  });
};

export const scaleCorners = (
  corners: LngLatTuple[],
  centroid: LngLatTuple,
  scaleMultiplier: number,
): ImageCoords => {
  const centerM = lngLatToMercator(centroid[0], centroid[1]);
  return corners.map((corner) => {
    const m = lngLatToMercator(corner[0], corner[1]);
    const dx = (m.x - centerM.x) * scaleMultiplier;
    const dy = (m.y - centerM.y) * scaleMultiplier;
    return mercatorToLngLat(centerM.x + dx, centerM.y + dy);
  }) as ImageCoords;
};
