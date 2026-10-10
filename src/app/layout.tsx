import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ALAN.AI — Your academic and career companion",
    template: "%s · ALAN.AI",
  },
  description:
    "A connected student workspace for college life, career discovery, learning plans and responsible AI assistance.",
  applicationName: "ALAN.AI",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
