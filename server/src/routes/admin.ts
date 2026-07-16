import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { generateId } from "../lib/utils.js";
import { eq, desc, asc, sql, and } from "drizzle-orm";
import {
  getCommissionRules,
  updateCommissionRules,
} from "../services/commission.js";

const router = Router();

// ── All admin routes require admin role ──────────────────
router.use(authenticate, authorize("admin"));

// ── GET /stats ───────────────────────────────────────────
router.get("/stats", (req: Request, res: Response) => {
  try {
    const totalUsers = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .get()?.count ?? 0;

    const totalListings = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.listings)
      .get()?.count ?? 0;

    const activeListings = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.listings)
      .where(eq(schema.listings.status, "active"))
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

    const totalCommissions = db
      .select({ sum: sql<number>`COALESCE(SUM(commission), 0)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, "completed"))
      .get()?.sum ?? 0;

    const pendingDisputes = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, "disputed"))
      .get()?.count ?? 0;

    const activeFraudFlags = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.fraudFlags)
      .where(eq(schema.fraudFlags.resolved, false))
      .get()?.count ?? 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalListings,
        activeListings,
        totalTransactions,
        completedTransactions,
        totalCommissions: Math.round((totalCommissions as number) * 100) / 100,
        pendingDisputes,
        activeFraudFlags,
      },
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

// ── GET /users ───────────────────────────────────────────
router.get("/users", (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20", role } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause;
    if (role) {
      whereClause = eq(schema.users.role, role as any);
    }

    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users);
    const total = (whereClause ? countQuery.where(whereClause).get() : countQuery.get())?.count ?? 0;

    const query = db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        kycStatus: schema.users.kycStatus,
        mfaEnabled: schema.users.mfaEnabled,
        displayName: schema.users.displayName,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users);

    if (whereClause) {
      query.where(whereClause);
    }

    const users = query
      .orderBy(desc(schema.users.createdAt))
      .limit(limitNum)
      .offset(offset)
      .all();

    res.json({
      success: true,
      data: users,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// ── GET /listings ────────────────────────────────────────
router.get("/listings", (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20", status } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause;
    if (status) {
      whereClause = eq(schema.listings.status, status as any);
    }

    const countResult = whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(schema.listings).where(whereClause).get()
      : db.select({ count: sql<number>`count(*)` }).from(schema.listings).get();
    const total = countResult?.count ?? 0;

    const listingsQuery = db
      .select()
      .from(schema.listings);
    if (whereClause) listingsQuery.where(whereClause);

    const listings = listingsQuery
      .orderBy(desc(schema.listings.createdAt))
      .limit(limitNum)
      .offset(offset)
      .all();

    // Enrich with seller email
    const enriched = listings.map((l) => {
      const seller = db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          displayName: schema.users.displayName,
        })
        .from(schema.users)
        .where(eq(schema.users.id, l.sellerId))
        .get();

      return {
        ...l,
        images: typeof l.images === "string" ? JSON.parse(l.images as string) : l.images,
        tags: typeof l.tags === "string" ? JSON.parse(l.tags as string) : l.tags,
        sellerEmail: seller?.email || "Unknown",
        sellerDisplayName: seller?.displayName || null,
      };
    });

    res.json({
      success: true,
      data: enriched,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("Admin listings error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch listings" });
  }
});

// ── POST /listings/:id/archive ───────────────────────────
router.post("/listings/:id/archive", (req: Request, res: Response) => {
  try {
    const listing = db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, req.params.id))
      .get();

    if (!listing) {
      res.status(404).json({ success: false, error: "Listing not found" });
      return;
    }

    const now = new Date().toISOString();
    db.update(schema.listings)
      .set({ status: "archived", updatedAt: now })
      .where(eq(schema.listings.id, req.params.id))
      .run();

    res.json({ success: true, data: { message: "Listing archived" } });
  } catch (err) {
    console.error("Archive listing error:", err);
    res.status(500).json({ success: false, error: "Failed to archive listing" });
  }
});

// ── GET /transactions ────────────────────────────────────
router.get("/transactions", (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20", status } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause;
    if (status) {
      whereClause = eq(schema.transactions.status, status as any);
    }

    const countResult = whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(schema.transactions).where(whereClause).get()
      : db.select({ count: sql<number>`count(*)` }).from(schema.transactions).get();
    const total = countResult?.count ?? 0;

    const txList = db
      .select()
      .from(schema.transactions);
    if (whereClause) txList.where(whereClause);

    const transactions = txList
      .orderBy(desc(schema.transactions.createdAt))
      .limit(limitNum)
      .offset(offset)
      .all();

    // Enrich with buyer/seller emails and listing title
    const enriched = transactions.map((t) => {
      const buyer = db
        .select({ id: schema.users.id, email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, t.buyerId))
        .get();

      const seller = db
        .select({ id: schema.users.id, email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, t.sellerId))
        .get();

      const listing = db
        .select({ id: schema.listings.id, title: schema.listings.title })
        .from(schema.listings)
        .where(eq(schema.listings.id, t.listingId))
        .get();

      return {
        ...t,
        buyerEmail: buyer?.email || "Unknown",
        sellerEmail: seller?.email || "Unknown",
        listingTitle: listing?.title || "Unknown",
      };
    });

    res.json({
      success: true,
      data: enriched,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("Admin transactions error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch transactions" });
  }
});

// ── POST /transactions/:id/resolve-dispute ───────────────
router.post("/transactions/:id/resolve-dispute", (req: Request, res: Response) => {
  try {
    const { action } = req.body; // "refund" or "release"

    if (!action || !["refund", "release"].includes(action)) {
      res.status(400).json({
        success: false,
        error: "action is required and must be 'refund' or 'release'",
      });
      return;
    }

    const transaction = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, req.params.id))
      .get();

    if (!transaction) {
      res.status(404).json({ success: false, error: "Transaction not found" });
      return;
    }

    if (transaction.status !== "disputed") {
      res.status(400).json({
        success: false,
        error: `Cannot resolve transaction with status "${transaction.status}". Only disputed transactions can be resolved.`,
      });
      return;
    }

    const now = new Date().toISOString();
    const newStatus = action === "refund" ? "refunded" : "completed";

    db.update(schema.transactions)
      .set({ status: newStatus, updatedAt: now })
      .where(eq(schema.transactions.id, req.params.id))
      .run();

    // Record escrow event
    db.insert(schema.escrowEvents)
      .values({
        id: generateId(),
        transactionId: req.params.id,
        eventType: action === "refund" ? "dispute_refunded" : "dispute_released",
        amount: transaction.amount,
        fromStatus: "disputed",
        toStatus: newStatus,
        metadata: JSON.stringify({ resolvedBy: req.user!.userId, action }),
        createdAt: now,
      })
      .run();

    const updated = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, req.params.id))
      .get()!;

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Resolve dispute error:", err);
    res.status(500).json({ success: false, error: "Failed to resolve dispute" });
  }
});

// ── GET /commission-rules ────────────────────────────────
router.get("/commission-rules", (_req: Request, res: Response) => {
  try {
    const rules = getCommissionRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    console.error("Get commission rules error:", err);
    res.status(500).json({ success: false, error: "Failed to get commission rules" });
  }
});

// ── POST /commission-rules ───────────────────────────────
router.post("/commission-rules", (req: Request, res: Response) => {
  try {
    const { rules } = req.body;

    if (!rules || typeof rules !== "object") {
      res.status(400).json({
        success: false,
        error: "rules object is required, e.g. { electronics: 8, vehicles: 5 }",
      });
      return;
    }

    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(rules)) {
      const num = Number(value);
      if (!isNaN(num)) {
        normalized[key] = num;
      }
    }

    const updated = updateCommissionRules(normalized);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Update commission rules error:", err);
    res.status(500).json({ success: false, error: "Failed to update commission rules" });
  }
});

export default router;
