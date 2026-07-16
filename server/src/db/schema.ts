import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Users ──────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["buyer", "seller", "admin"] })
    .notNull()
    .default("buyer"),
  kycStatus: text("kyc_status", {
    enum: ["unverified", "pending", "verified", "rejected"],
  })
    .notNull()
    .default("unverified"),
  mfaSecret: text("mfa_secret"),
  mfaEnabled: integer("mfa_enabled", { mode: "boolean" }).default(false),
  stripeAccountId: text("stripe_account_id"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Listings ───────────────────────────────────────────
export const listings = sqliteTable("listings", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  condition: text("condition", {
    enum: ["new", "like_new", "good", "fair", "poor"],
  }).notNull(),
  price: real("price").notNull(),
  currency: text("currency").notNull().default("USD"),
  location: text("location"),
  status: text("status", {
    enum: ["draft", "active", "sold", "archived"],
  })
    .notNull()
    .default("draft"),
  images: text("images", { mode: "json" }).$type<string[]>().default([]),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Transactions ───────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  listingId: text("listing_id")
    .notNull()
    .references(() => listings.id),
  buyerId: text("buyer_id")
    .notNull()
    .references(() => users.id),
  sellerId: text("seller_id")
    .notNull()
    .references(() => users.id),
  amount: real("amount").notNull(),
  commission: real("commission").notNull(),
  commissionRate: real("commission_rate").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status", {
    enum: [
      "pending",
      "escrow_held",
      "shipped",
      "delivered",
      "completed",
      "disputed",
      "refunded",
      "cancelled",
    ],
  })
    .notNull()
    .default("pending"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Escrow Events ──────────────────────────────────────
export const escrowEvents = sqliteTable("escrow_events", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => transactions.id),
  eventType: text("event_type").notNull(),
  amount: real("amount"),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Messages ───────────────────────────────────────────
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  senderId: text("sender_id")
    .notNull()
    .references(() => users.id),
  receiverId: text("receiver_id")
    .notNull()
    .references(() => users.id),
  listingId: text("listing_id").references(() => listings.id),
  content: text("content").notNull(),
  aiGenerated: integer("ai_generated", { mode: "boolean" }).default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Reviews ────────────────────────────────────────────
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => transactions.id),
  reviewerId: text("reviewer_id")
    .notNull()
    .references(() => users.id),
  rating: integer("rating").notNull(),
  content: text("content"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Referrals ──────────────────────────────────────────
export const referrals = sqliteTable("referrals", {
  id: text("id").primaryKey(),
  referralCode: text("referral_code").notNull().unique(),
  referrerId: text("referrer_id")
    .notNull()
    .references(() => users.id),
  refereeId: text("referee_id")
    .references(() => users.id),
  status: text("status", { enum: ["pending", "converted", "rewarded"] })
    .notNull()
    .default("pending"),
  rewardAmount: real("reward_amount").default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Marketing Contacts ─────────────────────────────────
export const marketingContacts = sqliteTable("marketing_contacts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  subscribed: integer("subscribed", { mode: "boolean" }).default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Support Inquiries ──────────────────────────────────
export const supportInquiries = sqliteTable("support_inquiries", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Fraud Flags ────────────────────────────────────────
export const fraudFlags = sqliteTable("fraud_flags", {
  id: text("id").primaryKey(),
  targetType: text("target_type", {
    enum: ["listing", "user", "transaction"],
  }).notNull(),
  targetId: text("target_id").notNull(),
  riskScore: real("risk_score").notNull(),
  reason: text("reason"),
  resolved: integer("resolved", { mode: "boolean" }).default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Prospects (Outreach CRM) ──────────────────────────
export const prospects = sqliteTable("prospects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform", {
    enum: ["reddit", "facebook", "discord", "craigslist", "other"],
  }).notNull(),
  contactIdentifier: text("contact_identifier").notNull(),
  notes: text("notes"),
  status: text("status", {
    enum: ["new", "contacted", "responded", "interested", "not_interested", "converted"],
  }).notNull().default("new"),
  assignedTo: text("assigned_to").references(() => users.id),
  lastContactedAt: text("last_contacted_at"),
  nextFollowUpAt: text("next_follow_up_at"),
  source: text("source"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ── Outreach Messages ────────────────────────────────
export const outreachMessages = sqliteTable("outreach_messages", {
  id: text("id").primaryKey(),
  prospectId: text("prospect_id")
    .notNull()
    .references(() => prospects.id),
  content: text("content").notNull(),
  platform: text("platform", {
    enum: ["reddit", "facebook", "discord", "craigslist", "other"],
  }).notNull(),
  sentAt: text("sent_at"),
  responseReceived: integer("response_received", { mode: "boolean" }).default(false),
  responseContent: text("response_content"),
  status: text("status", {
    enum: ["pending", "sent", "failed"],
  }).notNull().default("pending"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
