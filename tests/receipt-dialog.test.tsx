import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReceiptDialog from "../src/components/receipt-dialog";
import { extractReceipt } from "../src/services/workspace";

vi.mock("../src/services/workspace", () => ({ extractReceipt: vi.fn() }));

const extracted = {
  vendor: "Fictional Stationery",
  date: "2026-11-01",
  reference: "TEST-001",
  netPence: 1200,
  vatPence: 240,
  currency: "GBP",
};

function open(live = true, onAdd = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  render(
    <ReceiptDialog
      receipt="new"
      live={live}
      onClose={onClose}
      onPost={vi.fn()}
      onAdd={onAdd}
    />,
  );
  return { onClose, onAdd };
}

async function chooseImage() {
  fireEvent.change(
    screen.getByLabelText("Drop the paperwork. Keep the progress."),
    {
      target: {
        files: [
          new File(["fictional receipt"], "receipt.png", { type: "image/png" }),
        ],
      },
    },
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Send receipt" })).toBeEnabled(),
  );
}

beforeEach(() => vi.mocked(extractReceipt).mockReset());

describe("receipt image journey", () => {
  it("starts with the image input and waits for an explicit send", async () => {
    open();
    expect(screen.queryByLabelText("Supplier")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send receipt" })).toBeDisabled();
    await chooseImage();
    expect(
      screen.getByRole("img", { name: "Uploaded receipt preview" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Supplier")).not.toBeInTheDocument();
    expect(extractReceipt).not.toHaveBeenCalled();
  });

  it("shows Saul during extraction, then reviews editable fields before saving", async () => {
    let finishReading!: (data: typeof extracted) => void;
    let finishSaving!: () => void;
    vi.mocked(extractReceipt).mockReturnValue(
      new Promise((resolve) => {
        finishReading = resolve;
      }),
    );
    const onAdd = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        finishSaving = resolve;
      }),
    );
    const { onClose } = open(true, onAdd);
    await chooseImage();
    fireEvent.click(screen.getByRole("button", { name: "Send receipt" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saul is reading your receipt",
    );
    expect(screen.getByRole("img", { name: "Saul is thinking" })).toBeVisible();
    expect(screen.queryByLabelText("Supplier")).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finishReading(extracted));
    expect(screen.getByLabelText("Supplier")).toHaveValue(extracted.vendor);
    expect(screen.getByLabelText("Invoice date")).toHaveValue(extracted.date);
    expect(screen.getByLabelText("Invoice reference")).toHaveValue(
      extracted.reference,
    );
    expect(screen.getByLabelText("Net amount (£)")).toHaveValue(12);
    expect(screen.getByLabelText("VAT amount (£)")).toHaveValue(2.4);
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Supplier"), {
      target: { value: "Corrected supplier" },
    });
    fireEvent.change(screen.getByLabelText("VAT amount (£)"), {
      target: { value: "2.30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get VAT decision" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saul is checking the VAT details",
    );
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor: "Corrected supplier",
        netPence: 1200,
        vatPence: 230,
        image: expect.stringMatching(/^data:image\/png;base64,/),
      }),
    );
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finishSaving());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("retains the image after extraction fails and lets the user retry", async () => {
    vi.mocked(extractReceipt)
      .mockRejectedValueOnce(Error("Extraction unavailable"))
      .mockResolvedValueOnce(extracted);
    const { onAdd } = open();
    await chooseImage();
    fireEvent.click(screen.getByRole("button", { name: "Send receipt" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Extraction unavailable",
    );
    expect(
      screen.getByRole("img", { name: "Uploaded receipt preview" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Supplier")).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send receipt" }));
    expect(await screen.findByLabelText("Supplier")).toHaveValue(
      extracted.vendor,
    );
    expect(extractReceipt).toHaveBeenCalledTimes(2);
  });

  it("requires missing evidence to be completed instead of inserting zero amounts", async () => {
    vi.mocked(extractReceipt).mockResolvedValue({
      ...extracted,
      vendor: null,
      date: null,
      netPence: null,
      vatPence: null,
    });
    open();
    await chooseImage();
    fireEvent.click(screen.getByRole("button", { name: "Send receipt" }));
    expect(await screen.findByLabelText("Supplier")).toHaveValue("");
    expect(screen.getByLabelText("Invoice date")).toHaveValue("");
    expect(screen.getByLabelText("Net amount (£)")).toHaveValue(null);
    expect(screen.getByLabelText("VAT amount (£)")).toHaveValue(null);
    expect(
      screen.getByRole("button", { name: "Get VAT decision" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Supplier"), {
      target: { value: "Fictional shop" },
    });
    fireEvent.change(screen.getByLabelText("Invoice date"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(screen.getByLabelText("Net amount (£)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("VAT amount (£)"), {
      target: { value: "0" },
    });
    expect(
      screen.getByRole("button", { name: "Get VAT decision" }),
    ).toBeEnabled();
  });

  it("returns unsupported currencies to the image step without saving", async () => {
    vi.mocked(extractReceipt).mockResolvedValue({
      ...extracted,
      currency: "EUR",
    });
    const { onAdd } = open();
    await chooseImage();
    fireEvent.click(screen.getByRole("button", { name: "Send receipt" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only GBP receipts",
    );
    expect(screen.getByRole("button", { name: "Send receipt" })).toBeEnabled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it.each([
    new File(["unsupported"], "receipt.svg", { type: "image/svg+xml" }),
    new File([new Uint8Array(4500001)], "large.png", { type: "image/png" }),
  ])(
    "rejects an invalid replacement without sending the previously selected image",
    async (file) => {
      open();
      await chooseImage();
      fireEvent.change(
        screen.getByLabelText("Drop the paperwork. Keep the progress."),
        { target: { files: [file] } },
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Choose a PNG, JPG or WebP",
      );
      expect(
        screen.getByRole("button", { name: "Send receipt" }),
      ).toBeDisabled();
      expect(
        screen.queryByRole("img", { name: "Uploaded receipt preview" }),
      ).not.toBeInTheDocument();
      expect(extractReceipt).not.toHaveBeenCalled();
    },
  );

  it("keeps demo uploads explicit about manual entry and shows Saul after send", async () => {
    open(false);
    await chooseImage();
    fireEvent.click(screen.getByRole("button", { name: "Send receipt" }));
    expect(screen.getByRole("img", { name: "Saul is thinking" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "automatic extraction is available after sign-in",
    );
    expect(screen.queryByLabelText("Supplier")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Enter receipt details" }),
    );
    expect(screen.getByLabelText("Supplier")).toHaveValue("");
    expect(extractReceipt).not.toHaveBeenCalled();
  });
});
