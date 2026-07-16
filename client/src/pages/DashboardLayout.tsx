import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const navItems: Record<string, { label: string; path: string }[]> = {
  seller: [
    { label: "My Listings", path: "/dashboard/seller" },
    { label: "Create Listing", path: "/listings/new" },
  ],
  buyer: [
    { label: "My Purchases", path: "/dashboard/buyer" },
    { label: "Browse", path: "/listings" },
  ],
  admin: [
    { label: "Overview", path: "/dashboard/admin" },
  ],
};

export function DashboardLayout() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const items = navItems[user.role] || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="w-56 shrink-0">
          <h2 className="text-lg font-bold mb-4 capitalize">{user.role} Dashboard</h2>
          <nav className="space-y-1">
            {items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}