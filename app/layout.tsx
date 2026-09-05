import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI PR Reviewer",
    template: "%s · AI PR Reviewer",
  },
  description: "Automated, actionable code reviews for every GitHub pull request.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
