import { describe, expect, it } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import ChatMessage from "../src/components/chat-message";
import App from "../src/App";
import { vi } from "vitest";
vi.mock("../src/firebase", () => ({ auth: null, currentWorkspaceUser: () => null, workspaceFirestore: () => null, selectWorkspaceMode: vi.fn(), observeWorkspaceSession: vi.fn(), signIn: vi.fn() }));

describe("Markdown in both sides of the conversation", () => {
  it.each(["user", "assistant"] as const)(
    "renders headings, lists, links and emphasis for %s messages",
    (role) => {
      render(
        <ChatMessage
          message={{
            role,
            content:
              "## VAT notes\n\nKeep **original invoices** and *check the dates*.\n\n- First receipt\n- Second receipt\n\n[Invoice guidance](https://example.com/invoices)",
          }}
        />,
      );
      const message = screen.getByRole("article", {
        name: role === "user" ? "Your message" : "Saul’s reply",
      });
      expect(
        within(message).getByRole("heading", { name: "VAT notes", level: 2 }),
      ).toBeVisible();
      expect(within(message).getByText("original invoices").tagName).toBe(
        "STRONG",
      );
      expect(within(message).getByText("check the dates").tagName).toBe("EM");
      expect(within(message).getAllByRole("listitem")).toHaveLength(2);
      expect(
        within(message).getByRole("link", { name: "Invoice guidance" }),
      ).toHaveAttribute("href", "https://example.com/invoices");
    },
  );

  it("renders accounting tables and preserves code whitespace", () => {
    render(
      <ChatMessage
        message={{
          role: "assistant",
          content:
            "| Expense | VAT |\n| --- | ---: |\n| Software | £20.00 |\n\n```text\n  debit  100\n  credit 100\n```",
        }}
      />,
    );
    expect(screen.getByRole("table")).toHaveAttribute("data-slot", "table");
    expect(screen.getByRole("columnheader", { name: "VAT" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "£20.00" })).toBeVisible();
    expect(screen.getByText(/debit/).textContent).toBe(
      "  debit  100\n  credit 100\n",
    );
  });

  it("keeps Markdown semantics and accessible text during word fades", () => {
    render(
      <ChatMessage
        message={{
          role: "assistant",
          content: "## VAT\n\nKeep **every invoice** and `£20`.",
        }}
        animate
      />,
    );
    const article = screen.getByRole("article");
    expect(within(article).getByRole("heading", { name: "VAT" })).toBeVisible();
    expect(
      within(article).getByText("invoice").closest("strong"),
    ).not.toBeNull();
    expect(within(article).getByText("invoice")).toHaveClass("chat-word");
    expect(within(article).getByText("£20").tagName).toBe("CODE");
    expect(
      within(article).getByText("£20").querySelector(".chat-word"),
    ).toBeNull();
    expect(article).toHaveTextContent("Keep every invoice and £20.");
  });

  it("escapes supplied HTML and disables unsafe link protocols", () => {
    render(
      <ChatMessage
        message={{
          role: "user",
          content:
            '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[Unsafe](javascript:alert%281%29)',
        }}
      />,
    );
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("Unsafe").closest("a")).not.toHaveAttribute(
      "href",
      expect.stringMatching(/^javascript:/),
    );
  });
});

describe("dedicated chat shell", () => {
  it("opens on Chat and changes layouts when entering the workspace", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Let’s talk books." }),
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Main navigation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /walking from left to right/ }),
    ).toHaveAttribute("src", "/chibi/saul-pacing.png");
    expect(
      within(
        screen.getByRole("complementary", { name: "Conversations" }),
      ).getByRole("button", { name: "New conversation" }),
    ).toBeVisible();
    expect(
      within(
        screen.getByRole("region", { name: "Chat with Saul" }),
      ).queryByRole("button", { name: "New conversation" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Your books, in good hands." }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Chat", exact: true }));
    expect(
      screen.queryByRole("navigation", { name: "Main navigation" }),
    ).not.toBeInTheDocument();
  });
});
