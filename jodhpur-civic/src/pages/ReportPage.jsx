import { useState } from 'react';
import { PhotoUpload } from '../components/PhotoUpload';
import { MapView } from '../components/MapView';
import { WardInfo } from '../components/WardInfo';
import { getWardInfo } from '../utils/wardLookup';
import { saveComplaint } from '../utils/storage';
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

export function ReportPage() {
  const [photo, setPhoto] = useState(null);
  const [wardInfo, setWardInfo] = useState(null);
  const [manualPin, setManualPin] = useState(null);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [outsideWard, setOutsideWard] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoReady = ({ base64, lat, lng, error }) => {
    setPhoto({ base64, lat, lng });
    setOutsideWard(false);

    if (lat && lng) {
      const info = getWardInfo(lat, lng);
      setWardInfo(info);
      if (!info) setOutsideWard(true);
    }
  };

  const handleMapClick = (lat, lng) => {
    setManualPin({ lat, lng });
    setOutsideWard(false);
    const info = getWardInfo(lat, lng);
    setWardInfo(info);
    if (!info) setOutsideWard(true);
  };

  const handleSubmit = () => {
    const useLat = photo?.lat || manualPin?.lat;
    const useLng = photo?.lng || manualPin?.lng;

    if (!photo?.base64) { alert('Please upload a photo first.'); return; }
    if (!wardInfo || !useLat) { alert('Please confirm your location on the map.'); return; }

    setSubmitting(true);
    setTimeout(() => {
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
        issue_type: issueType,
        description,
        status: 'open',
        created_at: new Date().toISOString(),
      };
      saveComplaint(complaint);
      setSubmitted(complaint.tracking_id);
      setSubmitting(false);
    }, 600);
  };

  const resetForm = () => {
    setPhoto(null);
    setWardInfo(null);
    setManualPin(null);
    setIssueType('');
    setDescription('');
    setSubmitted(null);
    setOutsideWard(false);
  };

  // — Success screen —
  if (submitted) {
    return (
      <div className="success-screen fade-in">
        <div className="success-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h2>Complaint Filed</h2>
        <p style={{ marginTop: 6, marginBottom: 20 }}>Your complaint has been recorded locally.</p>

        <div className="tracking-box">
          <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Tracking ID</div>
          <div className="tracking-id font-mono">{submitted}</div>
        </div>

        <div className="success-details">
          <div className="success-detail-row">
            <span className="text-muted">Ward</span>
            <span>{wardInfo?.ward_no} — {wardInfo?.ward_name}</span>
          </div>
          <div className="success-detail-row">
            <span className="text-muted">Councillor</span>
            <span>{wardInfo?.councillor}</span>
          </div>
          <div className="success-detail-row">
            <span className="text-muted">MLA</span>
            <span>{wardInfo?.mla}</span>
          </div>
          <div className="success-detail-row">
            <span className="text-muted">Status</span>
            <span className="badge badge-open">Open</span>
          </div>
        </div>

        <button className="btn btn-primary btn-lg" onClick={resetForm} style={{ marginTop: 24 }}>
          File Another Complaint
        </button>
      </div>
    );
  }

  // — Report form —
  const stepOneDone = !!photo?.base64;
  const stepTwoDone = !!wardInfo;

  return (
    <div className="report-page">

      {/* Step 1 — Photo */}
      <div className={`card report-step ${stepOneDone ? 'step-complete' : ''}`}>
        <div className="card-body">
          <div className="step-header">
            <div className={`step-number ${stepOneDone ? 'done' : ''}`}>
              {stepOneDone
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                : 1}
            </div>
            <h3>Upload Photo</h3>
          </div>
          <PhotoUpload onPhotoReady={handlePhotoReady} />
          {photo?.base64 && (
            <div className="photo-preview fade-in">
              <img src={photo.base64} alt="Uploaded complaint" />
            </div>
          )}
        </div>
      </div>

      {/* Step 2 — Location */}
      <div className={`card report-step ${stepTwoDone ? 'step-complete' : ''}`}>
        <div className="card-body">
          <div className="step-header">
            <div className={`step-number ${stepTwoDone ? 'done' : ''}`}>
              {stepTwoDone
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                : 2}
            </div>
            <h3>Confirm Location</h3>
          </div>
          <p className="text-sm text-muted" style={{ marginBottom: 10 }}>
            {wardInfo
              ? `Ward ${wardInfo.ward_no} (${wardInfo.ward_name}) detected. Tap map to adjust if needed.`
              : 'Tap anywhere on the map to pin your location.'}
          </p>
          {outsideWard && (
            <div className="alert-warning">
              ⚠️ Location is outside the mapped ward boundaries. Please pin inside a ward polygon.
            </div>
          )}
          <MapView
            complaints={[]}
            onMapClick={handleMapClick}
            highlightWardNo={wardInfo?.ward_no}
            height="380px"
          />
        </div>
      </div>

      {/* Step 3 — Representative info */}
      {wardInfo && (
        <div className="card report-step step-complete fade-in">
          <div className="card-body">
            <div className="step-header">
              <div className="step-number done">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3>Responsible Representatives</h3>
            </div>
            <WardInfo wardInfo={wardInfo} />
          </div>
        </div>
      )}

      {/* Step 4 — Issue type + description + submit */}
      {wardInfo && (
        <div className="card report-step fade-in">
          <div className="card-body">
            <div className="step-header">
              <div className="step-number">4</div>
              <h3>Describe the Issue</h3>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: 6 }}>Issue Type</label>
              <div className="issue-type-grid">
                {ISSUE_TYPES.map((type) => (
                  <button
                    key={type}
                    className={`issue-chip ${issueType === type ? 'active' : ''}`}
                    onClick={() => setIssueType(issueType === type ? '' : type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: 6 }}>
                Additional Details <span className="text-muted">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Overflowing garbage bin near railway crossing, not collected for 5 days"
                rows={3}
              />
            </div>

            <button
              className="btn btn-primary btn-lg"
              onClick={handleSubmit}
              disabled={submitting}
              id="submit-complaint-btn"
            >
              {submitting ? <><span className="spinner" /> Filing Complaint…</> : 'File Complaint'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
