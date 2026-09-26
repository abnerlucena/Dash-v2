import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBreakpoints } from "@/lib/hooks";
import { clamp, readToken, storageGet, storageSet } from "@/lib/utils";

/*
 * Estado do layout ADS (navigation system):
 *  - inline:  ≥ 1024px e expandida → coluna redimensionável ao lado do Main
 *  - flyout:  ≥ 1024px e recolhida → abre como overlay ao passar o mouse no toggle
 *  - overlay: < 1024px → sempre recolhida; o toggle abre como overlay
 */

const KEY_EXPANDED = "dash-proto.sidenav.expanded";
const KEY_SIDENAV_WIDTH = "dash-proto.sidenav.width";
const KEY_PANEL_WIDTH = "dash-proto.panel.width";

interface LayoutState {
  isLarge: boolean;
  isMedium: boolean;
  canHover: boolean;

  isSideNavInline: boolean;
  isSideNavExpanded: boolean;
  sideNavWidth: number;
  setSideNavWidth: (px: number) => void;
  sideNavBounds: () => { min: number; max: number };
  toggleSideNav: () => void;
  collapseSideNav: () => void;

  flyoutOpen: boolean;
  overlayOpen: boolean;
  closeTransientSideNav: (opts?: { restoreFocus?: boolean }) => void;
  openOverlay: () => void;
  scheduleFlyoutOpen: () => void;
  scheduleFlyoutClose: () => void;
  cancelFlyoutClose: () => void;
  setPointerInsideFlyout: (inside: boolean) => void;
  setSideNavMenuOpen: (open: boolean) => void;
  toggleButtonRef: React.RefObject<HTMLButtonElement>;

  panelWidth: number;
  setPanelWidth: (px: number) => void;
  panelBounds: () => { min: number; max: number };
}

const LayoutContext = createContext<LayoutState | null>(null);

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout precisa estar dentro de <LayoutProvider>");
  return ctx;
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const { isLarge, isMedium, canHover } = useBreakpoints();

  const [expanded, setExpanded] = useState(() => storageGet(KEY_EXPANDED, true));
  const [sideNavWidth, setSideNavWidthState] = useState(() =>
    storageGet(KEY_SIDENAV_WIDTH, readToken("--dash-sidenav-width")),
  );
  const [panelWidth, setPanelWidthState] = useState(() =>
    storageGet(KEY_PANEL_WIDTH, readToken("--dash-panel-width")),
  );
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();
  const menuOpen = useRef(false);
  const pointerInside = useRef(false);

  const isSideNavInline = isLarge && expanded;

  const sideNavBounds = useCallback(
    () => ({
      min: readToken("--dash-sidenav-width-min"),
      max: window.innerWidth * readToken("--dash-sidenav-max-ratio"),
    }),
    [],
  );

  const panelBounds = useCallback(() => {
    const content = window.innerWidth - (isSideNavInline ? sideNavWidth : 0);
    return {
      min: readToken("--dash-panel-width-min"),
      max: Math.max(readToken("--dash-panel-width-min"), content * readToken("--dash-panel-max-ratio")),
    };
  }, [isSideNavInline, sideNavWidth]);

  const setSideNavWidth = useCallback(
    (px: number) => {
      const { min, max } = sideNavBounds();
      const next = Math.round(clamp(px, min, max));
      setSideNavWidthState(next);
      storageSet(KEY_SIDENAV_WIDTH, next);
    },
    [sideNavBounds],
  );

  const setPanelWidth = useCallback(
    (px: number) => {
      const { min, max } = panelBounds();
      const next = Math.round(clamp(px, min, max));
      setPanelWidthState(next);
      storageSet(KEY_PANEL_WIDTH, next);
    },
    [panelBounds],
  );

  const setExpandedPersist = useCallback((next: boolean) => {
    setExpanded(next);
    storageSet(KEY_EXPANDED, next);
  }, []);

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };

  const closeTransientSideNav = useCallback((opts?: { restoreFocus?: boolean }) => {
    clearTimers();
    setFlyoutOpen(false);
    setOverlayOpen(false);
    if (opts?.restoreFocus) toggleButtonRef.current?.focus();
  }, []);

  const toggleSideNav = useCallback(() => {
    clearTimers();
    if (isLarge) {
      if (flyoutOpen) {
        // Clique no toggle com o flyout aberto → fixa a navegação expandida
        setFlyoutOpen(false);
        setExpandedPersist(true);
      } else {
        setExpandedPersist(!expanded);
      }
    } else {
      setOverlayOpen((o) => !o);
    }
  }, [isLarge, flyoutOpen, expanded, setExpandedPersist]);

  const collapseSideNav = useCallback(() => {
    setExpandedPersist(false);
    setFlyoutOpen(false);
  }, [setExpandedPersist]);

  const openOverlay = useCallback(() => setOverlayOpen(true), []);

  const scheduleFlyoutOpen = useCallback(() => {
    if (isSideNavInline || overlayOpen || !canHover) return;
    clearTimers();
    openTimer.current = window.setTimeout(
      () => setFlyoutOpen(true),
      readToken("--dash-sidenav-flyout-open-delay"),
    );
  }, [isSideNavInline, overlayOpen, canHover]);

  const scheduleFlyoutClose = useCallback(() => {
    window.clearTimeout(openTimer.current);
    // O flyout continua aberto enquanto um menu dentro dele estiver aberto
    if (menuOpen.current) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(
      () => setFlyoutOpen(false),
      readToken("--dash-sidenav-flyout-close-delay"),
    );
  }, []);

  const cancelFlyoutClose = useCallback(() => window.clearTimeout(closeTimer.current), []);

  const setPointerInsideFlyout = useCallback((inside: boolean) => {
    pointerInside.current = inside;
  }, []);

  const setSideNavMenuOpen = useCallback(
    (open: boolean) => {
      menuOpen.current = open;
      if (open) cancelFlyoutClose();
      else if (!pointerInside.current) scheduleFlyoutClose();
    },
    [cancelFlyoutClose, scheduleFlyoutClose],
  );

  // Troca de breakpoint descarta estados transitórios
  useEffect(() => {
    clearTimers();
    setFlyoutOpen(false);
    setOverlayOpen(false);
  }, [isLarge]);

  // Janela menor → re-limita larguras
  useEffect(() => {
    const onResize = () => {
      const s = sideNavBounds();
      setSideNavWidthState((w) => clamp(w, s.min, Math.max(s.min, s.max)));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sideNavBounds]);

  // Atalho Ctrl+[ (sem animação: ações de teclado são instantâneas)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "[") {
        e.preventDefault();
        toggleSideNav();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSideNav]);

  useEffect(() => clearTimers, []);

  const value = useMemo<LayoutState>(
    () => ({
      isLarge,
      isMedium,
      canHover,
      isSideNavInline,
      isSideNavExpanded: expanded,
      sideNavWidth,
      setSideNavWidth,
      sideNavBounds,
      toggleSideNav,
      collapseSideNav,
      flyoutOpen: flyoutOpen && !isSideNavInline,
      overlayOpen: overlayOpen && !isSideNavInline,
      closeTransientSideNav,
      openOverlay,
      scheduleFlyoutOpen,
      scheduleFlyoutClose,
      cancelFlyoutClose,
      setPointerInsideFlyout,
      setSideNavMenuOpen,
      toggleButtonRef,
      panelWidth,
      setPanelWidth,
      panelBounds,
    }),
    [
      isLarge,
      isMedium,
      canHover,
      isSideNavInline,
      expanded,
      sideNavWidth,
      setSideNavWidth,
      sideNavBounds,
      toggleSideNav,
      collapseSideNav,
      flyoutOpen,
      overlayOpen,
      closeTransientSideNav,
      openOverlay,
      scheduleFlyoutOpen,
      scheduleFlyoutClose,
      cancelFlyoutClose,
      setPointerInsideFlyout,
      setSideNavMenuOpen,
      panelWidth,
      setPanelWidth,
      panelBounds,
    ],
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

/** Mantém o elemento montado durante a animação de saída. */
export function usePresence(open: boolean, durationToken = "--ds-motion-duration-panel") {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<"open" | "closed">(open ? "open" : "closed");

  useEffect(() => {
    if (open) {
      setMounted(true);
      setState("open");
      return;
    }
    setState("closed");
    const t = window.setTimeout(() => setMounted(false), readToken(durationToken));
    return () => window.clearTimeout(t);
  }, [open, durationToken]);

  return { mounted, state };
}
