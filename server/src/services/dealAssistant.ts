import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const isAiConfigured =
  OPENAI_API_KEY && OPENAI_API_KEY !== "sk-..." && OPENAI_API_KEY.length > 20;

// ── Inquiry Generation ──────────────────────────────────

export async function generateInquiryMessage(
  listingTitle: string,
  buyerName: string,
  question?: string
): Promise<string> {
  if (!isAiConfigured) {
    return question ||
      `Hi! I'm interested in your listing "${listingTitle}". Is it still available?`;
  }

  try {
    const prompt = `You are a buyer on a marketplace. Generate a polite, friendly inquiry message to a seller about their listing titled "${listingTitle}". The buyer's name is ${buyerName}. ${
      question
        ? `The buyer has a specific question: "${question}". Address this question naturally.`
        : "Ask about availability and condition."
    }

Keep it short (2-3 sentences), warm, and professional. Return ONLY the message text.`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 200,
      temperature: 0.7,
    });

    return text.trim();
  } catch (err) {
    console.error("AI inquiry generation failed:", err);
    return question ||
      `Hi! I'm interested in your listing "${listingTitle}". Is it still available?`;
  }
}

// ── Response Generation ─────────────────────────────────

export async function generateResponseToInquiry(
  inquiry: string,
  listingDetails: { title: string; price: number; condition: string; description: string }
): Promise<string> {
  if (!isAiConfigured) {
    return `Thanks for your interest! Yes, the "${listingDetails.title}" is still available. It's in ${listingDetails.condition} condition and priced at $${listingDetails.price}. Let me know if you have any other questions!`;
  }

  try {
    const prompt = `You are a seller on a marketplace. A potential buyer sent this inquiry:

"${inquiry}"

Your listing details:
- Title: ${listingDetails.title}
- Price: $${listingDetails.price}
- Condition: ${listingDetails.condition}
- Description: ${listingDetails.description}

Generate a warm, helpful response that addresses their question and encourages them to buy. Keep it 2-4 sentences. Mention the condition and a positive selling point. Return ONLY the response text.`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 300,
      temperature: 0.7,
    });

    return text.trim();
  } catch (err) {
    console.error("AI response generation failed:", err);
    return `Thanks for your interest! Yes, the "${listingDetails.title}" is still available. Let me know if you have any questions!`;
  }
}

// ── Counter Offer ───────────────────────────────────────

export async function suggestCounterOffer(
  askingPrice: number,
  buyerOffer: number,
  minPrice: number,
  maxPrice: number
): Promise<{ suggestedPrice: number; message: string }> {
  const clampedMin = Math.max(minPrice, 0);
  const clampedMax = Math.max(maxPrice, askingPrice);

  if (buyerOffer >= askingPrice) {
    return {
      suggestedPrice: askingPrice,
      message: `Great news! Your offer of $${buyerOffer} meets the asking price. We can proceed at $${askingPrice}.`,
    };
  }

  if (buyerOffer < clampedMin) {
    return {
      suggestedPrice: askingPrice,
      message: `Thank you for your offer of $${buyerOffer}, but unfortunately that's below the minimum acceptable price. The asking price is $${askingPrice}. Would you like to make another offer?`,
    };
  }

  if (!isAiConfigured) {
    // Simple midpoint negotiation
    const midpoint = Math.round(((askingPrice + buyerOffer) / 2) * 100) / 100;
    const suggested = Math.max(clampedMin, Math.min(clampedMax, midpoint));
    return {
      suggestedPrice: suggested,
      message: `Thanks for your offer of $${buyerOffer}! I can meet you at $${suggested}. That's a fair price for both of us. Let me know if that works for you!`,
    };
  }

  try {
    const prompt = `You are a marketplace negotiation assistant. A buyer has offered $${buyerOffer} for an item priced at $${askingPrice}. The seller's acceptable range is $${clampedMin} to $${clampedMax}.

Suggest a counter-offer price that:
1. Is within the $${clampedMin}-${clampedMax} range
2. Is higher than the buyer's offer but lower than the asking price
3. Feels like a reasonable compromise

Also generate a brief, friendly counter-offer message (1-2 sentences).

Return ONLY a JSON object with "suggestedPrice" (number) and "message" (string). No other text.`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 200,
      temperature: 0.5,
    });

    // Try to parse JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const suggestedPrice = Math.max(
        clampedMin,
        Math.min(clampedMax, Number(parsed.suggestedPrice) || buyerOffer + (askingPrice - buyerOffer) / 2)
      );
      return {
        suggestedPrice: Math.round(suggestedPrice * 100) / 100,
        message: parsed.message || `I can offer you a deal at $${suggestedPrice}.`,
      };
    }

    throw new Error("Could not parse AI response");
  } catch (err) {
    console.error("AI counter-offer failed:", err);
    const midpoint = Math.round(((askingPrice + buyerOffer) / 2) * 100) / 100;
    const suggested = Math.max(clampedMin, Math.min(clampedMax, midpoint));
    return {
      suggestedPrice: suggested,
      message: `Thanks for your offer of $${buyerOffer}! I can meet you at $${suggested}. Let me know if that works for you!`,
    };
  }
}

// ── Escalation Detection ────────────────────────────────

export async function shouldEscalateToHuman(
  conversationHistory: string[]
): Promise<{ escalate: boolean; reason?: string }> {
  // Non-AI heuristics first (always applied)
  const recentMsgs = conversationHistory.slice(-6);
  const combined = recentMsgs.join(" ").toLowerCase();

  // Red-flag keywords
  const redFlags = [
    "refund",
    "scam",
    "fraud",
    "lawyer",
    "sue",
    "police",
    "chargeback",
    "not as described",
    "broken",
    "fake",
    "counterfeit",
  ];

  for (const flag of redFlags) {
    if (combined.includes(flag)) {
      return { escalate: true, reason: `Red-flag keyword detected: "${flag}"` };
    }
  }

  // If conversation is long (>15 messages) and no resolution
  if (conversationHistory.length > 15) {
    return {
      escalate: true,
      reason: "Conversation has exceeded 15 messages without resolution",
    };
  }

  if (!isAiConfigured) {
    return { escalate: false };
  }

  try {
    const prompt = `Analyze this marketplace conversation between a buyer and seller. Determine if the conversation should be escalated to a human support agent.

Conversation:
${conversationHistory.map((m, i) => `[${i + 1}] ${m}`).join("\n")}

Should this be escalated? Respond with ONLY a JSON object: {"escalate": true/false, "reason": "brief explanation if true"}`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 150,
      temperature: 0.3,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        escalate: Boolean(parsed.escalate),
        reason: parsed.reason || undefined,
      };
    }

    return { escalate: false };
  } catch (err) {
    console.error("AI escalation check failed:", err);
    return { escalate: false };
  }
}
