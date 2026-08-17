import type { Metadata } from "next";
import { Inter, Playfair_Display, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Navbar, Contact } from "../components/SiteComponents";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-cormorant", display: "swap" });

export const metadata: Metadata = {
  title: "D&C MediaHouse | Cinematic Videography Portfolio",
  description: "Explore D&C MediaHouse, a professional cinematic videography and media portfolio featuring high-performance adaptive video streaming.",
  keywords: "cinematic video production, event cinematography, commercial filmmaker, brand story videos, fashion videos, Saksham Chaudhary, D&C MediaHouse, premium video agency",
  authors: [{ name: "Saksham Chaudhary" }],
  openGraph: {
    type: "website",
    url: "https://dcmediahouse.in",
    title: "D&C MediaHouse | Cinematic Videography Portfolio",
    description: "Explore D&C MediaHouse, a professional cinematic videography and media portfolio featuring high-performance adaptive video streaming.",
    siteName: "D&C MediaHouse",
    images: [{ url: "https://dcmediahouse.in/apple-touch-icon.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "D&C MediaHouse | Cinematic Videography Portfolio",
    description: "Explore D&C MediaHouse, a professional cinematic videography and media portfolio featuring high-performance adaptive video streaming.",
    images: ["https://dcmediahouse.in/apple-touch-icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${cormorant.variable}`}>
      <body className="min-h-screen bg-black text-white selection:bg-orange-500 selection:text-white font-sans">
        <Navbar />
        <main>{children}</main>
        <Contact />
      </body>
    </html>
  );
}
