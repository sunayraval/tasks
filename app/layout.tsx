import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "kite — Autonomous AI Workspace & Day Architect",
  description:
    "Let your day take flight. Conversational Gemini AI workspace, live MY DAY schedule engine, Notion-style resizable task database, Canvas LMS sync, and cinema-grade ambient themes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="cyber_ocean"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="font-sans antialiased selection:bg-primary selection:text-black">
        {children}
      </body>
    </html>
  );
}

