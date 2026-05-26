import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MobileFallback from "./MobileFallback";

describe("MobileFallback", () => {
  it("renders the mobile fallback alert", () => {
    render(<MobileFallback />);

    expect(screen.getByRole("alert")).toHaveClass("app-mobile-fallback");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "OmniAgent works best on desktop",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Mobile support coming soon.")).toBeInTheDocument();
  });
});
