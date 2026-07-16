import { useState } from "react";
import { Link } from "react-router-dom";
import { useMyListings, useDeleteListing } from "../hooks/useListings";
import { apiRequest } from "../lib/api";
import type { MessageData } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send, Bot, ChevronDown, ChevronUp } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  sold: "bg-blue-100 text-blue-800",
  archived: "bg-yellow-100 text-yellow-800",
};

export function SellerDashboardPage() {
  const { data: listings, isLoading, error } = useMyListings();
  const deleteListing = useDeleteListing();
  const [activeTab, setActiveTab] = useState<"listings" | "inquiries">("listings");

  // Inquiries
  const { data: inquiries, isLoading: inquiriesLoading } = useQuery<MessageData[]>({
    queryKey: ["seller-inquiries"],
    queryFn: () => apiRequest("/ai/inquiries"),
    enabled: activeTab === "inquiries",
    refetchInterval: 30000,
  });

  // AI response state
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [sendingResponse, setSendingResponse] = useState(false);

  const handleGenerateResponse = async (inquiry: MessageData) => {
    setRespondingTo(inquiry.id);
    setAiResponse(null);
    try {
      const result = await apiRequest<{ response: string }>("/ai/respond", {
        method: "POST",
        body: {
          inquiry: inquiry.content,
          listingId: inquiry.listingId,
        },
      });
      setAiResponse(result.response);
    } catch (err: any) {
      setAiResponse("Sorry, could not generate a response. Please try again.");
    } finally {
      setRespondingTo(null);
    }
  };

  const handleSendResponse = async (inquiry: MessageData) => {
    if (!aiResponse) return;
    setSendingResponse(true);
    try {
      // Send the response as a message back
      await apiRequest("/ai/respond", {
        method: "POST",
        body: {
          inquiry: inquiry.content,
          listingId: inquiry.listingId,
        },
      });
      setAiResponse(null);
      // In a full implementation we'd also save the sent message
    } catch (err) {
      console.error("Failed to send response:", err);
    } finally {
      setSendingResponse(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Seller Dashboard</h1>
        <Link
          to="/listings/new"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          + New Listing
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("listings")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "listings"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          My Listings
        </button>
        <button
          onClick={() => setActiveTab("inquiries")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "inquiries"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Inquiries
          {inquiries && inquiries.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {inquiries.length}
            </span>
          )}
        </button>
      </div>

      {/* Listings Tab */}
      {activeTab === "listings" && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-destructive">Failed to load listings</div>
          ) : !listings || listings.length === 0 ? (
            <div className="text-center py-12 bg-white border border-border rounded-xl">
              <p className="text-muted-foreground mb-4">You haven't created any listings yet</p>
              <Link to="/listings/new" className="text-primary hover:underline font-medium">
                Create your first listing
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Price</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Created</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {listings.map((listing) => (
                    <tr key={listing.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/listings/${listing.id}`} className="font-medium hover:text-primary transition-colors">
                          {listing.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">${listing.price.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[listing.status] || ""}`}>
                          {listing.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(listing.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/listings/${listing.id}`} className="text-sm text-primary hover:underline mr-3">
                          View
                        </Link>
                        {(listing.status === "draft" || listing.status === "active") && (
                          <button
                            onClick={() => {
                              if (confirm("Delete this listing?")) {
                                deleteListing.mutate(listing.id);
                              }
                            }}
                            className="text-sm text-destructive hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Inquiries Tab */}
      {activeTab === "inquiries" && (
        <>
          {inquiriesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !inquiries || inquiries.length === 0 ? (
            <div className="text-center py-12 bg-white border border-border rounded-xl">
              <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-1">No inquiries yet</p>
              <p className="text-sm text-muted-foreground">
                When buyers reach out, their messages will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {inquiries.map((inquiry) => (
                <div key={inquiry.id} className="bg-white border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          From: {inquiry.sender?.displayName || inquiry.sender?.email || "Unknown"}
                        </span>
                        {inquiry.aiGenerated && (
                          <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            <Bot className="w-3 h-3" />
                            AI Generated
                          </span>
                        )}
                      </div>
                      {inquiry.listing && (
                        <Link
                          to={`/listings/${inquiry.listing.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Re: {inquiry.listing.title} — ${inquiry.listing.price.toLocaleString()}
                        </Link>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(inquiry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Inquiry content */}
                  <div className="p-3 rounded-lg bg-muted/50 mb-3">
                    <p className="text-sm">{inquiry.content}</p>
                  </div>

                  {/* AI Response */}
                  {aiResponse && respondingTo !== inquiry.id ? (
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-medium text-purple-600">AI Suggested Response</span>
                      </div>
                      <p className="text-sm text-purple-900 mb-3">{aiResponse}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendResponse(inquiry)}
                          disabled={sendingResponse}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {sendingResponse ? "Sending..." : "Send Response"}
                        </button>
                        <button
                          onClick={() => setAiResponse(null)}
                          className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateResponse(inquiry)}
                      disabled={respondingTo === inquiry.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      {respondingTo === inquiry.id ? "Generating..." : "Generate AI Response"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
