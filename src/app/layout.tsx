import type { Metadata } from "next";
import { Andika } from "next/font/google";
import "./globals.css";

/**
 * Andika is a typeface designed for beginning readers: single-story "a" and
 * "g", clearly different l/I/1. A good fit for grades 1–4 on a projector.
 */
const andika = Andika({
  variable: "--font-andika",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Element",
  description: "Classroom learning games for grades 1–4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${andika.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
