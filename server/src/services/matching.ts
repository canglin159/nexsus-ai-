import { db, schema } from "../db/index.js";
import { eq, ne, and, or, inArray, desc, gte, lte } from "drizzle-orm";
import type { ListingData } from "../../../shared/types.js";

// ── Helpers ──────────────────────────────────────────────

function parseListing(row: any): ListingData {
  return {
    ...row,
    images: typeof row.images === "string" ? JSON.parse(row.images as string) : (row.images || []),
    tags: typeof row.tags === "string" ? JSON.parse(row.tags as string) : (row.tags || []),
  };
}

// ── Core Matching Functions ──────────────────────────────

export function getRecommendationsForBuyer(
  buyerId: string,
  limit: number = 8
): ListingData[] {
  try {
    // Step 1: Get buyer's purchase history categories and price preferences
    const pastTransactions = db
      .select({
        listingId: schema.transactions.listingId,
        amount: schema.transactions.amount,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.buyerId, buyerId))
      .orderBy(desc(schema.transactions.createdAt))
      .limit(20)
      .all();

    const pastListingIds = pastTransactions.map((t) => t.listingId);

    let preferredCategories: string[] = [];
    let avgPrice = 0;

    if (pastListingIds.length > 0) {
      // Get categories from past purchases
      const pastListings = db
        .select({ category: schema.listings.category })
        .from(schema.listings)
        .where(inArray(schema.listings.id, pastListingIds))
        .all();

      const categoryCount: Record<string, number> = {};
      for (const l of pastListings) {
        categoryCount[l.category] = (categoryCount[l.category] || 0) + 1;
      }
      preferredCategories = Object.entries(categoryCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([cat]) => cat);

      avgPrice =
        pastTransactions.reduce((sum, t) => sum + t.amount, 0) /
        pastTransactions.length;
    }

    // Step 2: Build recommendations
    // If buyer has history, prefer same categories and price range
    // Otherwise, return newest active listings

    const conditions = [eq(schema.listings.status, "active")];

    // Exclude listings buyer already purchased
    if (pastListingIds.length > 0) {
      conditions.push(ne(schema.listings.sellerId, buyerId));
    }

    if (preferredCategories.length > 0) {
      conditions.push(
        or(...preferredCategories.map((cat) => eq(schema.listings.category, cat)))!
      );
    }

    // Price range around buyer's average
    if (avgPrice > 0) {
      conditions.push(gte(schema.listings.price, avgPrice * 0.5));
      conditions.push(lte(schema.listings.price, avgPrice * 2.0));
    }

    const whereClause = and(...conditions);

    let results = db
      .select()
      .from(schema.listings)
      .where(whereClause)
      .orderBy(desc(schema.listings.createdAt))
      .limit(limit * 2)
      .all();

    // If not enough results with filters, fall back to newest
    if (results.length < limit) {
      const fallback = db
        .select()
        .from(schema.listings)
        .where(eq(schema.listings.status, "active"))
        .orderBy(desc(schema.listings.createdAt))
        .limit(limit)
        .all();

      const existingIds = new Set(results.map((r) => r.id));
      for (const f of fallback) {
        if (!existingIds.has(f.id)) {
          results.push(f);
        }
      }
    }

    return results.slice(0, limit).map(parseListing);
  } catch (err) {
    console.error("Buyer recommendations error:", err);
    // Fallback: return newest listings
    const results = db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.status, "active"))
      .orderBy(desc(schema.listings.createdAt))
      .limit(limit)
      .all();
    return results.map(parseListing);
  }
}

export function getRecommendationsForSeller(
  sellerId: string,
  limit: number = 10
): { buyerId: string; score: number }[] {
  try {
    // Get seller's active listing categories
    const sellerListings = db
      .select({ category: schema.listings.category, price: schema.listings.price })
      .from(schema.listings)
      .where(
        and(
          eq(schema.listings.sellerId, sellerId),
          eq(schema.listings.status, "active")
        )
      )
      .all();

    if (sellerListings.length === 0) return [];

    const sellerCategories = [...new Set(sellerListings.map((l) => l.category))];
    const avgPrice =
      sellerListings.reduce((sum, l) => sum + l.price, 0) / sellerListings.length;

    // Find buyers who purchased in same categories
    const matchingTransactions = db
      .select({
        buyerId: schema.transactions.buyerId,
        listingId: schema.transactions.listingId,
      })
      .from(schema.transactions)
      .innerJoin(
        schema.listings,
        eq(schema.transactions.listingId, schema.listings.id)
      )
      .where(
        and(
          inArray(schema.listings.category, sellerCategories),
          ne(schema.transactions.buyerId, sellerId)
        )
      )
      .all();

    // Score buyers by match count
    const buyerScores: Record<string, number> = {};
    for (const t of matchingTransactions) {
      buyerScores[t.buyerId] = (buyerScores[t.buyerId] || 0) + 1;
    }

    return Object.entries(buyerScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([buyerId, score]) => ({ buyerId, score }));
  } catch (err) {
    console.error("Seller recommendations error:", err);
    return [];
  }
}

export function getSimilarListings(
  listingId: string,
  limit: number = 4
): ListingData[] {
  try {
    const source = db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, listingId))
      .get();

    if (!source) return [];

    // Find listings in same category, similar price range
    const results = db
      .select()
      .from(schema.listings)
      .where(
        and(
          eq(schema.listings.status, "active"),
          ne(schema.listings.id, listingId),
          eq(schema.listings.category, source.category),
          gte(schema.listings.price, source.price * 0.5),
          lte(schema.listings.price, source.price * 2.0)
        )
      )
      .orderBy(desc(schema.listings.createdAt))
      .limit(limit)
      .all();

    // If not enough by exact category, expand to all active
    if (results.length < limit) {
      const existingIds = new Set(results.map((r) => r.id));
      const extra = db
        .select()
        .from(schema.listings)
        .where(
          and(
            eq(schema.listings.status, "active"),
            ne(schema.listings.id, listingId)
          )
        )
        .orderBy(desc(schema.listings.createdAt))
        .limit(limit)
        .all();
      for (const e of extra) {
        if (!existingIds.has(e.id)) {
          results.push(e);
        }
      }
    }

    return results.slice(0, limit).map(parseListing);
  } catch (err) {
    console.error("Similar listings error:", err);
    return [];
  }
}
