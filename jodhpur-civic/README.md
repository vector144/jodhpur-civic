# Jodhpur Civic Portal 🇮🇳

A real-time, map-first web application designed to empower the citizens of Jodhpur to report, track, and verify civic issues (like garbage dumps, potholes, waterlogging, and broken streetlights). Built with an absolute focus on accountability, precision, and mobile-first experience.

## ✨ Features

- **📍 Precision Geofencing**: Utilizes device GPS or photo EXIF data to precisely locate the user. If the location is outside Jodhpur's municipal boundaries, the app automatically blocks submission, preventing spam and misplaced reports.
- **🗺 Automatic Ward Detection**: Uses `Turf.js` point-in-polygon logic alongside GeoJSON boundaries to automatically detect the exact Municipal Ward (1–80) where the user is standing.
- **👤 Instant Accountability**: Once the ward is detected, the app instantly queries `representatives.json` and assigns the issue to the verified, actual Municipal Councillor for that specific ward (including their name, party, and phone number).
- **📸 Smart Camera Integration**: Features built-in image compression (`compressorjs`) and metadata extraction (`exifr`) to pull GPS data straight from captured photos when browser location isn't precise enough.
- **📊 Severity Scaling**: Citizens can categorise issues by severity (*Minor, Moderate, Severe, or Critical*) to help authorities prioritize responses.
- **✅ Community Verification**: Features a dedicated tracking and verification flow. Citizens can click on "Open" issues on the map and upload new photographic proof to "Verify" that an issue has been successfully cleaned up/resolved.
- **📱 Premium Map UI**: Beautiful, un-cluttered map interface using Leaflet and CARTO light tiles. Visual indicators (Red, Orange, Green dots) display problem areas at a glance.

## 🛠 Tech Stack

- **Frontend Framework**: React 18 (Vite)
- **Map & Geospatial**: Leaflet (`react-leaflet`), Turf.js (for spatial analysis)
- **Image Processing**: `compressorjs` (client-side compression), `exifr` (metadata reading)
- **Styling**: Vanilla CSS (Custom design system, Premium UI)

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js (v16 or higher) installed.

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd jodhpur-civic
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`. *(Note: For full GPS functionality, it is recommended to test on a physical mobile device or use browser DevTools sensor overrides).*

## 📂 Project Structure

- `src/components/MapView.jsx`: Renders the Leaflet map and handles plotting of issue markers.
- `src/components/PhotoUpload.jsx`: Handles camera access, image compression, and EXIF processing.
- `src/pages/ReportModal.jsx`: The core reporting flow (GPS acquisition -> Ward Assignment -> Photo -> Severity -> Submit).
- `src/pages/VerifyModal.jsx`: The modal used by citizens to upload proof of cleanup.
- `src/data/jodhpur-wards.js`: The exact geographic coordinates (GeoJSON polygons) for Jodhpur municipal wards.
- `src/data/representatives.json`: The real-world dataset mapping ward numbers to councillors and their parties.
- `src/utils/wardLookup.js`: Turf.js bridging logic to look up coordinates against the ward polygons.

## 🚧 Roadmap / Next Steps
- **Backend Migration**: Currently uses `localStorage` for storing complaints. Transition to Supabase/Firebase for real-time cloud data, authentication, and cloud storage for images.
- **WhatsApp Integration**: Hook up the "File Complaint via WhatsApp" button to generate a pre-filled WhatsApp message to the BBMP/Jodhpur Nagar Nigam control room.
- **Admin Dashboard**: Create a secure portal for councillors and municipal workers to update statuses from 'Open' to 'Acknowledged'.

## 📝 License
This project is open-source and free to be adapted for other municipalities.
