import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { apiRequest } from "../lib/api";
import { Copy, Share2, Users, Gift, DollarSign, Check, ArrowRight, ExternalLink } from "lucide-react";

interface ReferralStats {
  referralCode: string | null;
  totalReferred: number;
  conversions: number;
  rewardsEarned: number;
}

export function ReferralPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      // Get or create referral code
      const codeResult = await apiRequest<{ referralCode: string; createdAt: string }>("/referrals/code", {
        method: "POST",
      });

      // Get stats
      const statsResult = await apiRequest<ReferralStats>("/referrals/stats");
      setStats({
        referralCode: codeResult.referralCode,
        totalReferred: statsResult.totalReferred,
        conversions: statsResult.conversions,
        rewardsEarned: statsResult.rewardsEarned,
      });
    } catch (err: any) {
      setError(err.message || "Failed to load referral data");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!stats?.referralCode) return;
    const referralLink = `${window.location.origin}/register?ref=${stats.referralCode}`;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = async () => {
    if (!stats?.referralCode) return;
    const referralLink = `${window.location.origin}/register?ref=${stats.referralCode}`;
    const shareText = `Join me on Nexus Exchange — the AI-powered marketplace! Use my referral code: ${stats.referralCode}\n\n${referralLink}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Nexus Exchange Referral",
          text: shareText,
          url: referralLink,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    setRedeemMessage(null);
    setRedeemError(null);

    try {
      const result = await apiRequest<{ message: string; discount: string }>("/referrals/redeem", {
        method: "POST",
        body: { code: redeemCode.trim() },
      });
      setRedeemMessage(result.message);
      setRedeemCode("");
    } catch (err: any) {
      setRedeemError(err.message || "Failed to redeem code");
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Refer a Friend</h1>
        <p className="text-muted-foreground">
          Share Nexus Exchange with friends and earn rewards when they buy or sell on the platform!
        </p>
      </div>

      {/* Referral Code Card */}
      <div className="bg-white border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Your Referral Code</h2>
            <p className="text-sm text-muted-foreground">Share this code with friends</p>
          </div>
        </div>

        {stats?.referralCode ? (
          <>
            <div className="flex items-center justify-between bg-muted rounded-lg p-4 mb-4">
              <span className="text-xl font-bold tracking-wider text-primary">{stats.referralCode}</span>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  {copied ? (
                    <><Check className="w-4 h-4" /> Copied</>
                  ) : (
                    <><Copy className="w-4 h-4" /> Copy Link</>
                  )}
                </button>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Share your referral link and earn <strong>$50</strong> for each seller you refer who completes their first sale, and <strong>$25</strong> for each buyer you refer who makes their first purchase!
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">Loading your referral code...</p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-muted-foreground">People Referred</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats?.totalReferred || 0}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight className="w-4 h-4 text-green-600" />
            <p className="text-sm text-muted-foreground">Conversions</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats?.conversions || 0}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <p className="text-sm text-muted-foreground">Rewards Earned</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">${(stats?.rewardsEarned || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Redeem a Code */}
      <div className="bg-white border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-purple-50">
            <Gift className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold">Have a Referral Code?</h2>
            <p className="text-sm text-muted-foreground">Redeem a friend's code and get 10% off your first commission</p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
            placeholder="Enter referral code (e.g., NX-ABC123-XXXX)"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button
            onClick={handleRedeem}
            disabled={redeeming || !redeemCode.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {redeeming ? "Redeeming..." : "Redeem"}
          </button>
        </div>

        {redeemMessage && (
          <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm text-green-800">{redeemMessage}</p>
          </div>
        )}
        {redeemError && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-800">{redeemError}</p>
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-semibold mb-4">How It Works</h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">1</span>
            </div>
            <div>
              <p className="font-medium text-sm">Share Your Code</p>
              <p className="text-sm text-muted-foreground">Copy your unique referral link or code and share it with friends via email, social media, or text.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">2</span>
            </div>
            <div>
              <p className="font-medium text-sm">Friend Signs Up</p>
              <p className="text-sm text-muted-foreground">Your friend creates an account using your referral code. They get 10% off their first commission!</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">3</span>
            </div>
            <div>
              <p className="font-medium text-sm">You Earn Rewards</p>
              <p className="text-sm text-muted-foreground">When a referred seller completes their first sale, you earn <strong>$50</strong>. When a referred buyer makes their first purchase, you earn <strong>$25</strong>. No limits — refer as many people as you want!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}