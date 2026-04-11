import { Navbar, Hero, BrandStrip, PortfolioGrid, FeaturedCarousel, Gallery, Contact } from "./components/SiteComponents";

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-orange-500 selection:text-white">
      <Navbar />
      <main>
        <Hero />
        <BrandStrip />
        <PortfolioGrid />
        <FeaturedCarousel />
        <Gallery />
        <Contact />
      </main>
    </div>
  );
}
