import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "../lib/api";
import type { TransactionData } from "@shared/types";
import { Star, X, MessageSquare } from "lucide-react";

const statusSteps = ["pending", "escrow_held", "shipped", "delivered", "completed"];

const statusLabels: Record<string, string> = {
  pending: "Pending",
  escrow_held: "Escrow Held",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  disputed: "Disputed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  escrow_held: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  disputed: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export function BuyerDashboardPage() {
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);

  // Review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTxId, setReviewTxId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Track which transactions already have reviews
  const [reviewedTxIds, setReviewedTxIds] = useState<Set<string>>(new Set());

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await apiRequest<TransactionData[]>("/payments/transactions");
      setTransactions(data);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyReviews = useCallback(async () => {
    try {
      const data = await apiRequest<{ transactionId: string }[]>("/reviews/my");
      const ids = new Set(data.map((r: any) => r.transactionId));
      setReviewedTxIds(ids);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchMyReviews();
  }, [fetchTransactions, fetchMyReviews]);

  const openReviewModal = (txId: string) => {
    setReviewTxId(txId);
    setReviewRating(5);
    setReviewContent("");
    setReviewError("");
    setReviewModalOpen(true);
  };

  const submitReview = async () => {
    if (!reviewTxId) return;
    setSubmittingReview(true);
    setReviewError("");
    try {
      await apiRequest("/reviews", {
        method: "POST",
        body: {
          transactionId: reviewTxId,
          rating: reviewRating,
          content: reviewContent || undefined,
        },
      });
      setReviewModalOpen(false);
      setReviewedTxIds((prev) => new Set(prev).add(reviewTxId));
      fetchMyReviews();
    } catch (err: any) {
      setReviewError(err.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Purchases</h1>

      {transactions.length === 0 ? (
        <div className="text-center py-12 bg-white border border-border rounded-xl">
          <p className="text-muted-foreground mb-4">You haven't made any purchases yet</p>
          <a href="/listings" className="text-primary hover:underline font-medium">
            Browse Listings
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((tx) => {
            const isCompleted = tx.status === "completed";
            const hasReviewed = reviewedTxIds.has(tx.id);

            return (
              <div key={tx.id} className="bg-white border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold">{tx.listing?.title || "Listing"}</p>
                    <p className="text-sm text-muted-foreground">
                      ${tx.amount.toLocaleString()} · Commission: ${tx.commission.toFixed(2)}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[tx.status] || ""}`}>
                    {statusLabels[tx.status] || tx.status}
                  </span>
                </div>

                {/* Progress steps */}
                <div className="flex items-center gap-1">
                  {statusSteps.map((step, idx) => {
                    const currentIdx = statusSteps.indexOf(tx.status);
                    const stepIdx = statusSteps.indexOf(step);
                    const isActive = stepIdx <= currentIdx;

                    return (
                      <div key={step} className="flex items-center flex-1">
                        <div className={`w-full h-1.5 rounded-full ${isActive ? "bg-primary" : "bg-muted"}`} />
                        {idx < statusSteps.length - 1 && <div className="w-1" />}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  {statusSteps.map((step) => (
                    <span
                      key={step}
                      className={`text-xs ${
                        statusSteps.indexOf(step) <= statusSteps.indexOf(tx.status)
                          ? "text-primary font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {statusLabels[step]}
                    </span>
                  ))}
                </div>

                {/* Leave Review button for completed transactions */}
                {isCompleted && !hasReviewed && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <button
                      onClick={() => openReviewModal(tx.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Leave a Review
                    </button>
                  </div>
                )}

                {isCompleted && hasReviewed && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <Star className="w-3.5 h-3.5 fill-green-500" />
                      Reviewed
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setReviewModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Leave a Review</h3>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">{reviewError}</div>
            )}

            {/* Star rating */}
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Rating</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-0.5 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= reviewRating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">
                  {reviewRating === 5 ? "Excellent!" : reviewRating === 4 ? "Good" : reviewRating === 3 ? "Okay" : reviewRating === 2 ? "Poor" : "Terrible"}
                </span>
              </div>
            </div>

            {/* Text content */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Review (optional)</label>
              <textarea
                value={reviewContent}
                onChange={(e) => setReviewContent(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Share your experience with this seller..."
              />
            </div>

            <button
              onClick={submitReview}
              disabled={submittingReview}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submittingReview ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
              ) : (
                <Star className="w-4 h-4" />
              )}
              {submittingReview ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
