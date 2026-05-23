import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef, useCallback, forwardRef, memo, useMemo, useImperativeHandle } from "react";
import type Hls from "hls.js";
import { Play, X, ChevronLeft, ChevronRight, Instagram, MessageCircle, Menu, Send, ExternalLink, Volume2, VolumeX, Share2 } from "lucide-react";
import { cn } from "../lib/utils";
import { siteConfig } from "../data";
import { useInView } from "react-intersection-observer";

// ---------------------------------------------------------------------------
// HlsVideo – a drop-in <video> replacement with hls.js support
// ---------------------------------------------------------------------------
interface HlsVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
}

const HlsVideo = forwardRef<HTMLVideoElement, HlsVideoProps>(function HlsVideo(
  { src, ...rest },
  ref
) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Proper ref forwarding via useImperativeHandle
  useImperativeHandle(ref, () => internalRef.current!, []);

  useEffect(() => {
    const video = internalRef.current;
    if (!video || !src) return;

    // Clean up previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (src.endsWith(".m3u8")) {
      // Lazy-load hls.js only when needed (removes 521KB from critical path)
      import("hls.js").then(({ default: HlsLib }) => {
        // Guard: component may have unmounted during async import
        if (!internalRef.current) return;

        if (HlsLib.isSupported()) {
          const hls = new HlsLib({
            startLevel: -1,
            enableWorker: true,
            // Optimized for fast VOD startup & sub-3s buffering
            maxBufferLength: 10,            // buffer 10s ahead
            maxMaxBufferLength: 30,         // cap total buffer at 30s
            maxBufferSize: 30 * 1000 * 1000, // 30MB max buffer memory
            startFragPrefetch: true,        // prefetch first segment before manifest fully parsed
            backBufferLength: 5,            // keep only 5s of back-buffer
          });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(video);

          // autoPlay doesn't work natively with hls.js — kick-start after manifest parse
          if (rest.autoPlay) {
            hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
              video.play().catch(() => {});
            });
          }
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Safari native HLS (iOS)
          video.src = src;
          if (rest.autoPlay) {
            video.play().catch(() => {});
          }
        }
      });
    } else {
      video.src = src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  // iOS Safari requires these attributes to allow inline playback
  // and prevent the native QuickTime fullscreen player from hijacking
  return (
    <video
      ref={internalRef}
      {...rest}
      playsInline
      // @ts-ignore – webkit vendor attribute for older iOS
      webkit-playsinline="true"
    />
  );
});


export function useGlobalPauseState() {
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let modalOpen = false;
    const updateState = () => setIsPaused(document.hidden || modalOpen);

    const handleModal = (e: any) => {
      modalOpen = e.detail;
      updateState();
    };

    document.addEventListener("visibilitychange", updateState);
    window.addEventListener("videoModalState", handleModal);

    return () => {
      document.removeEventListener("visibilitychange", updateState);
      window.removeEventListener("videoModalState", handleModal);
    };
  }, []);

  return isPaused;
}

export function useIdleTimer(timeoutMs = 10000) {
  const [isIdle, setIsIdle] = useState(false);
  const isGlobalPaused = useGlobalPauseState();
  const lastMoveTime = useRef(0);
  const isIdleRef = useRef(false);

  // Keep ref in sync with state for use in event handlers
  useEffect(() => {
    isIdleRef.current = isIdle;
  }, [isIdle]);

  useEffect(() => {
    if (isGlobalPaused) {
      setIsIdle(false);
      return;
    }

    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      // Mouse move is sticky once in immersion - only scroll or manual exit works
      if (isIdleRef.current) return;

      setIsIdle(false);
      clearTimeout(timeoutId);
    };

    const handleScroll = () => {
      // Scroll always exits immersion as requested
      if (isIdleRef.current) {
        setIsIdle(false);
      }
    };

    // Touch handling for mobile — overflow:hidden blocks scroll events,
    // so we detect swipe-up (scroll down intent) via touch delta
    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isIdleRef.current) return;
      const deltaY = touchStartY - e.touches[0].clientY;
      // If user swipes up by more than 30px, exit immersion
      if (deltaY > 30) {
        setIsIdle(false);
      }
    };

    // Wheel handling for PC — overflow:hidden blocks scroll events,
    // but wheel events still fire on mouse wheel / trackpad
    const handleWheel = (e: WheelEvent) => {
      if (!isIdleRef.current) return;
      // deltaY > 0 means scrolling down
      if (e.deltaY > 0) {
        setIsIdle(false);
      }
    };

    // Throttled mousemove to avoid excessive state updates
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastMoveTime.current > 150) {
        lastMoveTime.current = now;
        resetTimer();
      }
    };

    const triggerManual = () => {
      // Scroll to top automatically so user is not stuck midway
      window.scrollTo({ top: 0, behavior: "smooth" });
      setIsIdle(true);
      clearTimeout(timeoutId);
    };

    const exitManual = () => {
      setIsIdle(false);
    };

    window.addEventListener("mousemove", throttledReset, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("triggerCinematic", triggerManual);
    window.addEventListener("exitCinematic", exitManual);

    // Automatic idle trigger is disabled based on user request "let the immersion button do its job"
    // timeoutId = setTimeout(() => {
    //   if (window.scrollY < 100) {
    //     setIsIdle(true);
    //   }
    // }, timeoutMs);

    return () => {
      window.removeEventListener("mousemove", throttledReset);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("triggerCinematic", triggerManual);
      window.removeEventListener("exitCinematic", exitManual);
      clearTimeout(timeoutId);
    };
  }, [timeoutMs, isGlobalPaused]);

  return isIdle;
}


// --- Navbar ---
export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isIdle = useIdleTimer(10000);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = ["Work", "Films", "Gallery", "Contact"];

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 md:px-12 py-4 md:py-6 flex justify-between items-center",
        isScrolled
          ? "bg-black/70 backdrop-blur-xl shadow-lg py-3 md:py-4"
          : "bg-transparent",
        isIdle && !isScrolled ? "opacity-0 pointer-events-none" : "opacity-100"
      )}>
        {/* Logo */}
        <div className="relative group cursor-pointer">
          <div className="text-xl md:text-2xl font-playfair font-semibold tracking-tight text-[#F8F5F0] drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            D&C <span className="text-xs md:text-sm font-sans font-bold uppercase tracking-[0.3em] ml-1 text-[#C5A059]">MediaHouse</span>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex gap-10 items-center">
          {navItems.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-[11px] font-inter font-medium uppercase tracking-[2px] text-[#F8F5F0]/70 hover:text-[#C5A059] transition-all duration-300 relative group py-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
            >
              {item}
              <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-[#C5A059] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setIsMenuOpen(true)}
          aria-label="Open menu"
          className="md:hidden text-[#F8F5F0] p-2 hover:text-[#C5A059] transition-colors drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
        >
          <Menu size={24} strokeWidth={1.5} />
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "tween", duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[60] bg-[#F5F1EB] flex flex-col p-8 md:p-12"
          >
            <div className="flex justify-between items-center mb-16">
              <div className="text-xl font-playfair font-semibold text-[#1C1C1C]">
                D&C <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] ml-1 text-[#C2A36B]">MediaHouse</span>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="text-[#1C1C1C] hover:text-[#C2A36B] transition-colors"
              >
                <X size={28} strokeWidth={1} />
              </button>
            </div>

            <div className="flex flex-col gap-8">
              {navItems.map((item, idx) => (
                <motion.a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={() => setIsMenuOpen(false)}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + idx * 0.1 }}
                  className="text-3xl font-playfair font-medium text-[#1C1C1C] hover:text-[#C2A36B] transition-colors"
                >
                  {item}
                </motion.a>
              ))}
            </div>

            <div className="mt-auto pt-12 border-t border-[#1C1C1C]/10">
              <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-[#6B645D] mb-6">Connect</p>
              <div className="flex gap-8">
                <a href={siteConfig.contact.instagram} target="_blank" rel="noopener noreferrer" className="text-[#1C1C1C] hover:text-[#C2A36B] transition-colors">
                  <Instagram size={22} strokeWidth={1.5} />
                </a>
                <a href={siteConfig.contact.whatsapp} target="_blank" rel="noopener noreferrer" className="text-[#1C1C1C] hover:text-[#C2A36B] transition-colors">
                  <MessageCircle size={22} strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// --- Hero Section ---
export function Hero() {
  const isIdle = useIdleTimer(10000);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isGlobalPaused = useGlobalPauseState();
  const audioFadeRef = useRef<NodeJS.Timeout | null>(null);

  // Play video on component mount and keep it playing throughout
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.play().catch(() => { });
  }, []);

  // FIXED: Handle audio fade-in on immersion entry, immediate kill on exit
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Clear any existing fade animation
    if (audioFadeRef.current) {
      clearInterval(audioFadeRef.current);
      audioFadeRef.current = null;
    }

    if (isIdle) {
      // ✅ ENTERING IMMERSION: Unmute and fade in volume over 1 second
      video.muted = false;
      video.volume = 0;

      const targetVolume = 0.3;
      const duration = 1000; // 1 second fade-in
      const startTime = Date.now();

      audioFadeRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic for smooth fade
        const eased = 1 - Math.pow(1 - progress, 3);
        video.volume = targetVolume * eased;

        if (progress >= 1) {
          clearInterval(audioFadeRef.current!);
          audioFadeRef.current = null;
        }
      }, 16); // ~60fps
    } else {
      // ✅ EXITING IMMERSION: Immediately mute and silence
      video.muted = true;
      video.volume = 0;
    }

    return () => {
      if (audioFadeRef.current) {
        clearInterval(audioFadeRef.current);
        audioFadeRef.current = null;
      }
    };
  }, [isIdle]);

  // Hide scrollbar during cinematic mode
  useEffect(() => {
    document.documentElement.style.overflow = isIdle ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [isIdle]);

  useEffect(() => {
    if (videoRef.current) {
      if (isGlobalPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => { });
      }
    }
  }, [isGlobalPaused]);

  return (
    <section id="hero" className="relative h-screen w-full overflow-hidden flex flex-col items-center justify-center bg-[#2D2926]">
      <HlsVideo
        ref={videoRef}
        src={siteConfig.hero.video}
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover will-change-transform"
        onContextMenu={(e) => e.preventDefault()}
        controlsList="nodownload"
      />

      <div className={cn(
        "relative z-10 text-center px-4 max-w-5xl mt-20 transition-all duration-1000",
        isIdle ? "opacity-0 pointer-events-none scale-105 blur-sm" : "opacity-100 blur-none scale-100"
      )}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="text-[#b8913e] text-[10px] uppercase tracking-[0.6em] font-bold mb-8 block">
            {siteConfig.hero.topline}
          </span>
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold text-[#F8F5F0] drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] tracking-tight mb-6 sm:mb-8 leading-[0.9] sm:leading-[0.85] font-playfair italic will-change-transform">
            {siteConfig.hero.headline}
          </h1>
          <p className="text-[10px] sm:text-sm md:text-xl text-[#F8F5F0]/80 font-medium tracking-[0.3em] sm:tracking-widest mb-8 sm:mb-12 max-w-2xl mx-auto uppercase drop-shadow-md">
            {siteConfig.hero.subheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center drop-shadow-lg scale-90 sm:scale-100">
            <a href={siteConfig.hero.primaryButton.link} className="w-full sm:w-auto px-10 sm:px-12 py-4 sm:py-5 bg-[#8B6F2E] text-white text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-medium hover:bg-[#A68546] shadow-md transition-all duration-500 whitespace-nowrap">
              {siteConfig.hero.primaryButton.text}
            </a>
            <a href={siteConfig.hero.secondaryButton.link} className="w-full sm:w-auto px-10 sm:px-12 py-4 sm:py-5 text-[#F8F5F0] sm:text-[#2D2926] text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-medium hover:text-[#C5A059] transition-all duration-500 whitespace-nowrap">
              {siteConfig.hero.secondaryButton.text}
            </a>
          </div>
        </motion.div>
      </div>




      {/* Manual Cinematic Mode Button */}
      <button
        onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new Event("triggerCinematic")); }}
        title="Enter Cinematic Mode"
        className={cn(
          "absolute bottom-24 md:bottom-8 right-6 md:right-8 z-20 flex px-5 py-3 items-center gap-3 bg-black/30 hover:bg-[#C5A059] backdrop-blur-md rounded-full text-white/70 hover:text-white border border-white/10 hover:border-transparent transition-all duration-500 shadow-lg group",
          isIdle ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        <span className="text-[9px] uppercase tracking-[0.4em] font-bold group-hover:tracking-[0.5em] transition-all duration-300">
          Watch
        </span>
        <Play size={14} fill="currentColor" />
      </button>

      {/* Immersion Controls - Exit Only */}
      <AnimatePresence>
        {isIdle && (
          <div className="absolute bottom-10 right-10 z-30 flex items-center gap-4">
            {/* Stop Immersion (X) */}
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new Event("exitCinematic")); }}
              className="p-5 bg-black/50 hover:bg-white text-white hover:text-black backdrop-blur-2xl rounded-full border border-white/20 transition-all duration-500 shadow-2xl flex items-center justify-center group"
              title="Exit Immersion"
            >
              <X size={26} strokeWidth={1.5} />
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}

// --- Brand Strip ---
export const BrandStrip = memo(function BrandStrip() {
  const brands = useMemo(() => [...siteConfig.brands, ...siteConfig.brands, ...siteConfig.brands], []);

  return (
    <div className="relative bg-white border-b border-[#2D2926]/5 overflow-hidden">
      {/* Top overlap strip to eliminate any seam between Hero and BrandStrip */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-white -translate-y-full" />
      <div className="py-16 md:py-24 relative">
      <div className="relative mb-12 md:mb-16">
        <div className="absolute inset-y-0 left-0 w-24 md:w-64 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 md:w-64 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        <div className="flex overflow-hidden">
          <motion.div
            animate={{ x: ["-33.33%", "0%"] }}
            transition={{
              duration: 40,
              repeat: Infinity,
              ease: "linear"
            }}
            className="flex gap-12 md:gap-24 items-center whitespace-nowrap px-12"
          >
            {brands.map((brand, idx) => (
              <div key={`${brand.name}-${idx}`} className="flex-shrink-0 cursor-pointer">
                <div className="w-16 h-16 md:w-24 md:h-24 flex items-center justify-center rounded-full overflow-hidden shadow-sm border border-[#2D2926]/5">
                  <img
                    src={brand.logo}
                    alt={brand.name}
                    loading="lazy"
                    decoding="async"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-center gap-4">
          <div className="h-[1px] w-6 md:w-8 bg-[#C5A059]/20" />
          <p className="text-[#2D2926]/70 text-[8px] md:text-[9px] uppercase tracking-[0.6em] font-bold text-center -mr-[0.6em]">
            Trusted by Industry Leaders
          </p>
          <div className="h-[1px] w-6 md:w-8 bg-[#C5A059]/20" />
        </div>
      </div>
      </div>
    </div>
  );
});

// --- Portfolio Grid ---
export function PortfolioGrid() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const categories = ["All", "Event", "Brands", "Commercials"];

  const filteredItems = useMemo(() => (activeCategory === "All"
    ? siteConfig.portfolio
    : siteConfig.portfolio.filter(item => item.category === activeCategory)
  ).filter(item => !(item as any).isDirectorCut), [activeCategory]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("videoModalState", { detail: !!openVideo }));
  }, [openVideo]);

  return (
    <section id="work" className="py-20 md:py-32 bg-[#F5F2ED] px-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 md:mb-24 gap-8 md:gap-12">
          <div className="max-w-xl">
            <h2 className="text-[#8B6F2E] text-[10px] uppercase tracking-[0.6em] font-bold mb-4 md:mb-6">Selected Works</h2>
            <h3 className="text-4xl md:text-7xl font-bold text-[#2D2926] tracking-tight font-serif leading-none">Crafting visual legacies.</h3>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                   "text-[9px] uppercase tracking-[0.3em] px-6 md:px-8 py-3 md:py-4 border transition-all duration-500 font-bold",
                   activeCategory === cat
                     ? "bg-[#8B6F2E] text-white border-[#8B6F2E]"
                     : "text-[#2D2926]/60 border-[#2D2926]/10 hover:border-[#2D2926]/30 hover:text-[#2D2926]"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1]
                }}
              >
                <PortfolioItem
                  item={item}
                  onOpen={() => setOpenVideo(item.video)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* View Full Portfolio Button */}
        <div className="flex justify-center mt-16 md:mt-24">
          <a
            href={siteConfig.playbook.main}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-12 py-5 border border-[#2D2926]/20 text-[#2D2926]/70 text-[10px] uppercase tracking-[0.4em] font-bold hover:bg-[#8B6F2E] hover:text-white hover:border-[#8B6F2E] transition-all duration-500 group"
          >
            View Full Portfolio
            <ExternalLink size={14} className="group-hover:translate-x-1 transition-transform duration-300" />
          </a>
        </div>
      </div>

      {/* Video Modal for portfolio items */}
      <AnimatePresence>
        {openVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2D2926]/95 backdrop-blur-md"
            onClick={() => setOpenVideo(null)}
          >
            <button
              onClick={() => setOpenVideo(null)}
              className="absolute top-10 right-10 text-white/50 hover:text-white transition-all duration-300 cursor-pointer"
              aria-label="Close Modal"
            >
              <X size={40} />
            </button>
            <div className="w-full max-w-7xl px-8 aspect-video" onClick={(e) => e.stopPropagation()}>
              <HlsVideo
                src={openVideo}
                autoPlay
                controls
                playsInline
                className="w-full h-full object-contain"
                onContextMenu={(e) => e.preventDefault()}
                controlsList="nodownload"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const PortfolioItem = memo(function PortfolioItem({ item, onOpen }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Lazy load: only load video source when near viewport
  const { ref: lazyRef, inView: isNearViewport } = useInView({
    threshold: 0,
    triggerOnce: true,
    rootMargin: "200px",
  });

  // Play trigger: tighter threshold for play/pause
  const { ref: playRef, inView } = useInView({
    threshold: 0.3,
    triggerOnce: false,
  });

  // Combine refs
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    lazyRef(node);
    playRef(node);
  }, [lazyRef, playRef]);

  useEffect(() => {
    setIsMobile(!window.matchMedia('(hover: hover)').matches);
  }, []);

  const shouldPlay = isMobile ? inView : isHovered;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (shouldPlay) {
      video.play().catch(() => { });
    } else {
      video.pause();
      // Reset to start for consistent preview
      if (video.readyState > 0) video.currentTime = 0;
    }
  }, [shouldPlay]);

  // Cleanup on unmount — free memory (HLS src is managed by hls.js, just pause)
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
      }
    };
  }, []);

  return (
    <div
      ref={setRefs}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onOpen}
      className={cn("relative overflow-hidden group bg-[#2D2926] border border-[#2D2926]/5 rounded-2xl md:rounded-[2rem] cursor-pointer w-full", item.aspect)}
    >
      {/* Skeleton */}
      {!videoLoaded && (
        <div className="absolute inset-0 bg-[#2D2926] animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#C5A059]/30 border-t-[#C5A059] rounded-full animate-spin" />
        </div>
      )}

      {/* Video — only mount source when near viewport */}
      {isNearViewport && (
        <HlsVideo
          ref={videoRef}
          src={item.video}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedData={() => setVideoLoaded(true)}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-all duration-700 will-change-transform",
            shouldPlay ? "scale-110" : "scale-100",
            videoLoaded ? "opacity-100" : "opacity-0"
          )}
          onContextMenu={(e) => e.preventDefault()}
          controlsList="nodownload"
        />
      )}

      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent transition-all duration-500 flex flex-col justify-end p-10",
        shouldPlay ? "opacity-100" : "opacity-0"
      )}>
        <p className="text-[9px] uppercase tracking-[0.4em] text-[#C5A059] font-bold mb-3 drop-shadow-sm">{item.category}</p>
        <h4 className="text-2xl md:text-3xl font-bold text-white tracking-tight font-serif italic drop-shadow-md">{item.title}</h4>
        <div className={cn(
          "mt-4 md:mt-6 h-[1px] bg-[#C5A059] transition-all duration-700",
          shouldPlay ? "w-full" : "w-12"
        )} />
        {item.playbookBoard && (
          <a
            href={(siteConfig.playbook.boards as any)[item.playbookBoard]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-4 flex items-center gap-2 text-[9px] uppercase tracking-[0.3em] text-white/60 hover:text-[#C5A059] transition-colors duration-300 w-fit"
          >
            View more <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
});

// --- Featured Carousel ---
const FilmSlide = memo(function FilmSlide({
  item,
  isGlobalPaused,
  onPlayReel,
}: {
  item: (typeof siteConfig.portfolio)[number];
  isGlobalPaused: boolean;
  onPlayReel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attempt play whenever globalPaused changes or component mounts
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isGlobalPaused) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [isGlobalPaused]);

  // When HLS finishes loading & the video has enough data, kick-start playback
  const handleCanPlay = useCallback(() => {
    const video = videoRef.current;
    if (video && !isGlobalPaused) {
      video.play().catch(() => {});
    }
  }, [isGlobalPaused]);

  const smoothEase = [0.25, 0.1, 0.25, 1] as const;  // CSS "ease" equivalent
  const slideEase = [0.22, 1, 0.36, 1] as const;      // Smooth decel

  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.9, ease: smoothEase }}
      className="absolute inset-0"
    >
      <HlsVideo
        ref={videoRef}
        src={item.video}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onCanPlay={handleCanPlay}
        onLoadedData={handleCanPlay}
        className="w-full h-full object-cover will-change-transform"
        onContextMenu={(e) => e.preventDefault()}
        controlsList="nodownload"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent p-10 md:p-16 flex flex-col justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6, delay: 0.3, ease: slideEase }}
            className="text-[#C5A059] font-bold tracking-[0.6em] uppercase text-[10px] mb-4 md:mb-6"
          >
            {item.category}
          </motion.p>
          <motion.h4
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.7, delay: 0.45, ease: slideEase }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold text-[#F8F5F0] drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] mb-8 md:mb-10 max-w-3xl leading-[0.9] font-serif italic"
          >
            {item.title}
          </motion.h4>
          <motion.button
            onClick={onPlayReel}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6, delay: 0.6, ease: slideEase }}
            className="w-fit px-8 md:px-12 py-4 md:py-5 bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.4em] font-bold hover:bg-[#A68546] transition-all duration-500"
          >
            Play Reel
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});

export function FeaturedCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const items = useMemo(() => siteConfig.portfolio.filter(item => (item as any).isDirectorCut), []);
  const isGlobalPaused = useGlobalPauseState();

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("videoModalState", { detail: isVideoModalOpen }));
  }, [isVideoModalOpen]);

  useEffect(() => {
    if (isVideoModalOpen) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [items.length, isVideoModalOpen, currentIndex]);

  return (
    <section id="films" className="py-32 bg-white overflow-hidden border-y border-[#2D2926]/5">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
          <div>
            <h2 className="text-[#8B6F2E] text-[10px] uppercase tracking-[0.6em] font-bold mb-6">Featured Films</h2>
            <h3 className="text-4xl md:text-7xl font-bold text-[#2D2926] tracking-tight font-serif leading-none">The Director's Cut</h3>
          </div>
          <div className="flex gap-2 md:gap-3">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Film ${idx + 1}`}
                className={cn(
                  "w-8 md:w-16 h-[2px] transition-all duration-700",
                  currentIndex === idx ? "bg-[#8B6F2E]" : "bg-[#2D2926]/10"
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-8 group">
          {/* Previous Arrow */}
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)}
            className="w-10 h-10 md:w-14 md:h-14 shrink-0 bg-white hover:bg-[#C5A059] border border-[#2D2926]/10 rounded-full flex items-center justify-center text-[#2D2926] hover:text-white transition-all duration-300 shadow-sm opacity-0 group-hover:opacity-100 hidden md:flex"
            aria-label="Previous Film"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="relative aspect-[4/5] md:aspect-video w-full overflow-hidden bg-transparent border border-[#2D2926]/5 rounded-2xl md:rounded-[3rem]">
            <AnimatePresence initial={false}>
              <FilmSlide
                key={currentIndex}
                item={items[currentIndex]}
                isGlobalPaused={isGlobalPaused}
                onPlayReel={() => setIsVideoModalOpen(true)}
              />
            </AnimatePresence>
          </div>

          {/* Next Arrow */}
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % items.length)}
            className="w-10 h-10 md:w-14 md:h-14 shrink-0 bg-white hover:bg-[#C5A059] border border-[#2D2926]/10 rounded-full flex items-center justify-center text-[#2D2926] hover:text-white transition-all duration-300 shadow-sm opacity-0 group-hover:opacity-100 hidden md:flex"
            aria-label="Next Film"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isVideoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2D2926]/95 backdrop-blur-md"
          >
            <button
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute top-10 right-10 text-white/50 hover:text-white transition-all duration-300 cursor-pointer"
              aria-label="Close Modal"
            >
              <X size={40} />
            </button>
            <div className="w-full max-w-7xl px-8 aspect-video">
              <HlsVideo
                src={items[currentIndex].video}
                autoPlay
                controls
                playsInline
                className="w-full h-full object-contain"
                onContextMenu={(e) => e.preventDefault()}
                controlsList="nodownload"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// --- Gallery Section ---
export const Gallery = memo(function Gallery() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <section id="gallery" className="py-20 md:py-32 bg-[#F5F2ED] px-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 md:mb-24 gap-8 md:gap-12">
          <div className="max-w-xl">
            <h2 className="text-[#8B6F2E] text-[10px] uppercase tracking-[0.6em] font-bold mb-4 md:mb-6">Visual Journal</h2>
            <h3 className="text-4xl md:text-7xl font-bold text-[#2D2926] tracking-tight font-serif leading-none">Collaborations.</h3>
          </div>
          <p className="text-[#2D2926]/60 text-[10px] uppercase tracking-[0.4em] font-bold max-w-xs md:text-right">
            A collection of frames captured across the globe.
          </p>
        </div>

        <div ref={ref} className="columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
          {siteConfig.gallery.map((img, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: Math.min(idx * 0.06, 0.6), ease: [0.22, 1, 0.36, 1] }}
              className="break-inside-avoid overflow-hidden group bg-white border border-[#2D2926]/5 rounded-2xl md:rounded-[2rem] cursor-zoom-in"
              onClick={() => setSelectedImage(img)}
            >
              <img
                src={img}
                alt={`Gallery ${idx}`}
                loading="lazy"
                decoding="async"
                width={600}
                height={800}
                className="w-full h-auto object-cover transition-transform duration-1000 will-change-transform group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2D2926]/95 backdrop-blur-xl p-4 md:p-12 cursor-zoom-out"
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 md:top-10 md:right-10 text-white/50 hover:text-white transition-all duration-300 z-[101]"
            >
              <X size={40} strokeWidth={1.5} />
            </motion.button>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full h-full flex items-center justify-center"
            >
              <img
                src={selectedImage}
                alt="Selected Gallery Item"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
});


// --- Merged Contact Section ---
export function Contact() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="contact" className="pt-24 md:pt-48 pb-16 bg-white px-6 md:px-8 border-t border-[#2D2926]/5">
      <div className="max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="text-center mb-24 md:mb-32">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
          >
            <span className="text-[#8B6F2E] text-[10px] uppercase tracking-[0.8em] font-bold mb-8 block">
              Collaboration
            </span>
            <h2 className="text-5xl md:text-9xl font-bold text-[#2D2926] tracking-tighter mb-8 leading-[0.8] font-serif italic">
              {siteConfig.contact.cta}
            </h2>
          </motion.div>
        </div>

        {/* Integration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 md:gap-24 items-start">
          {/* Left Column: Quick Contact */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            viewport={{ once: true }}
            className="lg:col-span-5 space-y-8"
          >
            <div>
              <h3 className="text-4xl md:text-6xl font-bold text-[#2D2926] tracking-tight font-serif italic mb-6 leading-tight">
                Want to <span className="text-[#C5A059]">get in touch</span>?
              </h3>
              <p className="text-[#2D2926]/65 text-base md:text-lg leading-relaxed max-w-md">
                Drop me a message! Whether you have a project in mind or just want to say hi, I'll get back to you within 24 hours.
              </p>
            </div>

            <div className="space-y-4 pt-6">
              <p className="text-[9px] uppercase tracking-[0.4em] font-bold text-[#2D2926]/70">Quick Connect</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={siteConfig.contact.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-8 py-4 border-2 border-[#25D366]/40 bg-white text-[#2D2926] text-[9px] uppercase tracking-[0.4em] font-bold hover:bg-[#25D366] hover:text-white hover:border-[#25D366] transition-all duration-500 group shadow-sm flex-1 sm:flex-none justify-center"
                >
                  <MessageCircle size={16} className="text-[#25D366] group-hover:text-white transition-colors" />
                  WhatsApp
                </a>
                <a
                  href={siteConfig.contact.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-8 py-4 border-2 border-[#C5A059]/40 bg-white text-[#2D2926] text-[9px] uppercase tracking-[0.4em] font-bold hover:bg-[#C5A059] hover:text-white hover:border-[#C5A059] transition-all duration-500 group shadow-sm flex-1 sm:flex-none justify-center"
                >
                  <Instagram size={16} className="text-[#C5A059] group-hover:text-white transition-colors" />
                  Instagram
                </a>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Form */}
          <div className="lg:col-span-7 bg-[#F5F2ED]/30 p-8 md:p-12 rounded-[2rem] border border-[#2D2926]/5">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="w-16 h-16 rounded-full bg-[#C5A059]/10 flex items-center justify-center mx-auto mb-6">
                  <Send size={24} className="text-[#C5A059]" />
                </div>
                <h3 className="text-2xl font-bold text-[#2D2926] font-serif mb-3 italic">Message Sent!</h3>
                <p className="text-[#2D2926]/40 text-sm tracking-wide">Thanks for reaching out. We'll get back to you soon.</p>
              </motion.div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  try {
                    await fetch(`https://formsubmit.co/ajax/${siteConfig.contact.email}`, {
                      method: "POST",
                      headers: { "Accept": "application/json" },
                      body: data,
                    });
                  } catch (_) { }
                  setSubmitted(true);
                }}
                className="space-y-6"
              >
                <input type="hidden" name="_captcha" value="false" />
                <input type="hidden" name="_template" value="table" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-[0.4em] font-bold text-[#2D2926]/70 ml-1">First name</label>
                    <input type="text" name="first_name" required placeholder="Saksham" className="w-full px-6 py-4 bg-white border border-[#2D2926]/5 rounded-xl text-[#2D2926] text-sm focus:outline-none focus:border-[#C5A059] transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-[0.4em] font-bold text-[#2D2926]/70 ml-1">Last name</label>
                    <input type="text" name="last_name" required placeholder="Chaudhary" className="w-full px-6 py-4 bg-white border border-[#2D2926]/5 rounded-xl text-[#2D2926] text-sm focus:outline-none focus:border-[#C5A059] transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-[0.4em] font-bold text-[#2D2926]/70 ml-1">Email</label>
                  <input type="email" name="email" required placeholder="you@example.com" className="w-full px-6 py-4 bg-white border border-[#2D2926]/5 rounded-xl text-[#2D2926] text-sm focus:outline-none focus:border-[#C5A059] transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-[0.4em] font-bold text-[#2D2926]/70 ml-1">Message</label>
                  <textarea name="message" required rows={4} placeholder="Hi! I'd love to chat about..." className="w-full px-6 py-4 bg-white border border-[#2D2926]/5 rounded-xl text-[#2D2926] text-sm focus:outline-none focus:border-[#C5A059] transition-all resize-none" />
                </div>
                <button type="submit" className="w-full py-5 bg-[#2D2926] text-white text-[10px] uppercase tracking-[0.5em] font-bold rounded-xl hover:bg-[#C5A059] hover:shadow-xl hover:shadow-[#C5A059]/20 transition-all duration-500 flex items-center justify-center gap-3">
                  Submit <Send size={14} />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-48 pt-12 border-t border-[#2D2926]/5 text-center text-[#2D2926]/70 text-[9px] uppercase tracking-[0.4em] font-bold">
          <p>© {new Date().getFullYear()} {siteConfig.name} Studios. All Rights Reserved.</p>
        </div>
      </div>
    </section>
  );
}

// --- Clips Layout (Vertical Videos) ---
export function ClipsLayout() {
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const clips = (siteConfig as any).clips || [];

  return (
    <section id="clips" className="py-24 md:py-32 bg-[#2D2926] px-6 md:px-8 overflow-hidden rounded-[3rem] md:rounded-[5rem] mb-20 relative z-10 mx-4 md:mx-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 md:mb-24 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="max-w-xl">
            <h2 className="text-[#d4b46a] text-[10px] uppercase tracking-[0.6em] font-bold mb-6">Shorts</h2>
            <h3 className="text-4xl md:text-7xl font-bold text-[#F8F5F0] tracking-tight font-serif leading-none italic">Visual Notes.</h3>
          </div>
          <p className="text-[#F8F5F0]/60 text-[9px] uppercase tracking-[0.4em] font-bold max-w-[200px] md:text-right leading-loose">
            VERTICAL STORYTELLING FOR THE MODERN SCREEN.
          </p>
        </div>

        <div className="flex gap-4 md:gap-10 overflow-x-auto pb-12 scrollbar-none snap-x -mx-6 px-6 md:mx-0 md:px-0">
          {clips.map((clip: any) => (
            <motion.div
              key={clip.id}
              whileHover={{ y: -10 }}
              className="flex-shrink-0 w-[280px] md:w-[320px] aspect-[9/16] bg-black rounded-[2.5rem] overflow-hidden relative group cursor-pointer snap-center border border-white/5 shadow-2xl"
              onClick={() => setActiveClip(clip.video)}
            >
              <ClipsPreview video={clip.video} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-10 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <p className="text-[#C5A059] text-[8px] uppercase tracking-[0.4em] font-bold mb-3">{clip.category}</p>
                <h4 className="text-2xl font-bold text-white font-serif italic tracking-tight">{clip.title}</h4>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-75 group-hover:scale-100 border border-white/10 shadow-2xl">
                <Play size={24} fill="white" className="text-white ml-1.5" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {activeClip && (
          <VerticalVideoPlayer
            src={activeClip}
            onClose={() => setActiveClip(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function ClipsPreview({ video }: { video: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ref, inView } = useInView({ threshold: 0.1 });

  useEffect(() => {
    if (inView && videoRef.current) {
      videoRef.current.play().catch(() => {});
    } else if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [inView]);

  return (
    <div ref={ref} className="w-full h-full">
      <HlsVideo
        ref={videoRef}
        src={video}
        muted
        loop
        playsInline
        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700"
      />
    </div>
  );
}

function VerticalVideoPlayer({ src, onClose }: { src: string; onClose: () => void }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: "D&C MediaHouse Clip",
        url: window.location.href,
      }).catch(() => {});
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      setProgress((video.currentTime / video.duration) * 100);
    };

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl px-6"
      onClick={onClose}
    >
      <div
        className="relative h-[85vh] aspect-[9/16] bg-[#111] rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <HlsVideo
          ref={videoRef}
          src={src}
          autoPlay
          muted={isMuted}
          loop
          playsInline
          className="w-full h-full object-cover"
          onClick={togglePlay}
        />

        {/* Top Controls */}
        <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-black/40 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
          <div className="flex gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
              className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-black/40 transition-all cursor-pointer"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-black/40 transition-all cursor-pointer"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>

        {/* Center Play/Pause Overlay */}
        <AnimatePresence>
          {!isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none"
            >
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center">
                <Play size={40} fill="white" className="text-white ml-2" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-[#C5A059]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}