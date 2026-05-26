import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { useRef } from "react";
import { useFocusTrap } from "./useFocusTrap";

function TestComponent({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, active);

  return (
    <div>
      <button data-testid="outside">Outside</button>
      <div ref={containerRef} data-testid="container">
        <button data-testid="btn1">Button 1</button>
        <button data-testid="btn2" disabled>
          Disabled Button
        </button>
        <input data-testid="input1" placeholder="Input 1" />
        <a href="#link" data-testid="link1">
          Link 1
        </a>
      </div>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("traps focus and cycles forward and backward when active", async () => {
    const user = userEvent.setup();
    render(<TestComponent active={true} />);

    const btn1 = screen.getByTestId("btn1");
    const input1 = screen.getByTestId("input1");
    const link1 = screen.getByTestId("link1");

    btn1.focus();
    expect(document.activeElement).toBe(btn1);

    // Tab to next element (skipping disabled button)
    await user.tab();
    expect(document.activeElement).toBe(input1);

    // Tab to next element
    await user.tab();
    expect(document.activeElement).toBe(link1);

    // Tab again -> should cycle back to first element
    await user.tab();
    expect(document.activeElement).toBe(btn1);

    // Shift+Tab -> should cycle backward to last element
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(link1);
  });

  it("does not trap focus when inactive", async () => {
    const user = userEvent.setup();
    render(<TestComponent active={false} />);

    const btn1 = screen.getByTestId("btn1");
    const input1 = screen.getByTestId("input1");
    const link1 = screen.getByTestId("link1");

    btn1.focus();
    expect(document.activeElement).toBe(btn1);

    await user.tab();
    expect(document.activeElement).toBe(input1);

    await user.tab();
    expect(document.activeElement).toBe(link1);

    // Tab again -> should not cycle back, should go to outside or document body
    await user.tab();
    expect(document.activeElement).not.toBe(btn1);
  });
});
