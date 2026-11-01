import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  renderHook,
} from "@testing-library/react";
vi.mock("../src/firebase", () => ({ auth: null, currentWorkspaceUser: () => null, workspaceFirestore: () => null, selectWorkspaceMode: vi.fn(), observeWorkspaceSession: vi.fn(), signIn: vi.fn() }));
vi.mock("../src/services/invoices", () => ({
  getInvoiceDownload: vi.fn(),
  fetchInvoices: vi.fn(),
  createInvoice: vi.fn(),
}));
import InvoiceDialog from "../src/components/invoice-dialog";
import Invoices from "../src/pages/invoices";
import MessageContent from "../src/components/message-content";
import { getInvoiceDownload } from "../src/services/invoices";
import { useWorkspace } from "../src/hooks/use-workspace";
import { buildInvoice } from "../src/lib/invoices";
import { defaultCompany } from "../src/domain";
import { invoiceInput } from "./fixtures/invoice";
const company = { ...defaultCompany, vatNumber: "GB000000000" };
const invoice = buildInvoice(invoiceInput, company, "a".repeat(32), "member");
const fill = () => {
  for (const [label, value] of Object.entries({
    "Invoice number": "INV-001",
    "Customer name": "Example Client Ltd",
    "Issue date": "2026-11-01",
    "Due date": "2026-11-30",
    "Seller address": "1 Fictional Street",
    "Customer address": "2 Sample Road",
    "Description 1": "Design services",
    "Quantity 1": "2",
    "Unit price (£) 1": "123.45",
    "Line VAT (£) 1": "49.38",
  }))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
};
describe("invoice surfaces", () => {
  it("validates fields, calculates totals, adds and removes items, and preserves the form on failure", async () => {
    const onClose = vi.fn();
    const onCreate = vi
      .fn()
      .mockRejectedValue(Error("Invoice number already in use"));
    render(
      <InvoiceDialog
        open
        onClose={onClose}
        onCreate={onCreate}
        company={company}
        live
      />,
    );
    expect(
      screen.getByRole("button", { name: "Create draft invoice" }),
    ).toBeDisabled();
    fill();
    expect(screen.getByText("£296.28")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getByLabelText("Description 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Remove item 2" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Create draft invoice" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already in use",
    );
    expect(screen.getByLabelText("Invoice number")).toHaveValue("INV-001");
    expect(onClose).not.toHaveBeenCalled();
  });
  it("blocks duplicate submissions until success and closes only after saving", async () => {
    let finish!: (value: typeof invoice) => void;
    const onCreate = vi.fn(
      () =>
        new Promise<typeof invoice>((resolve) => {
          finish = resolve;
        }),
    );
    const onClose = vi.fn();
    render(
      <InvoiceDialog
        open
        onClose={onClose}
        onCreate={onCreate}
        company={company}
        live={false}
      />,
    );
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "Create draft invoice" }),
    );
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      finish(invoice);
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("blocks VAT without a registered VAT number", () => {
    render(
      <InvoiceDialog
        open
        onClose={vi.fn()}
        onCreate={vi.fn()}
        company={defaultCompany}
        live
      />,
    );
    fill();
    expect(screen.getByRole("alert")).toHaveTextContent("VAT number");
    expect(
      screen.getByRole("button", { name: "Create draft invoice" }),
    ).toBeDisabled();
  });
  it("shows empty and search states, links the PDF and public view, and shows download errors", async () => {
    const { rerender } = render(
      <Invoices items={[]} company={company} live onCreate={vi.fn()} />,
    );
    expect(screen.getByText(/No invoices yet/)).toBeVisible();
    rerender(
      <Invoices items={[invoice]} company={company} live onCreate={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Search invoices"), {
      target: { value: "unmatched" },
    });
    expect(screen.getByText("No matching invoices.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Search invoices"), {
      target: { value: "" },
    });
    vi.mocked(getInvoiceDownload).mockRejectedValueOnce(
      Error("Download unavailable"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Get PDF link for INV-001" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Download unavailable",
    );
    const publicUrl =
      "https://rent-o-accountant.web.app/api/invoices/public/" + "a".repeat(43);
    vi.mocked(getInvoiceDownload).mockResolvedValue({
      url: publicUrl + "?download=1",
      publicUrl,
      filename: "invoice-INV-001.pdf",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Get PDF link for INV-001" }),
    );
    expect(
      await screen.findByRole("link", { name: "Download INV-001 PDF" }),
    ).toHaveAttribute("href", publicUrl + "?download=1");
    expect(
      screen.getByRole("link", { name: "View public invoice" }),
    ).toHaveAttribute("href", publicUrl);
    expect(screen.getByLabelText("Public invoice URL")).toHaveValue(publicUrl);
  });
  it("turns tool invoice links into accessible anchors while leaving untrusted Markdown as text", () => {
    const url =
      "https://rent-o-accountant.web.app/api/invoices/public/" + "a".repeat(43);
    render(
      <MessageContent
        content={`[View invoice](${url}) [Download PDF](${url}?download=1) [unsafe](javascript:alert(1))`}
      />,
    );
    expect(screen.getByRole("link", { name: "View invoice" })).toHaveAttribute(
      "href",
      url,
    );
    expect(screen.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
      "href",
      url + "?download=1",
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
  it("persists isolated demo invoices, handles identical retries and rejects conflicting numbers", async () => {
    const input = {
      ...invoiceInput,
      lines: [{ ...invoiceInput.lines[0], vatPence: 0 }],
    };
    const { result, unmount } = renderHook(() => useWorkspace());
    await act(async () => {
      await result.current.addInvoice(input);
    });
    await act(async () => {
      await result.current.addInvoice(input);
    });
    expect(result.current.invoices).toHaveLength(1);
    await expect(
      result.current.addInvoice({ ...input, customerName: "Changed" }),
    ).rejects.toThrow("already in use");
    unmount();
    const restored = renderHook(() => useWorkspace());
    expect(restored.result.current.invoices[0].number).toBe("INV-001");
  });
});
