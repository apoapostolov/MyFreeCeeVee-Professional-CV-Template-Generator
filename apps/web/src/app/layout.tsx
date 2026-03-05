import type { Metadata } from "next";
import { IBM_Plex_Sans, Merriweather } from "next/font/google";
import "./globals.css";

const bodySans = IBM_Plex_Sans({
  variable: "--font-body-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

const titleSerif = Merriweather({
  variable: "--font-title-serif",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "MyFreeCeeVee",
  description: "Professional CV template generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodySans.variable} ${titleSerif.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
