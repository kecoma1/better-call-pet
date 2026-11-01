import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { ChatRun } from "../domain";
import { chatRunSchema } from "./chat";

export function watchChatRun(
  conversationId: string,
  requestId: string,
  onUpdate: (run: ChatRun) => void,
  onError: (error: Error) => void,
): () => void {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) {
    onError(Error("Sign in to receive live chat events."));
    return () => {};
  }
  // An owner-filtered query is allowed before the server creates the run document.
  const source = query(
    collection(db, "chatRuns"),
    where("createdBy", "==", uid),
    where("requestId", "==", requestId),
  );
  let active = true;
  const stop = onSnapshot(
    source,
    (snapshot) => {
      if (!active) return;
      for (const document of snapshot.docs) {
        const result = chatRunSchema.safeParse(document.data());
        if (
          !result.success ||
          result.data.createdBy !== uid ||
          result.data.requestId !== requestId ||
          result.data.conversationId !== conversationId
        ) {
          onError(Error("Could not read live chat events."));
          return;
        }
        onUpdate(result.data);
      }
    },
    () => {
      if (active)
        onError(
          Error(
            "Live updates are unavailable. Your reply will still appear when it finishes.",
          ),
        );
    },
  );
  return () => {
    active = false;
    stop();
  };
}
