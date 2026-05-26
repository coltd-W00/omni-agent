export function mockMatchMedia(matchesFn: (query: string) => boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: matchesFn(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

export function mockViewport(width: number): void {
  mockMatchMedia((query) => {
    const minMatch = query.match(/\(min-width:\s*(\d+)px\)/);
    const maxMatch = query.match(/\(max-width:\s*(\d+)px\)/);
    const min = minMatch ? Number.parseInt(minMatch[1], 10) : 0;
    const max = maxMatch ? Number.parseInt(maxMatch[1], 10) : Infinity;
    return width >= min && width <= max;
  });
}
