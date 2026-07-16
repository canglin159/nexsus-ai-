import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { generateId } from "../lib/utils.js";
import { eq } from "drizzle-orm";

const router = Router();

// ── POST /subscribe — public, store email for newsletter ──
router.post("/subscribe", (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      res.status(400).json({ success: false, error: "A valid email address is required" });
      return;
    }

    // Check if already subscribed
    const existing = db
      .select()
      .from(schema.marketingContacts)
      .where(eq(schema.marketingContacts.email, email.toLowerCase().trim()))
      .get();

    if (existing) {
      // If already subscribed, just confirm
      res.json({
        success: true,
        data: { message: "You're already subscribed to our newsletter!" },
      });
      return;
    }

    const now = new Date().toISOString();
    db.insert(schema.marketingContacts)
      .values({
        id: generateId(),
        email: email.toLowerCase().trim(),
        subscribed: true,
        createdAt: now,
      })
      .run();

    res.status(201).json({
      success: true,
      data: { message: "Successfully subscribed to the newsletter!" },
    });
  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ success: false, error: "Failed to subscribe" });
  }
});

// ── POST /contact — public, store support inquiry ──
router.post("/contact", (req: Request, res: Response) => {
  try {
    const { name, email, message } = req.body;

    if (!email || !message) {
      res.status(400).json({ success: false, error: "Email and message are required" });
      return;
    }

    const now = new Date().toISOString();
    db.insert(schema.supportInquiries)
      .values({
        id: generateId(),
        name: name || null,
        email: email.toLowerCase().trim(),
        message,
        createdAt: now,
      })
      .run();

    res.status(201).json({
      success: true,
      data: { message: "Thank you for your inquiry! We'll get back to you soon." },
    });
  } catch (err) {
    console.error("Contact error:", err);
    res.status(500).json({ success: false, error: "Failed to submit inquiry" });
  }
});

export default router;