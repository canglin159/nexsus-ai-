import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { authenticate, authorize, optionalAuth } from "../middleware/auth.js";
import { generateId, slugify } from "../lib/utils.js";
import { eq, and, like, gte, lte, desc, asc, or, sql } from "drizzle-orm";

const router = Router();

// ── GET / (public, paginated, search/filter) ────────────
router.get("/", optionalAuth, (req: Request, res: Response) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      condition,
      q,
      sort = "newest",
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(schema.listings.status, "active")];

    if (category) conditions.push(eq(schema.listings.category, category));
    if (minPrice) conditions.push(gte(schema.listings.price, parseFloat(minPrice)));
    if (maxPrice) conditions.push(lte(schema.listings.price, parseFloat(maxPrice)));
    if (condition) conditions.push(eq(schema.listings.condition, condition as any));
    if (q) {
      const searchTerm = `%${q}%`;
      conditions.push(
        or(
          like(schema.listings.title, searchTerm),
          like(schema.listings.description, searchTerm),
          like(schema.listings.tags, searchTerm)
        )!
      );
    }

    const whereClause = and(...conditions);

    // Count total
    const countResult = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.listings)
      .where(whereClause)
      .get();
    const total = countResult?.count ?? 0;

    // Build order
    let orderBy;
    switch (sort) {
      case "price_asc":
        orderBy = asc(schema.listings.price);
        break;
      case "price_desc":
        orderBy = desc(schema.listings.price);
        break;
      case "oldest":
        orderBy = asc(schema.listings.createdAt);
        break;
      default:
        orderBy = desc(schema.listings.createdAt);
    }

    const results = db
      .select()
      .from(schema.listings)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limitNum)
      .offset(offset)
      .all();

    const items = results.map((l) => ({
      ...l,
      images: typeof l.images === "string" ? JSON.parse(l.images as string) : l.images,
      tags: typeof l.tags === "string" ? JSON.parse(l.tags as string) : l.tags,
    }));

    res.json({
      success: true,
      data: items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("Listings fetch error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch listings" });
  }
});

// ── GET /my (authenticated seller) ──────────────────────
router.get("/my", authenticate, authorize("seller"), (req: Request, res: Response) => {
  try {
    const results = db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.sellerId, req.user!.userId))
      .orderBy(desc(schema.listings.createdAt))
      .all();

    const items = results.map((l) => ({
      ...l,
      images: typeof l.images === "string" ? JSON.parse(l.images as string) : l.images,
      tags: typeof l.tags === "string" ? JSON.parse(l.tags as string) : l.tags,
    }));

    res.json({ success: true, data: items });
  } catch (err) {
    console.error("My listings error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch your listings" });
  }
});

// ── GET /:id (public, full listing with seller) ─────────
router.get("/:id", optionalAuth, (req: Request, res: Response) => {
  try {
    const listing = db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, req.params.id))
      .get();

    if (!listing) {
      res.status(404).json({ success: false, error: "Listing not found" });
      return;
    }

    const seller = db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.users)
      .where(eq(schema.users.id, listing.sellerId))
      .get();

    res.json({
      success: true,
      data: {
        ...listing,
        images: typeof listing.images === "string" ? JSON.parse(listing.images as string) : listing.images,
        tags: typeof listing.tags === "string" ? JSON.parse(listing.tags as string) : listing.tags,
        seller: seller || undefined,
      },
    });
  } catch (err) {
    console.error("Listing detail error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch listing" });
  }
});

// ── POST / (authenticated seller) ───────────────────────
router.post("/", authenticate, authorize("seller"), (req: Request, res: Response) => {
  try {
    const { title, description, category, condition, price, currency, location, images, tags } = req.body;

    if (!title || !description || !category || !condition || price === undefined) {
      res.status(400).json({ success: false, error: "Missing required fields: title, description, category, condition, price" });
      return;
    }

    const id = generateId();
    const now = new Date().toISOString();

    db.insert(schema.listings)
      .values({
        id,
        sellerId: req.user!.userId,
        title,
        description,
        category,
        condition,
        price: parseFloat(price),
        currency: currency || "USD",
        location: location || null,
        status: "active",
        images: JSON.stringify(images || []),
        tags: JSON.stringify(tags || []),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const listing = db.select().from(schema.listings).where(eq(schema.listings.id, id)).get()!;

    res.status(201).json({
      success: true,
      data: {
        ...listing,
        images: typeof listing.images === "string" ? JSON.parse(listing.images as string) : listing.images,
        tags: typeof listing.tags === "string" ? JSON.parse(listing.tags as string) : listing.tags,
      },
    });
  } catch (err) {
    console.error("Create listing error:", err);
    res.status(500).json({ success: false, error: "Failed to create listing" });
  }
});

// ── PUT /:id (authenticated seller, own listing) ────────
router.put("/:id", authenticate, authorize("seller"), (req: Request, res: Response) => {
  try {
    const listing = db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, req.params.id))
      .get();

    if (!listing) {
      res.status(404).json({ success: false, error: "Listing not found" });
      return;
    }

    if (listing.sellerId !== req.user!.userId) {
      res.status(403).json({ success: false, error: "You can only edit your own listings" });
      return;
    }

    const { title, description, category, condition, price, currency, location, images, tags, status } = req.body;
    const now = new Date().toISOString();

    const updates: Record<string, any> = { updatedAt: now };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (condition !== undefined) updates.condition = condition;
    if (price !== undefined) updates.price = parseFloat(price);
    if (currency !== undefined) updates.currency = currency;
    if (location !== undefined) updates.location = location;
    if (images !== undefined) updates.images = JSON.stringify(images);
    if (tags !== undefined) updates.tags = JSON.stringify(tags);
    if (status !== undefined) updates.status = status;

    db.update(schema.listings)
      .set(updates)
      .where(eq(schema.listings.id, req.params.id))
      .run();

    const updated = db.select().from(schema.listings).where(eq(schema.listings.id, req.params.id)).get()!;

    res.json({
      success: true,
      data: {
        ...updated,
        images: typeof updated.images === "string" ? JSON.parse(updated.images as string) : updated.images,
        tags: typeof updated.tags === "string" ? JSON.parse(updated.tags as string) : updated.tags,
      },
    });
  } catch (err) {
    console.error("Update listing error:", err);
    res.status(500).json({ success: false, error: "Failed to update listing" });
  }
});

// ── DELETE /:id (authenticated seller, own draft) ───────
router.delete("/:id", authenticate, authorize("seller"), (req: Request, res: Response) => {
  try {
    const listing = db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, req.params.id))
      .get();

    if (!listing) {
      res.status(404).json({ success: false, error: "Listing not found" });
      return;
    }

    if (listing.sellerId !== req.user!.userId) {
      res.status(403).json({ success: false, error: "You can only delete your own listings" });
      return;
    }

    if (listing.status !== "draft" && listing.status !== "active") {
      res.status(400).json({ success: false, error: "Only draft or active listings can be deleted" });
      return;
    }

    db.delete(schema.listings)
      .where(eq(schema.listings.id, req.params.id))
      .run();

    res.json({ success: true, data: { message: "Listing deleted" } });
  } catch (err) {
    console.error("Delete listing error:", err);
    res.status(500).json({ success: false, error: "Failed to delete listing" });
  }
});

export default router;