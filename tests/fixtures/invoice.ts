import type { InvoiceInput } from "../../src/domain";
export const invoiceInput: InvoiceInput = {
  number: "INV-001",
  issueDate: "2026-11-01",
  dueDate: "2026-11-30",
  sellerAddress: "1 Fictional Street\nLondon",
  customerName: "Example Client Ltd",
  customerAddress: "2 Sample Road\nLondon",
  lines: [
    {
      description: "Design services",
      quantity: 2,
      unitPence: 12345,
      vatPence: 4938,
    },
  ],
  notes: "Fictional test invoice",
  paymentDetails: "Use the invoice number as reference.",
};
