import { useState } from "react";
import { Navbar, Hero, BrandStrip, FeaturedCarousel, ClipsLayout, Gallery, Contact, AboutSection } from "./components/SiteComponents";

export default function App() {
  const [activeView, setActiveView] = useState("home"); // "home" or "about"

  return (
    <div className="min-h-screen bg-black text-white selection:bg-orange-500 selection:text-white">
      <Navbar activeView={activeView} setActiveView={setActiveView} />
      
      <main>
        {activeView === "home" ? (
          <>
            <Hero />
            <BrandStrip />
            <ClipsLayout />
            <FeaturedCarousel />
            {/* <PortfolioGrid /> — commented out, replaced by ClipsLayout above */}
            <Gallery />
          </>
        ) : (
          <AboutSection />
        )}
        <Contact setActiveView={setActiveView} />
      </main>
    </div>
  );
}
