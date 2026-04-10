import { useState, useEffect } from 'react';
import { MapView } from '../components/MapView';
import { getAllComplaints, deleteComplaint, updateComplaintStatus } from '../utils/storage';

const FILTERS = ['all', 'open', 'acknowledged', 'resolved'];

const STATUS_COLORS = {
  open: 'badge-open',
  acknowledged: 'badge-acknowledged',
  resolved: 'badge-resolved',
};

export function MapPage() {
  const [complaints, setComplaints] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const reload = () => setComplaints(getAllComplaints());

  useEffect(() => { reload(); }, []);

  const filtered = filter === 'all' ? complaints : complaints.filter((c) => c.status === filter);

  const handleStatusChange = (trackingId, newStatus) => {
    updateComplaintStatus(trackingId, newStatus);
    reload();
    if (selected?.tracking_id === trackingId) setSelected({ ...selected, status: newStatus });
  };

  const handleDelete = (trackingId) => {
    if (!confirm('Delete this complaint?')) return;
    deleteComplaint(trackingId);
    setSelected(null);
    reload();
  };

  return (
    <div className="map-page">
      {/* Left panel: filter + list */}
      <div className="complaints-panel">
        <div className="panel-header">
          <h2>All Complaints</h2>
          <span className="badge" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', fontSize: 12 }}>
            {filtered.length}
          </span>
        </div>

        <div className="filter-bar">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-pill ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--gray-300)', marginBottom: 8 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p className="text-sm text-muted">No complaints yet</p>
          </div>
        ) : (
          <div className="complaint-list">
            {filtered.map((c) => (
              <div
                key={c.tracking_id}
                className={`complaint-card ${selected?.tracking_id === c.tracking_id ? 'selected' : ''}`}
                onClick={() => setSelected(c)}
              >
                {c.photo_base64 && (
                  <img src={c.photo_base64} alt="" className="complaint-thumb" />
                )}
                <div className="complaint-info">
                  <div className="complaint-ward">Ward {c.ward_no} — {c.ward_name}</div>
                  {c.issue_type && <div className="complaint-type">{c.issue_type}</div>}
                  {c.description && <div className="complaint-desc">{c.description}</div>}
                  <div className="complaint-meta">
                    <span className="font-mono text-xs text-muted">{c.tracking_id}</span>
                    <span>·</span>
                    <span className="text-xs text-muted">
                      {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
                <span className={`badge ${STATUS_COLORS[c.status]}`} style={{ flexShrink: 0, alignSelf: 'flex-start' }}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: map + detail */}
      <div className="map-panel">
        <div className="map-wrapper card">
          <MapView complaints={filtered} height="420px" />
        </div>

        {selected && (
          <div className="complaint-detail card fade-in">
            <div className="card-body">
              <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 15 }}>Complaint Detail</h3>
                <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setSelected(null)}>
                  ✕ Close
                </button>
              </div>

              {selected.photo_base64 && (
                <img src={selected.photo_base64} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 14, maxHeight: 200, objectFit: 'cover' }} />
              )}

              <div className="detail-grid">
                <div className="detail-row">
                  <span className="text-muted text-sm">Tracking ID</span>
                  <span className="font-mono text-sm">{selected.tracking_id}</span>
                </div>
                <div className="detail-row">
                  <span className="text-muted text-sm">Ward</span>
                  <span className="text-sm">{selected.ward_no} — {selected.ward_name}</span>
                </div>
                {selected.issue_type && (
                  <div className="detail-row">
                    <span className="text-muted text-sm">Issue</span>
                    <span className="text-sm">{selected.issue_type}</span>
                  </div>
                )}
                {selected.description && (
                  <div className="detail-row">
                    <span className="text-muted text-sm">Details</span>
                    <span className="text-sm">{selected.description}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="text-muted text-sm">Councillor</span>
                  <span className="text-sm">{selected.councillor || '—'}</span>
                </div>
                <div className="detail-row">
                  <span className="text-muted text-sm">MLA</span>
                  <span className="text-sm">{selected.mla || '—'}</span>
                </div>
                <div className="detail-row">
                  <span className="text-muted text-sm">Filed</span>
                  <span className="text-sm">{new Date(selected.created_at).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <hr className="divider" />

              <div style={{ marginBottom: 12 }}>
                <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: 6 }}>Update Status</label>
                <div className="flex gap-2">
                  {['open', 'acknowledged', 'resolved'].map((s) => (
                    <button
                      key={s}
                      className={`filter-pill ${selected.status === s ? 'active' : ''}`}
                      style={{ fontSize: 12 }}
                      onClick={() => handleStatusChange(selected.tracking_id, s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-danger"
                style={{ width: '100%', marginTop: 4 }}
                onClick={() => handleDelete(selected.tracking_id)}
              >
                Delete Complaint
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
