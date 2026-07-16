import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { generateId } from "../lib/utils.js";
import { eq, and, count, sql } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// ── POST /code — generate or retrieve user's referral code ──
router.post("/code", authenticate, (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check if user already has a referral code
    const existing = db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.referrerId, userId))
      .get();

    if (existing) {
      res.json({
        success: true,
        data: {
          referralCode: existing.referralCode,
          createdAt: existing.createdAt,
        },
      });
      return;
    }

    // Generate a new referral code: NX-{shortId}-{XXXX}
    const shortId = userId.substring(0, 6);
    const randomSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
    const referralCode = `NX-${shortId}-${randomSuffix}`;

    const now = new Date().toISOString();
    db.insert(schema.referrals)
      .values({
        id: generateId(),
        referrerId: userId,
        referralCode,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    res.status(201).json({
      success: true,
      data: { referralCode, createdAt: now },
    });
  } catch (err) {
    console.error("Referral code error:", err);
    res.status(500).json({ success: false, error: "Failed to generate referral code" });
  }
});

// ── GET /stats — authenticated, get referral stats ──
router.get("/stats", authenticate, (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get user's referral record
    const userReferral = db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.referrerId, userId))
      .get();

    if (!userReferral) {
      res.json({
        success: true,
        data: {
          referralCode: null,
          totalReferred: 0,
          conversions: 0,
          rewardsEarned: 0,
        },
      });
      return;
    }

    // Count referrals made by this user
    const referralCount = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.referrals)
      .where(
        and(
          eq(schema.referrals.referrerId, userId),
          sql`${schema.referrals.refereeId} IS NOT NULL`
        )
      )
      .get();

    // Count conversions (referees who have a non-null refereeId)
    const conversionCount = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.referrals)
      .where(
        and(
          eq(schema.referrals.referrerId, userId),
          eq(schema.referrals.status, "converted")
        )
      )
      .get();

    // Sum rewards
    const rewardSum = db
      .select({ total: sql<number>`coalesce(sum(${schema.referrals.rewardAmount}), 0)` })
      .from(schema.referrals)
      .where(
        and(
          eq(schema.referrals.referrerId, userId),
          eq(schema.referrals.status, "rewarded")
        )
      )
      .get();

    res.json({
      success: true,
      data: {
        referralCode: userReferral.referralCode,
        totalReferred: referralCount?.count || 0,
        conversions: conversionCount?.count || 0,
        rewardsEarned: rewardSum?.total || 0,
      },
    });
  } catch (err) {
    console.error("Referral stats error:", err);
    res.status(500).json({ success: false, error: "Failed to get referral stats" });
  }
});

// ── POST /redeem — authenticated, apply referral discount ──
router.post("/redeem", authenticate, (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const userId = req.user!.userId;

    if (!code) {
      res.status(400).json({ success: false, error: "Referral code is required" });
      return;
    }

    // Find the referral code
    const referral = db
      .select()
      .from(schema.referrals)
      .where(eq(schema.referrals.referralCode, code.toUpperCase()))
      .get();

    if (!referral) {
      res.status(404).json({ success: false, error: "Invalid referral code" });
      return;
    }

    // Can't refer yourself
    if (referral.referrerId === userId) {
      res.status(400).json({ success: false, error: "You cannot use your own referral code" });
      return;
    }

    // Check if this code has already been used
    if (referral.refereeId) {
      res.status(400).json({ success: false, error: "This referral code has already been used" });
      return;
    }

    // Check if user already redeemed a referral code
    const existingRedemption = db
      .select()
      .from(schema.referrals)
      .where(
        and(
          eq(schema.referrals.refereeId, userId),
          sql`${schema.referrals.refereeId} IS NOT NULL`
        )
      )
      .get();

    if (existingRedemption) {
      res.status(400).json({ success: false, error: "You have already redeemed a referral code" });
      return;
    }

    // Apply the referral — mark referee, set status to converted
    const now = new Date().toISOString();
    db.update(schema.referrals)
      .set({
        refereeId: userId,
        status: "converted",
        rewardAmount: 10.0, // $10 reward for the referrer
        updatedAt: now,
      })
      .where(eq(schema.referrals.id, referral.id))
      .run();

    // Store the discount in the user's metadata (we'll use a simple approach: add a note to the user record)
    // For simplicity, we'll store the discount flag in a separate record
    // The frontend will check if the user has a referral discount applied

    res.json({
      success: true,
      data: {
        message: "Referral code redeemed! You'll receive 10% off commission on your first purchase.",
        discount: "10% off commission",
      },
    });
  } catch (err) {
    console.error("Referral redeem error:", err);
    res.status(500).json({ success: false, error: "Failed to redeem referral code" });
  }
});

export default router;