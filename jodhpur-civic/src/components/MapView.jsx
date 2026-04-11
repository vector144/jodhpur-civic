import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getAllWards } from '../utils/wardLookup';

const JODHPUR_CENTER = [26.2389, 73.0243];
const JODHPUR_BOUNDS = L.latLngBounds(L.latLng(25.8, 72.5), L.latLng(26.7, 73.6));

// Pins change color based on severity if unresolved, and turn green/blue for resolved/acknowledged
const SEVERITY_COLORS = {
  'Critical': '#d32f2f', // Dark Red
  'Severe':   '#f57c00', // Orange
  'Moderate': '#fbc02d', // Yellow
  'Minor':    '#4db6ac', // Teal
};

// Custom circle marker icon (same as NammaKasa dots)
function makeCircleIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:18px;height:18px;
      background:${color};
      border-radius:50%;
      border:2.5px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export function MapView({ complaints = [], onMapClick = null, onMarkerClick = null, highlightWardNo = null, height = '100%' }) {
  const mapRef      = useRef(null);
  const leafletMap  = useRef(null);
  const wardLayer   = useRef(null);
  const markers     = useRef([]);

  /* ── Init map once ── */
  useEffect(() => {
    if (leafletMap.current) return;

    leafletMap.current = L.map(mapRef.current, {
      center: JODHPUR_CENTER,
      zoom: 13,
      minZoom: 11,
      maxBounds: JODHPUR_BOUNDS,
      maxBoundsViscosity: 1.0,
      zoomControl: false,         // we'll place zoom custom
    });

    // 🎨 Carto Light — clean, minimal, NammaKasa-like
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }
    ).addTo(leafletMap.current);

    // Custom zoom control — bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(leafletMap.current);

    // Ward boundaries — NammaKasa style: thin red outline, very light fill
    const wards = getAllWards();
    wardLayer.current = L.geoJSON(
      { type: 'FeatureCollection', features: wards },
      {
        style: () => ({
          color: '#e53935',
          weight: 1.2,
          opacity: 0.6,
          fillColor: '#ffcdd2',
          fillOpacity: 0.15,
          dashArray: '4 4',
        }),
        onEachFeature: (feature, layer) => {
          const { ward_no, ward_name } = feature.properties;

          // Tooltip on hover
          layer.bindTooltip(
            `<div class="ward-tip"><strong>Ward ${ward_no}</strong><br>${ward_name}</div>`,
            { sticky: true, direction: 'top', offset: [0, -4] }
          );

          layer.on('mouseover', () => {
            layer.setStyle({ fillOpacity: 0.35, weight: 1.8 });
            layer.bringToFront();
          });
          layer.on('mouseout', () => wardLayer.current.resetStyle(layer));
        },
      }
    ).addTo(leafletMap.current);

    // Fit to wards on load
    if (wardLayer.current.getBounds().isValid()) {
      leafletMap.current.fitBounds(wardLayer.current.getBounds(), { padding: [24, 24] });
    }

    if (onMapClick) {
      leafletMap.current.on('click', (e) => onMapClick(e.latlng.lat, e.latlng.lng));
    }
  }, []); // eslint-disable-line

  /* ── Highlight ward ── */
  useEffect(() => {
    if (!wardLayer.current) return;
    wardLayer.current.eachLayer((layer) => {
      const isTarget = String(layer.feature?.properties?.ward_no) === String(highlightWardNo);
      layer.setStyle({
        color: isTarget ? '#b71c1c' : '#e53935',
        weight: isTarget ? 2.5 : 1.2,
        fillColor: isTarget ? '#ef9a9a' : '#ffcdd2',
        fillOpacity: isTarget ? 0.45 : 0.15,
        dashArray: isTarget ? null : '4 4',
      });
    });
  }, [highlightWardNo]);

  /* ── Complaint markers ── */
  useEffect(() => {
    if (!leafletMap.current) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    complaints.forEach((c) => {
      if (!c.lat || !c.lng) return;
      
      let color = '#757575'; // default grey
      const isResolved = c.status === 'resolved' || !!(c.verified_photo || (c.verifications && c.verifications.length > 0));
      
      if (isResolved) {
        color = '#43a047'; // 1. Support fully fixed -> Green
      } else {
        color = SEVERITY_COLORS[c.severity] || '#e53935'; // 2. Open -> Dynamic Severity
      }

      const marker = L.marker([c.lat, c.lng], { icon: makeCircleIcon(color) })
        .addTo(leafletMap.current);

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(c));
      } else {
        // inline popup if no external handler
        marker.bindPopup(`
          <div style="min-width:180px;font-family:Inter,sans-serif;padding:2px">
            ${c.photo_base64 ? `<img src="${c.photo_base64}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:8px"/>` : ''}
            <div style="font-weight:700;font-size:13px">${c.ward_name}</div>
            <div style="font-size:11px;color:#666;margin:2px 0">Ward #${c.ward_no}</div>
            ${c.issue_type ? `<div style="font-size:12px;color:#1565c0;margin-top:4px">${c.issue_type}</div>` : ''}
            <div style="margin-top:8px;font-size:12px;font-weight:700;color:${color}">
              ${c.status.toUpperCase()} · 1 report
            </div>
          </div>
        `);
      }

      markers.current.push(marker);
    });
  }, [complaints]); // eslint-disable-line

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height, position: 'absolute', inset: 0 }}
    />
  );
}
