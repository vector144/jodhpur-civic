import { useState, useEffect } from 'react';
import { ReportModal } from './pages/ReportModal';
import { MapView } from './components/MapView';
import { VerifyModal } from './pages/VerifyModal';
import { RepModal } from './components/RepModal';
import { getAllComplaintsFromDB, upvoteIssue } from './utils/api';
import logo from './assets/logo.png';
import { supabase } from './utils/supabase';
import representatives from './data/representatives.json';
import './App.css';

const SEVERITY_FILTERS = ['All Severity', 'High', 'Medium', 'Low'];
const STATUS_FILTERS = ['All Status', 'open', 'resolved'];

export default function App() {
  const [complaints, setComplaints] = useState([]);
  const [severity, setSeverity] = useState('All Severity');
  const [status, setStatus] = useState('All Status');
  const [showReport, setShowReport] = useState(false);
  const [view, setView] = useState('map'); // 'map' | 'list' | 'leaders'
  const [selected, setSelected] = useState(null);
  const [selectedRep, setSelectedRep] = useState(null);
  const [showSevDrop, setShowSevDrop] = useState(false);
  const [showStatDrop, setShowStatDrop] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [localUpvoted, setLocalUpvoted] = useState(false);

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
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setSelectedRep(null);
        setSelected(null);
        setShowReport(false);
        setShowVerify(false);
        window.history.pushState(null, '', '/');
      }
    };
    document.addEventListener('click', h);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', h);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  // Initialize Deep link
  useEffect(() => {
    const handleDeepLink = () => {
      setSelectedRep(null); // Always wipe rep modal on browser back/forward buttons
      const path = window.location.pathname;
      if (path.startsWith('/report/')) {
        const id = path.split('/report/')[1];
        const match = complaints.find(c => c.tracking_id === id);
        if (match && (!selected || selected.tracking_id !== id)) {
          setSelected(match);
          setLocalUpvoted(false);
        }
      } else {
        setSelected(null);
      }
    };

    // Check on complaints load if there's a deep link and no selection
    if (complaints.length > 0 && window.location.pathname.startsWith('/report/') && !selected) {
      handleDeepLink();
    }

    window.addEventListener('popstate', handleDeepLink);
    return () => window.removeEventListener('popstate', handleDeepLink);
  }, [complaints, selected]);

  const closeDetails = () => {
    setSelected(null);
    setLocalUpvoted(false);
    window.history.pushState(null, '', '/');
  };

  const openDetails = (c) => {
    setSelected(c);
    setLocalUpvoted(false);
    window.history.pushState(null, '', `/report/${c.tracking_id}`);
  };

  const handleShare = async () => {
    if (!selected) return;
    const url = window.location.href; // Leverages our deep link URL
    const text = `Check out this civic issue reported in Ward ${selected.ward_no} (${selected.ward_name}): ${selected.issue_type}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'JDH Civic Issue',
          text: text,
          url: url,
        });
      } catch (err) {
        console.log('Share prompt dismissed');
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text} \n\n${url}`);
        alert('Link copied to clipboard!');
      } catch (err) {
        alert('Failed to copy link.');
      }
    }
  };

  const isResolved = (c) => c.status === 'resolved' || !!(c.verified_photo || (c.verifications && c.verifications.length > 0));

  const filtered = complaints.filter((c) => {
    const effectiveStatus = isResolved(c) ? 'resolved' : c.status;
    const sOk = status === 'All Status' || effectiveStatus === status;
    return sOk;
  });


  const activeCount = filtered.filter((c) => !isResolved(c)).length;
  const resolvedCount = filtered.filter((c) => isResolved(c)).length;

  const leaderStats = Object.keys(representatives).map(wStr => {
    const w = parseInt(wStr);
    const rep = representatives[wStr];
    const wComplaints = complaints.filter(c => c.ward_no === w);
    const wActive = wComplaints.filter(c => !isResolved(c)).length;
    return {
       ward_no: w,
       ...rep,
       total: wComplaints.length,
       active: wActive,
       resolved: wComplaints.filter(c => isResolved(c)).length,
       complaints: wComplaints.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    };
  }).filter(r => r.total > 0).sort((a,b) => b.active - a.active);

  const openRepFromIssue = (ward_no) => {
    const repStat = leaderStats.find(r => r.ward_no === parseInt(ward_no));
    if (repStat) {
      closeDetails(); // Close the issue modal entirely so they don't stack redundantly
      setSelectedRep(repStat); // Open the Leader profile
    }
  };

  return (
    <div className="civic-shell">
      {/* ── Top bar ── */}
      <div className="civic-topbar">
        {/* Brand */}
        <div className="civic-brand">
          <img src={logo} alt="JDH Civic Logo" style={{ width: 22, height: 22, objectFit: 'contain' }} />
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
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
          <button className={`civic-toggle-btn ${view === 'leaders' ? 'active' : ''}`} onClick={() => setView('leaders')}>Leaders</button>
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
          onMarkerClick={(c) => openDetails(c)}
        />
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <div className="civic-list-view">
          {filtered.length === 0 ? (
            <div className="civic-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>No complaints yet. Be the first to report!</p>
            </div>
          ) : filtered.map((c) => (
            <div key={c.tracking_id} className="civic-list-card" onClick={() => openDetails(c)}>
              {c.photo_base64 && <img src={c.photo_base64} className="civic-list-thumb" alt="" />}
              <div className="civic-list-body">
                <div className="civic-list-ward">Ward {c.ward_no} — {c.ward_name}</div>
                {c.issue_type && <div className="civic-list-type">{c.issue_type}</div>}
                {c.description && <div className="civic-list-desc">{c.description}</div>}
              </div>
              <span className={`civic-status-badge status-${isResolved(c) ? 'resolved' : c.status}`}>
                {isResolved(c) ? 'RESOLVED' : c.status?.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Leaders view ── */}
      {view === 'leaders' && (
        <div className="civic-list-view" style={{ background: '#f5f7fa', padding: '16px' }}>
          <div style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '800', color: '#1565C0' }}>Worst Wards Leaderboard</div>
          {leaderStats.length === 0 ? (
            <div className="civic-empty">No data available yet.</div>
          ) : leaderStats.map((rep, idx) => (
            <div key={rep.ward_no} className="civic-list-card" onClick={() => setSelectedRep(rep)} style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: idx < 3 ? '#d32f2f' : '#999', width: '20px', textAlign: 'center' }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111' }}>Ward {rep.ward_no} • {rep.councillor}</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{rep.active} active issues ({rep.total} total)</div>
              </div>
              <div style={{ background: '#F1F8FE', color: '#1565C0', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
                {rep.active} Open
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Bottom report CTA ── */}
      <button className="civic-report-cta" onClick={() => setShowReport(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        Report Issue
      </button>

      {/* ── Detail popup (overlay card) ── */}
      {selected && (
        <div className="civic-detail-overlay" onClick={() => closeDetails()}>
          <div className="civic-detail-card fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ padding: 0 }}>

              {/* Header: Badges & Actions */}
              <div className="civic-detail-header">
                <div className="civic-status-badges">
                  {selected.severity && <span className="civic-badge badge-critical-blue" style={{ background: '#222', color: '#fff' }}>{selected.severity.toUpperCase()}</span>}

                  {selected.verified_photo || selected.status === 'resolved' ? (
                    <span className="civic-badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>RESOLVED</span>
                  ) : (
                    <span className="civic-badge badge-unresolved" style={{ background: '#F1F8FE', color: '#1565C0' }}>{selected.status?.toUpperCase() || 'OPEN'}</span>
                  )}
                </div>
                <div className="civic-detail-header-actions">

                  <button className="header-icon-btn" onClick={handleShare}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  </button>
                  <button className="header-icon-btn" onClick={() => closeDetails()}>✕</button>
                </div>
              </div>

              {/* Title & Location */}
              <div className="civic-summary-info">
                <div className="civic-summary-title">{selected.ward_name}</div>
                <a 
                  href={`https://maps.google.com/?q=${selected.lat},${selected.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="civic-summary-loc"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1976d2', fontWeight: 600, background: '#e3f2fd', padding: '4px 8px', borderRadius: '4px', marginTop: '4px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  Jodhpur, Ward {selected.ward_no} ↗
                </a>
              </div>

              {/* Hero Image */}
              {selected.verified_photo ? (
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 20px', margin: '15px 0' }}>
                  <div style={{ flex: '1 1 50%' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#1976D2', letterSpacing: '0.5px', marginBottom: 6 }}>BEFORE</div>
                    <img src={selected.photo_base64} alt="Before" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '12px' }} />
                  </div>
                  <div style={{ flex: '1 1 50%' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#43a047', letterSpacing: '0.5px', marginBottom: 6 }}>AFTER</div>
                    <img src={selected.verified_photo} alt="After" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '12px', border: '2px solid #43a047' }} />
                  </div>
                </div>
              ) : (
                selected.photo_base64 && (
                  <img src={selected.photo_base64} className="civic-detail-hero" alt="Issue" />
                )
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
                <div className="civic-acc-card" style={{ cursor: 'pointer' }} onClick={() => openRepFromIssue(selected.ward_no)}>
                  <div className="acc-avatar">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
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
                    <path d="M9 18l6-6-6-6" />
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
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>

              {/* Action Buttons */}
              {!(selected.verified_photo || selected.status === 'resolved') ? (
                <div className="civic-actions-footer">
                  <button
                    className="btn-premium outline"
                    onClick={async () => {
                      if (localUpvoted) return;
                      try {
                        await upvoteIssue(selected.tracking_id);
                        setLocalUpvoted(true);
                      } catch (e) {
                        alert(e.message);
                      }
                    }}
                    style={localUpvoted ? { background: '#f57c00', color: '#fff' } : {}}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={localUpvoted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                    {localUpvoted ? 'Endorsed!' : 'I have seen this too'}
                  </button>
                  <button className="btn-premium whatsapp">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.63 1.438h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    File Complaint via WhatsApp
                  </button>
                  <button className="btn-premium verify" onClick={() => setShowVerify(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    It is Cleaned Up — Verify
                  </button>

                  <div className="footer-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    All reports are anonymous
                  </div>
                </div>
              ) : ""}

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
            closeDetails();
            reload();
          }}
        />
      )}

      <RepModal 
        rep={selectedRep} 
        onClose={() => setSelectedRep(null)} 
        onSelectIssue={openDetails} 
        isResolved={isResolved} 
        representatives={representatives} 
      />
    </div>
  );
}
