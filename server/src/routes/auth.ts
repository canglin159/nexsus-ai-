import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import { db, schema } from "../db/index.js";
import { authenticate, authorize, signToken, AuthPayload } from "../middleware/auth.js";
import { generateId, sanitizeUser } from "../lib/utils.js";
import { eq, or } from "drizzle-orm";

const router = Router();

// ── POST /register ──────────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    if (!["buyer", "seller"].includes(role)) {
      res.status(400).json({ success: false, error: "Role must be 'buyer' or 'seller'" });
      return;
    }

    const existing = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .get();

    if (existing) {
      res.status(409).json({ success: false, error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = generateId();
    const now = new Date().toISOString();

    db.insert(schema.users).values({
      id,
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      createdAt: now,
      updatedAt: now,
    }).run();

    const user = db.select().from(schema.users).where(eq(schema.users.id, id)).get()!;
    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.status(201).json({
      success: true,
      data: { token, user: sanitizeUser(user) },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, error: "Registration failed" });
  }
});

// ── POST /login ─────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required" });
      return;
    }

    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .get();

    if (!user) {
      res.status(401).json({ success: false, error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid email or password" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.json({
      success: true,
      data: { token, user: sanitizeUser(user) },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

// ── GET /me ─────────────────────────────────────────────
router.get("/me", authenticate, (req: Request, res: Response) => {
  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, req.user!.userId))
    .get();

  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }

  res.json({ success: true, data: sanitizeUser(user) });
});

// ── POST /mfa/setup ─────────────────────────────────────
router.post("/mfa/setup", authenticate, (req: Request, res: Response) => {
  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, req.user!.userId))
    .get();

  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }

  const secret = speakeasy.generateSecret({
    name: `NexusExchange:${user.email}`,
  });

  // Store temporary secret
  db.update(schema.users)
    .set({ mfaSecret: secret.base32, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, user.id))
    .run();

  res.json({
    success: true,
    data: {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    },
  });
});

// ── POST /mfa/verify ────────────────────────────────────
router.post("/mfa/verify", authenticate, (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    res.status(400).json({ success: false, error: "Token is required" });
    return;
  }

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, req.user!.userId))
    .get();

  if (!user || !user.mfaSecret) {
    res.status(400).json({ success: false, error: "MFA not set up. Run /mfa/setup first." });
    return;
  }

  const verified = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: "base32",
    token,
    window: 1,
  });

  if (!verified) {
    res.status(400).json({ success: false, error: "Invalid token" });
    return;
  }

  db.update(schema.users)
    .set({ mfaEnabled: true, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, user.id))
    .run();

  res.json({ success: true, data: { message: "MFA enabled successfully" } });
});

// ── POST /kyc ───────────────────────────────────────────
router.post("/kyc", authenticate, authorize("seller"), (req: Request, res: Response) => {
  db.update(schema.users)
    .set({ kycStatus: "pending", updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, req.user!.userId))
    .run();

  res.json({ success: true, data: { message: "KYC submitted, status set to pending" } });
});

export default router;