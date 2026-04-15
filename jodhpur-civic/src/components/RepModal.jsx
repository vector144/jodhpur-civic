import { useEffect } from 'react';
import '../App.css';

export function RepModal({ rep, onClose, onSelectIssue, isResolved, representatives }) {
  if (!rep) return null;

  // Since it's a councillor, they only manage 1 ward.
  const active = rep.active || 0;
  const reports = rep.total || 0;
  
  // Fake calculation or real calculation for avg days
  const avgDays = 1; 

  const activeDumps = rep.complaints.filter(c => !isResolved(c) && (c.issue_type || '').toLowerCase().includes('garbage')).length;

  return (
    <div className="civic-detail-overlay" onClick={onClose}>
      <div className="civic-detail-card fade-in" style={{ padding: '0', background: '#fff', maxWidth: '440px', width: '100%', height: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#1565C0', fontSize: '18px' }}>
              {rep.councillor.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#111' }}>{rep.councillor}</div>
              <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                Councillor • Ward {rep.ward_no} • <span style={{color: rep.party === 'BJP' ? '#f57c00' : '#1976D2', fontWeight: 600}}>{rep.party}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="header-icon-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Stats */}
          <div className="civic-info-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '16px' }}>
            <div className="civic-info-card" style={{ padding: '12px 8px' }}>
              <span className="info-val" style={{ color: '#d32f2f' }}>{active}</span>
              <span className="info-lbl" style={{ fontSize: '10px' }}>Active</span>
            </div>
            <div className="civic-info-card" style={{ padding: '12px 8px' }}>
              <span className="info-val" style={{ color: '#fb8c00' }}>{reports}</span>
              <span className="info-lbl" style={{ fontSize: '10px' }}>Reports</span>
            </div>
            <div className="civic-info-card" style={{ padding: '12px 8px' }}>
              <span className="info-val" style={{ color: '#1976D2' }}>{avgDays}</span>
              <span className="info-lbl" style={{ fontSize: '10px' }}>Avg Days</span>
            </div>
            <div className="civic-info-card" style={{ padding: '12px 8px' }}>
              <span className="info-val" style={{ color: '#43a047' }}>{rep.resolved || 0}</span>
              <span className="info-lbl" style={{ fontSize: '10px' }}>Resolved</span>
            </div>
          </div>

          {active > 0 && (
            <div style={{ background: '#F1F8FE', color: '#1565C0', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.5', marginBottom: '24px', border: '1px solid #E3F2FD' }}>
              <strong>{active} issues</strong> remain unresolved in {rep.councillor}'s Jurisdiction (Ward {rep.ward_no}).
            </div>
          )}

          {/* Recent Reports */}
          <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '1px', color: '#999', marginBottom: '12px' }}>RECENT REPORTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {rep.complaints.slice(0, 10).map(c => {
               const res = isResolved(c);
               return (
                  <div key={c.tracking_id} onClick={() => { onClose(); onSelectIssue(c); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
                    <div style={{ width: '48px', height: '48px', flexShrink: 0, borderRadius: '8px', background: '#eee', overflow: 'hidden' }}>
                       {c.photo_base64 && <img src={c.photo_base64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                       <div style={{ fontSize: '14px', fontWeight: '700', color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Ward {c.ward_no} Zone</div>
                       <div style={{ fontSize: '12px', color: '#777', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.issue_type}</div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                       {res ? (
                         <span style={{ fontSize: '10px', fontWeight: '800', color: '#43a047', background: '#e8f5e9', padding: '4px 6px', borderRadius: '4px' }}>RESOLVED</span>
                       ) : (
                         <span style={{ fontSize: '10px', fontWeight: '800', color: '#c62828', background: '#F1F8FE', padding: '4px 6px', borderRadius: '4px' }}>{c.severity?.toUpperCase() || 'OPEN'}</span>
                       )}
                    </div>
                  </div>
               )
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
