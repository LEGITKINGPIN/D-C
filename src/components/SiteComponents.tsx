import { motion, AnimatePresence } from "motion/react";
import React, { useState, useEffect, useRef, useCallback, forwardRef, memo, useMemo, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import type Hls from "hls.js";
import { Play, X, ChevronLeft, ChevronRight, Instagram, MessageCircle, Menu, Send, ExternalLink, Volume2, VolumeX, Share2, Settings, Maximize, Minimize } from "lucide-react";
import { cn } from "../lib/utils";
import { siteConfig } from "../data";
import { useInView } from "react-intersection-observer";
import MuxPlayer from "@mux/mux-player-react";
import { useSanityProjects } from "../hooks/useSanityProjects";


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

  const resolvedSrc = useMemo(() => {
    if (!src || src.startsWith("http") || src.startsWith("blob:") || src.startsWith("data:")) return src;
    const baseUrl = import.meta.env.VITE_STORJ_BASE_URL;
    return baseUrl ? `${baseUrl}${src}` : src;
  }, [src]);

  // Proper ref forwarding via useImperativeHandle
  useImperativeHandle(ref, () => internalRef.current!, []);

  useEffect(() => {
    const video = internalRef.current;
    if (!video || !resolvedSrc) return;

    // Clean up previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (resolvedSrc.endsWith(".m3u8")) {
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
          hls.loadSource(resolvedSrc);
          hls.attachMedia(video);

          // autoPlay doesn't work natively with hls.js — kick-start after manifest parse
          if (rest.autoPlay) {
            hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
              video.play().catch(() => { });
            });
          }
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Safari native HLS (iOS)
          video.src = resolvedSrc;
          if (rest.autoPlay) {
            video.play().catch(() => { });
          }
        }
      });
    } else {
      video.src = resolvedSrc;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [resolvedSrc]);

  // iOS Safari requires these attributes to allow inline playback
  // and prevent the native QuickTime fullscreen player from hijacking
  return (
    <video
      ref={internalRef}
      aria-hidden="true"
      title="Cinematic video"
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
export function Navbar({ activeView = "home", setActiveView }: { activeView?: string; setActiveView?: (v: string) => void }) {
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

  const navItems = ["Work", "Films", "Gallery", "About", "Contact"];

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 md:px-12 py-4 md:py-6 flex justify-between items-center",
        (isScrolled || activeView === "about")
          ? "bg-black/90 backdrop-blur-xl shadow-lg py-3 md:py-4"
          : "bg-transparent",
        (isIdle && !isScrolled && activeView === "home") ? "opacity-0 pointer-events-none" : "opacity-100"
      )}>
        {/* Logo */}
        <div 
          className="relative group cursor-pointer"
          onClick={() => {
            setActiveView?.("home");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
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
              onClick={(e) => {
                if (item === "About") {
                  e.preventDefault();
                  setActiveView?.("about");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  if (activeView === "about") {
                    e.preventDefault();
                    setActiveView?.("home");
                    setTimeout(() => {
                      document.getElementById(item.toLowerCase())?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }
                }
              }}
              className={cn(
                "text-[11px] font-inter font-medium uppercase tracking-[2px] hover:text-[#C5A059] transition-all duration-300 relative group py-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]",
                (activeView === "about" && item === "About") ? "text-[#C5A059]" : "text-[#F8F5F0]/70"
              )}
            >
              {item}
              <span className="absolute bottom-0 left-0 h-[1px] bg-[#C5A059] transition-all duration-300 group-hover:w-full w-0" />
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
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    if (item === "About") {
                      e.preventDefault();
                      setActiveView?.("about");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    } else {
                      if (activeView === "about") {
                        e.preventDefault();
                        setActiveView?.("home");
                        setTimeout(() => {
                          document.getElementById(item.toLowerCase())?.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                      }
                    }
                  }}
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

  const { projects, loading } = useSanityProjects();
  const heroProject = useMemo(() => projects.find((p: any) => p.displaySection === 'hero' || (!p.displaySection && p.title.toLowerCase().includes('hero'))), [projects]);
  const heroSrc = heroProject?.playbackId ? `https://stream.mux.com/${heroProject.playbackId}.m3u8` : (loading ? '' : siteConfig.hero.video);
  const heroPoster = heroProject?.playbackId ? `https://image.mux.com/${heroProject.playbackId}/thumbnail.webp?time=0` : siteConfig.hero.poster;

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
      
      const fadeStep = 0.05; // 5% volume increase per step
      const fadeInterval = 50; // 50ms per step -> 1 second total
      
      audioFadeRef.current = setInterval(() => {
        if (video.volume < 1 - fadeStep) {
          video.volume += fadeStep;
        } else {
          video.volume = 1;
          if (audioFadeRef.current) clearInterval(audioFadeRef.current);
        }
      }, fadeInterval);
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
      {heroSrc && (
        <HlsVideo
          key={heroSrc}
          ref={videoRef}
          src={heroSrc}
          poster={heroPoster}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover will-change-transform"
          onContextMenu={(e) => e.preventDefault()}
          controlsList="nodownload"
        />
      )}

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
  const [openVideo, setOpenVideo] = useState<string | null>(null);

  const { projects, loading } = useSanityProjects();
  const filteredItems = useMemo(() => projects.filter(item => item.displaySection === 'portfolio' || (!item.displaySection && !item.title.toLowerCase().includes('director') && !item.title.toLowerCase().includes('visual notes'))), [projects]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("videoModalState", { detail: !!openVideo }));
  }, [openVideo]);

  return (
    <section id="work" className="py-20 md:py-32 bg-[#F5F2ED] px-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 md:mb-24">
          <div className="max-w-xl">
            <h2 className="text-[#7A6128] text-[10px] uppercase tracking-[0.6em] font-bold mb-4 md:mb-6">Selected Works</h2>
            <h3 className="text-4xl md:text-7xl font-bold text-[#2D2926] tracking-tight font-serif leading-none">Crafting visual legacies.</h3>
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
                  onOpen={() => setOpenVideo(item.playbackId ? `https://stream.mux.com/${item.playbackId}.m3u8` : item.video)}
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
      {typeof document !== "undefined" && createPortal(
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
        </AnimatePresence>,
        document.body
      )}
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
          src={item.playbackId ? `https://stream.mux.com/${item.playbackId}.m3u8` : item.video}
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
  item: any;
  isGlobalPaused: boolean;
  onPlayReel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  const posterUrl = useMemo(() => {
    if (item.playbackId) {
      return `https://image.mux.com/${item.playbackId}/thumbnail.webp?time=0`;
    }
    return item.thumbnail || item.poster || "";
  }, [item]);

  // Attempt play whenever globalPaused changes or component mounts
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isGlobalPaused) {
      video.pause();
    } else {
      video.play().catch(() => { });
    }
  }, [isGlobalPaused]);

  // When HLS finishes loading & the video has enough data, kick-start playback
  const handleCanPlay = useCallback(() => {
    const video = videoRef.current;
    setVideoReady(true);
    if (video && !isGlobalPaused) {
      video.play().catch(() => { });
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
      className="absolute inset-0 bg-[#2D2926]"
    >
      {/* Instant high-res poster thumbnail so card is never blank/gray */}
      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-700 will-change-transform text-transparent",
            videoReady ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
          loading="eager"
          decoding="async"
        />
      )}

      <HlsVideo
        ref={videoRef}
        src={item.playbackId ? `https://stream.mux.com/${item.playbackId}.m3u8` : item.video}
        poster={posterUrl}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onCanPlay={handleCanPlay}
        onLoadedData={handleCanPlay}
        className={cn(
          "w-full h-full object-cover will-change-transform transition-opacity duration-700",
          videoReady ? "opacity-100" : "opacity-0"
        )}
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
            className="w-fit px-8 md:px-12 py-4 md:py-5 bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.4em] font-bold hover:bg-[#A68546] transition-all duration-500 cursor-pointer"
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
  
  const { projects, loading } = useSanityProjects();
  const items = useMemo(() => {
    const sanityItems = projects.filter(item => item.displaySection === 'directorCut' || (!item.displaySection && item.title.toLowerCase().includes('director')));
    if (sanityItems.length > 0) return sanityItems;
    return siteConfig.portfolio.filter((p: any) => p.isDirectorCut);
  }, [projects]);

  // Preload all slide poster images so slide transitions are instantaneous
  useEffect(() => {
    if (!items || items.length === 0) return;
    items.forEach((it) => {
      const url = it.playbackId
        ? `https://image.mux.com/${it.playbackId}/thumbnail.webp?time=0`
        : (it.thumbnail || it.poster);
      if (url) {
        const img = new Image();
        img.src = url;
      }
    });
  }, [items]);

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
  }, [items.length, isVideoModalOpen]);

  if (items.length === 0) return null;

  return (
    <section id="films" className="py-32 bg-white overflow-hidden border-y border-[#2D2926]/5">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
          <div>
            <h2 className="text-[#7A6128] text-[10px] uppercase tracking-[0.6em] font-bold mb-6">Featured Films</h2>
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

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isVideoModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black backdrop-blur-2xl flex items-center justify-center"
              onClick={() => setIsVideoModalOpen(false)}
            >
              <VerticalVideoItem 
                src={items[currentIndex]?.playbackId ? `https://stream.mux.com/${items[currentIndex].playbackId}.m3u8` : ''} 
                onClose={() => setIsVideoModalOpen(false)} 
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </section>
  );
}

// --- Gallery Card (extracted & memoized to prevent re-creation on every Gallery render) ---
const GalleryCard = memo(function GalleryCard({ img, label, onClick }: { img: string; label: string; onClick: (img: string) => void }) {
  return (
    <div
      className="flex-shrink-0 w-[200px] h-[130px] sm:w-[260px] sm:h-[160px] md:w-[350px] md:h-[190px] lg:w-[400px] lg:h-[220px] rounded-2xl md:rounded-3xl overflow-hidden cursor-zoom-in group relative bg-[#2D2926] shadow-lg hover:shadow-2xl hover:shadow-black/20 transition-all duration-500"
      onClick={() => onClick(img)}
    >
      <img
        src={img}
        alt={`Gallery ${label}`}
        loading="lazy"
        decoding="async"
        width={800}
        height={520}
        className="w-full h-full object-cover transition-transform duration-700 will-change-transform group-hover:scale-110"
      />
      <div className="absolute inset-0 rounded-2xl md:rounded-3xl border-2 border-transparent group-hover:border-[#C5A059]/30 transition-all duration-500" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
});

// --- Gallery Lightbox with Zoom, Pan & Swipe Navigation ---
// Separate touch handling for Android/iOS vs mouse for PC.
const GalleryLightbox = memo(function GalleryLightbox({
  src,
  allImages,
  onClose,
  onNavigate,
  caption,
}: {
  src: string;
  allImages: string[];
  onClose: () => void;
  onNavigate?: (img: string) => void;
  caption?: React.ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  // Track whether a touch gesture is actively happening (disables CSS transition)
  const [isTouching, setIsTouching] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // ── Live refs so touch handlers never read stale closures ──
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;

  // ── Pan bounds enforcement ──
  // Prevents panning the image beyond its visible boundaries.
  // Pan values are in screen pixels (scale(z) translate(pan/z) = pan on screen).
  const clampPan = useCallback((p: { x: number; y: number }, z: number) => {
    if (z <= 1) return { x: 0, y: 0 };
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return p;

    const cRect = container.getBoundingClientRect();
    const iRect = img.getBoundingClientRect();
    // iRect is the *transformed* (zoomed) size on screen
    // Natural rendered size = iRect / z
    const imgW = iRect.width / z;
    const imgH = iRect.height / z;

    // Max screen-pixel offset: allow panning until the image edge meets the container edge
    const maxPanX = Math.max(0, (imgW * z - cRect.width) / 2);
    const maxPanY = Math.max(0, (imgH * z - cRect.height) / 2);

    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, p.x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, p.y)),
    };
  }, []);

  // ── Navigation helpers ──
  const currentIdx = allImages.indexOf(src);
  const goPrev = useCallback(() => {
    if (allImages.length <= 1) return;
    const prevIdx = (currentIdx - 1 + allImages.length) % allImages.length;
    setZoom(1); setPan({ x: 0, y: 0 });
    onNavigate(allImages[prevIdx]);
  }, [allImages, currentIdx, onNavigate]);

  const goNext = useCallback(() => {
    if (allImages.length <= 1) return;
    const nextIdx = (currentIdx + 1) % allImages.length;
    setZoom(1); setPan({ x: 0, y: 0 });
    onNavigate(allImages[nextIdx]);
  }, [allImages, currentIdx, onNavigate]);

  // Stable refs for navigation callbacks used inside the touch handler
  const goPrevRef = useRef(goPrev);
  const goNextRef = useRef(goNext);
  useEffect(() => { goPrevRef.current = goPrev; }, [goPrev]);
  useEffect(() => { goNextRef.current = goNext; }, [goNext]);

  // Reset zoom/pan when image changes
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [src]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowLeft") goPrev();
      else if (ev.key === "ArrowRight") goNext();
      else if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, onClose]);

  const applyZoom = useCallback((newZoom: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    setZoom(clamped);
    if (clamped <= 1) setPan({ x: 0, y: 0 });
  }, []);

  // ═══════════════════════════════════════════════════════════
  // PC: Mouse wheel zoom (unchanged — works fine)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom((prev) => {
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // PC: Mouse drag pan (unchanged — works fine)
  // ═══════════════════════════════════════════════════════════
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      panStart.current = { ...pan };
    },
    [zoom, pan]
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const newPan = {
        x: panStart.current.x + (e.clientX - dragStart.current.x),
        y: panStart.current.y + (e.clientY - dragStart.current.y),
      };
      setPan(clampPan(newPan, zoomRef.current));
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, clampPan]);

  // ═══════════════════════════════════════════════════════════
  // MOBILE: Touch handler — pinch-to-zoom (anchored at midpoint),
  //         1-finger pan (with bounds), swipe navigation,
  //         and double-tap to zoom
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // ── Pinch state ──
    let lastPinchDist: number | null = null;
    let pinchMidX = 0;
    let pinchMidY = 0;

    // ── Single-finger state ──
    let touchStartX = 0;
    let touchStartY = 0;
    let touchPanStartPos = { x: 0, y: 0 };
    let isPanningTouch = false;
    let isSwipingTouch = false;
    let swipeHandled = false;

    // ── Double-tap detection ──
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    // ── Momentum / inertia state ──
    let velocityX = 0;
    let velocityY = 0;
    let lastMoveTime = 0;
    let lastMoveX = 0;
    let lastMoveY = 0;
    let momentumRaf = 0;

    // Live-mutated copies kept in sync with React state via refs
    let liveZoom = zoomRef.current;
    let livePan = panRef.current;

    // ── Was this gesture a pinch? (prevents pan re-entry after lifting one finger from pinch) ──
    let wasPinching = false;

    const getPinchDist = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const getPinchMid = (touches: TouchList) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });

    const cancelMomentum = () => {
      if (momentumRaf) {
        cancelAnimationFrame(momentumRaf);
        momentumRaf = 0;
      }
    };

    // Clamp pan within bounds (inline version for imperative updates)
    // Same logic as clampPan above — pan is in screen pixels
    const clampPanLocal = (p: { x: number; y: number }, z: number) => {
      if (z <= 1) return { x: 0, y: 0 };
      const img = imgRef.current;
      const container = containerRef.current;
      if (!container || !img) return p;

      const cRect = container.getBoundingClientRect();
      const iRect = img.getBoundingClientRect();
      const imgW = iRect.width / z;
      const imgH = iRect.height / z;

      const maxPanX = Math.max(0, (imgW * z - cRect.width) / 2);
      const maxPanY = Math.max(0, (imgH * z - cRect.height) / 2);

      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, p.x)),
        y: Math.max(-maxPanY, Math.min(maxPanY, p.y)),
      };
    };

    // ─────────────────── TOUCH START ───────────────────
    const onTouchStart = (e: TouchEvent) => {
      // Sync from latest React state
      liveZoom = zoomRef.current;
      livePan = panRef.current;
      swipeHandled = false;
      cancelMomentum();
      setIsTouching(true);

      if (e.touches.length === 2) {
        // ── Pinch start ──
        e.preventDefault();
        isPanningTouch = false;
        isSwipingTouch = false;
        wasPinching = true;
        lastPinchDist = getPinchDist(e.touches);
        const mid = getPinchMid(e.touches);
        pinchMidX = mid.x;
        pinchMidY = mid.y;
      } else if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        lastMoveX = touchStartX;
        lastMoveY = touchStartY;
        lastMoveTime = Date.now();
        velocityX = 0;
        velocityY = 0;

        if (wasPinching) {
          // Finger lifted from a pinch — don't start a new pan/swipe,
          // just record position so the next onTouchMove can use it.
          // We'll decide on touchMove whether to start panning.
          wasPinching = false;
          if (liveZoom > 1) {
            isPanningTouch = true;
            isSwipingTouch = false;
            touchPanStartPos = { ...livePan };
            // Update touchStartX/Y to current finger so there's no jump
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
          } else {
            isPanningTouch = false;
            isSwipingTouch = false;
          }
          return;
        }

        if (liveZoom > 1) {
          // ── Pan mode (zoomed in) ──
          e.preventDefault();
          isPanningTouch = true;
          isSwipingTouch = false;
          touchPanStartPos = { ...livePan };
        } else {
          // ── Potential swipe-to-navigate or double-tap ──
          // Must preventDefault to stop browser from intercepting
          // the gesture (e.g. native double-tap-to-zoom on viewport)
          e.preventDefault();
          isPanningTouch = false;
          isSwipingTouch = true;
        }
      }
    };

    // ─────────────────── TOUCH MOVE ───────────────────
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastPinchDist !== null) {
        // ── Pinch zoom (anchored at midpoint) ──
        e.preventDefault();
        const dist = getPinchDist(e.touches);
        const scaleRatio = dist / lastPinchDist;
        lastPinchDist = dist;

        const prevZoom = liveZoom;
        liveZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, liveZoom * scaleRatio));

        if (liveZoom > 1) {
          // Adjust pan so the pinch midpoint stays stationary.
          // The midpoint in image-space should map to the same screen position
          // before and after the zoom change.
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;

            // Vector from center of container to the pinch midpoint
            const mid = getPinchMid(e.touches);
            const offsetX = mid.x - rect.left - cx;
            const offsetY = mid.y - rect.top - cy;

            // How much the pan needs to shift to keep the pinch point stable
            const zoomDelta = liveZoom - prevZoom;
            const newPan = {
              x: livePan.x - (offsetX * zoomDelta) / (liveZoom * prevZoom),
              y: livePan.y - (offsetY * zoomDelta) / (liveZoom * prevZoom),
            };
            livePan = clampPanLocal(newPan, liveZoom);
            setPan(livePan);
          }
        } else {
          livePan = { x: 0, y: 0 };
          setPan(livePan);
        }

        setZoom(liveZoom);
      } else if (e.touches.length === 1) {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const dx = currentX - touchStartX;
        const dy = currentY - touchStartY;

        // Track velocity for momentum
        const now = Date.now();
        const dt = now - lastMoveTime;
        if (dt > 0) {
          velocityX = (currentX - lastMoveX) / dt;
          velocityY = (currentY - lastMoveY) / dt;
        }
        lastMoveX = currentX;
        lastMoveY = currentY;
        lastMoveTime = now;

        if (isPanningTouch && liveZoom > 1) {
          // ── Panning the zoomed image ──
          e.preventDefault();
          const newPan = clampPanLocal(
            {
              x: touchPanStartPos.x + dx,
              y: touchPanStartPos.y + dy,
            },
            liveZoom
          );
          livePan = newPan;
          setPan(newPan);
        } else if (isSwipingTouch && !swipeHandled) {
          // ── Swipe to navigate (only when not zoomed) ──
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            e.preventDefault();
            swipeHandled = true;
            if (dx > 0) {
              goPrevRef.current();
            } else {
              goNextRef.current();
            }
          }
        }
      }
    };

    // ─────────────────── TOUCH END ───────────────────
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) lastPinchDist = null;

      if (e.touches.length === 0) {
        // ── Double-tap to zoom detection ──
        const now = Date.now();
        const tapX = e.changedTouches[0]?.clientX ?? 0;
        const tapY = e.changedTouches[0]?.clientY ?? 0;
        const timeSinceLastTap = now - lastTapTime;
        const distSinceLastTap = Math.hypot(tapX - lastTapX, tapY - lastTapY);

        // Accept double-tap if < 300ms apart and fingers didn't move far
        if (timeSinceLastTap < 300 && distSinceLastTap < 30 && !swipeHandled) {
          // Toggle zoom
          if (liveZoom > 1) {
            liveZoom = 1;
            livePan = { x: 0, y: 0 };
          } else {
            liveZoom = 2.5;
            // Zoom towards the tap point
            const container = containerRef.current;
            if (container) {
              const rect = container.getBoundingClientRect();
              const cx = rect.width / 2;
              const cy = rect.height / 2;
              const offsetX = tapX - rect.left - cx;
              const offsetY = tapY - rect.top - cy;
              livePan = clampPanLocal(
                {
                  x: -offsetX / liveZoom,
                  y: -offsetY / liveZoom,
                },
                liveZoom
              );
            }
          }
          setZoom(liveZoom);
          setPan(livePan);
          lastTapTime = 0; // Reset so triple-tap doesn't re-trigger
        } else {
          lastTapTime = now;
          lastTapX = tapX;
          lastTapY = tapY;
        }

        // ── Momentum / inertia for panning ──
        if (isPanningTouch && liveZoom > 1) {
          const decay = 0.95;
          const minVelocity = 0.01;
          let vx = velocityX * 16; // convert from px/ms to px/frame (~16ms)
          let vy = velocityY * 16;

          const animateMomentum = () => {
            vx *= decay;
            vy *= decay;

            if (Math.abs(vx) < minVelocity && Math.abs(vy) < minVelocity) {
              momentumRaf = 0;
              return;
            }

            const newPan = clampPanLocal(
              { x: livePan.x + vx, y: livePan.y + vy },
              liveZoom
            );
            livePan = newPan;
            setPan(newPan);

            momentumRaf = requestAnimationFrame(animateMomentum);
          };

          if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
            momentumRaf = requestAnimationFrame(animateMomentum);
          }
        }

        isPanningTouch = false;
        isSwipingTouch = false;
        wasPinching = false;

        // Small delay before removing isTouching so the last setPan
        // renders without CSS transition
        setTimeout(() => setIsTouching(false), 50);
      } else if (e.touches.length === 1 && wasPinching) {
        // ── Transitioned from pinch (2 fingers) to 1 finger ──
        // Re-anchor the single finger for panning without jump
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchPanStartPos = { ...livePan };
        lastMoveX = touchStartX;
        lastMoveY = touchStartY;
        lastMoveTime = Date.now();
        velocityX = 0;
        velocityY = 0;
        if (liveZoom > 1) {
          isPanningTouch = true;
          isSwipingTouch = false;
        }
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      cancelMomentum();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Registered once — reads from refs

  // PC: double-click to toggle zoom
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (zoom > 1) { setZoom(1); setPan({ x: 0, y: 0 }); } else { applyZoom(2.5); }
    },
    [zoom, applyZoom]
  );

  const handleBackdropClick = useCallback(() => {
    if (zoom <= 1 && !isDragging) onClose();
  }, [zoom, isDragging, onClose]);

  // Determine whether CSS transition should be active
  // Disable during any active pointer interaction for real-time tracking
  const isActiveGesture = isDragging || isTouching;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2D2926]/95 backdrop-blur-xl"
    >
      {/* Close button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-6 right-6 md:top-10 md:right-10 text-white/50 hover:text-white transition-all duration-300 z-[101]"
      >
        <X size={40} strokeWidth={1.5} />
      </motion.button>

      {/* Prev / Next arrows — visible on all devices */}
      {allImages.length > 1 && onNavigate && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-3 md:left-8 top-1/2 -translate-y-1/2 z-[101] w-11 h-11 md:w-14 md:h-14 rounded-full bg-black/40 md:bg-white/10 hover:bg-[#C5A059] backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white border border-white/10 hover:border-transparent transition-all duration-300 shadow-lg"
            aria-label="Previous image"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-3 md:right-8 top-1/2 -translate-y-1/2 z-[101] w-11 h-11 md:w-14 md:h-14 rounded-full bg-black/40 md:bg-white/10 hover:bg-[#C5A059] backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white border border-white/10 hover:border-transparent transition-all duration-300 shadow-lg"
            aria-label="Next image"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Hint text removed */}

      {/* Image counter */}
      {allImages.length > 1 && (
        <div className="absolute top-6 left-6 md:top-10 md:left-10 text-white/30 text-[10px] uppercase tracking-[0.4em] font-bold z-[101] pointer-events-none">
          {currentIdx + 1} / {allImages.length}
        </div>
      )}

      {/* Image container */}
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full h-full flex items-center justify-center overflow-hidden touch-none p-4 md:p-8"
        style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in" }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="relative max-w-full max-h-full rounded-lg shadow-2xl flex items-center justify-center will-change-transform"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transition: isActiveGesture ? "none" : "transform 0.2s ease-out",
          }}
        >
          <img
            ref={imgRef}
            src={src}
            alt="Selected Gallery Item"
            draggable={false}
            className="max-w-full max-h-full object-contain rounded-lg select-none"
          />
          {/* Custom Caption on the photo */}
          {caption && (
            <div className="absolute bottom-0 left-0 right-0 z-[101] pointer-events-none rounded-b-lg overflow-hidden">
              {caption}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

// --- Gallery Marquee Row ---
const GalleryMarqueeRow = memo(function GalleryMarqueeRow({
  images,
  direction,
  speed,
  rowLabel,
  onImageClick,
}: {
  images: string[];
  direction: "left" | "right";
  speed: number;
  rowLabel: string;
  onImageClick: (img: string) => void;
}) {
  const duplicated = useMemo(() => [...images, ...images, ...images, ...images], [images]);

  return (
    <div className="overflow-hidden w-full">
      <div
        className={cn(
          "flex gap-4 md:gap-5 w-max",
          direction === "left" ? "gallery-marquee-left" : "gallery-marquee-right"
        )}
        style={{ "--marquee-speed": `${speed}s` } as React.CSSProperties}
      >
        {duplicated.map((img, idx) => (
          <GalleryCard
            key={`${rowLabel}-${idx}`}
            img={img}
            label={`${rowLabel}-${idx}`}
            onClick={onImageClick}
          />
        ))}
      </div>
    </div>
  );
});

// --- Gallery Section (Continuous Marquee Rows) ---
export const Gallery = memo(function Gallery() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const images = siteConfig.gallery;
  const rowSize = Math.ceil(images.length / 3);
  const row1 = useMemo(() => images.slice(0, rowSize), [images, rowSize]);
  const row2 = useMemo(() => images.slice(rowSize, rowSize * 2), [images, rowSize]);
  const row3 = useMemo(() => images.slice(rowSize * 2), [images, rowSize]);

  const handleImageClick = useCallback((img: string) => setSelectedImage(img), []);

  return (
    <section id="gallery" className="relative bg-[#F5F2ED] py-20 md:py-32 overflow-hidden">
      {/* Section Header */}
      <div className="px-6 md:px-12 mb-8 md:mb-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-8">
          <div>
            <h2 className="text-[#7A6128] text-[10px] uppercase tracking-[0.6em] font-bold mb-3 md:mb-5">Visual Journal</h2>
            <h3 className="text-4xl md:text-7xl font-bold text-[#2D2926] tracking-tight font-serif leading-none">Halcyon.</h3>
          </div>
          <p className="text-[#2D2926]/75 text-[10px] uppercase tracking-[0.4em] font-bold max-w-xs md:text-right leading-relaxed">
            A collection of frames captured across the globe.
          </p>
        </div>
      </div>

      {/* Three Continuous Marquee Rows */}
      <div className="flex flex-col gap-3 md:gap-4">
        <GalleryMarqueeRow images={row1} direction="left" speed={120} rowLabel="r1" onImageClick={handleImageClick} />
        <GalleryMarqueeRow images={row2} direction="right" speed={110} rowLabel="r2" onImageClick={handleImageClick} />
        <GalleryMarqueeRow images={row3} direction="left" speed={130} rowLabel="r3" onImageClick={handleImageClick} />
      </div>

      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-[#F5F2ED] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-[#F5F2ED] to-transparent z-10 pointer-events-none" />

      {/* Lightbox Modal with Zoom & Pan */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {selectedImage && (
            <GalleryLightbox src={selectedImage} allImages={images} onClose={() => setSelectedImage(null)} onNavigate={(img) => setSelectedImage(img)} />
          )}
        </AnimatePresence>,
        document.body
      )}
    </section>
  );
});


// --- Contact & Footer ---
export function Contact({ setActiveView }: { setActiveView?: (v: string) => void }) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
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
              <span className="text-[#7A6128] text-[10px] uppercase tracking-[0.8em] font-bold mb-8 block">
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
                  <p className="text-[#2D2926]/70 text-sm tracking-wide">Thanks for reaching out. We'll get back to you soon.</p>
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

        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#F5F2ED] pt-20 md:pt-28 border-t border-[#2D2926]/10 relative overflow-hidden">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden" aria-hidden="true">
          <span className="text-[16vw] md:text-[10vw] font-serif italic font-bold text-[#2D2926]/[0.025] tracking-tighter whitespace-nowrap leading-none">
            D&C MediaHouse
          </span>
        </div>

        {/* Content Grid */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-14 md:gap-8 mb-16 md:mb-20">
            {/* Brand Column */}
            <div className="md:col-span-4 space-y-5">
              <div className="text-2xl md:text-3xl font-playfair font-semibold tracking-tight text-[#2D2926]">
                D&C <span className="text-sm md:text-base font-sans font-bold uppercase tracking-[0.3em] ml-1 text-[#C5A059]">MediaHouse</span>
              </div>
              <p className="text-[#2D2926]/75 text-base md:text-[15px] leading-relaxed max-w-sm">
                Cinematic storytelling for events, brands, and commercials. We don't shoot videos — we tell stories.
              </p>
              <div className="pt-3">
                <p className="text-[11px] uppercase tracking-[0.4em] font-bold text-[#2D2926]/70 mb-5">Follow Us</p>
                <div className="flex gap-4">
                  <a
                    href={siteConfig.contact.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full border border-[#2D2926]/10 flex items-center justify-center text-[#2D2926]/75 hover:bg-[#C5A059] hover:text-white hover:border-[#C5A059] transition-all duration-300"
                    aria-label="Instagram"
                  >
                    <Instagram size={20} />
                  </a>
                  <a
                    href={siteConfig.contact.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full border border-[#2D2926]/10 flex items-center justify-center text-[#2D2926]/75 hover:bg-[#25D366] hover:text-white hover:border-[#25D366] transition-all duration-300"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle size={20} />
                  </a>
                  <a
                    href={`mailto:${siteConfig.contact.email}`}
                    className="w-12 h-12 rounded-full border border-[#2D2926]/10 flex items-center justify-center text-[#2D2926]/75 hover:bg-[#2D2926] hover:text-white hover:border-[#2D2926] transition-all duration-300"
                    aria-label="Email"
                  >
                    <Send size={17} />
                  </a>
                </div>
              </div>
            </div>

            {/* Link Columns — 2-col grid on mobile, 3 columns on desktop */}
            <div className="md:col-span-8 md:col-start-5 grid grid-cols-2 sm:grid-cols-3 gap-10 md:gap-8">
              {/* Services Column */}
              <div>
                <h4 className="text-[11px] md:text-xs uppercase tracking-[0.4em] font-bold text-[#2D2926]/70 mb-5 md:mb-6">Services</h4>
                <ul className="space-y-3.5">
                  {["Event Coverage", "Brand Films", "Commercials", "Music Videos", "Lifestyle Shoots"].map((item) => (
                    <li key={item}>
                      <a href="#work" className="text-[#2D2926]/75 text-[15px] md:text-base hover:text-[#C5A059] transition-colors duration-300">{item}</a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Portfolio Column */}
              <div>
                <h4 className="text-[11px] md:text-xs uppercase tracking-[0.4em] font-bold text-[#2D2926]/70 mb-5 md:mb-6">Portfolio</h4>
                <ul className="space-y-3.5">
                  {[
                    { label: "Showreels", href: siteConfig.playbook.boards.showreels },
                    { label: "Weddings", href: siteConfig.playbook.boards.weddings },
                    { label: "Live Events", href: siteConfig.playbook.boards.liveEvents },
                    { label: "Fashion", href: siteConfig.playbook.boards.fashion },
                    { label: "View All", href: siteConfig.playbook.main },
                  ].map((item) => (
                    <li key={item.label}>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#2D2926]/75 text-[15px] md:text-base hover:text-[#C5A059] transition-colors duration-300 inline-flex items-center gap-2"
                      >
                        {item.label}
                        {item.label === "View All" && <ExternalLink size={13} />}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Connect Column */}
              <div className="col-span-2 sm:col-span-1">
                <h4 className="text-[11px] md:text-xs uppercase tracking-[0.4em] font-bold text-[#2D2926]/70 mb-5 md:mb-6">Connect</h4>
                <ul className="space-y-3.5">
                  <li>
                    <a 
                      href="#about" 
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveView?.("about");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-[#2D2926]/75 text-[15px] md:text-base hover:text-[#C5A059] transition-colors duration-300"
                    >
                      About Us
                    </a>
                  </li>
                  <li>
                    <a href="#contact" className="text-[#2D2926]/75 text-[15px] md:text-base hover:text-[#C5A059] transition-colors duration-300">Contact Us</a>
                  </li>
                  <li>
                    <a href={siteConfig.contact.whatsapp} target="_blank" rel="noopener noreferrer" className="text-[#2D2926]/75 text-[15px] md:text-base hover:text-[#C5A059] transition-colors duration-300">WhatsApp</a>
                  </li>
                  <li>
                    <a href={siteConfig.contact.instagram} target="_blank" rel="noopener noreferrer" className="text-[#2D2926]/75 text-[15px] md:text-base hover:text-[#C5A059] transition-colors duration-300">Instagram</a>
                  </li>
                  <li>
                    <a href={`mailto:${siteConfig.contact.email}`} className="text-[#2D2926]/50 text-[15px] md:text-base hover:text-[#C5A059] transition-colors duration-300">Email</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="relative z-10 border-t border-[#2D2926]/8">
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 md:py-7 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[#2D2926]/40 text-[10px] md:text-[11px] uppercase tracking-[0.3em] font-bold">
              © {new Date().getFullYear()} {siteConfig.name} Studios. All Rights Reserved.
            </p>
            <div className="flex gap-6 md:gap-8">
              {["Work", "Films", "Gallery", "Contact"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-[#2D2926]/60 text-[10px] md:text-[11px] uppercase tracking-[0.3em] font-bold hover:text-[#C5A059] transition-colors duration-300"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

// --- Clips Layout (Vertical Videos) ---
export const ClipsLayout = memo(function ClipsLayout() {
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const { projects: clips, loading } = useSanityProjects();

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('videoModalState', { detail: !!activeClip }));
  }, [activeClip]);

  const activeClips = useMemo(() => 
    clips.filter((c: any) => c.playbackId && (c.displaySection === 'clip' || (!c.displaySection && (c.title.toLowerCase().includes('visual notes') || c.title.toLowerCase().includes('clip')))))
  , [clips]);

  if (loading) return null;

  return (
    <section id="shorts" className="py-24 md:py-40 bg-[#F5F2ED] px-6 md:px-12 lg:px-16 overflow-hidden relative z-10">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-16 md:mb-24 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="max-w-xl">
            <h2 className="text-[#8B6F2E] text-[10px] uppercase tracking-[0.6em] font-bold mb-6">Shorts</h2>
            <h3 className="text-4xl md:text-7xl font-bold text-[#2D2926] tracking-tight font-serif leading-none italic">Visual Notes.</h3>
          </div>
          <p className="text-[#2D2926]/50 text-[9px] uppercase tracking-[0.4em] font-bold max-w-[200px] md:text-right leading-loose">
            VERTICAL STORYTELLING FOR THE MODERN SCREEN.
          </p>
        </div>

        <div 
          className="flex gap-5 md:gap-8 overflow-x-auto pb-8 pt-4 snap-x snap-mandatory -mx-6 px-6 md:-mx-12 md:px-12 lg:-mx-16 lg:px-16" 
        >
          {activeClips.map((clip: any) => (
            <ClipCard
              key={clip._id}
              clip={clip}
              onOpen={() => setActiveClip(clip.playbackId)}
            />
          ))}
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeClip && (
            <VerticalVideoPlayer
              clips={activeClips}
              initialClipId={activeClip}
              onClose={() => setActiveClip(null)}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </section>
  );
});

// --- Clip Card (hover-to-play on desktop, auto-play in view on mobile) ---
const ClipCard = memo(function ClipCard({ clip, onOpen }: { clip: any; onOpen: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(!window.matchMedia('(hover: hover)').matches);
  }, []);

  const { ref: playRef, inView } = useInView({
    threshold: 0.3,
    triggerOnce: false,
  });

  const shouldPlay = isMobile ? inView : isHovered;

  return (
    <motion.div
      ref={playRef}
      whileHover={{ y: -10 }}
      className="flex-shrink-0 w-[280px] md:w-[320px] lg:w-[360px] aspect-[9/16] bg-black rounded-[2.5rem] overflow-hidden relative group cursor-pointer snap-center border border-[#2D2926]/10"
      onClick={onOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ClipsPreview video={clip.playbackId ? `https://stream.mux.com/${clip.playbackId}.m3u8` : clip.video} shouldPlay={shouldPlay} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-10 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
        <p className="text-[#C5A059] text-[8px] uppercase tracking-[0.4em] font-bold mb-3">{clip.category}</p>
        <h4 className="text-2xl font-bold text-white font-serif italic tracking-tight">{clip.title}</h4>
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-75 group-hover:scale-100 border border-white/10 shadow-2xl">
        <Play size={24} fill="white" className="text-white ml-1.5" />
      </div>
    </motion.div>
  );
});

const ClipsPreview = memo(function ClipsPreview({ video, shouldPlay }: { video: string; shouldPlay: boolean }) {
  const videoRef = useRef<any>(null);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (shouldPlay) {
      vid.play()?.catch(() => { });
    } else {
      vid.pause();
      if (vid.currentTime > 0) vid.currentTime = 0;
    }
  }, [shouldPlay]);

  useEffect(() => {
    return () => {
      videoRef.current?.pause();
    };
  }, []);

  return (
    <div className="w-full h-full">
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
});

const VerticalVideoItem = memo(function VerticalVideoItem({ src, onClose }: { src: string; onClose: () => void; }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [showPlayFeedback, setShowPlayFeedback] = useState<"play" | "pause" | null>(null);
  const [hlsInstance, setHlsInstance] = useState<any>(null);
  const [qualityLevels, setQualityLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const videoRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const feedbackTimeout = useRef<NodeJS.Timeout | null>(null);

  const triggerFeedback = useCallback((type: "play" | "pause") => {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    setShowPlayFeedback(type);
    feedbackTimeout.current = setTimeout(() => setShowPlayFeedback(null), 600);
  }, []);

  const { ref: inViewRef, inView } = useInView({
    threshold: 0.6,
  });
  const isHorizontal = isVideoLoaded && videoAspect && videoAspect > 1;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (inView) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
      // Only reset if it's completely out of view to avoid flickering
      setTimeout(() => {
        if (!inViewRef) {
          video.currentTime = 0;
          setProgress(0);
        }
      }, 500);
    }
  }, [inView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && inView) {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
            setIsPlaying(true);
            triggerFeedback("play");
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
            triggerFeedback("pause");
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inView, triggerFeedback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  const handleHlsReady = useCallback((hls: any) => {
    setHlsInstance(hls);
    setQualityLevels(hls.levels || []);
    setCurrentLevel(hls.currentLevel);
  }, []);

  const changeQuality = (levelIndex: number) => {
    if (hlsInstance) {
      // Use nextLevel for a seamless switch (prevents instant buffering stall)
      hlsInstance.nextLevel = levelIndex;
      setCurrentLevel(levelIndex);
      setShowSettings(false);

      // Flush the buffer slightly ahead of current time to force the new 
      // quality to appear quickly, rather than waiting for the entire 
      // old low-quality buffer to play out.
      if (videoRef.current) {
        hlsInstance.trigger('hlsBufferFlushing', {
          startOffset: videoRef.current.currentTime + 2,
          endOffset: Number.POSITIVE_INFINITY
        });
      }
    }
  };

  const toggleFullscreen = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const togglePlay = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => { });
      setIsPlaying(true);
      triggerFeedback("play");
    } else {
      video.pause();
      setIsPlaying(false);
      triggerFeedback("pause");
    }
  }, []);



  useEffect(() => {
    return () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    };
  }, []);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: "D&C MediaHouse Clip",
        url: window.location.href,
      }).catch(() => { });
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (!isSeeking && video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, [isSeeking]);

  const seekToPosition = useCallback((clientX: number) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !video.duration) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
    setProgress(ratio * 100);
  }, []);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsSeeking(true);
    seekToPosition(e.clientX);

    const onMouseMove = (ev: MouseEvent) => {
      ev.preventDefault();
      seekToPosition(ev.clientX);
    };
    const onMouseUp = (ev: MouseEvent) => {
      ev.preventDefault();
      seekToPosition(ev.clientX);
      setIsSeeking(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [seekToPosition]);

  const handleProgressTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    setIsSeeking(true);
    seekToPosition(e.touches[0].clientX);

    const onTouchMove = (ev: TouchEvent) => {
      ev.preventDefault();
      seekToPosition(ev.touches[0].clientX);
    };
    const onTouchEnd = (ev: TouchEvent) => {
      const touch = ev.changedTouches[0];
      if (touch) seekToPosition(touch.clientX);
      setIsSeeking(false);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };

    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  }, [seekToPosition]);

  return (
    <div
      ref={(node) => {
        inViewRef(node);
        (containerRef as any).current = node;
      }}
      className="w-full h-full flex items-center justify-center relative bg-black"
    >
      <div
        className={cn(
          "relative bg-[#111] flex",
          !isVideoLoaded ? "aspect-[9/16] h-[100dvh] md:h-[85vh] md:w-auto md:rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border-0 md:border md:border-white/10" : "overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] md:border md:border-white/10 md:rounded-[2.5rem]"
        )}
        style={{
          aspectRatio: isVideoLoaded && videoAspect ? videoAspect : undefined,
          width: isVideoLoaded ? '100%' : undefined,
          height: isVideoLoaded ? '100%' : undefined,
          maxWidth: isVideoLoaded && videoAspect ? `calc(100dvh * ${videoAspect})` : undefined,
          maxHeight: isVideoLoaded && videoAspect ? `calc(100vw / ${videoAspect})` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <HlsVideo
          ref={videoRef}
          src={src}
          autoPlay={inView}
          muted={isMuted}
          loop
          playsInline
          onHlsReady={handleHlsReady}
          onLoadedMetadata={(e) => {
            const target = e.target as HTMLVideoElement;
            if (target.videoWidth && target.videoHeight) {
              setVideoAspect(target.videoWidth / target.videoHeight);
              setIsVideoLoaded(true);
            }
          }}
          className="w-full h-full object-contain"
          poster={src.includes("mux.com") ? src.replace(".m3u8", "/thumbnail.jpg?time=0").replace("stream.mux.com", "image.mux.com") : undefined}
          onClick={togglePlay}
        />

        {/* Top Bar (Close & Watermark) */}
        <div className="absolute top-0 left-0 right-0 p-4 md:p-6 lg:p-8 flex justify-between items-start z-10 pointer-events-none">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-black/40 transition-all cursor-pointer pointer-events-auto shrink-0"
          >
            <X size={20} />
          </button>
          
          <div className="opacity-80 mix-blend-screen drop-shadow-lg text-right pl-2">
            <div className="text-xs md:text-base font-playfair font-semibold tracking-tight text-[#F8F5F0]">
              D&C <span className="text-[6px] md:text-[10px] font-sans font-bold uppercase tracking-[0.3em] ml-0.5 md:ml-1 text-[#C5A059]">MediaHouse</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-12 right-4 md:right-8 flex flex-col gap-3 z-10 items-center">
            <div className="relative flex flex-col items-end">
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="absolute bottom-12 right-0 mb-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden py-2 min-w-[100px] shadow-2xl z-50 flex flex-col"
                  >
                    <button 
                      onClick={(e) => { e.stopPropagation(); changeQuality(-1); }}
                      className={cn("px-4 py-2 text-left text-xs hover:bg-white/10 transition-colors", currentLevel === -1 ? "text-[#C5A059] font-bold" : "text-white")}
                    >
                      Auto
                    </button>
                    {qualityLevels.map((level, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); changeQuality(idx); }}
                        className={cn("px-4 py-2 text-left text-xs hover:bg-white/10 transition-colors", currentLevel === idx ? "text-[#C5A059] font-bold" : "text-white")}
                      >
                        {level.height}p
                      </button>
                    )).reverse()}
                  </motion.div>
                )}
              </AnimatePresence>
              
              <button
                onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-black/40 transition-all cursor-pointer"
              >
                <Settings size={18} />
              </button>
            </div>
            
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

            <button
              onClick={toggleFullscreen}
              className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md items-center justify-center text-white/70 hover:text-white hover:bg-black/40 transition-all cursor-pointer hidden md:flex"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
        </div>

        <AnimatePresence>
          {!isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-20 h-20 rounded-full flex items-center justify-center">
                <Play size={40} fill="white" className="text-white ml-2" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          ref={progressBarRef}
          className="absolute bottom-0 left-0 right-0 z-30 cursor-pointer group/progress"
          onMouseDown={handleProgressMouseDown}
          onTouchStart={handleProgressTouchStart}
        >
          <div className="h-8 flex items-end">
            <div className="w-full h-1.5 group-hover/progress:h-3 transition-all duration-200 relative">
              <div className="absolute inset-0 bg-white/10 rounded-t-sm" />
              <div
                className="h-full bg-[#C5A059] rounded-t-sm relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-[#C5A059] rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity duration-200 border-2 border-white z-10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const VerticalVideoPlayer = memo(function VerticalVideoPlayer({ clips, initialClipId, onClose }: { clips: any[]; initialClipId: string; onClose: () => void; }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!containerRef.current) return;
        
        const container = containerRef.current;
        const children = Array.from(container.children);
        if (children.length === 0) return;
        
        const scrollTop = container.scrollTop;
        const height = container.clientHeight;
        const currentIndex = Math.round(scrollTop / height);
        
        if (e.key === 'ArrowDown' && currentIndex < children.length - 1) {
          children[currentIndex + 1].scrollIntoView({ behavior: 'smooth' });
        } else if (e.key === 'ArrowUp' && currentIndex > 0) {
          children[currentIndex - 1].scrollIntoView({ behavior: 'smooth' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    
    setTimeout(() => {
      if (containerRef.current && initialClipId) {
        const el = containerRef.current.querySelector(`[data-clip-id="${initialClipId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'instant' });
        }
      }
    }, 50);

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [initialClipId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black backdrop-blur-2xl"
      onClick={onClose}
    >
      <div 
        ref={containerRef}
        className="w-full h-[100dvh] overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .scrollbar-none::-webkit-scrollbar { display: none; }
        `}} />
        {clips.map((clip: any) => (
          <div 
            key={clip.playbackId} 
            data-clip-id={clip.playbackId}
            className="w-full h-[100dvh] snap-start snap-always"
          >
            <VerticalVideoItem 
              src={`https://stream.mux.com/${clip.playbackId}.m3u8`} 
              onClose={onClose} 
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
});


export function AboutSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section id="about" className="min-h-screen pt-32 pb-24 bg-[#F5F2ED] text-[#2D2926] relative z-20 flex items-center">
      <div className="max-w-7xl mx-auto px-6 md:px-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left: Image */}
          <div className="lg:col-span-4">
             <div 
               className="overflow-hidden rounded-2xl shadow-2xl relative aspect-[3/4] w-full max-w-sm mx-auto lg:mx-0 cursor-pointer group"
               onClick={() => setIsModalOpen(true)}
             >
                <img 
                  src={siteConfig.about.image} 
                  alt={siteConfig.about.name} 
                  className="absolute inset-0 w-full h-full object-cover object-center" 
                />
             </div>
          </div>

          {/* Right: Content */}
          <div className="lg:col-span-8 space-y-8 md:space-y-10">
             <div>
               <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif italic font-bold tracking-tight mb-4">{siteConfig.about.name}</h2>
               <p className="text-[#C5A059] font-sans uppercase tracking-[3px] text-xs md:text-sm font-bold">{siteConfig.about.role}</p>
             </div>
             
             <div className="space-y-4 text-[#2D2926]/75 leading-relaxed text-sm md:text-base lg:text-lg max-w-3xl">
                {siteConfig.about.bio.map((p, i) => <p key={i}>{p}</p>)}
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-[#2D2926]/10">
                {siteConfig.about.disciplines.map((d, i) => (
                  <div key={i} className="space-y-2">
                    <h3 className="text-base md:text-lg font-serif font-bold text-[#2D2926]">{d.title}</h3>
                    <p className="text-[#2D2926]/60 text-xs md:text-sm leading-relaxed">{d.desc}</p>
                  </div>
                ))}
             </div>
          </div>

        </div>
      </div>

      {/* Lightbox Modal */}
      {isModalOpen && siteConfig.about.image && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          <GalleryLightbox 
            src={siteConfig.about.image} 
            allImages={[siteConfig.about.image]} 
            onClose={() => setIsModalOpen(false)} 
            caption={
              <div className="text-center w-full px-6 pt-12 pb-6 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                <h2 className="text-3xl md:text-5xl font-serif italic font-bold tracking-tight text-white mb-2 drop-shadow-md">{siteConfig.about.name}</h2>
                <p className="text-[#C5A059] font-sans uppercase tracking-[2px] md:tracking-[3px] text-[10px] md:text-xs font-bold drop-shadow-lg">{siteConfig.about.role}</p>
              </div>
            }
          />
        </AnimatePresence>,
        document.body
      )}
    </section>
  );
}