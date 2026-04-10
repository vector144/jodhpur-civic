import { useState } from 'react';
import * as ExifReader from 'exifr';
import Compressor from 'compressorjs';

/**
 * Reads EXIF GPS from photo if available, compresses, returns base64 + coords.
 * onPhotoReady({ base64, lat, lng }) — lat/lng are null if no EXIF GPS found.
 */
export function PhotoUpload({ onPhotoReady }) {
  const [status, setStatus] = useState('idle'); // idle | loading | done

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('loading');

    // ── Step 1: Try to read GPS from photo EXIF ──
    let lat = null;
    let lng = null;
    try {
      const exif = await ExifReader.parse(file, { gps: true });
      if (exif?.latitude && exif?.longitude) {
        lat = exif.latitude;
        lng = exif.longitude;
      }
    } catch {
      // No EXIF or no GPS tag — that's fine, GPS from device will be used
    }

    // ── Step 2: Compress image ──
    const compressed = await new Promise((resolve, reject) =>
      new Compressor(file, {
        quality: 0.65,
        maxWidth: 1200,
        success: resolve,
        error: reject,
      })
    );

    // ── Step 3: Base64 preview + return Blob ──
    const reader = new FileReader();
    reader.onload = () => {
      setStatus('done');
      onPhotoReady({ file: compressed, base64: reader.result, lat, lng });
    };
    reader.readAsDataURL(compressed);
  };

  return (
    <div className="photo-upload-area">
      <label className={`photo-label ${status === 'done' ? 'done' : ''}`} htmlFor="photo-input">
        {status === 'idle' && (
          <>
            <div className="upload-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <span className="upload-text">Tap to take photo or browse</span>
            <span className="upload-hint">GPS from photo EXIF · device location as fallback</span>
          </>
        )}
        {status === 'loading' && (
          <>
            <div className="spinner" />
            <span className="upload-text" style={{ marginTop: 10 }}>Reading photo…</span>
          </>
        )}
        {status === 'done' && (
          <>
            <div className="upload-icon" style={{ color: '#43a047' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <span className="upload-text" style={{ color: '#43a047' }}>Photo ready</span>
            <span className="upload-hint">Tap to change photo</span>
          </>
        )}
      </label>
      <input
        id="photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={status === 'loading'}
        style={{ display: 'none' }}
      />
    </div>
  );
}
