import { useState, useEffect } from "react";
import { apiRequest } from "../lib/api";
import type { TransactionData } from "@shared/types";

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

  useEffect(() => {
    apiRequest<TransactionData[]>("/payments/transactions")
      .then(setTransactions)
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // For now, show a placeholder since we don't have a transactions list endpoint yet
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
          {transactions.map((tx) => (
            <div key={tx.id} className="bg-white border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold">{tx.listing?.title || "Listing"}</p>
                  <p className="text-sm text-muted-foreground">${tx.amount.toLocaleString()}</p>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}