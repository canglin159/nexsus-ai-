import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ── FAQ Data ────────────────────────────────────────────────
const faqs = [
  {
    question: "How does escrow work?",
    answer:
      "When you purchase an item, funds are held in escrow by Nexus Exchange. Once the seller ships the item and you confirm delivery, the funds are released to the seller minus our commission fee. This protects both buyers and sellers.",
  },
  {
    question: "What is the commission fee?",
    answer:
      "Commission rates vary by category. Default rate is 8% of the transaction amount. Electronics are 8%, Vehicles are 5%, Collectibles are 10%, and other categories may vary. You can see the exact rate before completing a purchase.",
  },
  {
    question: "How do I request a refund?",
    answer:
      "If you need a refund, first contact the seller through the platform to resolve the issue. If you can't reach an agreement, you can open a dispute from your purchases dashboard. An admin will review the case and decide on releasing funds or issuing a refund.",
  },
  {
    question: "How does shipping work?",
    answer:
      "Sellers can specify their shipping options when creating a listing — including local pickup and shipping with costs. After purchase, the seller marks the item as shipped and provides tracking info. Once you receive the item, confirm delivery to release funds.",
  },
  {
    question: "How do I create a listing?",
    answer:
      "Navigate to your Seller Dashboard and click 'Create Listing'. Fill in the details including title, description, price, category, and condition. You can use our AI Enhancement tool to generate optimized titles and descriptions automatically.",
  },
  {
    question: "How do I dispute a transaction?",
    answer:
      "Go to your purchases dashboard and find the transaction. If the status is 'Escrow Held' or later, you can open a dispute. Provide details about the issue and an admin will review your case.",
  },
  {
    question: "How do I reset my password?",
    answer:
      "On the login page, click 'Forgot Password' and enter your email address. We'll send you a link to reset your password. If you don't receive the email, check your spam folder.",
  },
  {
    question: "What payment methods are accepted?",
    answer:
      "We accept all major credit and debit cards through Stripe. Payments are processed securely and held in escrow until the transaction is completed successfully.",
  },
  {
    question: "How do I become a seller?",
    answer:
      "Register for an account and select the 'Seller' role during signup. Complete KYC (Know Your Customer) verification by submitting your identification documents. Once verified, you can start listing items immediately.",
  },
  {
    question: "How are disputes resolved?",
    answer:
      "When a dispute is opened, an admin reviews the transaction details, messages, and any evidence provided. The admin can either release the funds to the seller or issue a full refund to the buyer.",
  },
];

// ── GET /faq ────────────────────────────────────────────────
router.get("/faq", (_req: Request, res: Response) => {
  res.json({ success: true, data: faqs });
});

// ── POST /chat ───────────────────────────────────────────────
router.post("/chat", optionalAuth, (req: Request, res: Response) => {
  try {
    const { message, transactionId } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ success: false, error: "Message is required" });
      return;
    }

    const userMessage = message.trim().toLowerCase();
    let response = "";

    // If transactionId provided and user is authenticated, fetch transaction context
    let transactionContext = "";
    if (transactionId && req.user) {
      const tx = db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, transactionId))
        .get();

      if (tx && (tx.buyerId === req.user.userId || tx.sellerId === req.user.userId)) {
        const listing = db
          .select({ title: schema.listings.title })
          .from(schema.listings)
          .where(eq(schema.listings.id, tx.listingId))
          .get();

        transactionContext = `Regarding transaction $${tx.amount.toFixed(2)} for "${listing?.title || "item"}" (Status: ${tx.status}). `;
      }
    }

    // ── Rule-based FAQ matching ──────────────────────────
    const keywords: Record<string, string> = {
      refund: "To request a refund, first contact the seller through the platform. If you can't resolve the issue, open a dispute from your purchases dashboard and an admin will review your case.",
      "return": "Returns are handled between buyer and seller. Please contact the seller to arrange a return. If you can't reach an agreement, open a dispute from your purchases dashboard.",
      shipping: "Shipping is arranged between buyer and seller. The seller marks the item as shipped and provides tracking information. Once you receive the item, confirm delivery in your purchases dashboard to release funds from escrow.",
      ship: "Shipping is arranged between buyer and seller. The seller marks the item as shipped and provides tracking information. Once you receive the item, confirm delivery in your purchases dashboard to release funds from escrow.",
      escrow: "Funds are held securely in escrow until you confirm delivery of the item. This protects both buyers and sellers. Once delivery is confirmed, funds are released to the seller minus the commission fee.",
      commission: "Commission rates vary by category. The default rate is 8%. Electronics are 8%, Vehicles are 5%, Collectibles are 10%. You'll see the exact fee before completing any transaction.",
      fee: "Commission rates vary by category. The default rate is 8%. Electronics are 8%, Vehicles are 5%, Collectibles are 10%. You'll see the exact fee before completing any transaction.",
      account: "You can manage your account settings from your dashboard. If you need to update your email or password, please visit the settings section. For seller accounts, KYC verification may be required.",
      password: "Go to the login page and click 'Forgot Password' to reset your password. You'll receive a reset link via email.",
      login: "Go to the login page and click 'Forgot Password' if you've forgotten your credentials. New users can register for a free account.",
      listing: "To create a listing, go to your Seller Dashboard and click 'Create Listing'. Fill in the details and use our AI Enhancement tool to optimize your listing automatically.",
      "sell": "To sell on Nexus Exchange, register as a seller and complete KYC verification. Once approved, you can create listings and start selling immediately.",
      "buy": "Browse listings on the marketplace, view details, and click 'Buy Now' to purchase. Funds are held in escrow until you confirm receipt of the item.",
      "payment": "We accept credit and debit cards through Stripe. All payments are processed securely and held in escrow until transaction completion.",
      "stripe": "We use Stripe to process payments securely. Your payment information is handled by Stripe's secure infrastructure.",
      "dispute": "Open a dispute from your purchases dashboard if you have an issue with a transaction. An admin will review your case and decide on releasing funds or issuing a refund.",
      "tracking": "After a seller marks an item as shipped, tracking information will appear in your purchases dashboard. You can view the carrier and tracking number there.",
      "track": "After a seller marks an item as shipped, tracking information will appear in your purchases dashboard. You can view the carrier and tracking number there.",
      "hello": "Welcome to Nexus Exchange! I'm here to answer your questions about buying, selling, escrow, shipping, and more. How can I help you today?",
      "hi": "Welcome to Nexus Exchange! I'm here to answer your questions about buying, selling, escrow, shipping, and more. How can I help you today?",
      "help": "I'm the Nexus Exchange support assistant. I can answer questions about escrow, payments, shipping, listings, disputes, and more. What would you like to know?",
    };

    // Check for keyword matches
    const matchedKeywords = Object.keys(keywords).filter((k) => userMessage.includes(k));

    if (matchedKeywords.length > 0) {
      // Return the response for the best matching keyword (first one found)
      response = keywords[matchedKeywords[0]];
    } else if (userMessage.includes("thank")) {
      response = "You're welcome! If you have any other questions, feel free to ask. Happy trading on Nexus Exchange! 😊";
    } else if (userMessage.includes("bye") || userMessage.includes("goodbye")) {
      response = "Goodbye! Thanks for using Nexus Exchange. If you need help later, just start a new chat. Have a great day! 😊";
    } else {
      response =
        "I'm not sure I understand your question. I can help with topics like escrow, payments, shipping, listings, refunds, disputes, and account settings. Try asking something like 'How does escrow work?' or 'What is the commission fee?'";
    }

    // Prepend transaction context if available
    const fullResponse = transactionContext
      ? `${transactionContext}${response}`
      : response;

    // Get user greeting
    const greeting = !req.user
      ? "Welcome to Nexus Exchange! How can I help you today? "
      : "";

    res.json({
      success: true,
      data: {
        response: greeting + fullResponse,
        matchedKeyword: matchedKeywords.length > 0 ? matchedKeywords[0] : null,
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ success: false, error: "Failed to process chat message" });
  }
});

export default router;
