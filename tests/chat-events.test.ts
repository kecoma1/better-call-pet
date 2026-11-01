import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  auth: { currentUser: { uid: "member" } as { uid: string } | null },
  receive: null as null | ((snapshot: any) => void),
  fail: null as null | (() => void),
  stop: vi.fn(),
}));
vi.mock("../src/firebase", () => ({ auth: state.auth, db: {}, currentWorkspaceUser: () => state.auth.currentUser, workspaceFirestore: () => ({}) }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => name,
  where: (field: string, operator: string, value: string) => ({
    field,
    operator,
    value,
  }),
  query: (...constraints: unknown[]) => constraints,
  onSnapshot: vi.fn((_query, receive, fail) => {
    state.receive = receive;
    state.fail = fail;
    return state.stop;
  }),
}));
import { onSnapshot } from "firebase/firestore";
import { watchChatRun } from "../src/services/chat-events";
const conversationId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const run = {
  conversationId,
  requestId,
  createdBy: "member",
  status: "running",
  updatedAt: "2026-11-01T12:00:00.000Z",
  content: "Partial reply",
  tools: [],
  events: [],
};
beforeEach(() => {
  state.auth.currentUser = { uid: "member" };
  state.stop.mockReset();
});
describe("Firestore chat event snapshots", () => {
  it("subscribes with owner and request filters, accepts an initially missing run and detaches", () => {
    const receive = vi.fn(),
      error = vi.fn();
    const stop = watchChatRun(conversationId, requestId, receive, error);
    expect(vi.mocked(onSnapshot).mock.calls.at(-1)![0]).toEqual([
      "chatRuns",
      { field: "createdBy", operator: "==", value: "member" },
      { field: "requestId", operator: "==", value: requestId },
    ]);
    state.receive!({ docs: [] });
    expect(error).not.toHaveBeenCalled();
    state.receive!({ docs: [{ data: () => run }] });
    expect(receive).toHaveBeenCalledWith(run);
    stop();
    state.receive!({ docs: [{ data: () => run }] });
    state.fail!();
    expect(receive).toHaveBeenCalledTimes(1);
    expect(state.stop).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
  });
  it.each([
    { ...run, createdBy: "someone-else" },
    { ...run, conversationId: crypto.randomUUID() },
    { ...run, content: 42 },
    { ...run, requestId: crypto.randomUUID() },
  ])("rejects mismatched or malformed snapshots", (invalid) => {
    const receive = vi.fn(),
      error = vi.fn();
    watchChatRun(conversationId, requestId, receive, error);
    state.receive!({ docs: [{ data: () => invalid }] });
    expect(receive).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.any(Error));
  });
  it("reports permission/listener failures and does not subscribe when signed out", () => {
    const error = vi.fn();
    watchChatRun(conversationId, requestId, vi.fn(), error);
    state.fail!();
    expect(error.mock.calls[0][0].message).toContain(
      "Live updates are unavailable",
    );
    state.auth.currentUser = null;
    const calls = vi.mocked(onSnapshot).mock.calls.length;
    watchChatRun(conversationId, requestId, vi.fn(), error);
    expect(vi.mocked(onSnapshot).mock.calls).toHaveLength(calls);
    expect(error.mock.calls.at(-1)![0].message).toContain("Sign in");
  });
});
