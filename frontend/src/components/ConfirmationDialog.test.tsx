import { render, screen } from "@testing-library/react";
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
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("click Cancel → onCancel called", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("press Escape → onCancel called", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("focus lands on Cancel button when dialog opens", () => {
    renderDialog();
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    expect(cancelBtn).toHaveFocus();
  });
});
