import { useState, useEffect } from "react";
import { apiRequest } from "../lib/api";
import {
  BarChart3,
  Users,
  ShoppingBag,
  DollarSign,
  AlertTriangle,
  Settings,
  Archive,
  CheckCircle,
  XCircle,
  Shield,
  TrendingUp,
  Star,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────
interface AdminStats {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  totalTransactions: number;
  completedTransactions: number;
  totalCommissions: number;
  pendingDisputes: number;
  activeFraudFlags: number;
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
  kycStatus: string;
  mfaEnabled: boolean;
  displayName?: string | null;
  createdAt: string;
}

interface AdminListing {
  id: string;
  title: string;
  price: number;
  status: string;
  category: string;
  sellerId: string;
  sellerEmail: string;
  createdAt: string;
}

interface AdminTransaction {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  commission: number;
  commissionRate: number;
  status: string;
  buyerEmail: string;
  sellerEmail: string;
  listingTitle: string;
  createdAt: string;
}

interface FraudFlag {
  id: string;
  targetType: string;
  targetId: string;
  riskScore: number;
  reason: string | null;
  resolved: boolean;
  createdAt: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Tab Definitions ──────────────────────────────────────
type TabKey = "overview" | "users" | "listings" | "transactions" | "fraud" | "commission" | "analytics";

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
  { key: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
  { key: "listings", label: "Listings", icon: <ShoppingBag className="w-4 h-4" /> },
  { key: "transactions", label: "Transactions", icon: <DollarSign className="w-4 h-4" /> },
  { key: "fraud", label: "Fraud Flags", icon: <Shield className="w-4 h-4" /> },
  { key: "commission", label: "Commission", icon: <Settings className="w-4 h-4" /> },
  { key: "analytics", label: "Analytics", icon: <TrendingUp className="w-4 h-4" /> },
];

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  sold: "bg-blue-100 text-blue-800",
  archived: "bg-yellow-100 text-yellow-800",
  pending: "bg-yellow-100 text-yellow-800",
  escrow_held: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  disputed: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [fraudTotal, setFraudTotal] = useState(0);
  const [commissionRules, setCommissionRules] = useState<Record<string, number>>({});
  const [commissionForm, setCommissionForm] = useState<Record<string, string>>({});

  // Analytics states
  const [analyticsOverview, setAnalyticsOverview] = useState<any>(null);
  const [revenueByCategory, setRevenueByCategory] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [topSellers, setTopSellers] = useState<any[]>([]);
  const [topBuyers, setTopBuyers] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 20;

  // ── Loaders ──────────────────────────────────────────
  const loadStats = async () => {
    try {
      const data = await apiRequest<AdminStats>("/admin/stats");
      setStats(data);
    } catch (err: any) {
      console.error("Stats error:", err);
    }
  };

  const loadUsers = async (p = 1) => {
    setLoading(true);
    try {
      const data = await apiRequest<PaginatedResponse<AdminUser>>(`/admin/users?page=${p}&limit=${limit}`);
      setUsers(data.data);
      setUsersTotal(data.total);
      setPage(data.page);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadListings = async (p = 1) => {
    setLoading(true);
    try {
      const data = await apiRequest<PaginatedResponse<AdminListing>>(`/admin/listings?page=${p}&limit=${limit}`);
      setListings(data.data);
      setListingsTotal(data.total);
      setPage(data.page);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (p = 1) => {
    setLoading(true);
    try {
      const data = await apiRequest<PaginatedResponse<AdminTransaction>>(`/admin/transactions?page=${p}&limit=${limit}`);
      setTransactions(data.data);
      setTransactionsTotal(data.total);
      setPage(data.page);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFraudFlags = async (p = 1) => {
    setLoading(true);
    try {
      const data = await apiRequest<PaginatedResponse<FraudFlag>>(`/fraud/flags?page=${p}&limit=${limit}`);
      setFraudFlags(data.data);
      setFraudTotal(data.total);
      setPage(data.page);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCommissionRules = async () => {
    try {
      const data = await apiRequest<Record<string, number>>("/admin/commission-rules");
      setCommissionRules(data);
      const form: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) {
        form[k] = String(v);
      }
      setCommissionForm(form);
    } catch (err: any) {
      console.error("Commission rules error:", err);
    }
  };

  // ── Analytics Loaders ─────────────────────────────────
  const loadAnalyticsOverview = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await apiRequest<any>("/analytics/overview");
      setAnalyticsOverview(data);
    } catch (err) {
      console.error("Analytics overview error:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadRevenueByCategory = async () => {
    try {
      const data = await apiRequest<any[]>("/analytics/revenue-by-category");
      setRevenueByCategory(data);
    } catch (err) {
      console.error("Revenue by category error:", err);
    }
  };

  const loadTrends = async () => {
    try {
      const data = await apiRequest<any[]>("/analytics/trends");
      setTrends(data);
    } catch (err) {
      console.error("Trends error:", err);
    }
  };

  const loadTopSellers = async () => {
    try {
      const data = await apiRequest<any[]>("/analytics/top-sellers");
      setTopSellers(data);
    } catch (err) {
      console.error("Top sellers error:", err);
    }
  };

  const loadTopBuyers = async () => {
    try {
      const data = await apiRequest<any[]>("/analytics/top-buyers");
      setTopBuyers(data);
    } catch (err) {
      console.error("Top buyers error:", err);
    }
  };

  // ── Actions ──────────────────────────────────────────
  const handleArchiveListing = async (id: string) => {
    try {
      await apiRequest(`/admin/listings/${id}/archive`, { method: "POST" });
      loadListings(page);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResolveDispute = async (id: string, action: "refund" | "release") => {
    if (!confirm(`Are you sure you want to ${action} this transaction?`)) return;
    try {
      await apiRequest(`/admin/transactions/${id}/resolve-dispute`, {
        method: "POST",
        body: { action },
      });
      loadTransactions(page);
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResolveFlag = async (id: string) => {
    try {
      await apiRequest(`/fraud/flags/${id}/resolve`, { method: "POST" });
      loadFraudFlags(page);
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCheckListing = async (id: string) => {
    try {
      const result = await apiRequest<{ riskScore: number }>(`/fraud/check-listing/${id}`, { method: "POST" });
      alert(`Risk score: ${result.riskScore}`);
      loadFraudFlags();
      loadStats();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateCommission = async () => {
    const rules: Record<string, number> = {};
    for (const [k, v] of Object.entries(commissionForm)) {
      const num = parseFloat(v);
      if (!isNaN(num) && num > 0 && num <= 100) {
        rules[k] = num;
      }
    }
    try {
      const data = await apiRequest<Record<string, number>>("/admin/commission-rules", {
        method: "POST",
        body: { rules },
      });
      setCommissionRules(data);
      const form: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) {
        form[k] = String(v);
      }
      setCommissionForm(form);
      alert("Commission rules updated!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ── Load on mount & tab change ───────────────────────
  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    setError("");
    setPage(1);
    switch (activeTab) {
      case "overview":
        loadStats();
        break;
      case "users":
        loadUsers(1);
        break;
      case "listings":
        loadListings(1);
        break;
      case "transactions":
        loadTransactions(1);
        break;
      case "fraud":
        loadFraudFlags(1);
        break;
      case "commission":
        loadCommissionRules();
        break;
      case "analytics":
        loadAnalyticsOverview();
        loadRevenueByCategory();
        loadTrends();
        loadTopSellers();
        loadTopBuyers();
        break;
    }
  }, [activeTab]);

  // ── Render ────────────────────────────────────────────
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-muted rounded-xl p-1 w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">{error}</div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* ── Overview Tab ──────────────────────────────── */}
      {activeTab === "overview" && stats && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: "Total Users", value: stats.totalUsers, icon: <Users className="w-5 h-5 text-blue-600" /> },
              { label: "Active Listings", value: stats.activeListings, icon: <ShoppingBag className="w-5 h-5 text-green-600" /> },
              { label: "Completed Transactions", value: stats.completedTransactions, icon: <DollarSign className="w-5 h-5 text-purple-600" /> },
              { label: "Commission Revenue", value: `$${stats.totalCommissions.toLocaleString()}`, icon: <BarChart3 className="w-5 h-5 text-emerald-600" /> },
            ].map((stat) => (
              <div key={stat.label} className="bg-white border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  {stat.icon}
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
                <p className="text-3xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Total Listings", value: stats.totalListings },
              { label: "Total Transactions", value: stats.totalTransactions },
              { label: "Pending Disputes", value: stats.pendingDisputes, alert: stats.pendingDisputes > 0 },
              { label: "Active Fraud Flags", value: stats.activeFraudFlags, alert: stats.activeFraudFlags > 0 },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`border rounded-xl p-6 ${
                  stat.alert ? "bg-red-50 border-red-200" : "bg-white border-border"
                }`}
              >
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <div className="flex items-center gap-2">
                  <p className={`text-3xl font-bold ${stat.alert ? "text-red-700" : ""}`}>{stat.value}</p>
                  {stat.alert && <AlertTriangle className="w-5 h-5 text-red-500" />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Users Tab ──────────────────────────────────── */}
      {activeTab === "users" && !loading && (
        <div>
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">KYC</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">MFA</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{u.email}</p>
                      {u.displayName && <p className="text-xs text-muted-foreground">{u.displayName}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        u.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        u.kycStatus === "verified" ? "bg-green-100 text-green-800" :
                        u.kycStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>{u.kycStatus}</span>
                    </td>
                    <td className="px-4 py-3">
                      {u.mfaEnabled ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={usersTotal} limit={limit} onPage={loadUsers} />
        </div>
      )}

      {/* ── Listings Tab ──────────────────────────────── */}
      {activeTab === "listings" && !loading && (
        <div>
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Seller</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Price</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listings.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{l.title}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{l.sellerEmail}</td>
                    <td className="px-4 py-3 text-sm">${l.price.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[l.status] || ""}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {l.status === "active" && (
                        <button
                          onClick={() => handleArchiveListing(l.id)}
                          className="text-sm text-destructive hover:underline inline-flex items-center gap-1"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Archive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={listingsTotal} limit={limit} onPage={loadListings} />
        </div>
      )}

      {/* ── Transactions Tab ───────────────────────────── */}
      {activeTab === "transactions" && !loading && (
        <div>
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Listing</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Buyer</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Seller</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Commission</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium max-w-[160px] truncate">{t.listingTitle}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{t.buyerEmail}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{t.sellerEmail}</td>
                    <td className="px-4 py-3 text-sm">${t.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">${t.commission.toFixed(2)} ({t.commissionRate}%)</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[t.status] || ""}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.status === "disputed" && (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleResolveDispute(t.id, "release")}
                            className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                          >
                            Release
                          </button>
                          <button
                            onClick={() => handleResolveDispute(t.id, "refund")}
                            className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                          >
                            Refund
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={transactionsTotal} limit={limit} onPage={loadTransactions} />
        </div>
      )}

      {/* ── Fraud Flags Tab ────────────────────────────── */}
      {activeTab === "fraud" && !loading && (
        <div>
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Target ID</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Risk Score</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Reason</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Resolved</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fraudFlags.map((f) => {
                  const scoreColor =
                    f.riskScore >= 0.7 ? "text-red-700 bg-red-50" :
                    f.riskScore >= 0.4 ? "text-yellow-700 bg-yellow-50" :
                    "text-blue-700 bg-blue-50";
                  return (
                    <tr key={f.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          f.targetType === "listing" ? "bg-purple-100 text-purple-800" :
                          f.targetType === "user" ? "bg-orange-100 text-orange-800" :
                          "bg-pink-100 text-pink-800"
                        }`}>{f.targetType}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-xs">{f.targetId.slice(0, 8)}...</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${scoreColor}`}>
                          {f.riskScore.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                        {f.reason || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(f.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {f.resolved ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!f.resolved && (
                          <button
                            onClick={() => handleResolveFlag(f.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={fraudTotal} limit={limit} onPage={loadFraudFlags} />
        </div>
      )}

      {/* ── Commission Tab ─────────────────────────────── */}
      {activeTab === "commission" && (
        <div>
          <div className="bg-white border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Commission Rate Configuration</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure commission rates per category. Rates are percentages charged on each completed transaction.
            </p>

            <div className="space-y-4 mb-6">
              {Object.entries(commissionForm).map(([category, rate]) => (
                <div key={category} className="flex items-center gap-4">
                  <label className="w-40 text-sm font-medium capitalize">
                    {category.replace(/_/g, " ")}:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={rate}
                      onChange={(e) =>
                        setCommissionForm((prev) => ({ ...prev, [category]: e.target.value }))
                      }
                      min={0}
                      max={100}
                      step={0.5}
                      className="w-24 px-3 py-1.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  {commissionRules[category] !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      (current: {commissionRules[category]}%)
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleUpdateCommission}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Save Commission Rules
            </button>
          </div>
        </div>
      )}

      {/* ── Analytics Tab ──────────────────────────────── */}
      {activeTab === "analytics" && (
        <div>
          {analyticsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !analyticsOverview ? (
            <div className="text-center py-12 bg-white border border-border rounded-xl">
              <p className="text-muted-foreground">No analytics data available yet</p>
            </div>
          ) : (
            <>
              {/* Metric Cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                {[
                  { label: "Total GMV", value: `${(analyticsOverview.totalGMV || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <DollarSign className="w-5 h-5 text-green-600" />, color: "text-green-600" },
                  { label: "Total Commissions", value: `${(analyticsOverview.totalCommissionsEarned || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <BarChart3 className="w-5 h-5 text-emerald-600" />, color: "text-emerald-600" },
                  { label: "Active Listings", value: analyticsOverview.activeListings || 0, icon: <ShoppingBag className="w-5 h-5 text-blue-600" />, color: "text-blue-600" },
                  { label: "Avg Deal Size", value: `${(analyticsOverview.averageDealSize || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <TrendingUp className="w-5 h-5 text-purple-600" />, color: "text-purple-600" },
                  { label: "Conversion Rate", value: `${(analyticsOverview.conversionRate || 0).toFixed(1)}%`, icon: <Star className="w-5 h-5 text-yellow-600" />, color: "text-yellow-600" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {stat.icon}
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-6 mb-8">
                {/* Revenue by Category */}
                <div className="bg-white border border-border rounded-xl p-6">
                  <h3 className="text-sm font-semibold mb-4">Revenue by Category</h3>
                  {revenueByCategory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No completed transactions yet</p>
                  ) : (
                    <div className="space-y-3">
                      {revenueByCategory.map((cat) => {
                        const maxGmv = Math.max(...revenueByCategory.map((c: any) => c.gmv));
                        const barWidth = maxGmv > 0 ? (cat.gmv / maxGmv) * 100 : 0;
                        return (
                          <div key={cat.category}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium capitalize">{cat.category}</span>
                              <span className="text-muted-foreground">${cat.gmv.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2.5">
                              <div
                                className="bg-primary rounded-full h-2.5 transition-all duration-500"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                              <span>{cat.count} transactions</span>
                              <span>${cat.commissions.toFixed(2)} commissions</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 30-Day Trends */}
                <div className="bg-white border border-border rounded-xl p-6">
                  <h3 className="text-sm font-semibold mb-4">30-Day GMV Trend</h3>
                  {trends.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transaction data for recent days</p>
                  ) : (
                    <div className="space-y-1">
                      {/* Bar chart */}
                      <div className="flex items-end gap-0.5 h-40">
                        {trends.map((day, idx) => {
                          const maxGmv = Math.max(...trends.map((d: any) => d.gmv));
                          const height = maxGmv > 0 ? (day.gmv / maxGmv) * 100 : 0;
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center group relative">
                              <div
                                className="w-full bg-primary/60 hover:bg-primary rounded-sm transition-colors min-h-[2px]"
                                style={{ height: `${Math.max(height, 0.5)}%` }}
                                title={`${day.date}: ${day.gmv.toFixed(2)}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      {/* Date labels (show 5 labels) */}
                      <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                        {trends.filter((_, i) => i % Math.max(1, Math.floor(trends.length / 5)) === 0).concat(trends.length > 0 ? [trends[trends.length - 1]] : []).filter((d, i, arr) => i === 0 || d.date !== arr[i-1].date).map((day) => (
                          <span key={day.date}>{new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Sellers & Buyers */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Top Sellers */}
                <div className="bg-white border border-border rounded-xl p-6">
                  <h3 className="text-sm font-semibold mb-4">Top Sellers</h3>
                  {topSellers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No seller data yet</p>
                  ) : (
                    <div className="overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="pb-2 font-medium">Seller</th>
                            <th className="pb-2 font-medium">GMV</th>
                            <th className="pb-2 font-medium">Commission</th>
                            <th className="pb-2 font-medium text-right">Sales</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {topSellers.slice(0, 5).map((seller: any) => (
                            <tr key={seller.sellerId} className="text-sm">
                              <td className="py-2.5 pr-2">
                                <span className="font-medium truncate block max-w-[140px]">
                                  {seller.sellerDisplayName || seller.sellerEmail.split("@")[0]}
                                </span>
                              </td>
                              <td className="py-2.5 pr-2">${seller.gmv.toLocaleString()}</td>
                              <td className="py-2.5 pr-2">${seller.commissionPaid.toFixed(2)}</td>
                              <td className="py-2.5 text-right">{seller.transactionCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Top Buyers */}
                <div className="bg-white border border-border rounded-xl p-6">
                  <h3 className="text-sm font-semibold mb-4">Top Buyers</h3>
                  {topBuyers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No buyer data yet</p>
                  ) : (
                    <div className="overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="pb-2 font-medium">Buyer</th>
                            <th className="pb-2 font-medium">Total Spend</th>
                            <th className="pb-2 font-medium text-right">Purchases</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {topBuyers.slice(0, 5).map((buyer: any) => (
                            <tr key={buyer.buyerId} className="text-sm">
                              <td className="py-2.5 pr-2">
                                <span className="font-medium truncate block max-w-[160px]">
                                  {buyer.buyerDisplayName || buyer.buyerEmail.split("@")[0]}
                                </span>
                              </td>
                              <td className="py-2.5 pr-2">${buyer.spend.toLocaleString()}</td>
                              <td className="py-2.5 text-right">{buyer.transactionCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pagination Helper ────────────────────────────────────
function Pagination({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <p className="text-muted-foreground">
        Page {page} of {totalPages} ({total} items)
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-50 transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-50 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
