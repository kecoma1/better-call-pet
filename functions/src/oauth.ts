import type { Express, Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export const origin = "https://rent-o-accountant.web.app";
const resource = origin + "/mcp";
const db = () => getFirestore();
const random = () => randomBytes(32).toString("base64url");
export const hash = (v: string) =>
  createHash("sha256").update(v).digest("base64url");
const validRedirect = (s: string) => {
  try {
    const u = new URL(s);
    return (
      !u.username &&
      !u.password &&
      !u.hash &&
      (u.protocol === "https:" ||
        (u.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
    );
  } catch {
    return false;
  }
};
export async function requireInternal(
  uid: string,
  email?: string,
  verified = false,
) {
  const ref = db().collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    if (snap.data()?.active !== true) throw Error("Workspace access disabled.");
    return;
  }
  if (
    !verified ||
    email?.toLowerCase() !== process.env.INTERNAL_ADMIN_EMAIL?.toLowerCase()
  )
    throw Error("This account is not authorised for this internal workspace.");
  await db().runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (current.exists) {
      if (current.data()?.active !== true)
        throw Error("Workspace access disabled.");
      return;
    }
    tx.create(ref, {
      email,
      active: true,
      role: "admin",
      createdAt: new Date().toISOString(),
    });
  });
}
export async function firebaseUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const t = req.headers.authorization?.replace(/^Bearer /, "");
    if (!t) throw Error();
    const claims = await getAuth().verifyIdToken(t, true);
    await requireInternal(
      claims.uid,
      claims.email,
      claims.email_verified === true,
    );
    res.locals.uid = claims.uid;
    next();
  } catch {
    res.status(401).json({ error: "Sign in required." });
  }
}
const clients = () => db().collection("oauthClients");
async function validateQuery(q: Record<string, unknown>) {
  const p = z
    .object({
      client_id: z.string(),
      redirect_uri: z.string(),
      response_type: z.literal("code"),
      code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      code_challenge_method: z.literal("S256"),
      state: z.string().min(1).max(1000),
      scope: z.string().default("accounts:read"),
      resource: z.literal(resource),
    })
    .parse(q);
  const d = await clients().doc(p.client_id).get();
  if (
    !d.exists ||
    d.data()?.expiresAt < Date.now() ||
    !d.data()?.redirect_uris.includes(p.redirect_uri)
  )
    throw Error("Unknown client or redirect URI.");
  if (
    !p.scope
      .split(" ")
      .every((s) => ["accounts:read", "receipts:write"].includes(s))
  )
    throw Error("Unsupported scope.");
  return { ...p, client_name: d.data()!.client_name };
}
export function setupOAuth(app: Express) {
  app.get("/.well-known/oauth-protected-resource/mcp", (_q, r) =>
    r.json({
      resource,
      authorization_servers: [origin],
      scopes_supported: ["accounts:read", "receipts:write"],
      bearer_methods_supported: ["header"],
    }),
  );
  app.get("/.well-known/oauth-protected-resource", (_q, r) =>
    r.json({
      resource,
      authorization_servers: [origin],
      scopes_supported: ["accounts:read", "receipts:write"],
    }),
  );
  app.get("/.well-known/oauth-authorization-server", (_q, r) =>
    r.json({
      issuer: origin,
      authorization_endpoint: origin + "/oauth/authorize",
      token_endpoint: origin + "/oauth/token",
      registration_endpoint: origin + "/oauth/register",
      revocation_endpoint: origin + "/oauth/revoke",
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["accounts:read", "receipts:write"],
    }),
  );
  app.post("/oauth/register", async (q, r) => {
    const p = z
      .object({
        client_name: z.string().min(1).max(100).default("MCP client"),
        redirect_uris: z.array(z.string().refine(validRedirect)).min(1).max(5),
        token_endpoint_auth_method: z.literal("none").optional(),
      })
      .parse(q.body);
    const id = random();
    await clients()
      .doc(id)
      .set({ ...p, expiresAt: Date.now() + 30 * 86400000 });
    r.status(201).json({
      ...p,
      client_id: id,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
  });
  app.get("/oauth/authorize", async (q, r) => {
    await validateQuery(q.query);
    r.redirect(
      "/connect?" +
        new URLSearchParams(q.query as Record<string, string>).toString(),
    );
  });
  app.post("/api/oauth/preview", firebaseUser, async (q, r) =>
    r.json(await validateQuery(q.body)),
  );
  app.post("/api/oauth/approve", firebaseUser, async (q, r) => {
    const p = await validateQuery(q.body);
    const code = random();
    await db()
      .collection("oauthCodes")
      .doc(hash(code))
      .set({ ...p, uid: r.locals.uid, expiresAt: Date.now() + 120000 });
    const u = new URL(p.redirect_uri);
    u.searchParams.set("code", code);
    u.searchParams.set("state", p.state);
    u.searchParams.set("iss", origin);
    r.json({ redirect: u.toString() });
  });
  app.post("/oauth/token", async (q, r) => {
    const p = z
      .object({
        grant_type: z.enum(["authorization_code", "refresh_token"]),
        client_id: z.string(),
        code: z.string().optional(),
        redirect_uri: z.string().optional(),
        code_verifier: z.string().min(43).max(128).optional(),
        refresh_token: z.string().optional(),
        resource: z.literal(resource),
      })
      .parse(q.body);
    const isCode = p.grant_type === "authorization_code";
    const token = isCode ? p.code : p.refresh_token;
    if (!token) {
      r.status(400).json({ error: "invalid_grant" });
      return;
    }
    const ref = db()
      .collection(isCode ? "oauthCodes" : "oauthRefresh")
      .doc(hash(token));
    const access = random(),
      refresh = random();
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref),
        d = snap.data();
      if (!d || d.expiresAt < Date.now() || d.client_id !== p.client_id)
        throw Error("Invalid or expired grant.");
      if (isCode) {
        const actual = hash(p.code_verifier || "");
        const expected = d.code_challenge as string;
        if (
          d.redirect_uri !== p.redirect_uri ||
          actual.length !== expected.length ||
          !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
        )
          throw Error("Invalid PKCE verifier.");
      } else {
        const conn = await tx.get(
          db().collection("oauthConnections").doc(d.connectionId),
        );
        if (!conn.exists || conn.data()?.revoked)
          throw Error("Connection revoked.");
      }
      tx.delete(ref);
      const connectionId = d.connectionId || random();
      const data = {
        uid: d.uid,
        client_id: d.client_id,
        scope: d.scope,
        resource,
        connectionId,
      };
      tx.set(db().collection("oauthAccess").doc(hash(access)), {
        ...data,
        expiresAt: Date.now() + 3600000,
      });
      tx.set(db().collection("oauthRefresh").doc(hash(refresh)), {
        ...data,
        expiresAt: Date.now() + 30 * 86400000,
      });
      tx.set(
        db().collection("oauthConnections").doc(connectionId),
        {
          uid: d.uid,
          client_id: d.client_id,
          name: d.client_name || "MCP client",
          scope: d.scope,
          revoked: false,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    });
    r.set("Cache-Control", "no-store").json({
      access_token: access,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refresh,
      scope: (
        await db().collection("oauthAccess").doc(hash(access)).get()
      ).data()?.scope,
    });
  });
  app.post("/oauth/revoke", async (q, r) => {
    const token = typeof q.body.token === "string" ? q.body.token : "";
    if (token) {
      for (const c of ["oauthAccess", "oauthRefresh"]) {
        const ref = db().collection(c).doc(hash(token));
        const d = (await ref.get()).data();
        if (d) {
          await db()
            .collection("oauthConnections")
            .doc(d.connectionId)
            .update({ revoked: true });
          await ref.delete();
        }
      }
    }
    r.status(200).end();
  });
  app.get("/api/connections", firebaseUser, async (_q, r) => {
    const d = await db()
      .collection("oauthConnections")
      .where("uid", "==", r.locals.uid)
      .get();
    r.json(
      d.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d: any) => !d.revoked),
    );
  });
  app.post("/api/connections/revoke", firebaseUser, async (q, r) => {
    const id = z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .parse(q.body.id);
    const ref = db().collection("oauthConnections").doc(id);
    if ((await ref.get()).data()?.uid !== r.locals.uid) {
      r.status(403).end();
      return;
    }
    await ref.update({ revoked: true });
    r.json({ ok: true });
  });
}
export async function mcpUser(q: Request, r: Response, next: NextFunction) {
  const t = q.headers.authorization?.replace(/^Bearer /, "");
  const data = t
    ? (await db().collection("oauthAccess").doc(hash(t)).get()).data()
    : null;
  if (!data || data.expiresAt < Date.now() || data.resource !== resource) {
    r.set(
      "WWW-Authenticate",
      `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
    )
      .status(401)
      .json({ error: "invalid_token" });
    return;
  }
  const conn = (
    await db().collection("oauthConnections").doc(data.connectionId).get()
  ).data();
  const member = (await db().collection("users").doc(data.uid).get()).data();
  if (!conn || conn.revoked || member?.active !== true) {
    r.status(401).json({ error: "invalid_token" });
    return;
  }
  r.locals.uid = data.uid;
  r.locals.scopes = data.scope.split(" ");
  next();
}
