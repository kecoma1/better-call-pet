import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, signIn } from "../firebase";
import {
  defaultCompany,
  demoReceipts,
  demoDecision,
  duplicateKey,
  type Receipt,
  type ReceiptInput,
  type Company,
} from "../domain";
import * as service from "../services/workspace";
function localDemo() {
  try {
    const d = JSON.parse(localStorage.getItem("bcp-demo-v1") || "null");
    if (d && Array.isArray(d.receipts) && d.company) return d;
  } catch {}
  return { receipts: demoReceipts, company: defaultCompany };
}
export function useWorkspace() {
  const [user, setUser] = useState<User | null>(null),
    [items, setItems] = useState<Receipt[]>(() => localDemo().receipts),
    [company, setCompany] = useState<Company>(() => localDemo().company),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(
    () =>
      auth
        ? onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (!u) {
              const d = localDemo();
              setItems(d.receipts);
              setCompany(d.company);
            } else {
              setItems([]);
              setCompany(defaultCompany);
            }
          })
        : undefined,
    [],
  );
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!user) return;
      const d = await service.fetchWorkspace(signal);
      if (auth?.currentUser?.uid !== user.uid || signal?.aborted) return;
      setItems(d.receipts);
      setCompany(d.company);
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
    if (!user)
      try {
        localStorage.setItem(
          "bcp-demo-v1",
          JSON.stringify({ receipts: items, company }),
        );
      } catch {}
  }, [items, company, user]);
  async function add(input: ReceiptInput) {
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
  async function post(r: Receipt) {
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
    if (user) await service.saveCompany(c);
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
    items,
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
