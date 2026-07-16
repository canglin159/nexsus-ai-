import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateListing } from "../hooks/useListings";
import { apiRequest } from "../lib/api";
import type { ListingEnhancementResult } from "@shared/types";
import { Sparkles } from "lucide-react";

const categories = ["Electronics", "Vehicles", "Collectibles", "Furniture", "Fashion", "Sports", "Art", "Books", "Other"];
const conditions = ["new", "like_new", "good", "fair", "poor"];

export function CreateListingPage() {
  const navigate = useNavigate();
  const createListing = useCreateListing();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [condition, setCondition] = useState(conditions[0]);
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [tags, setTags] = useState("");

  // AI enhancement state
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedFields, setEnhancedFields] = useState<Set<string>>(new Set());
  const [enhanceError, setEnhanceError] = useState("");

  const handleAiEnhance = async () => {
    if (!title.trim() && !description.trim()) {
      setEnhanceError("Please enter a title or description first for AI to enhance.");
      return;
    }

    setEnhancing(true);
    setEnhanceError("");

    try {
      const result = await apiRequest<ListingEnhancementResult>("/ai/enhance-listing", {
        method: "POST",
        body: {
          title: title || undefined,
          description: description || undefined,
          category,
          tags: tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        },
      });

      const newEnhanced = new Set<string>();

      if (result.title && result.title !== title) {
        setTitle(result.title);
        newEnhanced.add("title");
      }
      if (result.description && result.description !== description) {
        setDescription(result.description);
        newEnhanced.add("description");
      }
      if (result.tags && result.tags.length > 0) {
        const tagStr = result.tags.join(", ");
        if (tagStr !== tags) {
          setTags(tagStr);
          newEnhanced.add("tags");
        }
      }

      setEnhancedFields(newEnhanced);
    } catch (err: any) {
      setEnhanceError(err.message || "AI enhancement failed. Please try again.");
    } finally {
      setEnhancing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createListing.mutateAsync({
        title,
        description,
        category,
        condition: condition as any,
        price: parseFloat(price),
        location: location || undefined,
        images: imageUrls ? imageUrls.split("\n").map((s) => s.trim()).filter(Boolean) : [],
        tags: tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      });
      navigate(`/listings/${result.id}`);
    } catch (err) {
      console.error("Failed to create listing:", err);
    }
  };

  const FieldLabel = ({ label, field }: { label: string; field: string }) => (
    <span className="flex items-center gap-2">
      {label}
      {enhancedFields.has(field) && (
        <span className="inline-flex items-center gap-1 text-xs font-normal text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
          <Sparkles className="w-3 h-3" />
          AI
        </span>
      )}
    </span>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create Listing</h1>
        <p className="text-muted-foreground mt-1">List your item for sale on Nexus Exchange</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-8 space-y-6">
        {createListing.isError && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {createListing.error?.message || "Failed to create listing"}
          </div>
        )}

        {enhanceError && (
          <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
            {enhanceError}
          </div>
        )}

        {/* AI Enhance Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAiEnhance}
            disabled={enhancing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 shadow-md"
          >
            <Sparkles className={`w-4 h-4 ${enhancing ? "animate-pulse" : ""}`} />
            {enhancing ? "Enhancing..." : "✨ AI Enhance"}
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            <FieldLabel label="Title *" field="title" />
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              enhancedFields.delete("title");
              setEnhancedFields(new Set(enhancedFields));
            }}
            className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              enhancedFields.has("title") ? "border-purple-300 bg-purple-50/30" : "border-border"
            }`}
            placeholder="e.g. iPhone 15 Pro Max - 256GB"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            <FieldLabel label="Description *" field="description" />
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              enhancedFields.delete("description");
              setEnhancedFields(new Set(enhancedFields));
            }}
            rows={4}
            className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              enhancedFields.has("description") ? "border-purple-300 bg-purple-50/30" : "border-border"
            }`}
            placeholder="Describe your item in detail..."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Condition *</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
            >
              {conditions.map((c) => (
                <option key={c} value={c}>{c.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Price (USD) *</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min={0}
              step="0.01"
              className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="999.99"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g. New York, NY"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Image URLs (one per line)</label>
          <textarea
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="https://example.com/image1.jpg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            <FieldLabel label="Tags (comma separated)" field="tags" />
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => {
              setTags(e.target.value);
              enhancedFields.delete("tags");
              setEnhancedFields(new Set(enhancedFields));
            }}
            className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              enhancedFields.has("tags") ? "border-purple-300 bg-purple-50/30" : "border-border"
            }`}
            placeholder="iphone, apple, smartphone"
          />
        </div>

        <button
          type="submit"
          disabled={createListing.isPending}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {createListing.isPending ? "Creating..." : "Publish Listing"}
        </button>
      </form>
    </div>
  );
}
