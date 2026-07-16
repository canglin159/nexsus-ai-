import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { apiRequest } from "../lib/api";
import {
  Users,
  MessageSquare,
  TrendingUp,
  Target,
  Search,
  Plus,
  X,
  Check,
  Loader2,
  Send,
  ExternalLink,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Bot,
  Activity,
  PieChart,
  BarChart3,
  Sparkles,
  Clock,
  Mail,
  Globe,
  ArrowUpRight,
  Filter,
} from "lucide-react";

interface Prospect {
  id: string;
  name: string;
  platform: string;
  contactIdentifier: string;
  notes: string | null;
  status: string;
  assignedTo: string | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: OutreachMessage[];
}

interface OutreachMessage {
  id: string;
  prospectId: string;
  content: string;
  platform: string;
  sentAt: string | null;
  responseReceived: boolean;
  responseContent: string | null;
  status: string;
  createdAt: string;
}

interface ProspectStats {
  total: number;
  byStatus: Record<string, number>;
  byPlatform: Record<string, number>;
  contactedToday: number;
  responseRate: number;
  conversions: number;
  contacted: number;
  responded: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  reddit: "bg-orange-100 text-orange-700 border-orange-200",
  facebook: "bg-blue-100 text-blue-700 border-blue-200",
  discord: "bg-purple-100 text-purple-700 border-purple-200",
  craigslist: "bg-yellow-100 text-yellow-700 border-yellow-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-700 border-gray-200",
  contacted: "bg-blue-100 text-blue-700 border-blue-200",
  responded: "bg-yellow-100 text-yellow-700 border-yellow-200",
  interested: "bg-green-100 text-green-700 border-green-200",
  not_interested: "bg-red-100 text-red-700 border-red-200",
  converted: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const PLATFORM_ICONS: Record<string, string> = {
  reddit: "🔴",
  facebook: "🔵",
  discord: "🟣",
  craigslist: "🟡",
  other: "⚪",
};

export function OutreachDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"pipeline" | "stats">("pipeline");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [stats, setStats] = useState<ProspectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Add prospect modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPlatform, setAddPlatform] = useState("reddit");
  const [addContact, setAddContact] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addSource, setAddSource] = useState("");
  const [adding, setAdding] = useState(false);

  // Detail panel
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // AI message generation
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");

  // Log message
  const [logMessageContent, setLogMessageContent] = useState("");
  const [loggingMessage, setLoggingMessage] = useState(false);

  // Log response
  const [responseContent, setResponseContent] = useState("");
  const [loggingResponse, setLoggingResponse] = useState(false);

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Follow-up date
  const [followUpDate, setFollowUpDate] = useState("");

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (platformFilter) params.set("platform", platformFilter);
      if (statusFilter) params.set("status", statusFilter);

      const result = await apiRequest<{ data: Prospect[]; total: number; totalPages: number }>(
        `/prospects?${params.toString()}`
      );
      setProspects(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error("Failed to fetch prospects:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, platformFilter, statusFilter]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const result = await apiRequest<ProspectStats>("/prospects/stats");
      setStats(result);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleAddProspect = async () => {
    if (!addName || !addContact) return;
    setAdding(true);
    try {
      await apiRequest("/prospects", {
        method: "POST",
        body: {
          name: addName,
          platform: addPlatform,
          contactIdentifier: addContact,
          notes: addNotes,
          source: addSource,
        },
      });
      setShowAddModal(false);
      setAddName("");
      setAddPlatform("reddit");
      setAddContact("");
      setAddNotes("");
      setAddSource("");
      fetchProspects();
      fetchStats();
    } catch (err) {
      console.error("Failed to add prospect:", err);
    } finally {
      setAdding(false);
    }
  };

  const openDetailPanel = async (id: string) => {
    setDetailLoading(true);
    setGeneratedMessage("");
    setLogMessageContent("");
    setResponseContent("");
    try {
      const result = await apiRequest<Prospect>(`/prospects/${id}`);
      setSelectedProspect(result);
      setFollowUpDate(result.nextFollowUpAt || "");
    } catch (err) {
      console.error("Failed to fetch prospect detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleGenerateMessage = async () => {
    if (!selectedProspect) return;
    setGeneratingMessage(true);
    try {
      const result = await apiRequest<{ message: string }>(
        `/prospects/${selectedProspect.id}/generate-message`,
        { method: "POST", body: {} }
      );
      setGeneratedMessage(result.message);
      setLogMessageContent(result.message);
    } catch (err) {
      console.error("Failed to generate message:", err);
    } finally {
      setGeneratingMessage(false);
    }
  };

  const handleLogMessage = async () => {
    if (!selectedProspect || !logMessageContent) return;
    setLoggingMessage(true);
    try {
      await apiRequest(`/prospects/${selectedProspect.id}/log-message`, {
        method: "POST",
        body: { content: logMessageContent, platform: selectedProspect.platform },
      });
      setLogMessageContent("");
      setGeneratedMessage("");
      openDetailPanel(selectedProspect.id);
      fetchProspects();
      fetchStats();
    } catch (err) {
      console.error("Failed to log message:", err);
    } finally {
      setLoggingMessage(false);
    }
  };

  const handleLogResponse = async () => {
    if (!selectedProspect || !responseContent) return;
    setLoggingResponse(true);
    try {
      await apiRequest(`/prospects/${selectedProspect.id}/log-response`, {
        method: "POST",
        body: { content: responseContent },
      });
      setResponseContent("");
      openDetailPanel(selectedProspect.id);
      fetchProspects();
      fetchStats();
    } catch (err) {
      console.error("Failed to log response:", err);
    } finally {
      setLoggingResponse(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedProspect) return;
    setUpdatingStatus(true);
    try {
      const body: Record<string, any> = { status: newStatus };
      if (followUpDate) body.nextFollowUpAt = followUpDate;

      await apiRequest(`/prospects/${selectedProspect.id}`, {
        method: "PUT",
        body,
      });
      openDetailPanel(selectedProspect.id);
      fetchProspects();
      fetchStats();
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFollowUpUpdate = async () => {
    if (!selectedProspect) return;
    setUpdatingStatus(true);
    try {
      await apiRequest(`/prospects/${selectedProspect.id}`, {
        method: "PUT",
        body: { nextFollowUpAt: followUpDate || null },
      });
      openDetailPanel(selectedProspect.id);
      fetchProspects();
    } catch (err) {
      console.error("Failed to update follow-up:", err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteProspect = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prospect?")) return;
    try {
      await apiRequest(`/prospects/${id}`, { method: "DELETE" });
      if (selectedProspect?.id === id) setSelectedProspect(null);
      fetchProspects();
      fetchStats();
    } catch (err) {
      console.error("Failed to delete prospect:", err);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isOverdue = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Outreach Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage sales outreach across Reddit, Facebook, Discord, and Craigslist
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Prospect
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "pipeline"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="w-4 h-4" />
          Pipeline
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "stats"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Stats
        </button>
      </div>

      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "pipeline" ? (
            <>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search by name or contact..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <select
                  value={platformFilter}
                  onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Platforms</option>
                  <option value="reddit">Reddit</option>
                  <option value="facebook">Facebook</option>
                  <option value="discord">Discord</option>
                  <option value="craigslist">Craigslist</option>
                  <option value="other">Other</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="responded">Responded</option>
                  <option value="interested">Interested</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="converted">Converted</option>
                </select>
                <button
                  onClick={handleSearch}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-muted transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Table */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : prospects.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No prospects found</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-3 text-sm text-primary hover:underline"
                  >
                    Add your first prospect
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-white border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Name
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Platform
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Status
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Last Contacted
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Next Follow-up
                            </th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {prospects.map((prospect) => (
                            <tr
                              key={prospect.id}
                              onClick={() => openDetailPanel(prospect.id)}
                              className={`hover:bg-muted/50 cursor-pointer transition-colors ${
                                selectedProspect?.id === prospect.id ? "bg-primary/5" : ""
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{prospect.name}</span>
                                  {prospect.source && (
                                    <span className="text-xs text-muted-foreground">({prospect.source})</span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">{prospect.contactIdentifier}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${PLATFORM_COLORS[prospect.platform] || PLATFORM_COLORS.other}`}>
                                  {PLATFORM_ICONS[prospect.platform] || "⚪"} {prospect.platform}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[prospect.status] || STATUS_COLORS.new}`}>
                                  {prospect.status.replace("_", " ")}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {formatDateTime(prospect.lastContactedAt)}
                              </td>
                              <td className="px-4 py-3">
                                {prospect.nextFollowUpAt ? (
                                  <span className={`text-sm ${isOverdue(prospect.nextFollowUpAt) ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                    {formatDate(prospect.nextFollowUpAt)}
                                    {isOverdue(prospect.nextFollowUpAt) && " ⚠️"}
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDetailPanel(prospect.id);
                                  }}
                                  className="text-sm text-primary hover:underline"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {prospects.length} of {total} prospects
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            /* Stats Tab */
            <>
              {/* Summary Cards */}
              {statsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white border border-border rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-primary" />
                        <p className="text-sm text-muted-foreground">Total Prospects</p>
                      </div>
                      <p className="text-2xl font-bold">{stats?.total || 0}</p>
                    </div>
                    <div className="bg-white border border-border rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <Send className="w-4 h-4 text-blue-600" />
                        <p className="text-sm text-muted-foreground">Contacted Today</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{stats?.contactedToday || 0}</p>
                    </div>
                    <div className="bg-white border border-border rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <p className="text-sm text-muted-foreground">Response Rate</p>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{stats?.responseRate || 0}%</p>
                    </div>
                    <div className="bg-white border border-border rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-emerald-600" />
                        <p className="text-sm text-muted-foreground">Conversions</p>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">{stats?.conversions || 0}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pipeline Breakdown */}
                    <div className="bg-white border border-border rounded-xl p-6">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        Pipeline Breakdown
                      </h3>
                      <div className="space-y-3">
                        {[
                          { status: "new", label: "New", color: "bg-gray-400" },
                          { status: "contacted", label: "Contacted", color: "bg-blue-500" },
                          { status: "responded", label: "Responded", color: "bg-yellow-500" },
                          { status: "interested", label: "Interested", color: "bg-green-500" },
                          { status: "converted", label: "Converted", color: "bg-emerald-500" },
                        ].map((item) => {
                          const count = stats?.byStatus[item.status] || 0;
                          const pct = stats?.total ? Math.round((count / stats.total) * 100) : 0;
                          return (
                            <div key={item.status}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm">{item.label}</span>
                                <span className="text-sm font-semibold">{count}</span>
                              </div>
                              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${item.color}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Platform Distribution */}
                    <div className="bg-white border border-border rounded-xl p-6">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-primary" />
                        Platform Distribution
                      </h3>
                      <div className="space-y-3">
                        {[
                          { platform: "reddit", label: "Reddit", color: "bg-orange-500" },
                          { platform: "facebook", label: "Facebook", color: "bg-blue-500" },
                          { platform: "discord", label: "Discord", color: "bg-purple-500" },
                          { platform: "craigslist", label: "Craigslist", color: "bg-yellow-500" },
                          { platform: "other", label: "Other", color: "bg-gray-500" },
                        ].map((item) => {
                          const count = stats?.byPlatform[item.platform] || 0;
                          const pct = stats?.total ? Math.round((count / stats.total) * 100) : 0;
                          return (
                            <div key={item.platform}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm">{item.label}</span>
                                <span className="text-sm font-semibold">{count}</span>
                              </div>
                              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${item.color}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-white border border-border rounded-xl p-6 md:col-span-2">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        Outreach Performance
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-muted/30 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">{stats?.contacted || 0}</p>
                          <p className="text-xs text-muted-foreground mt-1">Total Contacted</p>
                        </div>
                        <div className="text-center p-4 bg-muted/30 rounded-lg">
                          <p className="text-2xl font-bold text-yellow-600">{stats?.responded || 0}</p>
                          <p className="text-xs text-muted-foreground mt-1">Total Responses</p>
                        </div>
                        <div className="text-center p-4 bg-muted/30 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{stats?.responseRate || 0}%</p>
                          <p className="text-xs text-muted-foreground mt-1">Response Rate</p>
                        </div>
                        <div className="text-center p-4 bg-muted/30 rounded-lg">
                          <p className="text-2xl font-bold text-emerald-600">{stats?.conversions || 0}</p>
                          <p className="text-xs text-muted-foreground mt-1">Conversions</p>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          💡 <strong>Tip:</strong> Personalized DMs with specific references to a prospect's posts or listings get 3x higher response rates. Use the AI message generator to craft personalized messages.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Detail Side Panel */}
        {selectedProspect && (
          <div className="w-96 shrink-0">
            <div className="bg-white border border-border rounded-xl overflow-hidden sticky top-8">
              {/* Header */}
              <div className="p-4 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{selectedProspect.name}</h3>
                  <button
                    onClick={() => setSelectedProspect(null)}
                    className="p-1 hover:bg-muted rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${PLATFORM_COLORS[selectedProspect.platform] || PLATFORM_COLORS.other}`}>
                    {PLATFORM_ICONS[selectedProspect.platform] || "⚪"} {selectedProspect.platform}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[selectedProspect.status] || STATUS_COLORS.new}`}>
                    {selectedProspect.status.replace("_", " ")}
                  </span>
                </div>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="p-4 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {/* Contact Info */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Contact</p>
                    <p className="text-sm">{selectedProspect.contactIdentifier}</p>
                    {selectedProspect.source && (
                      <p className="text-xs text-muted-foreground mt-1">Source: {selectedProspect.source}</p>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground">{selectedProspect.notes || "No notes"}</p>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                      <p className="text-sm">{formatDate(selectedProspect.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Last Contacted</p>
                      <p className="text-sm">{formatDateTime(selectedProspect.lastContactedAt)}</p>
                    </div>
                  </div>

                  {/* Status Update */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Update Status</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["new", "contacted", "responded", "interested", "not_interested", "converted"].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusUpdate(s)}
                          disabled={updatingStatus}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                            selectedProspect.status === s
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {s.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Follow-up Date */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      Next Follow-up
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={followUpDate ? followUpDate.split("T")[0] : ""}
                        onChange={(e) => setFollowUpDate(e.target.value ? `${e.target.value}T00:00:00.000Z` : "")}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button
                        onClick={handleFollowUpUpdate}
                        disabled={updatingStatus}
                        className="px-2 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* AI Message Generator */}
                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      AI Message Generator
                    </p>
                    <button
                      onClick={handleGenerateMessage}
                      disabled={generatingMessage}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {generatingMessage ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Bot className="w-4 h-4" />
                          Generate AI Message
                        </>
                      )}
                    </button>
                    {generatedMessage && (
                      <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm text-purple-900">{generatedMessage}</p>
                      </div>
                    )}
                  </div>

                  {/* Log Message */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Send className="w-3 h-3" />
                      Log Sent Message
                    </p>
                    <textarea
                      value={logMessageContent}
                      onChange={(e) => setLogMessageContent(e.target.value)}
                      placeholder="Paste the message you sent..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                    <button
                      onClick={handleLogMessage}
                      disabled={loggingMessage || !logMessageContent}
                      className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {loggingMessage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Mark as Sent
                    </button>
                  </div>

                  {/* Log Response */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      Log Response
                    </p>
                    <textarea
                      value={responseContent}
                      onChange={(e) => setResponseContent(e.target.value)}
                      placeholder="Paste the prospect's response..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                    <button
                      onClick={handleLogResponse}
                      disabled={loggingResponse || !responseContent}
                      className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50"
                    >
                      {loggingResponse ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      Log Response
                    </button>
                  </div>

                  {/* Message History */}
                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Message History
                    </p>
                    {selectedProspect.messages && selectedProspect.messages.length > 0 ? (
                      <div className="space-y-3">
                        {selectedProspect.messages.map((msg) => (
                          <div key={msg.id} className="p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-muted-foreground">
                                {msg.status === "sent" ? "📤 Sent" : "📥 Response"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(msg.sentAt || msg.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm">{msg.content}</p>
                            {msg.responseContent && (
                              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                                <p className="text-xs font-medium text-green-700 mb-1">Response:</p>
                                <p className="text-sm text-green-800">{msg.responseContent}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No messages yet</p>
                    )}
                  </div>

                  {/* Delete */}
                  <div className="border-t border-border pt-4">
                    <button
                      onClick={() => handleDeleteProspect(selectedProspect.id)}
                      className="w-full px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                      Delete Prospect
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Prospect Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold">Add New Prospect</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Prospect's name or username"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Platform *</label>
                <select
                  value={addPlatform}
                  onChange={(e) => setAddPlatform(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="reddit">Reddit</option>
                  <option value="facebook">Facebook</option>
                  <option value="discord">Discord</option>
                  <option value="craigslist">Craigslist</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact Identifier *</label>
                <input
                  type="text"
                  value={addContact}
                  onChange={(e) => setAddContact(e.target.value)}
                  placeholder="Username, email, or profile URL"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Source</label>
                <input
                  type="text"
                  value={addSource}
                  onChange={(e) => setAddSource(e.target.value)}
                  placeholder="Where did you find them? (e.g., r/electronics, FB group)"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="Any context about this prospect..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProspect}
                disabled={adding || !addName || !addContact}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {adding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Prospect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}