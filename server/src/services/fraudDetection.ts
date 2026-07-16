import { db, schema } from "../db/index.js";
import { eq, and, gte, sql } from "drizzle-orm";
import { generateId } from "../lib/utils.js";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const isAiConfigured =
  OPENAI_API_KEY && OPENAI_API_KEY !== "sk-..." && OPENAI_API_KEY.length > 20;

// ── Category price averages (market reference data) ──────
const categoryPriceAverages: Record<string, number> = {
  electronics: 350,
  vehicles: 15000,
  collectibles: 200,
  equipment: 500,
  luxury_goods: 800,
  digital_assets: 120,
};

// ── Rule-based Scoring ───────────────────────────────────

export async function scoreListing(listingData: {
  title: string;
  description: string;
  price: number;
  category: string;
  sellerId: string;
}): Promise<number> {
  let score = 0;
  const reasons: string[] = [];

  // 1. Price significantly below market average
  const avgPrice = categoryPriceAverages[listingData.category] || 300;
  if (listingData.price < avgPrice * 0.3) {
    score += 0.3;
    reasons.push(
      `Price ($${listingData.price}) is significantly below market average ($${avgPrice})`
    );
  } else if (listingData.price < avgPrice * 0.5) {
    score += 0.15;
    reasons.push(`Price below 50% of market average`);
  }

  // 2. Title/description mismatch
  const titleLower = listingData.title.toLowerCase();
  const descLower = listingData.description.toLowerCase();

  // Detect common mismatches (e.g., "iPhone" in title but "charger" in description)
  const mismatchPatterns = [
    { title: ["iphone", "ipad", "macbook", "samsung"], desc: ["charger", "case", "cover", "screen protector"] },
    { title: ["car", "truck", "motorcycle", "vehicle"], desc: ["toy", "model", "miniature", "rc ", "remote"] },
    { title: ["rolex", "omega", "cartier"], desc: ["replica", "copy", "fake", "homage"] },
  ];

  for (const pattern of mismatchPatterns) {
    const titleMatch = pattern.title.some((t) => titleLower.includes(t));
    const descMatch = pattern.desc.some((d) => descLower.includes(d));
    if (titleMatch && descMatch) {
      score += 0.25;
      reasons.push("Potential title/description mismatch detected");
      break;
    }
  }

  // 3. Seller history checks
  const seller = db
    .select({
      id: schema.users.id,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, listingData.sellerId))
    .get();

  if (seller) {
    // Account very new (< 24h)
    const accountAge = Date.now() - new Date(seller.createdAt).getTime();
    if (accountAge < 24 * 60 * 60 * 1000) {
      score += 0.2;
      reasons.push("Seller account is less than 24 hours old");
    } else if (accountAge < 7 * 24 * 60 * 60 * 1000) {
      score += 0.1;
      reasons.push("Seller account is less than 7 days old");
    }

    // No prior sales
    const salesCount = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.sellerId, listingData.sellerId),
          eq(schema.transactions.status, "completed")
        )
      )
      .get();

    if (!salesCount || salesCount.count === 0) {
      score += 0.1;
      reasons.push("Seller has no prior completed sales");
    }
  }

  // 4. Similar listings from same seller
  const similarCount = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.listings)
    .where(
      and(
        eq(schema.listings.sellerId, listingData.sellerId),
        eq(schema.listings.category, listingData.category),
        eq(schema.listings.status, "active")
      )
    )
    .get();

  if (similarCount && similarCount.count > 5) {
    score += 0.15;
    reasons.push(`Seller has ${similarCount.count} similar active listings`);
  }

  // 5. AI-powered scam language detection
  if (isAiConfigured) {
    try {
      const prompt = `Analyze this marketplace listing for scam indicators. Look for: urgency/pressure tactics, too-good-to-be-true claims, suspicious payment instructions, requests to contact off-platform, grammatical patterns common in scams, unusual formatting, or deceptive language.

Title: "${listingData.title}"
Description: "${listingData.description}"
Category: ${listingData.category}
Price: $${listingData.price}

Rate the scam likelihood on a scale of 0.0 to 1.0, where 0 = completely safe, 1 = definitely a scam.
Return ONLY a JSON object: {"score": <number 0-1>, "reason": "<brief explanation>"}`;

      const { text } = await generateText({
        model: openai("gpt-4o-mini"),
        prompt,
        maxTokens: 150,
        temperature: 0.3,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const aiScore = Math.min(1, Math.max(0, Number(parsed.score) || 0));
        if (aiScore > 0.5) {
          score += aiScore * 0.4;
          reasons.push(`AI scam detection: ${parsed.reason || "suspicious patterns detected"}`);
        }
      }
    } catch (err) {
      console.error("AI fraud detection failed:", err);
    }
  }

  // Combine and cap
  const finalScore = Math.min(1, Math.round(score * 100) / 100);

  if (finalScore > 0 && reasons.length > 0) {
    console.log(`Fraud score for listing: ${finalScore} — ${reasons.join("; ")}`);
  }

  return finalScore;
}

export async function scoreUser(userData: {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  kycStatus: string;
  transactionCount: number;
}): Promise<number> {
  let score = 0;
  const reasons: string[] = [];

  // 1. New accounts with no KYC
  const accountAge = Date.now() - new Date(userData.createdAt).getTime();
  const hoursOld = accountAge / (60 * 60 * 1000);

  if (hoursOld < 24 && userData.kycStatus === "unverified") {
    score += 0.35;
    reasons.push("Brand new account with no KYC verification");
  } else if (hoursOld < 168 && userData.kycStatus === "unverified") {
    score += 0.2;
    reasons.push("Account less than 7 days old without KYC");
  } else if (userData.kycStatus === "unverified" && userData.transactionCount > 3) {
    score += 0.15;
    reasons.push("Multiple transactions without KYC verification");
  }

  // 2. Multiple failed transactions
  const failedTx = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.buyerId, userData.id),
        eq(schema.transactions.status, "cancelled")
      )
    )
    .get();

  const failedCount = failedTx?.count || 0;
  if (failedCount > 5) {
    score += 0.3;
    reasons.push(`${failedCount} cancelled transactions`);
  } else if (failedCount > 2) {
    score += 0.15;
    reasons.push(`${failedCount} cancelled transactions`);
  }

  // 3. Rapid listing creation (>5 per hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentListings = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.listings)
    .where(
      and(
        eq(schema.listings.sellerId, userData.id),
        gte(schema.listings.createdAt, oneHourAgo)
      )
    )
    .get();

  if (recentListings && recentListings.count > 10) {
    score += 0.4;
    reasons.push(`${recentListings.count} listings created in the last hour (excessive)`);
  } else if (recentListings && recentListings.count > 5) {
    score += 0.25;
    reasons.push(`${recentListings.count} listings created in the last hour`);
  }

  // 4. Disputed transactions
  const disputedTx = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.sellerId, userData.id),
        eq(schema.transactions.status, "disputed")
      )
    )
    .get();

  if (disputedTx && disputedTx.count > 2) {
    score += 0.3;
    reasons.push(`${disputedTx.count} disputed transactions`);
  }

  const finalScore = Math.min(1, Math.round(score * 100) / 100);
  if (finalScore > 0 && reasons.length > 0) {
    console.log(`Fraud score for user ${userData.email}: ${finalScore} — ${reasons.join("; ")}`);
  }
  return finalScore;
}

export async function scoreTransaction(transactionData: {
  amount: number;
  buyerId: string;
  sellerId: string;
  listingId: string;
}): Promise<number> {
  let score = 0;
  const reasons: string[] = [];

  // 1. Very high value transactions without KYC
  const buyer = db
    .select({
      kycStatus: schema.users.kycStatus,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, transactionData.buyerId))
    .get();

  if (transactionData.amount > 5000 && buyer && buyer.kycStatus === "unverified") {
    score += 0.35;
    reasons.push("High-value transaction ($" + transactionData.amount + ") with unverified buyer");
  } else if (transactionData.amount > 2000 && buyer && buyer.kycStatus === "unverified") {
    score += 0.2;
    reasons.push("Medium-high value transaction without KYC");
  }

  // 2. Buyer-seller interactions across unusual categories
  const buyerCategories = db
    .select({ category: schema.listings.category })
    .from(schema.transactions)
    .innerJoin(schema.listings, eq(schema.transactions.listingId, schema.listings.id))
    .where(eq(schema.transactions.buyerId, transactionData.buyerId))
    .all();

  const sellerCategories = db
    .select({ category: schema.listings.category })
    .from(schema.listings)
    .where(eq(schema.listings.sellerId, transactionData.sellerId))
    .all();

  const buyerCats = new Set(buyerCategories.map((c) => c.category));
  const sellerCats = new Set(sellerCategories.map((c) => c.category));

  // If buyer typically buys in X and seller sells in Y with no overlap
  if (buyerCats.size > 0 && sellerCats.size > 0) {
    const overlap = [...buyerCats].filter((c) => sellerCats.has(c));
    if (overlap.length === 0) {
      score += 0.15;
      reasons.push("Buyer and seller have no overlapping category history");
    }
  }

  // 3. Rush/pressure indicators via messages
  // Check recent messages between buyer and seller
  const recentMessages = db
    .select({ content: schema.messages.content })
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.senderId, transactionData.sellerId),
        eq(schema.messages.receiverId, transactionData.buyerId),
        gte(schema.messages.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      )
    )
    .all();

  const urgencyPhrases = [
    "act now",
    "limited time",
    "only today",
    "going fast",
    "won't last",
    "final hours",
    "before it's gone",
    "don't miss out",
    "urgent",
    "asap",
    "hurry",
    "last chance",
  ];

  let urgencyCount = 0;
  for (const msg of recentMessages) {
    const lower = msg.content.toLowerCase();
    for (const phrase of urgencyPhrases) {
      if (lower.includes(phrase)) {
        urgencyCount++;
        break;
      }
    }
  }

  if (urgencyCount >= 3) {
    score += 0.25;
    reasons.push("Multiple urgency/pressure indicators in seller messages");
  } else if (urgencyCount > 0) {
    score += 0.1;
    reasons.push("Urgency indicators detected in seller messages");
  }

  // 4. Same buyer-seller repeated transactions in short time (collusion/circle)
  const recentTxBetween = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.buyerId, transactionData.buyerId),
        eq(schema.transactions.sellerId, transactionData.sellerId),
        gte(
          schema.transactions.createdAt,
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        )
      )
    )
    .get();

  if (recentTxBetween && recentTxBetween.count > 3) {
    score += 0.2;
    reasons.push("Multiple transactions between same buyer and seller in 7 days");
  }

  const finalScore = Math.min(1, Math.round(score * 100) / 100);
  if (finalScore > 0 && reasons.length > 0) {
    console.log(`Fraud score for transaction: ${finalScore} — ${reasons.join("; ")}`);
  }
  return finalScore;
}

// ── Flag Writing ──────────────────────────────────────────

export function autoFlag(
  targetType: "listing" | "user" | "transaction",
  targetId: string,
  score: number,
  reason: string
): void {
  try {
    db.insert(schema.fraudFlags)
      .values({
        id: generateId(),
        targetType,
        targetId,
        riskScore: Math.round(score * 100) / 100,
        reason: reason || `Risk score: ${score}`,
        resolved: false,
        createdAt: new Date().toISOString(),
      })
      .run();
    console.log(`🚩 Fraud flag: ${targetType} ${targetId} — score ${score}`);
  } catch (err) {
    console.error("Failed to write fraud flag:", err);
  }
}

// ── Orchestrated Checks ───────────────────────────────────

export async function runListingChecks(listingId: string): Promise<number> {
  try {
    const listing = db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, listingId))
      .get();

    if (!listing) return 0;

    const score = await scoreListing({
      title: listing.title,
      description: listing.description,
      price: listing.price,
      category: listing.category,
      sellerId: listing.sellerId,
    });

    if (score > 0.7) {
      autoFlag("listing", listingId, score, `Auto-flagged: risk score ${score} exceeds threshold`);
    } else if (score > 0.4) {
      autoFlag("listing", listingId, score, `Suspicious listing patterns detected (score: ${score})`);
    }

    return score;
  } catch (err) {
    console.error("runListingChecks error:", err);
    return 0;
  }
}

export async function runUserChecks(userId: string): Promise<number> {
  try {
    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get();

    if (!user) return 0;

    const txCount = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.buyerId, userId))
      .get();

    const score = await scoreUser({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      kycStatus: user.kycStatus,
      transactionCount: txCount?.count || 0,
    });

    if (score > 0.7) {
      autoFlag("user", userId, score, `Auto-flagged: risk score ${score} exceeds threshold`);
    } else if (score > 0.4) {
      autoFlag("user", userId, score, `Suspicious user patterns detected (score: ${score})`);
    }

    return score;
  } catch (err) {
    console.error("runUserChecks error:", err);
    return 0;
  }
}

export async function runTransactionChecks(transactionId: string): Promise<number> {
  try {
    const transaction = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .get();

    if (!transaction) return 0;

    const score = await scoreTransaction({
      amount: transaction.amount,
      buyerId: transaction.buyerId,
      sellerId: transaction.sellerId,
      listingId: transaction.listingId,
    });

    if (score > 0.7) {
      autoFlag(
        "transaction",
        transactionId,
        score,
        `Auto-flagged: risk score ${score} exceeds threshold`
      );
    } else if (score > 0.4) {
      autoFlag(
        "transaction",
        transactionId,
        score,
        `Suspicious transaction patterns detected (score: ${score})`
      );
    }

    return score;
  } catch (err) {
    console.error("runTransactionChecks error:", err);
    return 0;
  }
}
