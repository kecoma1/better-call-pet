import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
vi.mock("../src/firebase", () => ({
  auth: null, currentWorkspaceUser: () => null, workspaceFirestore: () => null, selectWorkspaceMode: vi.fn(), observeWorkspaceSession: vi.fn(),
  signIn: vi.fn(),
  api: vi.fn(),
}));
import { useWorkspace } from "../src/hooks/use-workspace";
import { examples } from "../src/domain";
describe("isolated demo expense workspace", () => {
  it("rejects duplicates and preserves a single posted expense", async () => {
    const { result } = renderHook(() => useWorkspace());
    await expect(result.current.add(examples[0])).rejects.toThrow(
      "already in your books",
    );
    const receipt = result.current.items.find(
      (r) => r.vendor === examples[0].vendor,
    )!;
    await act(async () => {
      await result.current.post(receipt);
    });
    await act(async () => {
      await result.current.post(receipt);
    });
    expect(
      result.current.items.filter((r) => r.id === receipt.id),
    ).toHaveLength(1);
    expect(result.current.items.find((r) => r.id === receipt.id)?.status).toBe(
      "posted",
    );
  });
  it("does not post an expense whose VAT evidence needs review", async () => {
    const { result } = renderHook(() => useWorkspace());
    const input = {
      ...examples[0],
      reference: "missing-invoice",
      validInvoice: false,
    };
    await act(async () => {
      await result.current.add(input);
    });
    const receipt = result.current.items.find(
      (r) => r.reference === "missing-invoice",
    )!;
    await expect(result.current.post(receipt)).rejects.toThrow(
      "needs a VAT review",
    );
    expect(receipt.status).toBe("review");
  });
});
