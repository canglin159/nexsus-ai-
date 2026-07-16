import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { generateId } from "../lib/utils.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { eq, and, like, desc, sql, count } from "drizzle-orm";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const router = Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const isAiConfigured =
  OPENAI_API_KEY && OPENAI_API_KEY !== "sk-..." && OPENAI_API_KEY.length > 20;

// All routes require admin auth
router.use(authenticate, authorize("admin"));

// ── POST /api/prospects — Add new prospect ─────────────
router.post("/", (req: Request, res: Response) => {
  try {
    const { name, platform, contactIdentifier, notes, source } = req.body;

    if (!name || !platform || !contactIdentifier) {
      res.status(400).json({
        success: false,
        error: "name, platform, and contactIdentifier are required",
      });
      return;
    }

    const validPlatforms = ["reddit", "facebook", "discord", "craigslist", "other"];
    if (!validPlatforms.includes(platform)) {
      res.status(400).json({
        success: false,
        error: `Invalid platform. Must be one of: ${validPlatforms.join(", ")}`,
      });
      return;
    }

    const now = new Date().toISOString();
    const id = generateId();
    db.insert(schema.prospects)
      .values({
        id,
        name,
        platform,
        contactIdentifier,
        notes: notes || null,
        source: source || null,
        status: "new",
        assignedTo: req.user!.userId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const prospect = db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, id))
      .get();

    res.status(201).json({ success: true, data: prospect });
  } catch (err) {
    console.error("Create prospect error:", err);
    res.status(500).json({ success: false, error: "Failed to create prospect" });
  }
});

// ── GET /api/prospects — List prospects (paginated, filterable) ──
router.get("/", (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    const statusFilter = req.query.status as string | undefined;
    const platformFilter = req.query.platform as string | undefined;
    const search = req.query.search as string | undefined;

    let conditions = [];

    if (statusFilter && ["new", "contacted", "responded", "interested", "not_interested", "converted"].includes(statusFilter)) {
      conditions.push(eq(schema.prospects.status, statusFilter as any));
    }
    if (platformFilter && ["reddit", "facebook", "discord", "craigslist", "other"].includes(platformFilter)) {
      conditions.push(eq(schema.prospects.platform, platformFilter as any));
    }
    if (search) {
      conditions.push(
        sql`(${schema.prospects.name} LIKE ${`%${search}%`} OR ${schema.prospects.contactIdentifier} LIKE ${`%${search}%`})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const total = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.prospects)
      .where(whereClause)
      .get();

    const prospects = db
      .select()
      .from(schema.prospects)
      .where(whereClause)
      .orderBy(desc(schema.prospects.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const totalCount = total?.count || 0;

    res.json({
      success: true,
      data: prospects,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    console.error("List prospects error:", err);
    res.status(500).json({ success: false, error: "Failed to list prospects" });
  }
});

// ── GET /api/prospects/stats — Pipeline stats ──────────
router.get("/stats", (req: Request, res: Response) => {
  try {
    const total = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.prospects)
      .get();

    const byStatus = db
      .select({
        status: schema.prospects.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.prospects)
      .groupBy(schema.prospects.status)
      .all();

    const byPlatform = db
      .select({
        platform: schema.prospects.platform,
        count: sql<number>`count(*)`,
      })
      .from(schema.prospects)
      .groupBy(schema.prospects.platform)
      .all();

    const today = new Date().toISOString().split("T")[0];
    const contactedToday = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.prospects)
      .where(
        and(
          sql`date(${schema.prospects.lastContactedAt}) = ${today}`
        )
      )
      .get();

    const totalResponded = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.prospects)
      .where(
        sql`${schema.prospects.status} IN ('responded', 'interested', 'converted')`
      )
      .get();

    const totalContacted = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.prospects)
      .where(
        sql`${schema.prospects.status} != 'new'`
      )
      .get();

    const totalCount = total?.count || 0;
    const contactedCount = totalContacted?.count || 0;
    const respondedCount = totalResponded?.count || 0;
    const responseRate = contactedCount > 0
      ? Math.round((respondedCount / contactedCount) * 100)
      : 0;

    const conversions = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.prospects)
      .where(eq(schema.prospects.status, "converted"))
      .get();

    res.json({
      success: true,
      data: {
        total: totalCount,
        byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s.count }), {} as Record<string, number>),
        byPlatform: byPlatform.reduce((acc, p) => ({ ...acc, [p.platform]: p.count }), {} as Record<string, number>),
        contactedToday: contactedToday?.count || 0,
        responseRate,
        conversions: conversions?.count || 0,
        contacted: contactedCount,
        responded: respondedCount,
      },
    });
  } catch (err) {
    console.error("Prospect stats error:", err);
    res.status(500).json({ success: false, error: "Failed to get prospect stats" });
  }
});

// ── GET /api/prospects/:id — Get prospect detail ───────
router.get("/:id", (req: Request, res: Response) => {
  try {
    const prospect = db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, req.params.id))
      .get();

    if (!prospect) {
      res.status(404).json({ success: false, error: "Prospect not found" });
      return;
    }

    // Get message history
    const messages = db
      .select()
      .from(schema.outreachMessages)
      .where(eq(schema.outreachMessages.prospectId, req.params.id))
      .orderBy(desc(schema.outreachMessages.createdAt))
      .all();

    res.json({
      success: true,
      data: { ...prospect, messages },
    });
  } catch (err) {
    console.error("Get prospect error:", err);
    res.status(500).json({ success: false, error: "Failed to get prospect" });
  }
});

// ── PUT /api/prospects/:id — Update prospect ───────────
router.put("/:id", (req: Request, res: Response) => {
  try {
    const existing = db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, req.params.id))
      .get();

    if (!existing) {
      res.status(404).json({ success: false, error: "Prospect not found" });
      return;
    }

    const { status, notes, nextFollowUpAt, name, contactIdentifier, platform, source } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (status !== undefined) {
      const validStatuses = ["new", "contacted", "responded", "interested", "not_interested", "converted"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
        return;
      }
      updates.status = status;
    }
    if (notes !== undefined) updates.notes = notes;
    if (nextFollowUpAt !== undefined) updates.nextFollowUpAt = nextFollowUpAt;
    if (name !== undefined) updates.name = name;
    if (contactIdentifier !== undefined) updates.contactIdentifier = contactIdentifier;
    if (platform !== undefined) {
      const validPlatforms = ["reddit", "facebook", "discord", "craigslist", "other"];
      if (!validPlatforms.includes(platform)) {
        res.status(400).json({ success: false, error: `Invalid platform. Must be one of: ${validPlatforms.join(", ")}` });
        return;
      }
      updates.platform = platform;
    }
    if (source !== undefined) updates.source = source;

    db.update(schema.prospects)
      .set(updates)
      .where(eq(schema.prospects.id, req.params.id))
      .run();

    const updated = db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, req.params.id))
      .get();

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Update prospect error:", err);
    res.status(500).json({ success: false, error: "Failed to update prospect" });
  }
});

// ── DELETE /api/prospects/:id — Delete prospect ────────
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const existing = db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, req.params.id))
      .get();

    if (!existing) {
      res.status(404).json({ success: false, error: "Prospect not found" });
      return;
    }

    // Delete associated outreach messages first
    db.delete(schema.outreachMessages)
      .where(eq(schema.outreachMessages.prospectId, req.params.id))
      .run();

    db.delete(schema.prospects)
      .where(eq(schema.prospects.id, req.params.id))
      .run();

    res.json({ success: true, data: { message: "Prospect deleted" } });
  } catch (err) {
    console.error("Delete prospect error:", err);
    res.status(500).json({ success: false, error: "Failed to delete prospect" });
  }
});

// ── POST /api/prospects/:id/generate-message ───────────
router.post("/:id/generate-message", async (req: Request, res: Response) => {
  try {
    const prospect = db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, req.params.id))
      .get();

    if (!prospect) {
      res.status(404).json({ success: false, error: "Prospect not found" });
      return;
    }

    const { context } = req.body;

    if (!isAiConfigured) {
      // Fallback messages based on platform
      const fallbacks: Record<string, string> = {
        reddit: `Hey ${prospect.name}! 👋 I saw your posts and think you'd be a great fit for Nexus Exchange — an AI marketplace that handles listings, negotiations, and escrow automatically. 8% commission only when it sells. Worth a look? https://nexusexchange.app`,
        facebook: `Hey ${prospect.name}! 👋 Noticed you're active in the reselling community. Nexus Exchange is an AI-powered marketplace that does all the selling work for you — AI writes listings, finds buyers, negotiates, and escrows payments. 8% fee only on sales. Check it out: https://nexusexchange.app`,
        discord: `Hey ${prospect.name}! Quick question — have you tried Nexus Exchange yet? It's an AI marketplace that handles everything: listings, matching, negotiation, and escrow. 8% fee only when it sells. Free to list. https://nexusexchange.app`,
        craigslist: `Hi ${prospect.name}, I came across your listing and wanted to share Nexus Exchange — an AI-powered marketplace. AI handles listings, buyer matching, negotiation, and escrow payments. 8% commission on completed sales. No listing fees. https://nexusexchange.app`,
        other: `Hi ${prospect.name}! Check out Nexus Exchange — an AI marketplace that automates the entire selling process. AI handles listings, finds buyers, negotiates prices, and manages escrow payments. 8% commission only on completed sales. https://nexusexchange.app`,
      };
      res.json({
        success: true,
        data: { message: fallbacks[prospect.platform] || fallbacks.other },
      });
      return;
    }

    try {
      const prompt = `You are a sales closer for Nexus Exchange, an AI marketplace brokerage. Generate a short, personalized outreach message for ${prospect.platform} based on:
- Prospect name: ${prospect.name}
- Notes: ${prospect.notes || "No additional context"}
- Our platform: 8% commission, AI handles listings/negotiation/escrow
${context ? `- Extra context: ${context}` : ""}

Keep it under 200 characters for DMs. Make it sound natural for the platform (${prospect.platform}). Return ONLY the message text, nothing else.`;

      const { text } = await generateText({
        model: openai("gpt-4o-mini"),
        prompt,
        maxTokens: 200,
        temperature: 0.7,
      });

      res.json({
        success: true,
        data: { message: text.trim().replace(/^["']|["']$/g, "") },
      });
    } catch (aiErr) {
      console.error("AI message generation failed, using fallback:", aiErr);
      const fallbacks: Record<string, string> = {
        reddit: `Hey ${prospect.name}! 👋 I saw your posts and think you'd be a great fit for Nexus Exchange — an AI marketplace that handles listings, negotiations, and escrow automatically. 8% commission only when it sells. Worth a look? https://nexusexchange.app`,
        facebook: `Hey ${prospect.name}! 👋 Noticed you're active in the reselling community. Nexus Exchange is an AI-powered marketplace that does all the selling work for you. 8% fee only on sales. Check it out: https://nexusexchange.app`,
        discord: `Hey ${prospect.name}! Quick question — have you tried Nexus Exchange yet? It's an AI marketplace that handles everything. 8% fee only when it sells. Free to list. https://nexusexchange.app`,
        craigslist: `Hi ${prospect.name}, I came across your listing and wanted to share Nexus Exchange — an AI-powered marketplace. 8% commission on completed sales. No listing fees. https://nexusexchange.app`,
        other: `Hi ${prospect.name}! Check out Nexus Exchange — an AI marketplace that automates the entire selling process. 8% commission only on completed sales. https://nexusexchange.app`,
      };
      res.json({
        success: true,
        data: { message: fallbacks[prospect.platform] || fallbacks.other },
      });
    }
  } catch (err) {
    console.error("Generate message error:", err);
    res.status(500).json({ success: false, error: "Failed to generate message" });
  }
});

// ── POST /api/prospects/:id/log-message — Log sent message ──
router.post("/:id/log-message", (req: Request, res: Response) => {
  try {
    const prospect = db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, req.params.id))
      .get();

    if (!prospect) {
      res.status(404).json({ success: false, error: "Prospect not found" });
      return;
    }

    const { content, platform } = req.body;

    if (!content) {
      res.status(400).json({ success: false, error: "Content is required" });
      return;
    }

    const now = new Date().toISOString();
    const msgId = generateId();

    db.insert(schema.outreachMessages)
      .values({
        id: msgId,
        prospectId: req.params.id,
        content,
        platform: platform || prospect.platform,
        sentAt: now,
        status: "sent",
        createdAt: now,
      })
      .run();

    // Update prospect status
    db.update(schema.prospects)
      .set({
        status: "contacted",
        lastContactedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.prospects.id, req.params.id))
      .run();

    const message = db
      .select()
      .from(schema.outreachMessages)
      .where(eq(schema.outreachMessages.id, msgId))
      .get();

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    console.error("Log message error:", err);
    res.status(500).json({ success: false, error: "Failed to log message" });
  }
});

// ── POST /api/prospects/:id/log-response — Log response ──
router.post("/:id/log-response", (req: Request, res: Response) => {
  try {
    const prospect = db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, req.params.id))
      .get();

    if (!prospect) {
      res.status(404).json({ success: false, error: "Prospect not found" });
      return;
    }

    const { content } = req.body;

    if (!content) {
      res.status(400).json({ success: false, error: "Content is required" });
      return;
    }

    const now = new Date().toISOString();

    // Find the most recent sent message and mark it as responded
    const lastSent = db
      .select()
      .from(schema.outreachMessages)
      .where(
        and(
          eq(schema.outreachMessages.prospectId, req.params.id),
          eq(schema.outreachMessages.status, "sent")
        )
      )
      .orderBy(desc(schema.outreachMessages.sentAt))
      .get();

    if (lastSent) {
      db.update(schema.outreachMessages)
        .set({
          responseReceived: true,
          responseContent: content,
        })
        .where(eq(schema.outreachMessages.id, lastSent.id))
        .run();
    }

    // Update prospect status
    db.update(schema.prospects)
      .set({
        status: "responded",
        updatedAt: now,
      })
      .where(eq(schema.prospects.id, req.params.id))
      .run();

    const updated = db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, req.params.id))
      .get();

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Log response error:", err);
    res.status(500).json({ success: false, error: "Failed to log response" });
  }
});

export default router;