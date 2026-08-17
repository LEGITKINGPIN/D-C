"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";

interface LoadingScreenProps {
  onComplete?: () => void;
  maxWait?: number;
}

export function LoadingScreen({ onComplete, maxWait = 6500 }: LoadingScreenProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const completedRef = useRef(false);

  // Function to safely trigger completion once
  const triggerComplete = () => {
    if (!completedRef.current) {
      completedRef.current = true;
      if (onComplete) onComplete();
    }
  };

  // Step 1: Animation timeline
  useEffect(() => {
    // Lock scroll during loading
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Expand to "MEDIAHOUSE" after "D&C" settles
    const expandTimer = setTimeout(() => {
      setIsExpanded(true);
    }, 600);

    // Minimum animation duration so the expansion finishes cleanly (~1.3s)
    const minAnimTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1300);

    // Hard fallback timeout: max wait time so the user is never stuck
    const safetyTimer = setTimeout(() => {
      setIsReady(true);
      setMinTimeElapsed(true);
    }, maxWait);

    return () => {
      clearTimeout(expandTimer);
      clearTimeout(minAnimTimer);
      clearTimeout(safetyTimer);
      document.body.style.overflow = originalOverflow;
    };
  }, [maxWait]);

  // Step 2: Buffer / Asset preload monitoring
  useEffect(() => {
    let isCancelled = false;

    const checkReadiness = async () => {
      try {
        const promises: Promise<any>[] = [];

        // 1. Check fonts
        if (typeof document !== "undefined" && document.fonts) {
          promises.push(document.fonts.ready);
        }

        // 2. Preload & decode Hero poster
        const posterPromise = new Promise((resolve) => {
          const img = new Image();
          img.src = "/hero/RDR.webp";
          if (img.complete) {
            resolve(true);
          } else {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
          }
        });
        promises.push(posterPromise);

        // 3. Monitor Hero Video Buffering
        const videoPromise = new Promise((resolve) => {
          let attempts = 0;
          const checkVideo = () => {
            if (isCancelled) return;
            const heroVideo = document.querySelector("#hero video") as HTMLVideoElement | null;
            if (heroVideo && (heroVideo.readyState >= 2 || !heroVideo.paused || heroVideo.currentTime > 0)) {
              resolve(true);
            } else if (attempts > 35) { // ~3.5s max attempt for video
              resolve(true);
            } else {
              attempts++;
              setTimeout(checkVideo, 100);
            }
          };
          checkVideo();
        });
        promises.push(videoPromise);

        // 4. Window load event (if not already loaded)
        if (typeof document !== "undefined" && document.readyState !== "complete") {
          const windowLoadPromise = new Promise((resolve) => {
            window.addEventListener("load", () => resolve(true), { once: true });
          });
          promises.push(windowLoadPromise);
        }

        // Wait for critical assets to buffer
        await Promise.all(promises);

        if (!isCancelled) {
          setIsReady(true);
        }
      } catch (err) {
        if (!isCancelled) {
          setIsReady(true);
        }
      }
    };

    checkReadiness();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Step 3: Trigger completion when BOTH min animation has played AND website is buffered
  useEffect(() => {
    if (minTimeElapsed && isReady) {
      // Small graceful buffer (150ms) before fading out
      const timer = setTimeout(() => {
        triggerComplete();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [minTimeElapsed, isReady]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{
        opacity: 0,
        y: -30,
        filter: "blur(10px)",
        transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] }
      }}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black select-none pointer-events-auto"
      style={{
        background: "radial-gradient(ellipse at center, #111111 0%, #060606 60%, #000000 100%)"
      }}
    >
      {/* Ambient background glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: isExpanded ? [0.25, 0.4, 0.25] : 0.15,
          scale: isExpanded ? [1, 1.1, 1] : 0.9
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute w-72 h-72 md:w-96 md:h-96 rounded-full bg-[#C5A059]/20 blur-[90px] pointer-events-none"
      />

      {/* Main Logo Container — kept strictly centered */}
      <motion.div
        layout
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex items-center justify-center z-10 px-6 py-4"
      >
        {/* D&C Text */}
        <motion.span
          initial={{ opacity: 0, y: 12, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="font-playfair italic font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-[#F8F5F0] tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] whitespace-nowrap"
        >
          D&C
        </motion.span>

        {/* Expanding MEDIAHOUSE text */}
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={isExpanded ? { width: "auto", opacity: 1 } : { width: 0, opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden flex items-center"
        >
          <span className="font-sans font-bold uppercase tracking-[0.28em] sm:tracking-[0.34em] text-sm sm:text-base md:text-xl lg:text-2xl text-[#C5A059] pl-3 sm:pl-4 md:pl-5 whitespace-nowrap drop-shadow-[0_2px_12px_rgba(197,160,89,0.35)]">
            MEDIAHOUSE
          </span>
        </motion.div>
      </motion.div>

      {/* Subtle cinematic gold accent line expanding from center */}
      <div className="relative w-28 sm:w-36 md:w-44 h-[1px] bg-white/10 mt-3 overflow-hidden rounded-full">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: isExpanded ? 1 : 0.4 }}
          transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full bg-gradient-to-r from-transparent via-[#C5A059] to-transparent origin-center"
        />
      </div>
    </motion.div>
  );
}
