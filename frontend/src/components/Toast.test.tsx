import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEffect } from "react";
import { ToastProvider, useToast } from "./Toast";
import type { ToastTone } from "./Toast";

function TestConsumer({ tone = "success" as ToastTone, message = "Test message" }: { tone?: ToastTone; message?: string }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast({ tone, message })}>
      Show toast
    </button>
  );
}

function AutoToast({ tone = "success" as ToastTone, message = "Test message" }: { tone?: ToastTone; message?: string }) {
  const { showToast } = useToast();

  useEffect(() => {
    showToast({ tone, message });
  }, [message, showToast, tone]);

  return null;
}

describe("Toast", () => {
  it("showToast makes toast appear with text", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer message="Comment saved" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Show toast" }));
    expect(screen.getByText("Comment saved")).toBeInTheDocument();
  });

  describe("with fake timers", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("auto-dismiss after 4s for success tone", () => {
      render(
        <ToastProvider>
          <AutoToast tone="success" message="Auto dismissed" />
        </ToastProvider>,
      );
      expect(screen.getByText("Auto dismissed")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByText("Auto dismissed").closest(".app-toast")).toHaveClass(
        "app-toast--exiting",
      );
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(screen.queryByText("Auto dismissed")).not.toBeInTheDocument();
    });

    it("error toast does NOT auto-dismiss", () => {
      render(
        <ToastProvider>
          <AutoToast tone="error" message="Persistent error" />
        </ToastProvider>,
      );
      act(() => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.getByText("Persistent error")).toBeInTheDocument();
    });

    it("pushing 4th toast removes oldest (FIFO drop)", () => {
      function MultiToast() {
        const { showToast } = useToast();
        useEffect(() => {
          showToast({ tone: "error", message: "Toast 1" });
          showToast({ tone: "error", message: "Toast 2" });
          showToast({ tone: "error", message: "Toast 3" });
          showToast({ tone: "error", message: "Toast 4" });
        }, [showToast]);

        return null;
      }

      render(
        <ToastProvider>
          <MultiToast />
        </ToastProvider>,
      );
      expect(screen.queryByText("Toast 1")).not.toBeInTheDocument();
      expect(screen.getByText("Toast 2")).toBeInTheDocument();
      expect(screen.getByText("Toast 3")).toBeInTheDocument();
      expect(screen.getByText("Toast 4")).toBeInTheDocument();
    });

    it("auto-dismiss timer does not reset when another toast is added", () => {
      function StaggeredToasts() {
        const { showToast } = useToast();

        useEffect(() => {
          showToast({ tone: "success", message: "Toast 1" });
          const timer = setTimeout(() => {
            showToast({ tone: "success", message: "Toast 2" });
          }, 3000);
          return () => clearTimeout(timer);
        }, [showToast]);

        return (
          null
        );
      }

      render(
        <ToastProvider>
          <StaggeredToasts />
        </ToastProvider>,
      );
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByText("Toast 2")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText("Toast 1").closest(".app-toast")).toHaveClass(
        "app-toast--exiting",
      );
      expect(screen.getByText("Toast 2")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(screen.queryByText("Toast 1")).not.toBeInTheDocument();
    });
  });

  it("useToast outside provider throws", () => {
    function BadConsumer() {
      useToast();
      return null;
    }
    expect(() => render(<BadConsumer />)).toThrow(
      "useToast must be used within ToastProvider",
    );
  });
});
