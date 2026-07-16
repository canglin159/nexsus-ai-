import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { db, schema } from "../db/index.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { generateId, calculateCommission } from "../lib/utils.js";
import { getCommissionRate } from "../services/commission.js";
import { runTransactionChecks } from "../services/fraudDetection.js";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ── GET /transactions (authenticated buyer, own transactions) ──
router.get("/transactions", authenticate, (req: Request, res: Response) => {
  try {
    const results = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.buyerId, req.user!.userId))
      .orderBy(desc(schema.transactions.createdAt))
      .all();

    const items = results.map((t) => ({
      ...t,
      listing: db
        .select({
          id: schema.listings.id,
          title: schema.listings.title,
          price: schema.listings.price,
          images: schema.listings.images,
          status: schema.listings.status,
        })
        .from(schema.listings)
        .where(eq(schema.listings.id, t.listingId))
        .get(),
    }));

    res.json({ success: true, data: items });
  } catch (err) {
    console.error("Transactions fetch error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch transactions" });
  }
});

const stripeKey = process.env.STRIPE_SECRET_KEY;
let stripe: Stripe | null = null;
if (stripeKey && stripeKey !== "sk_test_...") {
  stripe = new Stripe(stripeKey, { apiVersion: "2025-03-31.basil" });
}

// ── POST /create-intent ─────────────────────────────────
router.post("/create-intent", authenticate, authorize("buyer"), async (req: Request, res: Response) => {
  try {
    const { listingId } = req.body;

    if (!listingId) {
      res.status(400).json({ success: false, error: "listingId is required" });
      return;
    }

    const listing = db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, listingId))
      .get();

    if (!listing || listing.status !== "active") {
      res.status(404).json({ success: false, error: "Listing not found or not available" });
      return;
    }

    if (listing.sellerId === req.user!.userId) {
      res.status(400).json({ success: false, error: "Cannot purchase your own listing" });
      return;
    }

    // Check for existing pending transaction
    const existing = db
      .select()
      .from(schema.transactions)
      .where(
        eq(schema.transactions.listingId, listingId) &&
        eq(schema.transactions.buyerId, req.user!.userId)
      )
      .get();

    if (existing && existing.status === "pending") {
      res.json({ success: true, data: { transactionId: existing.id, clientSecret: null, amount: existing.amount } });
      return;
    }

    const commissionRate = getCommissionRate(listing.category);
    const amount = listing.price;
    const commission = calculateCommission(amount, commissionRate);
    const now = new Date().toISOString();
    const transactionId = generateId();

    let stripePaymentIntentId: string | undefined;
    let clientSecret: string | null = null;

    if (stripe) {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: listing.currency.toLowerCase(),
        metadata: {
          transactionId,
          listingId,
          buyerId: req.user!.userId,
          sellerId: listing.sellerId,
        },
        automatic_payment_methods: { enabled: true },
      });
      stripePaymentIntentId = intent.id;
      clientSecret = intent.client_secret;
    }

    db.insert(schema.transactions)
      .values({
        id: transactionId,
        listingId,
        buyerId: req.user!.userId,
        sellerId: listing.sellerId,
        amount,
        commission,
        commissionRate,
        stripePaymentIntentId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Run transaction fraud check asynchronously
    runTransactionChecks(transactionId).catch((err) => {
      console.error("Transaction fraud check error:", err);
    });

    res.status(201).json({
      success: true,
      data: { transactionId, clientSecret, amount, commission },
    });
  } catch (err) {
    console.error("Create intent error:", err);
    res.status(500).json({ success: false, error: "Failed to create payment intent" });
  }
});

// ── POST /confirm ───────────────────────────────────────
router.post("/confirm", authenticate, authorize("buyer"), (req: Request, res: Response) => {
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

    if (transaction.buyerId !== req.user!.userId) {
      res.status(403).json({ success: false, error: "Not your transaction" });
      return;
    }

    if (transaction.status !== "pending") {
      res.status(400).json({ success: false, error: `Cannot confirm transaction with status ${transaction.status}` });
      return;
    }

    const now = new Date().toISOString();

    db.update(schema.transactions)
      .set({ status: "escrow_held", updatedAt: now })
      .where(eq(schema.transactions.id, transactionId))
      .run();

    // Record escrow event
    db.insert(schema.escrowEvents)
      .values({
        id: generateId(),
        transactionId,
        eventType: "payment_confirmed",
        amount: transaction.amount,
        fromStatus: "pending",
        toStatus: "escrow_held",
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
    console.error("Confirm payment error:", err);
    res.status(500).json({ success: false, error: "Failed to confirm payment" });
  }
});

// ── POST /release ───────────────────────────────────────
router.post("/release", authenticate, authorize("buyer"), async (req: Request, res: Response) => {
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

    if (transaction.buyerId !== req.user!.userId) {
      res.status(403).json({ success: false, error: "Not your transaction" });
      return;
    }

    if (transaction.status !== "escrow_held" && transaction.status !== "delivered") {
      res.status(400).json({ success: false, error: `Cannot release payment with status ${transaction.status}` });
      return;
    }

    const now = new Date().toISOString();

    // In production, transfer to seller via Stripe
    if (stripe && transaction.stripePaymentIntentId) {
      try {
        // In a real system we would do a Stripe transfer to the seller's connected account
        // For now, we just mark it as completed
        console.log(`Would transfer ${transaction.amount - transaction.commission} to seller ${transaction.sellerId}`);
      } catch (stripeErr) {
        console.error("Stripe transfer error:", stripeErr);
        // Continue - we still mark as completed for dev
      }
    }

    db.update(schema.transactions)
      .set({ status: "completed", updatedAt: now })
      .where(eq(schema.transactions.id, transactionId))
      .run();

    // Update listing status
    db.update(schema.listings)
      .set({ status: "sold", updatedAt: now })
      .where(eq(schema.listings.id, transaction.listingId))
      .run();

    // Record escrow event
    db.insert(schema.escrowEvents)
      .values({
        id: generateId(),
        transactionId,
        eventType: "payment_released",
        amount: transaction.amount - transaction.commission,
        fromStatus: transaction.status,
        toStatus: "completed",
        metadata: JSON.stringify({ commission: transaction.commission }),
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
    console.error("Release payment error:", err);
    res.status(500).json({ success: false, error: "Failed to release payment" });
  }
});

// ── POST /dispute ───────────────────────────────────────
router.post("/dispute", authenticate, authorize("buyer"), (req: Request, res: Response) => {
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

    if (transaction.buyerId !== req.user!.userId) {
      res.status(403).json({ success: false, error: "Not your transaction" });
      return;
    }

    if (!["escrow_held", "shipped", "delivered"].includes(transaction.status)) {
      res.status(400).json({ success: false, error: `Cannot dispute transaction with status ${transaction.status}` });
      return;
    }

    const now = new Date().toISOString();

    db.update(schema.transactions)
      .set({ status: "disputed", updatedAt: now })
      .where(eq(schema.transactions.id, transactionId))
      .run();

    // Record escrow event
    db.insert(schema.escrowEvents)
      .values({
        id: generateId(),
        transactionId,
        eventType: "dispute_opened",
        fromStatus: transaction.status,
        toStatus: "disputed",
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
    console.error("Dispute error:", err);
    res.status(500).json({ success: false, error: "Failed to dispute transaction" });
  }
});

// ── POST /webhooks/stripe ───────────────────────────────
router.post("/webhooks/stripe", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe) {
    res.status(200).json({ received: true });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      JSON.stringify(req.body),
      sig,
      webhookSecret || ""
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).json({ success: false, error: `Webhook Error: ${err.message}` });
    return;
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const transactionId = intent.metadata?.transactionId;
        if (transactionId) {
          const now = new Date().toISOString();
          db.update(schema.transactions)
            .set({ status: "escrow_held", updatedAt: now })
            .where(eq(schema.transactions.id, transactionId))
            .run();
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const transactionId = intent.metadata?.transactionId;
        if (transactionId) {
          const now = new Date().toISOString();
          db.update(schema.transactions)
            .set({ status: "cancelled", updatedAt: now })
            .where(eq(schema.transactions.id, transactionId))
            .run();
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ success: false, error: "Webhook handler failed" });
  }
});

export default router;