import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { generateId } from "../lib/utils.js";
import { eq } from "drizzle-orm";

const router = Router();

// ── POST /ship ───────────────────────────────────────────────
// Seller marks a transaction as shipped
router.post("/ship", authenticate, (req: Request, res: Response) => {
  try {
    const { transactionId, carrier, trackingNumber } = req.body;

    if (!transactionId) {
      res.status(400).json({ success: false, error: "transactionId is required" });
      return;
    }

    const transaction = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .get();

    if (!transaction) {
      res.status(404).json({ success: false, error: "Transaction not found" });
      return;
    }

    // Only seller of this transaction can mark as shipped
    if (transaction.sellerId !== req.user!.userId && req.user!.role !== "admin") {
      res.status(403).json({ success: false, error: "Only the seller can mark items as shipped" });
      return;
    }

    // Must be in escrow_held status
    if (transaction.status !== "escrow_held" && transaction.status !== "pending") {
      res.status(400).json({
        success: false,
        error: `Cannot ship transaction with status "${transaction.status}". Only pending/escrow_held transactions can be shipped.`,
      });
      return;
    }

    const now = new Date().toISOString();
    const trackingMetadata: Record<string, any> = { shippedAt: now };
    if (carrier) trackingMetadata.carrier = carrier;
    if (trackingNumber) trackingMetadata.trackingNumber = trackingNumber;

    // Update transaction status
    db.update(schema.transactions)
      .set({ status: "shipped", updatedAt: now })
      .where(eq(schema.transactions.id, transactionId))
      .run();

    // Record escrow event
    db.insert(schema.escrowEvents)
      .values({
        id: generateId(),
        transactionId,
        eventType: "shipped",
        amount: transaction.amount,
        fromStatus: transaction.status,
        toStatus: "shipped",
        metadata: JSON.stringify(trackingMetadata),
        createdAt: now,
      })
      .run();

    const updated = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .get()!;

    res.json({
      success: true,
      data: {
        ...updated,
        tracking: trackingMetadata,
      },
    });
  } catch (err) {
    console.error("Ship error:", err);
    res.status(500).json({ success: false, error: "Failed to mark as shipped" });
  }
});

// ── POST /confirm-delivery ───────────────────────────────────
// Buyer confirms receipt of item
router.post("/confirm-delivery", authenticate, (req: Request, res: Response) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      res.status(400).json({ success: false, error: "transactionId is required" });
      return;
    }

    const transaction = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .get();

    if (!transaction) {
      res.status(404).json({ success: false, error: "Transaction not found" });
      return;
    }

    // Only buyer of this transaction can confirm delivery
    if (transaction.buyerId !== req.user!.userId && req.user!.role !== "admin") {
      res.status(403).json({ success: false, error: "Only the buyer can confirm delivery" });
      return;
    }

    // Must be in shipped status
    if (transaction.status !== "shipped") {
      res.status(400).json({
        success: false,
        error: `Cannot confirm delivery for transaction with status "${transaction.status}". Only shipped transactions can be confirmed.`,
      });
      return;
    }

    const now = new Date().toISOString();

    // Update transaction status
    db.update(schema.transactions)
      .set({ status: "delivered", updatedAt: now })
      .where(eq(schema.transactions.id, transactionId))
      .run();

    // Record escrow event
    db.insert(schema.escrowEvents)
      .values({
        id: generateId(),
        transactionId,
        eventType: "delivered",
        amount: transaction.amount,
        fromStatus: "shipped",
        toStatus: "delivered",
        metadata: JSON.stringify({ confirmedAt: now }),
        createdAt: now,
      })
      .run();

    const updated = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .get()!;

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Confirm delivery error:", err);
    res.status(500).json({ success: false, error: "Failed to confirm delivery" });
  }
});

// ── GET /tracking/:transactionId ─────────────────────────────
router.get("/tracking/:transactionId", authenticate, (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const transaction = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .get();

    if (!transaction) {
      res.status(404).json({ success: false, error: "Transaction not found" });
      return;
    }

    // Only buyer or seller can view tracking
    if (
      transaction.buyerId !== req.user!.userId &&
      transaction.sellerId !== req.user!.userId &&
      req.user!.role !== "admin"
    ) {
      res.status(403).json({ success: false, error: "Not authorized to view this tracking info" });
      return;
    }

    // Get all escrow events for this transaction as timeline
    const events = db
      .select()
      .from(schema.escrowEvents)
      .where(eq(schema.escrowEvents.transactionId, transactionId))
      .orderBy(schema.escrowEvents.createdAt)
      .all();

    // Parse metadata from events
    const shippingEvent = events.find((e) => e.eventType === "shipped");
    const trackingInfo = shippingEvent?.metadata
      ? (typeof shippingEvent.metadata === "string"
          ? JSON.parse(shippingEvent.metadata)
          : shippingEvent.metadata)
      : null;

    const timeline = events.map((e) => ({
      eventType: e.eventType,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      amount: e.amount,
      metadata: e.metadata
        ? (typeof e.metadata === "string" ? JSON.parse(e.metadata) : e.metadata)
        : null,
      createdAt: e.createdAt,
    }));

    res.json({
      success: true,
      data: {
        transactionId: transaction.id,
        status: transaction.status,
        carrier: trackingInfo?.carrier || null,
        trackingNumber: trackingInfo?.trackingNumber || null,
        shippedAt: trackingInfo?.shippedAt || null,
        timeline,
      },
    });
  } catch (err) {
    console.error("Tracking error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch tracking info" });
  }
});

export default router;
