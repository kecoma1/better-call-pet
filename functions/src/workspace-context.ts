import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";

// Only verified server middleware constructs anonymous actors. A client never
// selects its workspace, and internal members keep the existing shared books.
export type WorkspaceActor = string | { uid: string; demo: true };
export const actorUid = (actor: WorkspaceActor) =>
  typeof actor === "string" ? actor : actor.uid;
export const isDemo = (actor: WorkspaceActor) => typeof actor !== "string";
export function workspaceCollection(name: string, actor: WorkspaceActor = "") {
  return getFirestore().collection(
    isDemo(actor) ? "demo" + name[0].toUpperCase() + name.slice(1) : name,
  );
}
export function workspaceDocument(name: string, id: string, actor: WorkspaceActor = "") {
  const prefix = isDemo(actor)
    ? createHash("sha256").update(actorUid(actor)).digest("hex") + "-"
    : "";
  return workspaceCollection(name, actor).doc(prefix + id);
}
export const workspaceFields = (actor: WorkspaceActor) =>
  isDemo(actor) ? { workspaceId: actorUid(actor) } : {};
export function workspaceList(name: string, actor: WorkspaceActor) {
  const collection = workspaceCollection(name, actor);
  return (isDemo(actor)
    ? collection.where("workspaceId", "==", actorUid(actor))
    : collection
  ).orderBy("createdAt", "desc").limit(500);
}
