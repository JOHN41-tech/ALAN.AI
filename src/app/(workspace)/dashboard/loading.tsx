export default function DashboardLoading() {
  return (
    <div aria-label="Loading dashboard" aria-busy="true">
      <div className="skeleton skeleton-title" />
      <div className="stat-grid" style={{ marginTop: 24 }}>{Array.from({ length: 4 }, (_, index) => <div className="surface stat-card" key={index}><div className="skeleton skeleton-line" /><div className="skeleton skeleton-value" /></div>)}</div>
      <div className="content-grid"><div className="surface panel"><div className="skeleton skeleton-line" /><div className="skeleton skeleton-block" /></div><div className="surface panel"><div className="skeleton skeleton-line" /><div className="skeleton skeleton-block" /></div></div>
    </div>
  );
}
