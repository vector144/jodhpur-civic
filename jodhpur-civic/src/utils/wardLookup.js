import * as turf from '@turf/turf';
import { jodhpurWardsGeoJSON as wardGeoJSON } from '../data/jodhpur-wards.js';
import representatives from '../data/representatives.json';

/**
 * Given lat/lng returns ward info + representative data.
 * Returns null if outside all ward boundaries.
 * NOTE: turf uses [lng, lat] — opposite of Leaflet's [lat, lng]
 */
export function getWardInfo(lat, lng) {
  const point = turf.point([lng, lat]);

  const wardFeature = wardGeoJSON.features.find((feature) =>
    turf.booleanPointInPolygon(point, feature)
  );

  if (!wardFeature) return null;

  const wardNo = String(wardFeature.properties.ward_no);
  const rep = representatives[wardNo];

  return {
    ward_no: wardNo,
    ward_name: wardFeature.properties.ward_name,
    geometry: wardFeature.geometry,
    ...(rep || {}),
  };
}

/** Returns all ward features (for rendering on map) */
export function getAllWards() {
  return wardGeoJSON.features;
}
