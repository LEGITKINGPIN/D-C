import type { Metadata } from "next";
import { Inter, Playfair_Display, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Navbar, Contact } from "../components/SiteComponents";
import { ClientLoadingScreen } from "../components/ClientLoadingScreen";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter-next", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-playfair-next", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-cormorant-next", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://dcmediahouse.in"),
  title: {
    default: "D&C MediaHouse | Cinematic Videography & Storytelling",
    template: "%s | D&C MediaHouse",
  },
  description: "D&C MediaHouse is a premier video production agency specializing in event coverage, brand films, commercials, and cinematic storytelling.",
  keywords: [
    "cinematic video production", "event cinematography", "commercial filmmaker", 
    "brand story videos", "fashion videos", "Saksham Chaudhary", 
    "D&C MediaHouse", "premium video agency", "New Delhi video production",
    "dcm", "dncm", "dnc mediahouse", "dcmediahouse", "dnc media house", 
    "d & c mediahouse", "d and c mediahouse", "dc media house", "dc media", 
    "d&c media house", "dncmediahouse", "dcmedia"
  ],
  authors: [{ name: "Saksham Chaudhary", url: "https://dcmediahouse.in" }],
  creator: "Saksham Chaudhary",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "https://dcmediahouse.in",
    title: "D&C MediaHouse | Cinematic Videography Portfolio",
    description: "Explore D&C MediaHouse, a professional cinematic videography and media portfolio featuring high-performance adaptive video streaming.",
    siteName: "D&C MediaHouse",
    locale: "en_IN",
    images: [{ 
      url: "/apple-touch-icon.png",
      width: 180,
      height: 180,
      alt: "D&C MediaHouse Logo"
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "D&C MediaHouse | Cinematic Videography Portfolio",
    description: "Explore D&C MediaHouse, a professional cinematic videography and media portfolio featuring high-performance adaptive video streaming.",
    images: ["/apple-touch-icon.png"],
    creator: "@dcmediahouse", // Example handle
  },
  verification: {
    google: "placeholder-google-site-verification", // Ready for user to fill
  }
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "D&C MediaHouse",
  "image": "https://dcmediahouse.in/apple-touch-icon.png",
  "description": "Professional cinematic videography portfolio based in New Delhi, featuring high-performance media streaming.",
  "url": "https://dcmediahouse.in",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "New Delhi",
    "addressRegion": "Delhi",
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "28.6139",
    "longitude": "77.2090"
  },
  "sameAs": [
    "https://www.instagram.com/dcmediahouse"
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${cormorant.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-black text-white selection:bg-orange-500 selection:text-white font-sans">
        <ClientLoadingScreen>
          <Navbar />
          <main>{children}</main>
          <Contact />
        </ClientLoadingScreen>
      </body>
    </html>
  );
}
