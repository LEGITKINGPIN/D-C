"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { LoadingScreen } from "./LoadingScreen";

export function ClientLoadingScreen({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  // Allow scrolling to be managed by LoadingScreen internally (it does so already)
  // We just handle the unmounting of LoadingScreen when it completes.

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}
      </AnimatePresence>
      {children}
    </>
  );
}
