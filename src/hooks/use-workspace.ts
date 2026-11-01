import { useState, useEffect, useCallback, useRef } from "react";
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
export type WorkspaceMode = "live" | "demo";
type Workspace = { receipts: Receipt[]; company: Company };
function localDemo(): Workspace {
  try {
    const d = JSON.parse(localStorage.getItem("bcp-demo-v1") || "null");
    if (d && Array.isArray(d.receipts) && d.company) return d;
  } catch {}
  return { receipts: demoReceipts, company: defaultCompany };
}
export function useWorkspace() {
  const [user, setUser] = useState<User | null>(null),
    [mode, setMode] = useState<WorkspaceMode>(() => {
      try {
        return localStorage.getItem("bcp-workspace-mode") === "demo"
          ? "demo"
          : "live";
      } catch {
        return "live";
      }
    }),
    [demo, setDemo] = useState<Workspace>(localDemo),
    [workspace, setWorkspace] = useState<Workspace>({
      receipts: [],
      company: defaultCompany,
    }),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const live = !!user && mode === "live";
  const workspaceKey = live ? user.uid : "demo";
  const activeWorkspace = useRef(workspaceKey);
  activeWorkspace.current = workspaceKey;
  const { receipts: items, company } = live ? workspace : demo;
  useEffect(
    () =>
      auth
        ? onAuthStateChanged(auth, (u) => {
            setUser(u);
            setWorkspace({ receipts: [], company: defaultCompany });
          })
        : undefined,
    [],
  );
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!live || !user || activeWorkspace.current !== user.uid) return;
      const d = await service.fetchWorkspace(signal);
      if (
        activeWorkspace.current !== user.uid ||
        auth?.currentUser?.uid !== user.uid ||
        signal?.aborted
      )
        return;
      setWorkspace(d);
    },
    [live, user],
  );
  useEffect(() => {
    setError("");
    if (!live) return;
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
  }, [refresh, live]);
  useEffect(() => {
    try {
      localStorage.setItem("bcp-demo-v1", JSON.stringify(demo));
    } catch {}
  }, [demo]);
  useEffect(() => {
    try {
      localStorage.setItem("bcp-workspace-mode", mode);
    } catch {}
  }, [mode]);
  async function login() {
    await signIn();
    setMode("live");
  }
  async function switchMode(next: WorkspaceMode) {
    if (next === "live" && !user) await login();
    else setMode(next);
  }
  async function add(input: ReceiptInput) {
    if (live) {
      await service.createReceipt(input);
      await refresh();
      return;
    }
    if (items.some((r) => duplicateKey(r) === duplicateKey(input)))
      throw Error("This receipt is already in your books.");
    const { image, ...data } = input;
    setDemo((prev) => ({
      ...prev,
      receipts: [
        {
          ...data,
          id: crypto.randomUUID(),
          decision: demoDecision(input, company),
          status: "review",
          createdAt: new Date().toISOString(),
        },
        ...prev.receipts,
      ],
    }));
  }
  async function post(r: Receipt) {
    if (r.decision.verdict === "review")
      throw Error("This receipt still needs a VAT review.");
    if (live) {
      await service.postReceipt(r.id);
      await refresh();
    } else
      setDemo((prev) => ({
        ...prev,
        receipts: prev.receipts.map((i) =>
          i.id === r.id ? { ...i, status: "posted" } : i,
        ),
      }));
  }
  async function save(c: Company) {
    if (live) {
      await service.saveCompany(c);
      if (
        activeWorkspace.current === user.uid &&
        auth?.currentUser?.uid === user.uid
      )
        setWorkspace((prev) => ({ ...prev, company: c }));
    } else
      setDemo((prev) => ({
        company: c,
        receipts: prev.receipts.map((r) =>
          r.status === "review" ? { ...r, decision: demoDecision(r, c) } : r,
        ),
      }));
  }
  return {
    user,
    live,
    switchMode,
    items,
    company,
    error,
    setError,
    loading: live && loading,
    refresh,
    add,
    post,
    save,
    login,
    logout: async () => {
      if (auth) await signOut(auth);
    },
  };
}
