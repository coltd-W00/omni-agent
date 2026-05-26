import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

function TestComponent({
  onSearch,
  onNewTask,
  hasButton = true,
  buttonDisabled = false,
}: {
  onSearch: () => void;
  onNewTask: () => void;
  hasButton?: boolean;
  buttonDisabled?: boolean;
}) {
  useKeyboardShortcuts({ onSearch, onNewTask });

  return (
    <div>
      <input data-testid="input" placeholder="Type here..." />
      <textarea data-testid="textarea" placeholder="More text..." />
      <div contentEditable data-testid="editable">
        Editable
      </div>
      {hasButton && (
        <button
          data-action="resume-session"
          disabled={buttonDisabled}
          data-testid="resume-btn"
          onClick={() => {}}
        >
          Resume Session
        </button>
      )}
    </div>
  );
}

describe("useKeyboardShortcuts", () => {
  let onSearch: any;
  let onNewTask: any;

  beforeEach(() => {
    onSearch = vi.fn();
    onNewTask = vi.fn();
  });

  it("triggers onSearch on Cmd+K or Ctrl+K", () => {
    render(<TestComponent onSearch={onSearch} onNewTask={onNewTask} />);

    // Command+K
    const eventCmdK = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(eventCmdK);
    expect(onSearch).toHaveBeenCalledTimes(1);

    // Ctrl+K
    const eventCtrlK = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(eventCtrlK);
    expect(onSearch).toHaveBeenCalledTimes(2);
  });

  it("triggers onNewTask on Cmd+N or Ctrl+N", () => {
    render(<TestComponent onSearch={onSearch} onNewTask={onNewTask} />);

    // Command+N
    const eventCmdN = new KeyboardEvent("keydown", {
      key: "n",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(eventCmdN);
    expect(onNewTask).toHaveBeenCalledTimes(1);
  });

  it("does not trigger shortcut when inside input, textarea, or contenteditable", () => {
    render(<TestComponent onSearch={onSearch} onNewTask={onNewTask} />);

    const input = screen.getByTestId("input");
    input.focus();

    const eventCmdK = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    input.dispatchEvent(eventCmdK);
    expect(onSearch).not.toHaveBeenCalled();

    const textarea = screen.getByTestId("textarea");
    textarea.focus();
    textarea.dispatchEvent(eventCmdK);
    expect(onSearch).not.toHaveBeenCalled();

    const editable = screen.getByTestId("editable");
    editable.focus();
    editable.dispatchEvent(eventCmdK);
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("clicks the resume session button when R is pressed (no modifiers)", () => {
    render(<TestComponent onSearch={onSearch} onNewTask={onNewTask} />);

    const btn = screen.getByTestId("resume-btn");
    const clickSpy = vi.spyOn(btn, "click");

    const eventR = new KeyboardEvent("keydown", {
      key: "r",
      bubbles: true,
    });
    document.dispatchEvent(eventR);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("does not click the resume button if it is disabled", () => {
    render(
      <TestComponent
        onSearch={onSearch}
        onNewTask={onNewTask}
        buttonDisabled={true}
      />
    );

    const btn = screen.getByTestId("resume-btn");
    const clickSpy = vi.spyOn(btn, "click");

    const eventR = new KeyboardEvent("keydown", {
      key: "r",
      bubbles: true,
    });
    document.dispatchEvent(eventR);
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
