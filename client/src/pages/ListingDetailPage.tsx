import { useParams, useNavigate } from "react-router-dom";
import { useListing } from "../hooks/useListings";
import { useAuth } from "../hooks/useAuth";
import { apiRequest } from "../lib/api";
import { useState } from "react";

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

          {listing.status === "active" && (!user || user.role !== "seller" || user.id !== listing.sellerId) && (
            <button
              onClick={handleBuy}
              disabled={purchasing}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-lg shadow-primary/25"
            >
              {purchasing ? "Processing..." : "Buy Now"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}