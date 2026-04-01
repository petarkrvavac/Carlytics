"use client";

import { useEffect, useState } from "react";

export function useIsLightTheme() {
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      setIsLightTheme(root.classList.contains("light"));
    };

    applyTheme();

    const observer = new MutationObserver(applyTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return isLightTheme;
}