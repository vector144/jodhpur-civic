import { useState, useEffect } from 'react';
import { PhotoUpload } from '../components/PhotoUpload';
import { WardInfo } from '../components/WardInfo';
import { getWardInfo } from '../utils/wardLookup';
import { reportIssue } from '../utils/api';
import { generateTrackingId } from '../utils/trackingId';

const ISSUE_TYPES = [
  'Garbage / Open Dump',
  'Broken Road / Pothole',
  'Waterlogging / Drain Overflow',
  'Street Light Not Working',
  'Illegal Construction',
  'Stray Animals',
  'Other',
];

const SEVERITY_OPTIONS = [
  { id: 'Minor', label: 'Minor', desc: 'A few bags or scattered litter — fits in a small area (under 1m²)' },
  { id: 'Moderate', label: 'Moderate', desc: 'Noticeable heap — roughly the size of an auto-rickshaw (1–5m²)' },
  { id: 'Severe', label: 'Severe', desc: 'Covers a significant area — sidewalk blocked or road edge piled up (5–20m²)' },
  { id: 'Critical', label: 'Critical', desc: 'Major illegal dumpsite — occupies a vacant plot or entire stretch of road (20m²+)' }
];

export function ReportModal({ onClose }) {
  const [photo, setPhoto] = useState(null);
  const [wardInfo, setWardInfo] = useState(null);
  const [issueType, setIssueType] = useState('');
  const [severity, setSeverity] = useState('');
  const [description, setDesc] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [outsideWard, setOutside] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Real-time GPS ──
  const [gpsState, setGpsState] = useState('acquiring');
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);

  // Start watching GPS as soon as modal opens
  useEffect(() => {
    if (!navigator.geolocation) { setGpsState('unavailable'); return; }

    const watchId = navigator.geolocation.watchPosition(
      ({ coords: { latitude, longitude, accuracy } }) => {
        setUserLat(latitude);
        setUserLng(longitude);
        setGpsAccuracy(Math.round(accuracy));
        setGpsState('done');
        const info = getWardInfo(latitude, longitude);
        setWardInfo(info);
        if (info) setGpsTimedOut(false);
        // Only flag outside-ward when accuracy is reasonably precise (≤500m)
        setOutside(!info && accuracy <= 500);
      },
      (err) => {
        setGpsState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // After 12s with no ward found, stop waiting and show the issue
  useEffect(() => {
    const t = setTimeout(() => {
      if (!wardInfo) setGpsTimedOut(true);
    }, 12000);
    return () => clearTimeout(t);
  }, [wardInfo]);

  // Manual retry — re-triggers the browser's permission dialog
  const requestLocation = () => {
    console.log("yess")
    setGpsState('acquiring');
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude, accuracy } }) => {
        setUserLat(latitude);
        setUserLng(longitude);
        setGpsAccuracy(Math.round(accuracy));
        setGpsState('done');
        const info = getWardInfo(latitude, longitude);
        setWardInfo(info);
        setOutside(!info);
      },
      (err) => {
        setGpsState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Photo provides both base64 preview and the File/Blob for Supabase
  const handlePhotoReady = ({ base64, file }) => setPhoto({ base64, file });

  const handleSubmit = async () => {
    if (!photo?.file) { alert('Please upload a photo first.'); return; }
    if (gpsState !== 'done') { alert('Still acquiring GPS. Please allow location access.'); return; }
    if (!wardInfo) { alert('Your location is outside Jodhpur ward boundaries.'); return; }
    if (!issueType) { alert('Please select an Issue Type.'); return; }
    if (!severity) { alert('Please select How Bad It Is (Severity).'); return; }

    setSubmitting(true);
    try {
      await reportIssue({
        file: photo.file,
        severity,
        gps: { lat: userLat, lng: userLng },
        wardInfo,
        issueType,
        description
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert('Failed to submit: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal-header">
          <h2 className="modal-title">Report an Issue</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {submitted ? (
            /* ── Success ── */
            <div className="modal-success">
              <div className="modal-success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#43a047" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3>Complaint Filed!</h3>
              <p className="modal-success-sub">Your report has been recorded.</p>
              <div className="modal-tracking-box">
                <div className="modal-tracking-label">Status</div>
                <div className="modal-tracking-id">Sent to Council</div>
              </div>
              {wardInfo && (
                <div className="modal-ward-summary">
                  <div className="modal-ward-row"><span>Ward</span><span>{wardInfo.ward_no} — {wardInfo.ward_name}</span></div>
                  {wardInfo.councillor && <div className="modal-ward-row"><span>Councillor</span><span>{wardInfo.councillor}</span></div>}
                  {wardInfo.mla && <div className="modal-ward-row"><span>MLA</span><span>{wardInfo.mla}</span></div>}
                </div>
              )}
              <button className="civic-report-cta" style={{ position: 'static', width: '100%', marginTop: 20 }} onClick={onClose}>
                Done
              </button>
            </div>

          ) : (
            /* ── Form ── */
            <>
              {/* Step 1 — Live GPS / Location */}
              <div className="modal-section">
                <div className="modal-section-label">
                  <span className={`modal-step-num ${gpsState === 'done' && wardInfo ? 'done' : ''}`}>
                    {gpsState === 'done' && wardInfo ? '✓' : '1'}
                  </span>
                  Your Location
                </div>

                {gpsState === 'acquiring' && (
                  <div className="gps-status acquiring">
                    <span className="spinner" />
                    <span>Acquiring GPS signal…</span>
                  </div>
                )}

                {gpsState === 'done' && wardInfo && (
                  <div className="gps-status done">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <div>
                      <div className="gps-ward-name">Ward {wardInfo.ward_no} — {wardInfo.ward_name}</div>
                      <div className="gps-accuracy">±{gpsAccuracy}m · live</div>
                      {/* debug: remove before prod */}
                      <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#2e7d32', marginTop: 2, opacity: 0.8 }}>
                        {userLat?.toFixed(6)}, {userLng?.toFixed(6)}
                      </div>
                    </div>
                  </div>
                )}

                {gpsState === 'done' && outsideWard && (
                  <div className="modal-alert">⚠️ Your location is outside Jodhpur's ward boundaries.</div>
                )}

                {/* Stuck / poor GPS — tiered messages */}
                {gpsState === 'done' && !wardInfo && !outsideWard && (
                  gpsTimedOut || gpsAccuracy > 50000 ? (
                    <div className="gps-denied-card">
                      <div className="gps-denied-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="1.8">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                      <div className="gps-denied-body">
                        <div className="gps-denied-title">Poor GPS Signal</div>
                        <div className="gps-denied-sub">
                          Accuracy is ±{gpsAccuracy >= 1000 ? `${Math.round(gpsAccuracy / 1000)}km` : `${gpsAccuracy}m`}.
                          This device is using IP-based location — not precise enough to detect your ward.
                          Please use a phone with GPS enabled.
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#999', marginTop: 4 }}>
                          {userLat?.toFixed(4)}, {userLng?.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="gps-status acquiring">
                      <span className="spinner" />
                      <span>Improving accuracy (±{gpsAccuracy >= 1000 ? `${Math.round(gpsAccuracy / 1000)}km` : `${gpsAccuracy}m`})…</span>
                    </div>
                  )
                )}
                {gpsState === 'denied' && (
                  <div className="gps-denied-card">
                    <div className="gps-denied-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="1.8">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <line x1="12" y1="7" x2="12" y2="11" />
                        <line x1="12" y1="15" x2="12.01" y2="15" />
                      </svg>
                    </div>
                    <div className="gps-denied-body">
                      <div className="gps-denied-title">Location Access Required</div>
                      <div className="gps-denied-sub">
                        We need your location to identify the ward and assign the correct councillor &amp; MLA.
                      </div>
                      <button className="gps-allow-btn" onClick={requestLocation}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        Allow Location Access
                      </button>
                      <div className="gps-denied-hint">
                        If denied permanently: tap the 🔒 lock icon in your browser's address bar → Site Settings → Location → Allow
                      </div>
                    </div>
                  </div>
                )}
                {gpsState === 'unavailable' && (
                  <div className="gps-denied-card">
                    <div className="gps-denied-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <div className="gps-denied-body">
                      <div className="gps-denied-title">GPS Unavailable</div>
                      <div className="gps-denied-sub">Your device or browser does not support location services.</div>
                      <button className="gps-allow-btn" onClick={requestLocation}>
                        Retry
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2 — Representatives (shows immediately when ward known) */}
              {wardInfo && (
                <div className="modal-section">
                  <div className="modal-section-label">
                    <span className="modal-step-num done">✓</span> Representatives
                  </div>
                  <WardInfo wardInfo={wardInfo} />
                </div>
              )}

              {/* Step 3 — Photo */}
              <div className="modal-section">
                <div className="modal-section-label">
                  <span className={`modal-step-num ${photo?.base64 ? 'done' : ''}`}>
                    {photo?.base64 ? '✓' : '2'}
                  </span>
                  Upload Photo
                </div>
                <PhotoUpload onPhotoReady={handlePhotoReady} />
                {photo?.base64 && <img src={photo.base64} alt="preview" className="modal-photo-preview" />}
              </div>

              {/* Step 4 — Issue type + submit */}
              {photo?.base64 && (
                <div className="modal-section">
                  {/* Step 4 — Issue type */}
                  <div className="modal-section-label">
                    <span className="modal-step-num">3</span> Issue Type
                  </div>
                  <div className="issue-type-grid">
                    {ISSUE_TYPES.map((t) => (
                      <button
                        key={t}
                        className={`issue-chip ${issueType === t ? 'active' : ''}`}
                        onClick={() => setIssueType(issueType === t ? '' : t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Step 5 — Severity */}
                  <div className="modal-section-label" style={{ marginTop: 24 }}>
                    <span className="modal-step-num">4</span> How Bad Is It?
                  </div>
                  <div className="severity-list">
                    {SEVERITY_OPTIONS.map((opt) => (
                      <div
                        key={opt.id}
                        className={`severity-card ${severity === opt.id ? 'active' : ''}`}
                        onClick={() => setSeverity(severity === opt.id ? '' : opt.id)}
                      >
                        <div className="severity-radio">
                          {severity === opt.id && <div className="severity-radio-inner" />}
                        </div>
                        <div className="severity-content">
                          <div className={`severity-title type-${opt.id.toLowerCase()}`}>{opt.label}</div>
                          <div className="severity-desc">{opt.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <textarea
                    placeholder="Add more details (optional)…"
                    rows={3}
                    value={description}
                    onChange={(e) => setDesc(e.target.value)}
                    style={{ marginTop: 24 }}
                  />
                  <div style={{ marginTop: 24, paddingBottom: 10 }}>
                    <button
                      className="civic-report-cta"
                      style={{ position: 'static', width: '100%', transform: 'none', minHeight: '48px' }}
                      onClick={handleSubmit}
                      disabled={submitting || gpsState !== 'done'}
                    >
                      {submitting ? 'Filing…' :
                        (gpsState !== 'done' ? 'Waiting for GPS…' : 'Submit Complaint')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
