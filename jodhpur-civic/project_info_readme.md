# Jodhpur Civic Complaint App — Frontend Build Prompt

> **For the AI agent:** Build a complete React frontend app. No backend. All data comes from local JSON files. Read this entire file before writing any code.

---

## What You Are Building

A civic complaint app for Jodhpur, Rajasthan where citizens can:
1. Take/upload a photo of garbage or a civic issue
2. App auto-detects their GPS location
3. App identifies which ward they are in (point-in-polygon on GeoJSON)
4. App shows the responsible Ward Councillor, MLA, and MP
5. Complaint is saved to `localStorage` (no backend)
6. A public map shows all submitted complaints as markers

---

## Tech Stack

```
React 18 (Vite)
Leaflet.js           — map rendering (free, no API key)
@turf/turf           — point-in-polygon calculation
exifr                — extract GPS from photo EXIF data
compressorjs         — compress image before storing
leaflet/dist/leaflet.css
```

Install:
```bash
npm create vite@latest jodhpur-civic --template react
cd jodhpur-civic
npm install leaflet @turf/turf exifr compressorjs
```

---

## Project File Structure

```
src/
├── App.jsx
├── main.jsx
├── pages/
│   ├── ReportPage.jsx       ← photo upload + ward detection flow
│   └── MapPage.jsx          ← public map of all complaints
├── components/
│   ├── MapView.jsx          ← Leaflet map component
│   ├── PhotoUpload.jsx      ← camera/file input with GPS extraction
│   ├── WardInfo.jsx         ← shows detected ward + representatives
│   └── ComplaintCard.jsx    ← single complaint display
├── utils/
│   ├── wardLookup.js        ← point-in-polygon logic
│   ├── storage.js           ← localStorage helpers
│   └── trackingId.js        ← generate JDH-YYYY-NNNNN IDs
└── data/
    ├── jodhpur-wards.geojson   ← ward boundary polygons (see below)
    └── representatives.json    ← ward → councillor/MLA/MP mapping
```

---

## Data Files

### `src/data/representatives.json`

Structure — one entry per ward number (Jodhpur has 65 wards):

```json
{
  "1": {
    "ward_no": 1,
    "ward_name": "Paota",
    "councillor": "Councillor Name Here",
    "councillor_phone": "9829000000",
    "assembly_constituency": "Jodhpur",
    "mla": "MLA Name Here",
    "mla_phone": "9414000000",
    "lok_sabha": "Jodhpur",
    "mp": "Gajendra Singh Shekhawat",
    "mp_phone": "9414000001"
  },
  "2": { ... },
  ...
  "65": { ... }
}
```

> **Note for developer:** Populate this file from the Jodhpur Municipal Corporation (JMC) website or file an RTI. MLA/MP data is on the Election Commission of India website.

### `src/data/jodhpur-wards.geojson`

GeoJSON FeatureCollection. Each feature is one ward polygon:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "ward_no": 1,
        "ward_name": "Paota"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [73.0100, 26.2900],
            [73.0150, 26.2950],
            [73.0200, 26.2900],
            [73.0100, 26.2900]
          ]
        ]
      }
    }
  ]
}
```

> **How to get this data:**
> 1. Go to https://overpass-turbo.eu and run this query:
>    ```
>    [out:json];
>    area["name"="Jodhpur"]["admin_level"="6"]->.city;
>    (
>      relation["boundary"="administrative"]["admin_level"="10"](area.city);
>    );
>    out geom;
>    ```
> 2. Export → GeoJSON. If results are empty, wards are not yet in OSM.
> 3. Fallback: go to https://geojson.io, switch to satellite tiles, manually trace ward boundaries as polygons. Use the JMC ward map PDF as reference.
> 4. Each polygon's `properties` must have `ward_no` (integer) matching the key in `representatives.json`.

---

## Core Logic — Ward Lookup (`src/utils/wardLookup.js`)

```javascript
import * as turf from '@turf/turf';
import wardGeoJSON from '../data/jodhpur-wards.geojson';
import representatives from '../data/representatives.json';

/**
 * Given lat/lng, returns ward info + representative data.
 * Returns null if coordinates are outside all ward boundaries.
 */
export function getWardInfo(lat, lng) {
  // IMPORTANT: turf uses [longitude, latitude] order, not [lat, lng]
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
    ...(rep || {})
  };
}

/**
 * Returns all ward features (used to render all ward polygons on map).
 */
export function getAllWards() {
  return wardGeoJSON.features;
}
```

---

## Core Logic — GPS Extraction (`src/components/PhotoUpload.jsx`)

```jsx
import { useState } from 'react';
import * as ExifReader from 'exifr';
import Compressor from 'compressorjs';

export function PhotoUpload({ onPhotoReady }) {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('loading');

    // Step 1: Try to extract GPS from EXIF (works for camera photos, not screenshots)
    let lat = null;
    let lng = null;

    try {
      const exif = await ExifReader.parse(file, { gps: true });
      if (exif?.latitude && exif?.longitude) {
        lat = exif.latitude;
        lng = exif.longitude;
      }
    } catch (err) {
      // EXIF parse failed — not a problem, fall through to GPS API
    }

    // Step 2: If no EXIF GPS, use browser geolocation
    if (!lat || !lng) {
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
          })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (err) {
        // GPS denied — caller should show manual map pin UI
        setStatus('error');
        onPhotoReady({ file, lat: null, lng: null, error: 'gps_denied' });
        return;
      }
    }

    // Step 3: Compress the image before storing (camera photos = 5-10MB, compress to ~300KB)
    const compressedFile = await new Promise((resolve, reject) =>
      new Compressor(file, {
        quality: 0.6,
        maxWidth: 1200,
        success: resolve,
        error: reject,
      })
    );

    // Step 4: Convert to base64 for localStorage storage
    const reader = new FileReader();
    reader.onload = () => {
      setStatus('done');
      onPhotoReady({
        file: compressedFile,
        base64: reader.result,
        lat,
        lng,
        error: null,
      });
    };
    reader.readAsDataURL(compressedFile);
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        capture="environment"  // opens rear camera on mobile
        onChange={handleFileChange}
        disabled={status === 'loading'}
      />
      {status === 'loading' && <p>Detecting location...</p>}
      {status === 'error' && <p>Could not detect GPS. Please pin your location on the map.</p>}
    </div>
  );
}
```

---

## Core Logic — Leaflet Map (`src/components/MapView.jsx`)

```jsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getAllWards } from '../utils/wardLookup';

// Fix Leaflet default marker icon broken in Vite/Webpack
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIconUrl, shadowUrl: markerShadowUrl });

const JODHPUR_CENTER = [26.2389, 73.0243];

export function MapView({ complaints = [], onMapClick = null, highlightWardNo = null }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const wardLayerRef = useRef(null);

  useEffect(() => {
    if (leafletMap.current) return; // already initialized

    leafletMap.current = L.map(mapRef.current).setView(JODHPUR_CENTER, 12);

    // Free OpenStreetMap tiles — no API key needed
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(leafletMap.current);

    // Draw ward boundary polygons
    const wards = getAllWards();
    wardLayerRef.current = L.geoJSON(
      { type: 'FeatureCollection', features: wards },
      {
        style: (feature) => ({
          color: '#7F77DD',       // border color
          weight: 1.5,
          fillColor: '#EEEDFE',   // fill color
          fillOpacity: 0.2,
        }),
        onEachFeature: (feature, layer) => {
          const { ward_no, ward_name } = feature.properties;
          layer.bindTooltip(`Ward ${ward_no}: ${ward_name}`, { sticky: true });
          layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.5 }));
          layer.on('mouseout', () => wardLayerRef.current.resetStyle(layer));
        },
      }
    ).addTo(leafletMap.current);

    // Optional: allow user to click map to set location manually
    if (onMapClick) {
      leafletMap.current.on('click', (e) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }
  }, []);

  // Highlight a specific ward (e.g., after detection)
  useEffect(() => {
    if (!wardLayerRef.current || !highlightWardNo) return;
    wardLayerRef.current.eachLayer((layer) => {
      const isHighlighted = String(layer.feature.properties.ward_no) === String(highlightWardNo);
      layer.setStyle({
        fillColor: isHighlighted ? '#1D9E75' : '#EEEDFE',
        fillOpacity: isHighlighted ? 0.5 : 0.2,
        weight: isHighlighted ? 2.5 : 1.5,
        color: isHighlighted ? '#0F6E56' : '#7F77DD',
      });
    });
  }, [highlightWardNo]);

  // Add complaint markers
  useEffect(() => {
    if (!leafletMap.current) return;

    // Status color mapping
    const statusColors = {
      open: '#E24B4A',        // red
      acknowledged: '#BA7517', // amber
      resolved: '#1D9E75',    // green
    };

    complaints.forEach((complaint) => {
      if (!complaint.lat || !complaint.lng) return;

      const color = statusColors[complaint.status] || statusColors.open;

      // Custom colored circle marker
      const marker = L.circleMarker([complaint.lat, complaint.lng], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9,
      }).addTo(leafletMap.current);

      marker.bindPopup(`
        <div style="min-width: 180px;">
          <img src="${complaint.photo_base64}" style="width:100%; border-radius:4px; margin-bottom:8px;" />
          <b>Ward ${complaint.ward_no}</b><br/>
          <span style="font-size:12px; color:#666;">${complaint.ward_name}</span><br/>
          <span style="font-size:12px;">${complaint.description || ''}</span><br/>
          <span style="font-size:11px; color:${color}; font-weight:600;">● ${complaint.status.toUpperCase()}</span><br/>
          <span style="font-size:11px; color:#999;">${complaint.tracking_id}</span>
        </div>
      `);
    });
  }, [complaints]);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '500px', borderRadius: '8px' }} />
  );
}
```

---

## Core Logic — localStorage Storage (`src/utils/storage.js`)

```javascript
const STORAGE_KEY = 'jdh_complaints';

export function saveComplaint(complaint) {
  const existing = getAllComplaints();
  existing.unshift(complaint); // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function getAllComplaints() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function updateComplaintStatus(trackingId, newStatus) {
  const all = getAllComplaints();
  const updated = all.map((c) =>
    c.tracking_id === trackingId ? { ...c, status: newStatus } : c
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
```

---

## Core Logic — Tracking ID (`src/utils/trackingId.js`)

```javascript
export function generateTrackingId() {
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-5); // last 5 digits of timestamp
  return `JDH-${year}-${seq}`;
}
```

---

## Full Report Page (`src/pages/ReportPage.jsx`)

```jsx
import { useState } from 'react';
import { PhotoUpload } from '../components/PhotoUpload';
import { MapView } from '../components/MapView';
import { WardInfo } from '../components/WardInfo';
import { getWardInfo } from '../utils/wardLookup';
import { saveComplaint } from '../utils/storage';
import { generateTrackingId } from '../utils/trackingId';

export function ReportPage() {
  const [photo, setPhoto] = useState(null);        // { base64, lat, lng }
  const [wardInfo, setWardInfo] = useState(null);  // result of getWardInfo()
  const [manualPin, setManualPin] = useState(null);// { lat, lng } from map click
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(null);// tracking ID after submit

  // Called when photo is processed and GPS extracted
  const handlePhotoReady = ({ base64, lat, lng, error }) => {
    setPhoto({ base64, lat, lng });

    if (lat && lng) {
      const info = getWardInfo(lat, lng);
      setWardInfo(info);
    }
    // If GPS failed, user will click map to set pin (see handleMapClick)
  };

  // Called when user taps map to manually set location
  const handleMapClick = (lat, lng) => {
    setManualPin({ lat, lng });
    const info = getWardInfo(lat, lng);
    setWardInfo(info);
  };

  const handleSubmit = () => {
    const useLat = photo?.lat || manualPin?.lat;
    const useLng = photo?.lng || manualPin?.lng;

    if (!photo || !wardInfo || !useLat) {
      alert('Please upload a photo and confirm your location.');
      return;
    }

    const complaint = {
      tracking_id: generateTrackingId(),
      photo_base64: photo.base64,
      lat: useLat,
      lng: useLng,
      ward_no: wardInfo.ward_no,
      ward_name: wardInfo.ward_name,
      councillor: wardInfo.councillor,
      mla: wardInfo.mla,
      mp: wardInfo.mp,
      description,
      status: 'open',
      created_at: new Date().toISOString(),
    };

    saveComplaint(complaint);
    setSubmitted(complaint.tracking_id);
  };

  if (submitted) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Complaint Submitted</h2>
        <p>Tracking ID: <strong>{submitted}</strong></p>
        <p>Ward: {wardInfo?.ward_no} — {wardInfo?.ward_name}</p>
        <p>Councillor: {wardInfo?.councillor}</p>
        <button onClick={() => { setSubmitted(null); setPhoto(null); setWardInfo(null); setDescription(''); }}>
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Report a Civic Issue</h2>

      {/* Step 1: Photo Upload */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h3>1. Upload Photo</h3>
        <PhotoUpload onPhotoReady={handlePhotoReady} />
        {photo?.base64 && (
          <img src={photo.base64} alt="Uploaded" style={{ width: '100%', borderRadius: '8px', marginTop: '0.5rem' }} />
        )}
      </section>

      {/* Step 2: Map — shows detected location, allows manual pin */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h3>2. Confirm Location</h3>
        <p style={{ fontSize: '13px', color: '#666' }}>
          {wardInfo ? `Ward ${wardInfo.ward_no} detected. Tap map to adjust.` : 'Tap map to pin your location.'}
        </p>
        <MapView
          complaints={[]}
          onMapClick={handleMapClick}
          highlightWardNo={wardInfo?.ward_no}
        />
      </section>

      {/* Step 3: Ward + Representative Info */}
      {wardInfo && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3>3. Responsible Representative</h3>
          <WardInfo wardInfo={wardInfo} />
        </section>
      )}

      {/* Step 4: Description + Submit */}
      {wardInfo && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3>4. Describe the Issue</h3>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Overflowing garbage bin near railway crossing"
            rows={3}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '14px' }}
          />
          <button
            onClick={handleSubmit}
            style={{ marginTop: '0.75rem', width: '100%', padding: '12px', fontSize: '16px', background: '#7F77DD', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Submit Complaint
          </button>
        </section>
      )}
    </div>
  );
}
```

---

## Ward Info Display (`src/components/WardInfo.jsx`)

```jsx
export function WardInfo({ wardInfo }) {
  if (!wardInfo) return null;

  const rows = [
    { label: 'Ward', value: `${wardInfo.ward_no} — ${wardInfo.ward_name}` },
    { label: 'Councillor', value: wardInfo.councillor },
    { label: 'Phone', value: wardInfo.councillor_phone },
    { label: 'MLA', value: `${wardInfo.mla} (${wardInfo.assembly_constituency})` },
    { label: 'MP', value: `${wardInfo.mp} (${wardInfo.lok_sabha})` },
  ];

  return (
    <div style={{ background: '#f7f7f9', borderRadius: '8px', padding: '1rem', border: '0.5px solid #e0e0e0' }}>
      {rows.map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #e8e8e8', fontSize: '14px' }}>
          <span style={{ color: '#888' }}>{label}</span>
          <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value || '—'}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## Public Map Page (`src/pages/MapPage.jsx`)

```jsx
import { useState, useEffect } from 'react';
import { MapView } from '../components/MapView';
import { getAllComplaints } from '../utils/storage';

export function MapPage() {
  const [complaints, setComplaints] = useState([]);
  const [filter, setFilter] = useState('all'); // all | open | acknowledged | resolved

  useEffect(() => {
    setComplaints(getAllComplaints());
  }, []);

  const filtered = filter === 'all' ? complaints : complaints.filter((c) => c.status === filter);

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2>All Complaints in Jodhpur</h2>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        {['all', 'open', 'acknowledged', 'resolved'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '0.5px solid #ccc',
              background: filter === s ? '#7F77DD' : 'transparent',
              color: filter === s ? '#fff' : '#444',
              cursor: 'pointer',
              fontSize: '13px',
              textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#888', alignSelf: 'center' }}>
          {filtered.length} complaint{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <MapView complaints={filtered} />

      {/* List below map */}
      <div style={{ marginTop: '1.5rem' }}>
        {filtered.map((c) => (
          <div key={c.tracking_id} style={{ display: 'flex', gap: '12px', padding: '12px', border: '0.5px solid #e8e8e8', borderRadius: '8px', marginBottom: '8px' }}>
            {c.photo_base64 && (
              <img src={c.photo_base64} alt="" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Ward {c.ward_no} — {c.ward_name}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{c.description}</div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>{c.tracking_id} · {new Date(c.created_at).toLocaleDateString('en-IN')}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', alignSelf: 'flex-start',
              color: c.status === 'resolved' ? '#1D9E75' : c.status === 'acknowledged' ? '#BA7517' : '#E24B4A' }}>
              {c.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## App Entry + Navigation (`src/App.jsx`)

```jsx
import { useState } from 'react';
import { ReportPage } from './pages/ReportPage';
import { MapPage } from './pages/MapPage';

export default function App() {
  const [page, setPage] = useState('report'); // 'report' | 'map'

  return (
    <div>
      {/* Simple tab navigation */}
      <nav style={{ display: 'flex', borderBottom: '1px solid #e8e8e8', padding: '0 1rem', background: '#fff', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ padding: '1rem 0', fontWeight: 600, fontSize: '16px', marginRight: '2rem', color: '#7F77DD' }}>
          JDH Civic
        </div>
        {['report', 'map'].map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              borderBottom: page === p ? '2px solid #7F77DD' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: page === p ? 600 : 400,
              color: page === p ? '#7F77DD' : '#666',
              textTransform: 'capitalize',
            }}
          >
            {p === 'report' ? 'Report Issue' : 'View Map'}
          </button>
        ))}
      </nav>

      <main>
        {page === 'report' && <ReportPage />}
        {page === 'map' && <MapPage />}
      </main>
    </div>
  );
}
```

---

## Vite Config (fix GeoJSON + Leaflet icons)

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.geojson'], // allow importing GeoJSON as JS module
});
```

---

## Important Notes for the Agent

### Leaflet coordinate order
Turf.js uses `[longitude, latitude]` (GeoJSON standard).
Leaflet uses `[latitude, longitude]` (opposite).
**Never mix these up.** In `wardLookup.js`, always do `turf.point([lng, lat])`.

### Leaflet in React
Leaflet mutates the DOM directly. Always:
- Use a `useRef` for the container div
- Guard initialization with `if (leafletMap.current) return;`
- Never render Leaflet inside a component that re-renders frequently

### GeoJSON import in Vite
```javascript
// This works after adding assetsInclude to vite.config.js:
import wardGeoJSON from '../data/jodhpur-wards.geojson';
// wardGeoJSON is a plain JS object — use directly
```

### localStorage photo storage
Base64 images are large. Each complaint ~300KB compressed. localStorage limit is ~5MB.
After ~15 complaints, storage will fill up. For MVP this is fine.
Later: replace with Supabase Storage upload.

### Mobile camera
The `capture="environment"` attribute on the file input opens the rear camera directly on Android and iOS. Works in Chrome and Safari. No extra permissions needed beyond camera access.

### GPS accuracy
`enableHighAccuracy: true` uses GPS chip (accurate to ~5m) instead of WiFi triangulation (accurate to ~50m). It takes longer to acquire (3-8 seconds) but is much more accurate for ward-level detection.

---

## What to Build First (In Order)

1. Set up Vite + install dependencies
2. Create placeholder `jodhpur-wards.geojson` with 2-3 sample ward polygons (use real Jodhpur coordinates from Google Maps)
3. Create `representatives.json` with those 2-3 ward entries
4. Get `MapView.jsx` rendering with ward polygons visible on screen
5. Add `PhotoUpload.jsx` with GPS detection working
6. Wire up `wardLookup.js` — confirm ward detection prints correct ward name in console
7. Build `ReportPage.jsx` end-to-end flow
8. Build `MapPage.jsx` with complaint markers
9. Add `App.jsx` navigation

---

*End of prompt. Build the complete app as described.*