import { useParams, useNavigate, Link } from "react-router-dom";
import { useListing } from "../hooks/useListings";
import { useAuth } from "../hooks/useAuth";
import { apiRequest } from "../lib/api";
import { ListingCard } from "../components/ListingCard";
import { useState, useEffect } from "react";
import type { ListingData, NegotiationResult } from "@shared/types";
import { MessageCircle, Zap, X, Send } from "lucide-react";

const conditionLabels: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: listing, isLoading, error } = useListing(id!);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  // Similar listings
  const [similarListings, setSimilarListings] = useState<ListingData[]>([]);

  // Ask a Question modal
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askResult, setAskResult] = useState<string | null>(null);

  // Make an Offer modal
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [negotiating, setNegotiating] = useState(false);
  const [negotiationResult, setNegotiationResult] = useState<NegotiationResult | null>(null);

  useEffect(() => {
    if (id) {
      apiRequest<ListingData[]>(`/ai/similar/${id}?limit=4`)
        .then(setSimilarListings)
        .catch(() => {});
    }
  }, [id]);

  const handleBuy = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setPurchasing(true);
    setPurchaseError("");
    try {
      const { transactionId } = await apiRequest<{ transactionId: string }>("/payments/create-intent", {
        method: "POST",
        body: { listingId: id },
      });
      await apiRequest("/payments/confirm", {
        method: "POST",
        body: { transactionId },
      });
      navigate(user.role === "buyer" ? "/dashboard/buyer" : "/listings");
    } catch (err: any) {
      setPurchaseError(err.message || "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAskResult(null);
    try {
      const result = await apiRequest<{ message: string }>("/ai/ask-question", {
        method: "POST",
        body: { listingId: id, question: question.trim() },
      });
      setAskResult(result.message);
    } catch (err: any) {
      setAskResult("Failed to send question. Please try again.");
    } finally {
      setAsking(false);
    }
  };

  const handleMakeOffer = async () => {
    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount <= 0) return;
    setNegotiating(true);
    setNegotiationResult(null);
    try {
      const result = await apiRequest<NegotiationResult>("/ai/negotiate", {
        method: "POST",
        body: { listingId: id, offerAmount: amount },
      });
      setNegotiationResult(result);
    } catch (err: any) {
      setNegotiationResult({
        suggestedPrice: 0,
        message: err.message || "Negotiation failed",
        originalPrice: listing?.price || 0,
        buyerOffer: amount,
        isAccepted: false,
      });
    } finally {
      setNegotiating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-lg text-destructive">Listing not found</p>
      </div>
    );
  }

  const imageUrl = listing.images?.[0] || "https://placehold.co/800x600/e2e8f0/64748b?text=No+Image";

  const isOwner = user && user.id === listing.sellerId;
  const canBuy = listing.status === "active" && !isOwner;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid md:grid-cols-2 gap-10">
        {/* Image */}
        <div className="rounded-xl overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://placehold.co/800x600/e2e8f0/64748b?text=No+Image";
            }}
          />
        </div>

        {/* Details */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {conditionLabels[listing.condition] || listing.condition}
            </span>
            <span className="text-sm text-muted-foreground">{listing.category}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              listing.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
            }`}>
              {listing.status}
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-4">{listing.title}</h1>
          <p className="text-4xl font-bold text-primary mb-6">${listing.price.toLocaleString()}</p>

          <p className="text-muted-foreground leading-relaxed mb-6">{listing.description}</p>

          {listing.location && (
            <p className="text-sm text-muted-foreground mb-2">
              📍 {listing.location}
            </p>
          )}

          {listing.tags && listing.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {listing.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Seller info */}
          {listing.seller && (
            <div className="border-t border-border pt-4 mb-6">
              <p className="text-sm text-muted-foreground mb-1">Sold by</p>
              <p className="font-medium">{listing.seller.displayName || listing.seller.email}</p>
            </div>
          )}

          {purchaseError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">{purchaseError}</div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            {canBuy && (
              <button
                onClick={handleBuy}
                disabled={purchasing}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-lg shadow-primary/25"
              >
                {purchasing ? "Processing..." : "Buy Now"}
              </button>
            )}

            {user && !isOwner && listing.status === "active" && (
              <div className="flex gap-3">
                <button
                  onClick={() => { setAskModalOpen(true); setAskResult(null); setQuestion(""); }}
                  className="flex-1 py-2.5 rounded-xl border-2 border-border bg-white text-foreground font-medium hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Ask a Question
                </button>
                <button
                  onClick={() => { setOfferModalOpen(true); setNegotiationResult(null); setOfferAmount(""); }}
                  className="flex-1 py-2.5 rounded-xl border-2 border-border bg-white text-foreground font-medium hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Make an Offer
                </button>
              </div>
            )}

            {!user && listing.status === "active" && (
              <Link
                to="/login"
                className="w-full py-2.5 rounded-xl border-2 border-border bg-white text-foreground font-medium text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                Sign in to ask questions or make offers
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Similar Listings */}
      {similarListings.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Similar Listings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {similarListings.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        </section>
      )}

      {/* Ask a Question Modal */}
      {askModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAskModalOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Ask a Question</h3>
              <button onClick={() => setAskModalOpen(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!askResult ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Ask the seller about "{listing.title}". Our AI will help craft a polite inquiry.
                </p>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
                  placeholder="e.g. Is this item still under warranty?"
                />
                <button
                  onClick={handleAskQuestion}
                  disabled={asking || !question.trim()}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {asking ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {asking ? "Sending..." : "Send Inquiry"}
                </button>
              </>
            ) : (
              <>
                <div className="p-4 rounded-xl bg-green-50 border border-green-200 mb-4">
                  <p className="text-sm text-green-800 font-medium mb-1">✅ Message Sent!</p>
                  <p className="text-sm text-green-700">{askResult}</p>
                </div>
                <button
                  onClick={() => setAskModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Make an Offer Modal */}
      {offerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOfferModalOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Make an Offer</h3>
              <button onClick={() => setOfferModalOpen(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!negotiationResult ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  The asking price is <strong>${listing.price.toLocaleString()}</strong>. Make your best offer — our AI will negotiate on behalf of the seller.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Your Offer (USD)</label>
                  <input
                    type="number"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    min={1}
                    step="0.01"
                    className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder={(listing.price * 0.85).toFixed(2)}
                  />
                </div>
                <button
                  onClick={handleMakeOffer}
                  disabled={negotiating || !offerAmount || parseFloat(offerAmount) <= 0}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {negotiating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {negotiating ? "Negotiating..." : "Submit Offer"}
                </button>
              </>
            ) : (
              <>
                <div className={`p-4 rounded-xl border mb-4 ${
                  negotiationResult.isAccepted
                    ? "bg-green-50 border-green-200"
                    : negotiationResult.suggestedPrice > 0
                    ? "bg-blue-50 border-blue-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  <p className={`text-sm font-medium mb-1 ${
                    negotiationResult.isAccepted
                      ? "text-green-800"
                      : negotiationResult.suggestedPrice > 0
                      ? "text-blue-800"
                      : "text-red-800"
                  }`}>
                    {negotiationResult.isAccepted
                      ? "🎉 Offer Accepted!"
                      : negotiationResult.suggestedPrice > 0
                      ? "💬 Counter-Offer"
                      : "❌ Offer Declined"}
                  </p>
                  <p className="text-sm mb-2">{negotiationResult.message}</p>
                  {negotiationResult.suggestedPrice > 0 && !negotiationResult.isAccepted && (
                    <p className="text-sm font-semibold">
                      Suggested price: ${negotiationResult.suggestedPrice.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  {!negotiationResult.isAccepted && negotiationResult.suggestedPrice > 0 && (
                    <button
                      onClick={() => {
                        setOfferAmount(negotiationResult.suggestedPrice.toString());
                        setNegotiationResult(null);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
                    >
                      Accept ${negotiationResult.suggestedPrice.toLocaleString()}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setNegotiationResult(null);
                      setOfferAmount("");
                    }}
                    className="flex-1 py-2.5 rounded-xl border-2 border-border bg-white font-medium hover:border-primary/50 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
