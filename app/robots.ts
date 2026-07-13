import type { MetadataRoute } from "next";

// While the public site is gated (SITE_PUBLIC_ENABLED=false) we ask every
// crawler to stay out entirely — belt-and-suspenders alongside the proxy.ts
// rewrite and the coming-soon page's noindex. When the gate is lifted this
// flips back to allow-all automatically (same single switch, no date logic).
export default function robots(): MetadataRoute.Robots {
  const gated = process.env.SITE_PUBLIC_ENABLED === "false";

  if (gated) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    host: "https://www.oxxovo.ai",
  };
}
