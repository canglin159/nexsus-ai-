export function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Total Users", value: "—" },
          { label: "Active Listings", value: "—" },
          { label: "Total Transactions", value: "—" },
          { label: "Commission Revenue", value: "—" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-border rounded-xl p-8 text-center">
        <p className="text-muted-foreground">
          Full admin analytics dashboard coming soon. This is a placeholder.
        </p>
      </div>
    </div>
  );
}