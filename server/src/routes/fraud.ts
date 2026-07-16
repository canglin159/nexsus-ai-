import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { eq, desc, asc, sql, and } from "drizzle-orm";
import {
  runListingChecks,
  runUserChecks,
  runTransactionChecks,
} from "../services/fraudDetection.js";

const router = Router();

// ── All fraud routes require admin authentication ────────
router.use(authenticate, authorize("admin"));

// ── POST /check-listing/:id ──────────────────────────────
router.post("/check-listing/:id", async (req: Request, res: Response) => {
  try {
    const listing = db
      .select({ id: schema.listings.id })
      .from(schema.listings)
      .where(eq(schema.listings.id, req.params.id))
      .get();

    if (!listing) {
      res.status(404).json({ success: false, error: "Listing not found" });
      return;
    }

    const score = await runListingChecks(req.params.id);
    res.json({ success: true, data: { listingId: req.params.id, riskScore: score } });
  } catch (err) {
    console.error("Check listing error:", err);
    res.status(500).json({ success: false, error: "Failed to check listing" });
  }
});

// ── POST /check-user/:id ─────────────────────────────────
router.post("/check-user/:id", async (req: Request, res: Response) => {
  try {
    const user = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, req.params.id))
      .get();

    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    const score = await runUserChecks(req.params.id);
    res.json({ success: true, data: { userId: req.params.id, riskScore: score } });
  } catch (err) {
    console.error("Check user error:", err);
    res.status(500).json({ success: false, error: "Failed to check user" });
  }
});

// ── POST /check-transaction/:id ──────────────────────────
router.post("/check-transaction/:id", async (req: Request, res: Response) => {
  try {
    const transaction = db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(eq(schema.transactions.id, req.params.id))
      .get();

    if (!transaction) {
      res.status(404).json({ success: false, error: "Transaction not found" });
      return;
    }

    const score = await runTransactionChecks(req.params.id);
    res.json({ success: true, data: { transactionId: req.params.id, riskScore: score } });
  } catch (err) {
    console.error("Check transaction error:", err);
    res.status(500).json({ success: false, error: "Failed to check transaction" });
  }
});

// ── GET /flags ───────────────────────────────────────────
router.get("/flags", (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      sort = "date",
      order = "desc",
      resolved: resolvedFilter,
      targetType,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];

    if (resolvedFilter === "true") {
      conditions.push(eq(schema.fraudFlags.resolved, true));
    } else if (resolvedFilter === "false") {
      conditions.push(eq(schema.fraudFlags.resolved, false));
    }

    if (targetType) {
      conditions.push(eq(schema.fraudFlags.targetType, targetType as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.fraudFlags);

    const countResult = whereClause
      ? countQuery.where(whereClause).get()
      : countQuery.get();
    const total = countResult?.count ?? 0;

    // Sort
    let orderBy;
    switch (sort) {
      case "score":
        orderBy = order === "asc" ? asc(schema.fraudFlags.riskScore) : desc(schema.fraudFlags.riskScore);
        break;
      default:
        orderBy = order === "asc" ? asc(schema.fraudFlags.createdAt) : desc(schema.fraudFlags.createdAt);
    }

    const flagsQuery = db
      .select()
      .from(schema.fraudFlags)
      .limit(limitNum)
      .offset(offset);

    if (whereClause) {
      flagsQuery.where(whereClause);
    }

    const flags = flagsQuery.orderBy(orderBy).all();

    res.json({
      success: true,
      data: flags,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("Fetch fraud flags error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch fraud flags" });
  }
});

// ── POST /flags/:id/resolve ──────────────────────────────
router.post("/flags/:id/resolve", (req: Request, res: Response) => {
  try {
    const flag = db
      .select()
      .from(schema.fraudFlags)
      .where(eq(schema.fraudFlags.id, req.params.id))
      .get();

    if (!flag) {
      res.status(404).json({ success: false, error: "Fraud flag not found" });
      return;
    }

    db.update(schema.fraudFlags)
      .set({ resolved: true })
      .where(eq(schema.fraudFlags.id, req.params.id))
      .run();

    const updated = db
      .select()
      .from(schema.fraudFlags)
      .where(eq(schema.fraudFlags.id, req.params.id))
      .get()!;

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Resolve fraud flag error:", err);
    res.status(500).json({ success: false, error: "Failed to resolve fraud flag" });
  }
});

export default router;
