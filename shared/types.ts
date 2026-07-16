// ── Shared types between client and server ────────────

export type UserRole = "buyer" | "seller" | "admin";
export type KycStatus = "unverified" | "pending" | "verified" | "rejected";
export type ListingStatus = "draft" | "active" | "sold" | "archived";
export type ListingCondition = "new" | "like_new" | "good" | "fair" | "poor";
export type TransactionStatus =
  | "pending"
  | "escrow_held"
  | "shipped"
  | "delivered"
  | "completed"
  | "disputed"
  | "refunded"
  | "cancelled";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  kycStatus: KycStatus;
  mfaEnabled: boolean;
  displayName?: string;
  avatarUrl?: string;
  stripeAccountId?: string;
  createdAt: string;
}

export interface ListingData {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  category: string;
  condition: ListingCondition;
  price: number;
  currency: string;
  location?: string;
  status: ListingStatus;
  images: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  seller?: Pick<UserProfile, "id" | "email" | "displayName" | "avatarUrl">;
}

export interface TransactionData {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  commission: number;
  commissionRate: number;
  stripePaymentIntentId?: string;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
  listing?: ListingData;
  buyer?: Pick<UserProfile, "id" | "email" | "displayName">;
  seller?: Pick<UserProfile, "id" | "email" | "displayName">;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── AI & Matching Types ─────────────────────────────────

export interface ListingEnhancementInput {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface ListingEnhancementResult {
  title: string;
  description: string;
  tags: string[];
}

export interface NegotiationResult {
  suggestedPrice: number;
  message: string;
  originalPrice: number;
  buyerOffer: number;
  isAccepted: boolean;
}

export interface MessageData {
  id: string;
  senderId: string;
  receiverId: string;
  listingId?: string | null;
  content: string;
  aiGenerated: boolean;
  createdAt: string;
  sender?: {
    id: string;
    email: string;
    displayName?: string | null;
  };
  listing?: {
    id: string;
    title: string;
    price: number;
  } | null;
}
