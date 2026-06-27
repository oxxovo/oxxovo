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

export const metadata: Metadata = {
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
