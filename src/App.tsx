import { Navbar, Hero, BrandStrip, FeaturedCarousel, ClipsLayout, Gallery, Contact } from "./components/SiteComponents";
import { SpeedInsights } from '@vercel/speed-insights/react';

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-orange-500 selection:text-white">
      <Navbar />
      <main>
        <Hero />
        <BrandStrip />
        <ClipsLayout />
        <FeaturedCarousel />
        {/* <PortfolioGrid /> — commented out, replaced by ClipsLayout above */}
        <Gallery />
        <Contact />
      </main>
      <SpeedInsights />
    </div>
  );
}
