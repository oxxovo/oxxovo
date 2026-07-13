import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
