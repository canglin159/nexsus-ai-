import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";
import { generateId } from "../lib/utils.js";
import { eq, and, desc, inArray } from "drizzle-orm";

const router = Router();

// ── POST / (create review) ───────────────────────────────
router.post("/", authenticate, (req: Request, res: Response) => {
  try {
    const { transactionId, rating, content } = req.body;

    if (!transactionId || rating === undefined) {
      res.status(400).json({ success: false, error: "transactionId and rating (1-5) are required" });
      return;
    }

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ success: false, error: "Rating must be between 1 and 5" });
      return;
    }

    // Verify transaction exists and belongs to the user
    const transaction = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .get();

    if (!transaction) {
      res.status(404).json({ success: false, error: "Transaction not found" });
      return;
    }

    if (transaction.buyerId !== req.user!.userId) {
      res.status(403).json({
        success: false,
        error: "Only the buyer can leave a review for this transaction",
      });
      return;
    }

    // Verify transaction is completed
    if (transaction.status !== "completed") {
      res.status(400).json({
        success: false,
        error: `Cannot review a transaction with status "${transaction.status}". Reviews are only available for completed transactions.`,
      });
      return;
    }

    // Prevent duplicate reviews
    const existing = db
      .select()
      .from(schema.reviews)
      .where(
        and(
          eq(schema.reviews.transactionId, transactionId),
          eq(schema.reviews.reviewerId, req.user!.userId)
        )
      )
      .get();

    if (existing) {
      res.status(409).json({ success: false, error: "You have already reviewed this transaction" });
      return;
    }

    const id = generateId();
    const now = new Date().toISOString();

    db.insert(schema.reviews)
      .values({
        id,
        transactionId,
        reviewerId: req.user!.userId,
        rating: ratingNum,
        content: content || null,
        createdAt: now,
      })
      .run();

    const review = db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.id, id))
      .get()!;

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    console.error("Create review error:", err);
    res.status(500).json({ success: false, error: "Failed to create review" });
  }
});

// ── GET /listing/:listingId ──────────────────────────────
router.get("/listing/:listingId", optionalAuth, (req: Request, res: Response) => {
  try {
    // Find all completed transactions for this listing
    const txList = db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.listingId, req.params.listingId),
          eq(schema.transactions.status, "completed")
        )
      )
      .all();

    if (txList.length === 0) {
      res.json({ success: true, data: [], averageRating: 0, reviewCount: 0 });
      return;
    }

    const txIds = txList.map((t) => t.id);

    // Get reviews for these transactions
    const reviewList = db
      .select()
      .from(schema.reviews)
      .where(inArray(schema.reviews.transactionId, txIds))
      .orderBy(desc(schema.reviews.createdAt))
      .all();

    // Enrich with reviewer info
    const enriched = reviewList.map((r) => {
      const reviewer = db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          displayName: schema.users.displayName,
        })
        .from(schema.users)
        .where(eq(schema.users.id, r.reviewerId))
        .get();

      return {
        ...r,
        reviewer: reviewer
          ? {
              id: reviewer.id,
              displayName: reviewer.displayName || reviewer.email,
            }
          : { id: r.reviewerId, displayName: "Anonymous" },
      };
    });

    const averageRating =
      enriched.length > 0
        ? Math.round((enriched.reduce((sum, r) => sum + r.rating, 0) / enriched.length) * 10) / 10
        : 0;

    res.json({
      success: true,
      data: enriched,
      averageRating,
      reviewCount: enriched.length,
    });
  } catch (err) {
    console.error("Fetch listing reviews error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch reviews" });
  }
});

// ── GET /seller/:sellerId ────────────────────────────────
router.get("/seller/:sellerId", optionalAuth, (req: Request, res: Response) => {
  try {
    // Get all completed transactions where this user is the seller
    const completedTxs = db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.sellerId, req.params.sellerId),
          eq(schema.transactions.status, "completed")
        )
      )
      .all();

    if (completedTxs.length === 0) {
      res.json({
        success: true,
        data: [],
        averageRating: 0,
        reviewCount: 0,
      });
      return;
    }

    const txIds = completedTxs.map((t) => t.id);

    // Get all reviews for these transactions
    const reviewList = db
      .select()
      .from(schema.reviews)
      .where(inArray(schema.reviews.transactionId, txIds))
      .orderBy(desc(schema.reviews.createdAt))
      .all();

    const enriched = reviewList.map((r) => {
      const reviewer = db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          displayName: schema.users.displayName,
        })
        .from(schema.users)
        .where(eq(schema.users.id, r.reviewerId))
        .get();

      return {
        ...r,
        reviewer: reviewer
          ? {
              id: reviewer.id,
              displayName: reviewer.displayName || reviewer.email,
            }
          : { id: r.reviewerId, displayName: "Anonymous" },
      };
    });

    const averageRating =
      enriched.length > 0
        ? Math.round((enriched.reduce((sum, r) => sum + r.rating, 0) / enriched.length) * 10) / 10
        : 0;

    res.json({
      success: true,
      data: enriched,
      averageRating,
      reviewCount: enriched.length,
    });
  } catch (err) {
    console.error("Fetch seller reviews error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch seller reviews" });
  }
});

// ── GET /my ──────────────────────────────────────────────
router.get("/my", authenticate, (req: Request, res: Response) => {
  try {
    const reviewList = db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.reviewerId, req.user!.userId))
      .orderBy(desc(schema.reviews.createdAt))
      .all();

    // Enrich with transaction/listing info
    const enriched = reviewList.map((r) => {
      const transaction = db
        .select({
          id: schema.transactions.id,
          listingId: schema.transactions.listingId,
          amount: schema.transactions.amount,
          status: schema.transactions.status,
        })
        .from(schema.transactions)
        .where(eq(schema.transactions.id, r.transactionId))
        .get();

      let listing = null;
      if (transaction) {
        listing = db
          .select({
            id: schema.listings.id,
            title: schema.listings.title,
          })
          .from(schema.listings)
          .where(eq(schema.listings.id, transaction.listingId))
          .get();
      }

      return {
        ...r,
        transaction: transaction || undefined,
        listing: listing || undefined,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error("Fetch my reviews error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch your reviews" });
  }
});

export default router;
