import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memescope · Early coin watchlist",
  description: "A simple $15K early-coin watchlist with written narratives, recent callouts and expandable rug-risk checks.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
