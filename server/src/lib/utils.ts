import crypto from "crypto";

export function generateId(): string {
  return crypto.randomUUID();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function calculateCommission(
  amount: number,
  ratePercent: number
): number {
  return Math.round(amount * (ratePercent / 100) * 100) / 100;
}

export function sanitizeUser(user: {
  id: string;
  email: string;
  role: string;
  kycStatus: string;
  mfaEnabled: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
  stripeAccountId?: string | null;
  createdAt: string;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    kycStatus: user.kycStatus,
    mfaEnabled: user.mfaEnabled,
    displayName: user.displayName || undefined,
    avatarUrl: user.avatarUrl || undefined,
    stripeAccountId: user.stripeAccountId || undefined,
    createdAt: user.createdAt,
  };
}
