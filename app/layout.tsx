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
  title: "TaskIt — Next-Gen AI Productivity Workspace",
  description:
    "Futuristic Notion-style time management workspace with Gemini AI Copilot, HCPSS Canvas iCal Sync, and zero-bandwidth IndexedDB video backgrounds.",
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

