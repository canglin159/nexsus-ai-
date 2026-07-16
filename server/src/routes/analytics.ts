import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

const router = Router();

// ── All analytics routes require admin role ─────────────────
router.use(authenticate, authorize("admin"));

// ── GET /overview ───────────────────────────────────────────
router.get("/overview", (_req: Request, res: Response) => {
  try {
    const totalUsers = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .get()?.count ?? 0;

    const totalBuyers = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(eq(schema.users.role, "buyer"))
      .get()?.count ?? 0;

    const totalSellers = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(eq(schema.users.role, "seller"))
      .get()?.count ?? 0;

    const activeListings = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.listings)
      .where(eq(schema.listings.status, "active"))
      .get()?.count ?? 0;

    const totalListings = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.listings)
      .get()?.count ?? 0;

    const totalTransactions = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .get()?.count ?? 0;

    const completedTransactions = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, "completed"))
      .get()?.count ?? 0;

    const pendingTransactions = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .where(
        and(
          gte(schema.transactions.status, "pending"),
          lte(schema.transactions.status, "escrow_held"),
        )
      )
      .get()?.count ?? 0;

    // Count pending/escrow_held/shipped/delivered as pending
    const pendingCount = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .where(
        sql`status IN ('pending', 'escrow_held', 'shipped', 'delivered')`
      )
      .get()?.count ?? 0;

    const disputedTransactions = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, "disputed"))
      .get()?.count ?? 0;

    const totalGMV = db
      .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, "completed"))
      .get()?.sum ?? 0;

    const totalCommissionsEarned = db
      .select({ sum: sql<number>`COALESCE(SUM(commission), 0)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, "completed"))
      .get()?.sum ?? 0;

    const averageDealSize = completedTransactions > 0
      ? (totalGMV as number) / completedTransactions
      : 0;

    const conversionRate = totalTransactions > 0
      ? ((completedTransactions / totalTransactions) * 100)
      : 0;

    const avgRatingResult = db
      .select({ avg: sql<number>`COALESCE(AVG(rating), 0)` })
      .from(schema.reviews)
      .get()?.avg ?? 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalBuyers,
        totalSellers,
        activeListings,
        totalListings,
        totalTransactions,
        completedTransactions,
        pendingTransactions: pendingCount,
        disputedTransactions,
        totalGMV: Math.round((totalGMV as number) * 100) / 100,
        totalCommissionsEarned: Math.round((totalCommissionsEarned as number) * 100) / 100,
        averageDealSize: Math.round((averageDealSize as number) * 100) / 100,
        conversionRate: Math.round((conversionRate as number) * 100) / 100,
        averageRating: Math.round((avgRatingResult as number) * 10) / 10,
      },
    });
  } catch (err) {
    console.error("Analytics overview error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch analytics overview" });
  }
});

// ── GET /revenue-by-category ────────────────────────────────
router.get("/revenue-by-category", (_req: Request, res: Response) => {
  try {
    const data = db
      .select({
        category: schema.listings.category,
        gmv: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
        commissions: sql<number>`COALESCE(SUM(${schema.transactions.commission}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(schema.transactions)
      .innerJoin(
        schema.listings,
        eq(schema.transactions.listingId, schema.listings.id)
      )
      .where(eq(schema.transactions.status, "completed"))
      .groupBy(schema.listings.category)
      .all();

    const result = data.map((row) => ({
      category: row.category,
      gmv: Math.round(row.gmv * 100) / 100,
      commissions: Math.round(row.commissions * 100) / 100,
      count: row.count,
    }));

    // If no completed transactions, return empty array
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Revenue by category error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch revenue by category" });
  }
});

// ── GET /trends?days=30 ─────────────────────────────────────
router.get("/trends", (req: Request, res: Response) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string, 10) || 30));

    // Generate date range
    const dates: string[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }

    // Get all completed transactions
    const transactions = db
      .select({
        amount: schema.transactions.amount,
        commission: schema.transactions.commission,
        createdAt: schema.transactions.createdAt,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, "completed"))
      .all();

    // Group by date
    const dateMap = new Map<string, { transactions: number; gmv: number; commissions: number }>();
    for (const tx of transactions) {
      const day = tx.createdAt.split("T")[0];
      const existing = dateMap.get(day) || { transactions: 0, gmv: 0, commissions: 0 };
      existing.transactions += 1;
      existing.gmv += tx.amount;
      existing.commissions += tx.commission;
      dateMap.set(day, existing);
    }

    const trendData = dates.map((date) => {
      const data = dateMap.get(date) || { transactions: 0, gmv: 0, commissions: 0 };
      return {
        date,
        transactions: data.transactions,
        gmv: Math.round(data.gmv * 100) / 100,
        commissions: Math.round(data.commissions * 100) / 100,
      };
    });

    res.json({ success: true, data: trendData });
  } catch (err) {
    console.error("Trends error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch trends" });
  }
});

// ── GET /top-sellers?limit=10 ────────────────────────────────
router.get("/top-sellers", (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

    const data = db
      .select({
        sellerId: schema.transactions.sellerId,
        gmv: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
        commissionPaid: sql<number>`COALESCE(SUM(${schema.transactions.commission}), 0)`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, "completed"))
      .groupBy(schema.transactions.sellerId)
      .orderBy(desc(sql`COALESCE(SUM(${schema.transactions.amount}), 0)`))
      .limit(limit)
      .all();

    const enriched = data.map((row) => {
      const seller = db
        .select({ id: schema.users.id, email: schema.users.email, displayName: schema.users.displayName })
        .from(schema.users)
        .where(eq(schema.users.id, row.sellerId))
        .get();

      return {
        sellerId: row.sellerId,
        sellerEmail: seller?.email || "Unknown",
        sellerDisplayName: seller?.displayName || null,
        gmv: Math.round(row.gmv * 100) / 100,
        commissionPaid: Math.round(row.commissionPaid * 100) / 100,
        transactionCount: row.transactionCount,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error("Top sellers error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch top sellers" });
  }
});

// ── GET /top-buyers?limit=10 ─────────────────────────────────
router.get("/top-buyers", (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

    const data = db
      .select({
        buyerId: schema.transactions.buyerId,
        spend: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, "completed"))
      .groupBy(schema.transactions.buyerId)
      .orderBy(desc(sql`COALESCE(SUM(${schema.transactions.amount}), 0)`))
      .limit(limit)
      .all();

    const enriched = data.map((row) => {
      const buyer = db
        .select({ id: schema.users.id, email: schema.users.email, displayName: schema.users.displayName })
        .from(schema.users)
        .where(eq(schema.users.id, row.buyerId))
        .get();

      return {
        buyerId: row.buyerId,
        buyerEmail: buyer?.email || "Unknown",
        buyerDisplayName: buyer?.displayName || null,
        spend: Math.round(row.spend * 100) / 100,
        transactionCount: row.transactionCount,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error("Top buyers error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch top buyers" });
  }
});

export default router;
