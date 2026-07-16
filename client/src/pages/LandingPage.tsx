import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ListingCard } from "../components/ListingCard";
import { useState, useEffect } from "react";
import { apiRequest } from "../lib/api";
import type { ListingData } from "@shared/types";

export function LandingPage() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<ListingData[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    if (user) {
      setLoadingRecs(true);
      apiRequest<ListingData[]>("/ai/recommendations?limit=8")
        .then(setRecommendations)
        .catch(() => {})
        .finally(() => setLoadingRecs(false));
    }
  }, [user]);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
              AI-Powered{" "}
              <span className="text-primary">Marketplace</span> Brokerage
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
              Nexus Exchange autonomously matches buyers and sellers, handles negotiations,
              manages escrow payments, and executes the entire transaction lifecycle — all
              without human intervention.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="inline-flex items-center px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
              >
                Start Selling
              </Link>
              <Link
                to="/listings"
                className="inline-flex items-center px-8 py-3 rounded-xl border-2 border-border bg-white text-foreground font-semibold text-lg hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                Browse Listings
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats — live counts fetched from the platform */}
      <section className="border-y border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Commission Rate", value: "8%" },
              { label: "Listing Fee", value: "Free" },
              { label: "AI Enhancement", value: "Auto" },
              { label: "Escrow Protection", value: "100%" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recommended For You (logged-in users only) */}
      {user && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold">Recommended For You</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  AI-curated picks based on your preferences
                </p>
              </div>
              <Link
                to="/listings"
                className="text-sm font-medium text-primary hover:underline"
              >
                View All →
              </Link>
            </div>

            {loadingRecs ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-muted animate-pulse h-72" />
                ))}
              </div>
            ) : recommendations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recommendations.slice(0, 8).map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/50 rounded-xl">
                <p className="text-muted-foreground">
                  No recommendations yet. Start browsing to get personalized picks!
                </p>
                <Link
                  to="/listings"
                  className="inline-block mt-3 text-primary font-medium hover:underline"
                >
                  Browse Listings
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">How Nexus Exchange Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                emoji: "🤖",
                title: "AI Matching",
                desc: "Our AI autonomously matches buyers with the right listings based on preferences, budget, and behavior patterns.",
              },
              {
                emoji: "⚖️",
                title: "Smart Negotiation",
                desc: "AI handles price negotiations within seller-defined parameters, finding the sweet spot for both parties.",
              },
              {
                emoji: "🔒",
                title: "Secure Escrow",
                desc: "Every transaction is protected by escrow. Funds are held securely until both parties confirm satisfaction.",
              },
              {
                emoji: "⚡",
                title: "Instant Settlement",
                desc: "Automated payment release upon delivery confirmation. Sellers get paid fast with transparent commission.",
              },
              {
                emoji: "🛡️",
                title: "Fraud Detection",
                desc: "Real-time AI-powered fraud detection flags suspicious activity before any transaction completes.",
              },
              {
                emoji: "📊",
                title: "Analytics Dashboard",
                desc: "Detailed insights on sales, buyer behavior, and market trends to help you make data-driven decisions.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl border border-border bg-white hover:shadow-lg hover:border-primary/20 transition-all duration-200"
              >
                <div className="text-3xl mb-4">{feature.emoji}</div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary/5 border-y border-border py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Marketplace Experience?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join Nexus Exchange today — whether you're buying or selling, our AI handles the heavy lifting.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}
