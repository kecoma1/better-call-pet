// Browser integration harness. Auth and HTTP are replaced with synthetic fixtures by Playwright.
import { createRoot } from "react-dom/client";
import ReceiptDialog from "../../../src/components/receipt-dialog";
import { createReceipt } from "../../../src/services/workspace";
import "../../../src/style.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <ReceiptDialog
    receipt="new"
    live
    onClose={() => root.render(null)}
    onAdd={async (input) => {
      await createReceipt(input);
    }}
    onPost={async () => {}}
  />,
);
