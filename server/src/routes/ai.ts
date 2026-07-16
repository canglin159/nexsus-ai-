import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { authenticate, authorize, optionalAuth } from "../middleware/auth.js";
import { generateId } from "../lib/utils.js";
import { eq } from "drizzle-orm";
import { enhanceListing } from "../services/aiListing.js";
import {
  getRecommendationsForBuyer,
  getSimilarListings,
} from "../services/matching.js";
import {
  generateInquiryMessage,
  generateResponseToInquiry,
  suggestCounterOffer,
} from "../services/dealAssistant.js";

const router = Router();

// ── POST /enhance-listing ──────────────────────────────
router.post(
  "/enhance-listing",
  authenticate,
  authorize("seller"),
  async (req: Request, res: Response) => {
    try {
      const { title, description, category, tags } = req.body;

      const result = await enhanceListing({
        title: title || undefined,
        description: description || undefined,
        category: category || undefined,
        tags: tags || undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      console.error("Enhance listing error:", err);
      res.status(500).json({ success: false, error: "Failed to enhance listing" });
    }
  }
);

// ── GET /recommendations ───────────────────────────────
router.get(
  "/recommendations",
  authenticate,
  (req: Request, res: Response) => {
    try {
      const limit = Math.min(
        20,
        Math.max(1, parseInt(req.query.limit as string, 10) || 8)
      );

      const recommendations = getRecommendationsForBuyer(
        req.user!.userId,
        limit
      );

      res.json({
        success: true,
        data: recommendations,
      });
    } catch (err) {
      console.error("Recommendations error:", err);
      res.status(500).json({ success: false, error: "Failed to get recommendations" });
    }
  }
);

// ── GET /similar/:listingId ────────────────────────────
router.get(
  "/similar/:listingId",
  optionalAuth,
  (req: Request, res: Response) => {
    try {
      const limit = Math.min(
        10,
        Math.max(1, parseInt(req.query.limit as string, 10) || 4)
      );

      const similar = getSimilarListings(req.params.listingId, limit);

      res.json({
        success: true,
        data: similar,
      });
    } catch (err) {
      console.error("Similar listings error:", err);
      res.status(500).json({ success: false, error: "Failed to get similar listings" });
    }
  }
);

// ── POST /ask-question ─────────────────────────────────
router.post(
  "/ask-question",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { listingId, question } = req.body;

      if (!listingId) {
        res.status(400).json({ success: false, error: "listingId is required" });
        return;
      }

      const listing = db
        .select()
        .from(schema.listings)
        .where(eq(schema.listings.id, listingId))
        .get();

      if (!listing) {
        res.status(404).json({ success: false, error: "Listing not found" });
        return;
      }

      const buyer = db
        .select({ displayName: schema.users.displayName, email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, req.user!.userId))
        .get();

      const buyerName = buyer?.displayName || buyer?.email || "Buyer";

      const message = await generateInquiryMessage(
        listing.title,
        buyerName,
        question || undefined
      );

      // Save the inquiry message to the DB
      const msgId = generateId();
      db.insert(schema.messages)
        .values({
          id: msgId,
          senderId: req.user!.userId,
          receiverId: listing.sellerId,
          listingId,
          content: message,
          aiGenerated: true,
          createdAt: new Date().toISOString(),
        })
        .run();

      res.json({
        success: true,
        data: {
          messageId: msgId,
          message,
          sentTo: listing.sellerId,
        },
      });
    } catch (err) {
      console.error("Ask question error:", err);
      res.status(500).json({ success: false, error: "Failed to send question" });
    }
  }
);

// ── POST /respond ─────────────────────────────────────
router.post(
  "/respond",
  authenticate,
  authorize("seller"),
  async (req: Request, res: Response) => {
    try {
      const { inquiry, listingId } = req.body;

      if (!inquiry || !listingId) {
        res.status(400).json({
          success: false,
          error: "inquiry and listingId are required",
        });
        return;
      }

      const listing = db
        .select()
        .from(schema.listings)
        .where(eq(schema.listings.id, listingId))
        .get();

      if (!listing) {
        res.status(404).json({ success: false, error: "Listing not found" });
        return;
      }

      if (listing.sellerId !== req.user!.userId) {
        res.status(403).json({
          success: false,
          error: "You can only respond to inquiries about your own listings",
        });
        return;
      }

      const response = await generateResponseToInquiry(inquiry, {
        title: listing.title,
        price: listing.price,
        condition: listing.condition,
        description: listing.description,
      });

      res.json({
        success: true,
        data: { response },
      });
    } catch (err) {
      console.error("Respond error:", err);
      res.status(500).json({ success: false, error: "Failed to generate response" });
    }
  }
);

// ── POST /negotiate ────────────────────────────────────
router.post(
  "/negotiate",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { listingId, offerAmount } = req.body;

      if (!listingId || offerAmount === undefined) {
        res.status(400).json({
          success: false,
          error: "listingId and offerAmount are required",
        });
        return;
      }

      const listing = db
        .select()
        .from(schema.listings)
        .where(eq(schema.listings.id, listingId))
        .get();

      if (!listing) {
        res.status(404).json({ success: false, error: "Listing not found" });
        return;
      }

      if (listing.status !== "active") {
        res.status(400).json({
          success: false,
          error: "This listing is no longer active",
        });
        return;
      }

      const parsedOffer = parseFloat(offerAmount);
      if (isNaN(parsedOffer) || parsedOffer <= 0) {
        res.status(400).json({
          success: false,
          error: "Invalid offer amount",
        });
        return;
      }

      // Seller's min/max: use listing price as max, 60% as min by default
      const minPrice = listing.price * 0.6;
      const maxPrice = listing.price;

      const result = await suggestCounterOffer(
        listing.price,
        parsedOffer,
        minPrice,
        maxPrice
      );

      res.json({
        success: true,
        data: {
          suggestedPrice: result.suggestedPrice,
          message: result.message,
          originalPrice: listing.price,
          buyerOffer: parsedOffer,
          isAccepted: result.suggestedPrice === parsedOffer,
        },
      });
    } catch (err) {
      console.error("Negotiate error:", err);
      res.status(500).json({ success: false, error: "Failed to negotiate" });
    }
  }
);

// ── GET /inquiries ─────────────────────────────────────
router.get(
  "/inquiries",
  authenticate,
  authorize("seller"),
  (req: Request, res: Response) => {
    try {
      // Get all messages where seller is the receiver, grouped by listing
      const inquiries = db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.receiverId, req.user!.userId))
        .orderBy(
          // drizzle doesn't have desc as function-arg friendly
          // Use raw ordering: newest first
          eq(schema.messages.createdAt, schema.messages.createdAt)
        )
        .all();

      // Sort in JS for simplicity
      inquiries.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Enrich with sender and listing info
      const enriched = inquiries.map((msg) => {
        const sender = db
          .select({
            id: schema.users.id,
            email: schema.users.email,
            displayName: schema.users.displayName,
          })
          .from(schema.users)
          .where(eq(schema.users.id, msg.senderId))
          .get();

        const listing = msg.listingId
          ? db
              .select({
                id: schema.listings.id,
                title: schema.listings.title,
                price: schema.listings.price,
              })
              .from(schema.listings)
              .where(eq(schema.listings.id, msg.listingId))
              .get()
          : null;

        return {
          ...msg,
          sender: sender
            ? {
                id: sender.id,
                email: sender.email,
                displayName: sender.displayName,
              }
            : null,
          listing,
        };
      });

      res.json({
        success: true,
        data: enriched,
      });
    } catch (err) {
      console.error("Inquiries fetch error:", err);
      res.status(500).json({ success: false, error: "Failed to fetch inquiries" });
    }
  }
);

export default router;
