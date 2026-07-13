import type { Metadata } from "next";

// Public-site gate landing (shown when SITE_PUBLIC_ENABLED=false — see proxy.ts).
// DELIBERATELY MINIMAL: brand wordmark + "Coming Soon" only. It must reveal
// NOTHING about what OXXOVO is (no product, tournament, scoring, studio, prizes,
// rules, seasons). The root layout's metadata describes the product, so every
// revealing field is overridden here to a neutral value, and the page is
// noindex. No <img> is used, so no asset request is needed to render it.
export const metadata: Metadata = {
  title: { absolute: "OXXOVO" },
  description: "",
  applicationName: "OXXOVO",
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: "OXXOVO",
    description: "",
    url: "https://www.oxxovo.ai",
    siteName: "OXXOVO",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "OXXOVO",
    description: "",
    images: [],
  },
};

export default function ComingSoon() {
  return (
    <main
      className="flex flex-1 flex-col items-center justify-center px-6 text-center"
      style={{ minHeight: "100vh", background: "#050507" }}
    >
      <span className="text-[48px] font-black tracking-wide text-[#8b22ff] drop-shadow-[0_0_30px_rgba(139,34,255,.5)] sm:text-[64px]">
        OXXOVO
      </span>
      <p className="mt-5 text-[15px] font-medium uppercase tracking-[0.25em] text-white/60 sm:text-[17px]">
        Coming Soon
      </p>
    </main>
  );
}
