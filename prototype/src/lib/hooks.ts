import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { storageGet, storageSet } from "./utils";

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches);
}

/** Breakpoints ADS: s 768–1023 recolhe a navegação; m ≥ 1024 expande inline. */
export function useBreakpoints() {
  const isLarge = useMediaQuery("(min-width: 1024px)");
  const isMedium = useMediaQuery("(min-width: 768px)");
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");
  return { isLarge, isMedium, canHover };
}

export type ColorModePreference = "light" | "dark" | "auto";
const COLOR_MODE_KEY = "dash-proto.color-mode";

export function useColorMode() {
  const [preference, setPreference] = useState<ColorModePreference>(() =>
    storageGet<ColorModePreference>(COLOR_MODE_KEY, "auto"),
  );
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolved = preference === "auto" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    document.documentElement.setAttribute("data-color-mode", resolved);
  }, [resolved]);

  const update = useCallback((next: ColorModePreference) => {
    setPreference(next);
    storageSet(COLOR_MODE_KEY, next);
  }, []);

  return { preference, resolved, setPreference: update };
}
