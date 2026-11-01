import { currentWorkspaceUser } from "../firebase";
export async function api(path: string, data?: unknown, signal?: AbortSignal) {
  const token = await currentWorkspaceUser()?.getIdToken();
  if (!token) throw Error("Sign in to use your live workspace.");
  const res = await fetch("/api" + path, {
    signal,
    method: data === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const body = await res.json();
  if (!res.ok) throw Error(body.error || "Request failed. Please try again.");
  return body;
}
