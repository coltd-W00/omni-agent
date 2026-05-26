import { useMediaQuery } from "./useMediaQuery";

export type Breakpoint =
  | "desktop-l"
  | "desktop-m"
  | "desktop-s"
  | "tablet"
  | "mobile";

export function useBreakpoint(): Breakpoint {
  const isDesktopL = useMediaQuery("(min-width: 1440px)");
  const isDesktopM = useMediaQuery(
    "(min-width: 1280px) and (max-width: 1439px)"
  );
  const isDesktopS = useMediaQuery(
    "(min-width: 1024px) and (max-width: 1279px)"
  );
  const isTablet = useMediaQuery(
    "(min-width: 768px) and (max-width: 1023px)"
  );

  if (isDesktopL) return "desktop-l";
  if (isDesktopM) return "desktop-m";
  if (isDesktopS) return "desktop-s";
  if (isTablet) return "tablet";
  return "mobile";
}

export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
