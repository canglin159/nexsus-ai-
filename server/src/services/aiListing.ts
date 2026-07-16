import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const isAiConfigured =
  OPENAI_API_KEY && OPENAI_API_KEY !== "sk-..." && OPENAI_API_KEY.length > 20;

function getModel() {
  if (!isAiConfigured) return null;
  return openai("gpt-4o-mini");
}

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

async function generateListingTitle(rawInput: string): Promise<string> {
  if (!isAiConfigured) return rawInput;

  try {
    const prompt = `Generate a compelling, SEO-friendly marketplace listing title based on this raw description. Make it concise (under 80 characters), highlight key selling points, and include relevant keywords:

Raw input: "${rawInput}"

Return ONLY the title text, nothing else.`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 80,
      temperature: 0.7,
    });

    return text.trim().replace(/^["']|["']$/g, "");
  } catch (err) {
    console.error("AI title generation failed:", err);
    return rawInput;
  }
}

async function generateListingDescription(
  rawInput: string,
  category: string
): Promise<string> {
  if (!isAiConfigured) return rawInput;

  try {
    const prompt = `You are an expert marketplace copywriter. Transform this raw item description into a polished, engaging, and detailed listing description. Include a compelling opening, key features as bullet points, condition notes, and a call to action. The item is in the "${category}" category.

Raw description: "${rawInput}"

Return ONLY the enhanced description text. Use 2-3 short paragraphs. Do not include markdown formatting.`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 500,
      temperature: 0.7,
    });

    return text.trim();
  } catch (err) {
    console.error("AI description generation failed:", err);
    return rawInput;
  }
}

async function suggestTags(
  rawInput: string,
  category: string
): Promise<string[]> {
  if (!isAiConfigured) return [];

  try {
    const prompt = `Generate 5-8 relevant search tags for a marketplace listing in the "${category}" category based on this description. Tags should be lowercase, single words or short 2-word phrases, comma-separated.

Description: "${rawInput}"

Return ONLY the comma-separated tags, nothing else. Example: iphone, apple, smartphone, 256gb, unlocked`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 100,
      temperature: 0.5,
    });

    return text
      .trim()
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length < 50)
      .slice(0, 8);
  } catch (err) {
    console.error("AI tag generation failed:", err);
    return [];
  }
}

export async function enhanceListing(
  input: ListingEnhancementInput
): Promise<ListingEnhancementResult> {
  // Build a combined raw input for AI from available fields
  const rawText = [
    input.title,
    input.description,
    input.category ? `Category: ${input.category}` : "",
    input.tags ? `Tags: ${input.tags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  if (!rawText && input.title) {
    // Nothing to enhance
    return {
      title: input.title,
      description: input.description || "",
      tags: input.tags || [],
    };
  }

  const [enhancedTitle, enhancedDescription, enhancedTags] = await Promise.all([
    input.title
      ? generateListingTitle(rawText)
      : generateListingTitle(input.description || rawText),
    generateListingDescription(input.description || rawText, input.category || "General"),
    suggestTags(rawText, input.category || "General"),
  ]);

  return {
    title: enhancedTitle || input.title || "Untitled Listing",
    description: enhancedDescription || input.description || "",
    tags: enhancedTags.length > 0 ? enhancedTags : input.tags || [],
  };
}
