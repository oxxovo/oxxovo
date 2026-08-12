import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import AuthSync from "./_components/AuthSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ★2026-08-11 (TK found Korean text "too heavy" -- 제니2 traced it to layout.tsx
// only loading Geist's latin subset, so Hangul was falling back to the OS's
// default Korean font entirely uncoordinated with the site's actual type).
// Verified before wiring, not assumed: next/font auto-splits this into 249
// unicode-range @font-face rules covering the full modern Hangul Syllables
// block (U+AC00..U+D7A3, confirmed by grep on the generated CSS -- no gaps
// like the Black Han Sans precedent). Real page weight is small because the
// browser only fetches the specific range files it needs, not the whole
// font -- a handful of ~15-20KB chunks for the site's actual Korean
// vocabulary, not a multi-MB download. `subsets: ['latin']` is what Google
// Fonts' own metadata calls this font's base config; the Hangul ranges come
// through regardless (verified in the build output, not from the subset name).
const notoKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// While the public site is gated (SITE_PUBLIC_ENABLED=false), the root <head>
// must not describe the product — otherwise the exempt pages that legitimately
// render (login/auth/admin) would leak "AI video creation tournament / judged
// by AI" in their page source even though the visible UI is just a form. The
// gate flip is per-deployment (an env change requires a redeploy), so reading
// the env here at module load is correct for the active deployment. When the
// gate lifts, the full marketing metadata returns automatically.
const sitePublicGated = process.env.SITE_PUBLIC_ENABLED === "false";

const richMetadata: Metadata = {
  metadataBase: new URL("https://www.oxxovo.ai"),
  title: {
    default: "OXXOVO — The Global Arena for AI Creators",
    template: "%s · OXXOVO",
  },
  description:
    "OXXOVO is an AI video creation tournament. Make a short AI video, compete with creators worldwide, and let the work win — judged by AI. No connections, no gatekeepers.",
  applicationName: "OXXOVO",
  openGraph: {
    type: "website",
    siteName: "OXXOVO",
    url: "https://www.oxxovo.ai",
    title: "OXXOVO — The Global Arena for AI Creators",
    description:
      "An AI video creation tournament. Same prompt, same time, no excuses. Compete worldwide; AI decides.",
    images: [{ url: "/arena_image.png", width: 1200, height: 630, alt: "OXXOVO" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "OXXOVO — The Global Arena for AI Creators",
    description:
      "An AI video creation tournament. Same prompt, same time, no excuses. Compete worldwide; AI decides.",
    images: ["/arena_image.png"],
  },
};

const gatedMetadata: Metadata = {
  metadataBase: new URL("https://www.oxxovo.ai"),
  title: "OXXOVO",
  description: "",
  applicationName: "OXXOVO",
  robots: { index: false, follow: false },
};

export const metadata: Metadata = sitePublicGated ? gatedMetadata : richMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${notoKr.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AuthSync />{children}</body>
    </html>
  );
}
