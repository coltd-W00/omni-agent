import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

function TestComponent({ query }: { query: string }) {
  const matches = useMediaQuery(query);
  return <span>{matches ? "match" : "no-match"}</span>;
}

describe("useMediaQuery", () => {
  it("returns the current matchMedia result", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query === "(min-width: 1440px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });

    render(<TestComponent query="(min-width: 1440px)" />);

    expect(screen.getByText("match")).toBeInTheDocument();
  });

  it("removes the previous listener when query changes", () => {
    const removeEventListener = vi.fn();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });

    const { rerender } = render(<TestComponent query="(min-width: 1440px)" />);
    rerender(<TestComponent query="(min-width: 1280px)" />);

    expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
