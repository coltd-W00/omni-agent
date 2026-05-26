import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll } from "vitest";
import ConfirmationDialog from "./ConfirmationDialog";

// JSDOM polyfill for HTMLDialogElement.showModal / close
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
});

function renderDialog(
  props: Partial<Parameters<typeof ConfirmationDialog>[0]> = {},
) {
  const defaults = {
    open: true,
    title: "Delete task",
    description: "This action cannot be undone.",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };
  return render(<ConfirmationDialog {...defaults} {...props} />);
}

describe("ConfirmationDialog", () => {
  it("open=true → dialog visible with title, description, and buttons", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete task")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("click Confirm → onConfirm called", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ type: "click" }),
    );
  });

  it("click Cancel → onCancel called", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("click backdrop → onCancel called", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    await user.click(screen.getByRole("dialog"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("parent-controlled close does not call onCancel", () => {
    const onCancel = vi.fn();
    const { rerender } = renderDialog({ open: true, onCancel });
    rerender(
      <ConfirmationDialog
        open={false}
        title="Delete task"
        description="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("press Escape → onCancel called", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("focus lands on heading when dialog opens", async () => {
    renderDialog();
    const heading = screen.getByRole("heading", { name: "Delete task" });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });
});
