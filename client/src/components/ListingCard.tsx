import { Link } from "react-router-dom";
import type { ListingData } from "@shared/types";

const conditionColors: Record<string, string> = {
  new: "bg-green-100 text-green-800",
  like_new: "bg-blue-100 text-blue-800",
  good: "bg-yellow-100 text-yellow-800",
  fair: "bg-orange-100 text-orange-800",
  poor: "bg-red-100 text-red-800",
};

const conditionLabels: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export function ListingCard({ listing }: { listing: ListingData }) {
  const imageUrl = listing.images?.[0] || "https://placehold.co/400x300/e2e8f0/64748b?text=No+Image";

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group bg-white rounded-xl border border-border overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-200"
    >
      <div className="aspect-[4/3] bg-muted overflow-hidden">
        <img
          src={imageUrl}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://placehold.co/400x300/e2e8f0/64748b?text=No+Image";
          }}
        />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conditionColors[listing.condition] || "bg-gray-100 text-gray-800"}`}>
            {conditionLabels[listing.condition] || listing.condition}
          </span>
          <span className="text-xs text-muted-foreground">{listing.category}</span>
        </div>
        <h3 className="font-semibold text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            ${listing.price.toLocaleString()}
          </span>
          {listing.location && (
            <span className="text-xs text-muted-foreground">{listing.location}</span>
          )}
        </div>
      </div>
    </Link>
  );
}