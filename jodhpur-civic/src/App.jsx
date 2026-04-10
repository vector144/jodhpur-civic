import { useState, useEffect } from 'react';
import { ReportModal } from './pages/ReportModal';
import { MapView } from './components/MapView';
import { VerifyModal } from './pages/VerifyModal';
import { getAllComplaintsFromDB } from './utils/api';
import { supabase } from './utils/supabase';
import representatives from './data/representatives.json';
import './App.css';

const SEVERITY_FILTERS = ['All Severity', 'High', 'Medium', 'Low'];
const STATUS_FILTERS  = ['All Status', 'open', 'acknowledged', 'resolved'];

export default function App() {
  const [complaints, setComplaints]     = useState([]);
  const [severity, setSeverity]         = useState('All Severity');
  const [status, setStatus]             = useState('All Status');
  const [showReport, setShowReport]     = useState(false);
  const [view, setView]                 = useState('map'); // 'map' | 'list'
  const [selected, setSelected]         = useState(null);
  const [showSevDrop, setShowSevDrop]   = useState(false);
  const [showStatDrop, setShowStatDrop] = useState(false);
  const [showVerify, setShowVerify]     = useState(false);

  const reload = async () => {
    try {
      const data = await getAllComplaintsFromDB();
      setComplaints(data);
    } catch (e) {
      console.error('Failed to load issues DB:', e);
    }
  };

  useEffect(() => { 
    reload(); 

    // Setup Supabase Realtime Listener
    const channel = supabase
      .channel('issues-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        () => {
          // On any insertion or update, reload our data
          reload();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const h = () => { setShowSevDrop(false); setShowStatDrop(false); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  const filtered = complaints.filter((c) => {
    const sOk = status === 'All Status' || c.status === status;
    return sOk;
  });

  const activeCount   = filtered.filter((c) => c.status !== 'resolved').length;
  const resolvedCount = filtered.filter((c) => c.status === 'resolved').length;

  return (
    <div className="civic-shell">
      {/* ── Top bar ── */}
      <div className="civic-topbar">
        {/* Brand */}
        <div className="civic-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span className="civic-brand-name">JDH Civic</span>
          <span className="civic-brand-beta">v0.1</span>
        </div>

        {/* Filters */}
        <div className="civic-filters">
          {/* Severity dropdown */}
          <div className="civic-dropdown-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              className="civic-dropdown-btn"
              onClick={() => { setShowSevDrop((p) => !p); setShowStatDrop(false); }}
            >
              {severity}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showSevDrop && (
              <div className="civic-dropdown-menu">
                {SEVERITY_FILTERS.map((f) => (
                  <button key={f} className={`civic-dropdown-item ${severity === f ? 'active' : ''}`}
                    onClick={() => { setSeverity(f); setShowSevDrop(false); }}>
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status dropdown */}
          <div className="civic-dropdown-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              className="civic-dropdown-btn"
              onClick={() => { setShowStatDrop((p) => !p); setShowSevDrop(false); }}
            >
              {STATUS_FILTERS.find((f) => f === status) || status}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showStatDrop && (
              <div className="civic-dropdown-menu">
                {STATUS_FILTERS.map((f) => (
                  <button key={f} className={`civic-dropdown-item ${status === f ? 'active' : ''}`}
                    onClick={() => { setStatus(f); setShowStatDrop(false); }}>
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map / List toggle */}
        <div className="civic-view-toggle">
          <button className={`civic-toggle-btn ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}>Map</button>
          <button className={`civic-toggle-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {/* ── Stats pill ── */}
      <div className="civic-stats">
        <div className="civic-stat">
          <span className="civic-stat-num open">{activeCount}</span>
          <span className="civic-stat-label">Active</span>
        </div>
        <div className="civic-stat-divider" />
        <div className="civic-stat">
          <span className="civic-stat-num resolved">{resolvedCount}</span>
          <span className="civic-stat-label">Resolved</span>
        </div>
      </div>

      {/* ── Map ── */}
      {view === 'map' && (
        <MapView
          complaints={filtered}
          height="100%"
          onMarkerClick={(c) => setSelected(c)}
        />
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <div className="civic-list-view">
          {filtered.length === 0 ? (
            <div className="civic-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>No complaints yet. Be the first to report!</p>
            </div>
          ) : filtered.map((c) => (
            <div key={c.tracking_id} className="civic-list-card" onClick={() => setSelected(c)}>
              {c.photo_base64 && <img src={c.photo_base64} className="civic-list-thumb" alt="" />}
              <div className="civic-list-body">
                <div className="civic-list-ward">Ward {c.ward_no} — {c.ward_name}</div>
                {c.issue_type && <div className="civic-list-type">{c.issue_type}</div>}
                {c.description && <div className="civic-list-desc">{c.description}</div>}
              </div>
              <span className={`civic-status-badge status-${c.status}`}>{c.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Bottom report CTA ── */}
      <button className="civic-report-cta" onClick={() => setShowReport(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        Report Issue
      </button>

      {/* ── Detail popup (overlay card) ── */}
      {selected && (
        <div className="civic-detail-overlay" onClick={() => setSelected(null)}>
          <div className="civic-detail-card fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ padding: 0 }}>
              
              {/* Header: Badges & Actions */}
              <div className="civic-detail-header">
                <div className="civic-status-badges">
                  <span className="civic-badge badge-critical">Critical</span>
                  <span className="civic-badge badge-unresolved">{selected.status || 'Unresolved'}</span>
                </div>
                <div className="civic-detail-header-actions">
                  <button className="header-icon-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                  </button>
                  <button className="header-icon-btn" onClick={() => setSelected(null)}>✕</button>
                </div>
              </div>

              {/* Title & Location */}
              <div className="civic-summary-info">
                <div className="civic-summary-title">{selected.ward_name}</div>
                <div className="civic-summary-loc">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  Jodhpur, Ward {selected.ward_no}
                </div>
              </div>

              {/* Hero Image */}
              {selected.photo_base64 && (
                <img src={selected.photo_base64} className="civic-detail-hero" alt="Issue" />
              )}

              {/* Detail Stats Grid */}
              <div className="civic-info-grid">
                <div className="civic-info-card">
                  <span className="info-val">1</span>
                  <span className="info-lbl">Reports</span>
                </div>
                <div className="civic-info-card">
                  <span className="info-val">1</span>
                  <span className="info-lbl">Days</span>
                </div>
                <div className="civic-info-card">
                  <span className="info-val blue" style={{ textTransform: 'capitalize' }}>
                    {selected.issue_type?.split(' ')[0] || 'Civic Issue'}
                  </span>
                  <span className="info-lbl">Issue Type</span>
                </div>
              </div>

              {/* Accountability Section */}
              <div className="civic-section-title">Accountability</div>
              <div className="civic-acc-list">
                {/* Councillor */}
                <div className="civic-acc-card">
                  <div className="acc-avatar">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                   </svg>
                  </div>
                  <div className="acc-body">
                    <div className="acc-top">
                      <div className="acc-name">{representatives[selected.ward_no]?.councillor || 'Representative'}</div>
                      <span className="acc-party-tag" style={{ color: representatives[selected.ward_no]?.party === 'BJP' ? '#f57c00' : '#2196f3' }}>
                        {representatives[selected.ward_no]?.party}
                      </span>
                    </div>
                    <div className="acc-sub">Municipal Councillor · Ward {selected.ward_no}</div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>

                {/* Ward Info */}
                <div className="civic-acc-card">
                  <div className="acc-avatar" style={{ background: '#f0f0f0', fontWeight: 800, color: '#999', fontSize: 13 }}>
                    W{selected.ward_no}
                  </div>
                  <div className="acc-body">
                    <div className="acc-name">Ward #{selected.ward_no}</div>
                    <div className="acc-sub">{selected.ward_name} Zone</div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="civic-actions-footer">
                <button className="btn-premium outline">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                  </svg>
                  I have seen this too
                </button>
                <button className="btn-premium whatsapp">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.63 1.438h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  File Complaint via WhatsApp
                </button>
                <button className="btn-premium verify" onClick={() => setShowVerify(true)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  It is Cleaned Up — Verify
                </button>

                <div className="footer-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  All reports are anonymous
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Report modal ── */}
      {showReport && (
        <ReportModal onClose={() => { setShowReport(false); reload(); }} />
      )}

      {/* ── Verify Clean-up Modal ── */}
      {showVerify && selected && (
        <VerifyModal 
          complaint={selected} 
          onClose={() => setShowVerify(false)} 
          onVerified={() => {
            setShowVerify(false);
            setSelected(null);
            reload();
          }} 
        />
      )}
    </div>
  );
}
