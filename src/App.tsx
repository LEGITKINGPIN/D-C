import { useState, useEffect } from "react";
import { Navbar, Hero, BrandStrip, FeaturedCarousel, ClipsLayout, Gallery, Contact, AboutSection } from "./components/SiteComponents";

export default function App() {
  const [activeView, setActiveView] = useState(() => {
    return window.location.hash === "#about" ? "about" : "home";
  });

  useEffect(() => {
    const handleHashChange = () => {
      setActiveView(window.location.hash === "#about" ? "about" : "home");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (activeView === "about") {
      if (window.location.hash !== "#about") {
        window.history.pushState(null, "", "#about");
      }
    } else if (activeView === "home" && window.location.hash === "#about") {
      window.history.pushState(null, "", window.location.pathname);
    }
  }, [activeView]);

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
