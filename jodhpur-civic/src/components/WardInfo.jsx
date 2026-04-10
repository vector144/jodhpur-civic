export function WardInfo({ wardInfo }) {
  if (!wardInfo) return null;

  const reps = [
    {
      role: 'Ward Councillor',
      name: wardInfo.councillor || '—',
      phone: wardInfo.councillor_phone,
      color: 'var(--blue)',
      bg: 'var(--blue-bg)',
    },
    {
      role: `MLA — ${wardInfo.assembly_constituency || 'Jodhpur'}`,
      name: wardInfo.mla || '—',
      phone: wardInfo.mla_phone,
      color: 'var(--green)',
      bg: 'var(--green-bg)',
    },
    {
      role: `MP — ${wardInfo.lok_sabha || 'Jodhpur'} LS`,
      name: wardInfo.mp || '—',
      phone: wardInfo.mp_phone,
      color: 'var(--saffron)',
      bg: 'var(--saffron-light)',
    },
  ];

  return (
    <div className="ward-info fade-in">
      <div className="ward-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        Ward {wardInfo.ward_no} — {wardInfo.ward_name}
      </div>

      <div className="rep-list">
        {reps.map((rep) => (
          <div key={rep.role} className="rep-row" style={{ '--rep-color': rep.color, '--rep-bg': rep.bg }}>
            <div className="rep-dot" />
            <div className="rep-body">
              <div className="rep-role">{rep.role}</div>
              <div className="rep-name">{rep.name}</div>
            </div>
            {rep.phone && (
              <a href={`tel:${rep.phone}`} className="rep-call" title={`Call ${rep.name}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 6.29 6.29l.91-1.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Call
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
