import { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  image?: string;
}

export function SEO({ title, description, image }: SEOProps) {
  useEffect(() => {
    const fullTitle = title
      ? `${title} | Nexus Exchange`
      : "Nexus Exchange - AI-Powered Marketplace Brokerage";

    document.title = fullTitle;

    const setMetaTag = (name: string, content: string, property = false) => {
      const attr = property ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMetaTag("description", description);

    // Open Graph tags
    setMetaTag("og:title", fullTitle, true);
    setMetaTag("og:description", description, true);
    setMetaTag("og:type", "website", true);
    setMetaTag("og:site_name", "Nexus Exchange", true);

    if (image) {
      setMetaTag("og:image", image, true);
    }

    // Twitter Card
    setMetaTag("twitter:card", "summary_large_image");
    setMetaTag("twitter:title", fullTitle);
    setMetaTag("twitter:description", description);
    if (image) {
      setMetaTag("twitter:image", image);
    }
  }, [title, description, image]);

  return null;
}
