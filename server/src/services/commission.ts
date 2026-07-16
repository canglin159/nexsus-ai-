// ── Default commission rules by category ──────────────────
// These can be overridden via admin API or environment variables

const DEFAULT_COMMISSION_RULES: Record<string, number> = {
  electronics: 8,
  vehicles: 5,
  collectibles: 10,
  equipment: 7,
  luxury_goods: 9,
  digital_assets: 12,
  default: 8,
};

// In-memory store (in production this would be a DB table)
let commissionRules: Record<string, number> = { ...DEFAULT_COMMISSION_RULES };

// Load any env override for default rate
const envDefaultRate = parseFloat(process.env.DEFAULT_COMMISSION_RATE || "8");
if (!isNaN(envDefaultRate) && envDefaultRate > 0) {
  commissionRules.default = envDefaultRate;
}

// Load per-category overrides from env (COMMISSION_OVERRIDES=electronics:5,vehicles:3)
const overridesEnv = process.env.COMMISSION_OVERRIDES || "";
if (overridesEnv) {
  overridesEnv.split(",").forEach((pair) => {
    const [cat, rate] = pair.split(":");
    if (cat && rate) {
      const parsedRate = parseFloat(rate);
      if (!isNaN(parsedRate) && parsedRate > 0) {
        commissionRules[cat.trim()] = parsedRate;
      }
    }
  });
}

/**
 * Get the commission rate for a given category.
 * Falls back to the default rate if no category-specific rate exists.
 */
export function getCommissionRate(category: string): number {
  const normalized = category.toLowerCase().trim();
  return commissionRules[normalized] ?? commissionRules.default ?? 8;
}

/**
 * Calculate the commission amount from a transaction amount and rate.
 */
export function calculateCommission(amount: number, ratePercent: number): number {
  return Math.round(amount * (ratePercent / 100) * 100) / 100;
}

/**
 * Apply a promotional discount to a commission amount.
 * @param commission The original commission amount
 * @param discountPercent The discount percent (e.g., 25 = 25% off)
 * @returns The discounted commission amount
 */
export function applyPromoDiscount(commission: number, discountPercent: number): number {
  const clampedDiscount = Math.min(100, Math.max(0, discountPercent));
  const discount = commission * (clampedDiscount / 100);
  return Math.round((commission - discount) * 100) / 100;
}

/**
 * Get all current commission rules.
 */
export function getCommissionRules(): Record<string, number> {
  return { ...commissionRules };
}

/**
 * Update commission rules (bulk replace or single update).
 * Rules with a value of -1 are removed.
 */
export function updateCommissionRules(newRules: Record<string, number>): Record<string, number> {
  for (const [category, rate] of Object.entries(newRules)) {
    if (rate === -1) {
      delete commissionRules[category];
    } else if (rate > 0 && rate <= 100) {
      commissionRules[category] = rate;
    }
  }
  return { ...commissionRules };
}

/**
 * Reset commission rules to defaults.
 */
export function resetCommissionRules(): Record<string, number> {
  commissionRules = { ...DEFAULT_COMMISSION_RULES };
  if (!isNaN(envDefaultRate) && envDefaultRate > 0) {
    commissionRules.default = envDefaultRate;
  }
  return { ...commissionRules };
}
