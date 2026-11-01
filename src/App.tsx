import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  MessageCircle,
  ReceiptText,
  FileText,
  BookOpen,
  Files,
  Landmark,
  Percent,
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  LogOut,
  LogIn,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Card, CardContent } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { useWorkspace } from "./hooks/use-workspace";
import WorkspaceSwitcher from "./components/workspace-switcher";
import Overview from "./pages/overview";
import Invoices from "./pages/invoices";
import Books from "./pages/books";
import Reports from "./pages/reports";
import Settings from "./pages/settings";
import Connect from "./pages/connect";
import ReceiptTable from "./components/receipt-table";
import ReceiptDialog from "./components/receipt-dialog";
import ReceiptSheet from "./components/receipt-sheet";
import Chat from "./components/chat";
import Saul from "./components/saul";
import type { Receipt } from "./domain";
const navigation = [
  { name: "Chat", icon: MessageCircle },
  { name: "Overview", icon: LayoutDashboard },
  { name: "Receipts", icon: ReceiptText },
  { name: "Invoices", icon: FileText },
  { name: "Bookkeeping", icon: BookOpen },
  { name: "Annual accounts", icon: Files },
  { name: "Corporation Tax", icon: Landmark },
  { name: "VAT", icon: Percent },
];
export default function App() {
  const w = useWorkspace();
  const [page, setPage] = useState("Chat"),
    [collapsed, setCollapsed] = useState(
      () => localStorage.getItem("bcp-sidebar") === "1",
    ),
    [selected, setSelected] = useState<Receipt | "new" | null>(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All receipts");
  const waiting = w.items.filter((r) => r.status === "review").length;
  const internal = !!w.user && !w.user.isAnonymous;
  useEffect(() => { setSelected(null); setSearch(""); setFilter("All receipts"); }, [w.user?.uid]);
  const navigate = (p: string) => {
    setPage(p);
    setSearch("");
  };
  if (location.pathname === "/connect")
    return <Connect live={internal} onLogin={w.login} />;
  return (
    <div
      className={
        "app-shell " +
        (page === "Chat" ? "chat-layout " : "") +
        (collapsed ? "collapsed" : "")
      }
    >
      {page !== "Chat" && (
        <aside className="sidebar">
          <a className="brand" href="/" aria-label="Better Call Pet home">
            <Saul state="seated" />
            <span>
              better call{" "}
              <strong>
                pet<span>✳</span>
              </strong>
            </span>
          </a>
          <WorkspaceSwitcher companyName={w.company.name} live={internal}
            onSwitch={w.switchMode} onError={w.setError} />
          <span className="nav-caption">WORKSPACE</span>
          <nav aria-label="Main navigation">
            {navigation.map(({ name, icon: Icon }) => (
              <Button
                variant="ghost"
                key={name}
                className={"nav-button " + (page === name ? "active" : "")}
                onClick={() => navigate(name)}
                title={name}
                aria-current={page === name ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{name}</span>
                {name === "Receipts" && waiting > 0 && (
                  <Badge variant="secondary">{waiting}</Badge>
                )}
              </Button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <Button
              variant="ghost"
              className={"nav-button " + (page === "Settings" ? "active" : "")}
              onClick={() => navigate("Settings")}
              aria-label="Settings & connections"
            >
              <SettingsIcon size={18} />
              <span>Settings & connections</span>
            </Button>
            <div className="sidebar-profile">
              <span className="profile-avatar">
                {w.user?.displayName?.slice(0, 1) || "D"}
              </span>
              <div>
                <strong>{w.user?.displayName || "Demo workspace"}</strong>
                <small>
                  {w.user ? "Personal account" : "Have a look around"}
                </small>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={internal ? "Sign out" : "Sign in"}
                onClick={() =>
                  void (internal ? w.logout() : w.login()).catch((e) =>
                    w.setError(e.message),
                  )
                }
              >
                {internal ? <LogOut size={16} /> : <LogIn size={16} />}
              </Button>
            </div>
          </div>
        </aside>
      )}
      <div className="main-shell">
        {page !== "Chat" && (
          <header className="topbar">
            <div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => {
                  setCollapsed(!collapsed);
                  localStorage.setItem("bcp-sidebar", collapsed ? "0" : "1");
                }}
              >
                {collapsed ? (
                  <PanelLeftOpen size={17} />
                ) : (
                  <PanelLeftClose size={17} />
                )}
              </Button>
              <span className="breadcrumb">
                Workspace <span>/</span> <strong>{page}</strong>
              </span>
            </div>
            <div>
              <span className="today">
                {new Intl.DateTimeFormat("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Europe/London",
                }).format(new Date())}
              </span>
              <Badge variant="outline" className="workspace-mode">
                <span className="online-dot" />
                {w.user ? "Live workspace" : "Demo mode"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="mobile-settings"
                aria-label="Open settings"
                onClick={() => navigate("Settings")}
              >
                <SettingsIcon size={16} />
              </Button>
              {!w.user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void w.login().catch((e) => w.setError(e.message))
                  }
                >
                  Sign in <ArrowUpRight size={14} />
                </Button>
              )}
            </div>
          </header>
        )}
        <main className={page === "Chat" ? "chat-main" : undefined}>
          {w.error && (
            <div role="alert" className="error app-error">
              {w.error}
              <Button variant="ghost" size="sm" onClick={() => w.setError("")}>
                Dismiss
              </Button>
            </div>
          )}
          {w.loading ? (
            <p role="status" className="empty">
              Opening your workspace…
            </p>
          ) : page === "Chat" ? null : page === "Overview" ? (
            <Overview
              items={w.items}
              company={w.company}
              onAdd={() => setSelected("new")}
              onSelect={setSelected}
              onNavigate={navigate}
            />
          ) : page === "Receipts" ? (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">PAPERWORK, MEET PERSONALITY</p>
                  <h1>
                    Every receipt counts<span>.</span>
                  </h1>
                  <p>Import once. Review the VAT. Keep your books in sync.</p>
                </div>
                <Button onClick={() => setSelected("new")}>
                  <Plus size={16} />
                  Add receipt
                </Button>
              </div>
              <Card>
                <CardContent>
                  <div className="receipts-toolbar">
                    <div className="filters">
                      {["All receipts", "To review", "Posted"].map((f) => (
                        <Button
                          key={f}
                          variant={f === filter ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setFilter(f)}
                        >
                          {f}
                        </Button>
                      ))}
                    </div>
                    <div className="search-box">
                      <Search size={15} />
                      <Label className="sr-only" htmlFor="receipt-search">
                        Search receipts
                      </Label>
                      <Input
                        id="receipt-search"
                        placeholder="Search receipts…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <ReceiptTable
                    items={w.items.filter(
                      (r) =>
                        (filter === "All receipts" ||
                          r.status ===
                            (filter === "Posted" ? "posted" : "review")) &&
                        (r.vendor + " " + r.reference + " " + r.category)
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )}
                    onSelect={setSelected}
                  />
                </CardContent>
              </Card>
            </>
          ) : page === "Invoices" ? (
            <Invoices
              key={w.user?.uid || "demo"}
              items={w.invoices}
              company={w.company}
              live={!!w.user}
              onCreate={w.addInvoice}
            />
          ) : page === "Bookkeeping" ? (
            <Books items={w.items} onSelect={setSelected} />
          ) : page === "Settings" ? (
            <Settings company={w.company} onSave={w.save} live={internal} />
          ) : (
            <Reports page={page} items={w.items} company={w.company} />
          )}
          <Chat
            key={w.user?.uid || "demo"}
            live={!!w.user}
            items={w.items}
            onRefresh={w.refresh}
            view={page === "Chat" ? "page" : "floating"}
            onExpand={() => navigate("Chat")}
            onNavigate={navigate}
            onSignIn={() => void w.login().catch((e) => w.setError(e.message))}
            onOpenReceipt={(id) => {
              const receipt = w.items.find((item) => item.id === id);
              if (receipt) setSelected(receipt);
            }}
          />
        </main>
      </div>
      <ReceiptDialog
        key={selected === "new" ? "new" : "closed"}
        open={selected === "new"}
        onClose={() => setSelected(null)}
        onAdd={w.add}
        live={!!w.user}
      />
      <ReceiptSheet
        key={selected && selected !== "new" ? selected.id : "no-selection"}
        receipt={selected && selected !== "new" ? selected : null}
        onClose={() => setSelected(null)}
        onPost={w.post}
      />
    </div>
  );
}
