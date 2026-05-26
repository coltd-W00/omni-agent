import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockViewport } from "../test-utils/matchMedia";
import { useBreakpoint } from "./useBreakpoint";

function TestComponent() {
  const breakpoint = useBreakpoint();
  return <span>{breakpoint}</span>;
}

describe("useBreakpoint", () => {
  it.each([
    [4000, "desktop-l"],
    [1440, "desktop-l"],
    [1439, "desktop-m"],
    [1280, "desktop-m"],
    [1279, "desktop-s"],
    [1024, "desktop-s"],
    [1023, "tablet"],
    [768, "tablet"],
    [767, "mobile"],
    [100, "mobile"],
  ])("maps %ipx to %s", (width, expected) => {
    mockViewport(width);

    render(<TestComponent />);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
