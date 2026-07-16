import { Link } from "react-router-dom";
import { useMyListings, useDeleteListing } from "../hooks/useListings";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  sold: "bg-blue-100 text-blue-800",
  archived: "bg-yellow-100 text-yellow-800",
};

export function SellerDashboardPage() {
  const { data: listings, isLoading, error } = useMyListings();
  const deleteListing = useDeleteListing();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive">Failed to load listings</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Listings</h1>
        <Link
          to="/listings/new"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          + New Listing
        </Link>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="text-center py-12 bg-white border border-border rounded-xl">
          <p className="text-muted-foreground mb-4">You haven't created any listings yet</p>
          <Link
            to="/listings/new"
            className="text-primary hover:underline font-medium"
          >
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
                    <Link
                      to={`/listings/${listing.id}`}
                      className="text-sm text-primary hover:underline mr-3"
                    >
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
    </div>
  );
}