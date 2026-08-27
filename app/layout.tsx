import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import AuthSync from "./_components/AuthSync";
import HtmlLangSync from "./_components/HtmlLangSync";

// ★2026-08-12: replaces Geist (was loaded but never wired into body's
// font-family -- a dead load, latin-only) and Noto Sans KR (TK: unbalanced
// weight vs. the rest of the site, 10.4MB vs Pretendard's 1.5MB for two
// weights). One family for Korean and English both, so there is a single
// place to tune weight/tracking instead of two fonts that can drift apart.
const pretendard = localFont({
  src: [
    { path: "./fonts/Pretendard-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Pretendard-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Pretendard-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-pretendard",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    "An AI video competition. Same tools, same clock, skill decides. Enter from anywhere.",
  applicationName: "OXXOVO",
  openGraph: {
    type: "website",
    siteName: "OXXOVO",
    url: "https://www.oxxovo.ai",
    title: "OXXOVO — The Global Arena for AI Creators",
    description:
      "An AI video competition. Same tools, same clock, skill decides. Enter from anywhere.",
    images: [{ url: "/arena_image.png", width: 1200, height: 630, alt: "OXXOVO" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "OXXOVO — The Global Arena for AI Creators",
    description:
      "An AI video competition. Same tools, same clock, skill decides. Enter from anywhere.",
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
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* lang="en" here is the SSR default (matches admin-i18n's SERVER_DEFAULT);
          HtmlLangSync flips it client-side once localStorage's ko/en toggle is
          readable. See HtmlLangSync.tsx for why that gap exists and stays. */}
      <body className="min-h-full flex flex-col"><AuthSync /><HtmlLangSync />{children}</body>
    </html>
  );
}
