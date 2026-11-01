import { useState, useEffect, useCallback } from "react";
import { signOut, type User } from "firebase/auth";
import { auth, signIn, observeWorkspaceSession, currentWorkspaceUser } from "../firebase";
import {
  defaultCompany,
  demoReceipts,
  demoDecision,
  duplicateKey,
  type Receipt,
  type ReceiptInput,
  type Company,
} from "../domain";
import * as invoiceService from "../services/invoices";
import {
  buildInvoice,
  invoiceInputSchema,
  invoiceNumberKey,
  isInvoice,
} from "../lib/invoices";
import type { Invoice, InvoiceInput } from "../domain";
import * as service from "../services/workspace";
function localDemo() {
  try {
    const d = JSON.parse(localStorage.getItem("bcp-demo-v1") || "null");
    if (d && Array.isArray(d.receipts) && d.company)
      return {
        ...d,
        invoices: Array.isArray(d.invoices) ? d.invoices.filter(isInvoice) : [],
      };
  } catch {}
  return { receipts: demoReceipts, company: defaultCompany, invoices: [] };
}
export function useWorkspace() {
  const [user, setUser] = useState<User | null>(null),
    [items, setItems] = useState<Receipt[]>(() => auth ? [] : localDemo().receipts),
    [invoices, setInvoices] = useState<Invoice[]>(() => auth ? [] : localDemo().invoices),
    [company, setCompany] = useState<Company>(() => auth ? defaultCompany : localDemo().company),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(!!auth);
  useEffect(
    () =>
      auth
        ? observeWorkspaceSession((u) => {
            setError("");
            setLoading(!!u);
            setUser(u);
            if (!u) {
              const d = localDemo();
              setItems(d.receipts);
              setInvoices(d.invoices);
              setCompany(d.company);
            } else {
              setItems([]);
              setInvoices([]);
              setCompany(defaultCompany);
            }
          }, (e) => { setError(e.message); setLoading(false); })
        : undefined,
    [],
  );
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!user) return;
      const [d, invoiceData] = await Promise.all([
        service.fetchWorkspace(signal),
        invoiceService.fetchInvoices(signal),
      ]);
      if (currentWorkspaceUser()?.uid !== user.uid || signal?.aborted) return;
      setItems(d.receipts);
      setCompany(d.company);
      setInvoices(invoiceData);
    },
    [user],
  );
  useEffect(() => {
    if (!user) return;
    const c = new AbortController();
    setLoading(true);
    refresh(c.signal)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [refresh, user]);
  useEffect(() => {
    if (!auth && !user)
      try {
        localStorage.setItem(
          "bcp-demo-v1",
          JSON.stringify({ receipts: items, company, invoices }),
        );
      } catch { setError("Changes could not be saved in this browser. Free some storage and try again."); }
  }, [items, company, invoices, user]);
  function requireSession() {
    if (auth && !user) throw Error("The demo session is not ready. Please reload to try again.");
  }
  async function add(input: ReceiptInput) {
    requireSession();
    if (user) {
      await service.createReceipt(input);
      await refresh();
      return;
    }
    if (items.some((r) => duplicateKey(r) === duplicateKey(input)))
      throw Error("This receipt is already in your books.");
    const { image, ...data } = input;
    setItems((prev) => [
      {
        ...data,
        id: crypto.randomUUID(),
        decision: demoDecision(input, company),
        status: "review",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }
  async function addInvoice(input: InvoiceInput): Promise<Invoice> {
    requireSession();
    if (user) {
      const invoice = await invoiceService.createInvoice(input);
      if (currentWorkspaceUser()?.uid !== user.uid) return invoice;
      // Creation succeeded even if a later refresh fails; retries reuse this number safely.
      setInvoices((prev) => [
        invoice,
        ...prev.filter((i) => i.id !== invoice.id),
      ]);
      return invoice;
    }
    const data = invoiceInputSchema.parse(input);
    const existing = invoices.find(
      (i) => invoiceNumberKey(i.number) === invoiceNumberKey(data.number),
    );
    if (existing) {
      const canonical = (v: InvoiceInput) =>
        JSON.stringify({
          ...invoiceInputSchema.parse(v),
          number: invoiceNumberKey(v.number),
        });
      if (canonical(existing) !== canonical(data))
        throw Error(
          "This invoice number is already in use with different details.",
        );
      return existing;
    }
    const invoice = buildInvoice(
      data,
      company,
      crypto.randomUUID().replace(/-/g, ""),
      "demo",
    );
    setInvoices((prev) => [invoice, ...prev]);
    return invoice;
  }
  async function post(r: Receipt) {
    requireSession();
    if (r.decision.verdict === "review")
      throw Error("This receipt still needs a VAT review.");
    if (user) {
      await service.postReceipt(r.id);
      await refresh();
    } else
      setItems((prev) =>
        prev.map((i) => (i.id === r.id ? { ...i, status: "posted" } : i)),
      );
  }
  async function save(c: Company) {
    requireSession();
    if (user) {
      await service.saveCompany(c);
      if (currentWorkspaceUser()?.uid !== user.uid) return;
    }
    else
      setItems((prev) =>
        prev.map((r) =>
          r.status === "review" ? { ...r, decision: demoDecision(r, c) } : r,
        ),
      );
    setCompany(c);
  }
  return {
    user,
    offline: !auth,
    items,
    invoices,
    addInvoice,
    company,
    error,
    setError,
    loading,
    refresh,
    add,
    post,
    save,
    login: signIn,
    logout: async () => {
      if (auth) await signOut(auth);
    },
  };
}
