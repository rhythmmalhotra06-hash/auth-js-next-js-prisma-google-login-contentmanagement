// Route-level loading skeleton — shown while server components fetch (Airtable).
export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-muted)' }}>
      <div className="content" style={{ paddingTop: 28 }}>
        <div className="skel" style={{ height: 22, width: 200, marginBottom: 18 }} />
        <div className="kpis">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skel" style={{ height: 86 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, marginTop: 18 }}>
          <div className="skel" style={{ height: 160 }} />
          <div className="skel" style={{ height: 160 }} />
        </div>
        <div className="skel" style={{ height: 280, marginTop: 18 }} />
      </div>
    </div>
  );
}
