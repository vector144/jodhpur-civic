import { useState } from 'react';
import { PhotoUpload } from '../components/PhotoUpload';
import { verifyIssue } from '../utils/api';

export function VerifyModal({ complaint, onClose, onVerified }) {
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoReady = ({ base64, file }) => {
    setPhoto({ base64, file });
  };

  const handleSubmit = async () => {
    if (!photo?.file) {
      alert("Please upload a photo to verify the cleanup.");
      return;
    }
    
    setSubmitting(true);
    try {
      await verifyIssue({
        issueId: complaint.tracking_id,
        file: photo.file
      });
      onVerified();
    } catch (err) {
      console.error(err);
      alert('Verification failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Verify Clean-up</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ fontSize: '14px', color: '#555', marginTop: '10px' }}>
            Upload a recent photo of the location to confirm that the issue <strong>({complaint.issue_type})</strong> at <strong>Ward {complaint.ward_no}</strong> has been resolved.
          </div>

          <div className="modal-section" style={{ marginTop: 0 }}>
            <PhotoUpload onPhotoReady={handlePhotoReady} />
          </div>

          {photo?.base64 && (
            <div style={{ position: 'relative', marginTop: 10 }}>
              <img src={photo.base64} alt="Verification" className="modal-photo-preview" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '12px' }} />
              <div style={{ position: 'absolute', top: 10, right: 10, background: '#43a047', color: '#fff', fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>VERIFIED IMAGE</div>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 20, paddingBottom: 10 }}>
             <button
                className="civic-report-cta"
                style={{ position: 'static', width: '100%', transform: 'none', background: '#108e4d', minHeight: '48px' }}
                onClick={handleSubmit}
                disabled={submitting || !photo}
              >
                {submitting ? 'Verifying...' : 'Submit Verification'}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}
