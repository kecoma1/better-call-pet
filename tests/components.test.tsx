import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { defaultCompany, demoReceipts, examples } from "../src/domain";
vi.mock("../src/firebase", () => ({
  auth: null,
  signIn: vi.fn(),
  api: vi.fn(),
}));
vi.mock("../src/services/workspace", () => ({
  fetchConnections: vi.fn(),
  saveCompany: vi.fn(),
  extractReceipt: vi.fn(),
}));
import Saul from "../src/components/saul";
import VerdictBadge from "../src/components/verdict-badge";
import ReceiptTable from "../src/components/receipt-table";
import ReceiptDialog from "../src/components/receipt-dialog";
import Chat from "../src/components/chat";
import Overview from "../src/pages/overview";
import Books from "../src/pages/books";
import Reports from "../src/pages/reports";
import Settings from "../src/pages/settings";
import Connect from "../src/pages/connect";
import App from "../src/App";
describe("foundation surfaces", () => {
  it("renders an accessible reduced-motion Saul", () => {
    render(<Saul />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/chibi/saul-idle.png",
    );
  });
  it("labels VAT as a review rather than guessing", () => {
    render(<VerdictBadge verdict="review" />);
    expect(screen.getByText("Needs review")).toBeVisible();
  });
  it("opens a receipt from the list and supports empty records", () => {
    const select = vi.fn();
    const { rerender } = render(
      <ReceiptTable items={demoReceipts} onSelect={select} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Review Paper & Co." }));
    expect(select).toHaveBeenCalledWith(demoReceipts[0]);
    rerender(<ReceiptTable items={[]} onSelect={select} />);
    expect(screen.getByText(/Your next receipt starts/)).toBeVisible();
  });
  it("keeps entered fields and shows a failed classification beside the form", async () => {
    render(
      <ReceiptDialog
        open={true}
        live={false}
        onClose={vi.fn()}
        onAdd={vi.fn().mockRejectedValue(Error("Provider unavailable"))}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Use sample receipt/ }));
    fireEvent.click(screen.getByRole("button", { name: "Get VAT decision" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Provider unavailable",
    );
    expect(screen.getByLabelText("Supplier")).toHaveValue(examples[0].vendor);
  });
  it("shows Saul beneath chat messages and a clearly labelled demo response", async () => {
    render(<Chat live={false} items={demoReceipts} onRefresh={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Message Saul"), {
      target: { value: "What VAT can I reclaim?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(
      await within(screen.getByRole("log")).findByText(/This is the demo workspace/),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Chat with Saul" }),
    ).toBeVisible();
  });
  it("starts the main expense journey from the overview", () => {
    const add = vi.fn();
    render(
      <Overview
        items={[]}
        company={defaultCompany}
        onAdd={add}
        onSelect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add receipt" }));
    expect(add).toHaveBeenCalled();
    expect(screen.getAllByText("£0.00", { exact: true })).toHaveLength(2);
  });
  it("renders the empty ledger without inventing entries", () => {
    render(<Books items={[]} onSelect={vi.fn()} />);
    expect(
      screen.getByText(/Approve a receipt to create your first journal/),
    ).toBeVisible();
  });
  it("labels reports as incomplete working papers", () => {
    render(
      <Reports
        page="Corporation Tax"
        items={demoReceipts}
        company={defaultCompany}
      />,
    );
    expect(screen.getByText("Not generated")).toBeVisible();
    expect(screen.getByText(/No return has been filed/)).toBeVisible();
  });
  it("saves company details explicitly", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<Settings company={defaultCompany} onSave={save} live={false} />);
    fireEvent.change(screen.getByLabelText("Legal company name"), {
      target: { value: "Test Ltd" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save company details" }),
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Test Ltd" }),
      ),
    );
    expect(await screen.findByRole("button", { name: "Saved" })).toBeVisible();
  });
  it("shows connection guidance without inventing a Dot deep link", () => {
    render(<Connect live={false} onLogin={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Connect your Dot." }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toBeVisible();
  });
  it("navigates the sidebar to expenses", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Receipts/ }));
    expect(
      screen.getByRole("heading", { name: "Every receipt counts." }),
    ).toBeVisible();
  });
});
