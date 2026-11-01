// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
let environment: RulesTestEnvironment;
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  "chat event read permissions",
  () => {
    beforeAll(async () => {
      const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
      environment = await initializeTestEnvironment({
        projectId: "demo-bcp-chat",
        firestore: {
          host,
          port: Number(port),
          rules: readFileSync("firestore.rules", "utf8"),
        },
      });
      await environment.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await Promise.all([
          setDoc(doc(db, "users/member"), { active: true }),
          setDoc(doc(db, "users/other"), { active: true }),
          setDoc(doc(db, "users/revoked"), { active: false }),
          setDoc(doc(db, "chatRuns/run"), {
            createdBy: "member",
            requestId: "request",
            content: "Private reply",
          }),
        ]);
      });
    });
    afterAll(async () => {
      await environment?.cleanup();
    });
    it("lets only the active owner read their run and rejects every client write", async () => {
      const owner = environment.authenticatedContext("member").firestore();
      await assertSucceeds(getDoc(doc(owner, "chatRuns/run")));
      await assertFails(
        setDoc(doc(owner, "chatRuns/run"), {
          createdBy: "member",
          content: "Forged",
        }),
      );
      for (const uid of ["other", "revoked", "unknown"]) {
        const db = environment.authenticatedContext(uid).firestore();
        await assertFails(getDoc(doc(db, "chatRuns/run")));
        await assertFails(setDoc(doc(db, "chatRuns/new"), { createdBy: uid }));
      }
      await assertFails(
        getDoc(
          doc(environment.unauthenticatedContext().firestore(), "chatRuns/run"),
        ),
      );
    });
    it("allows an owner-filtered listener query before a run exists and rejects unscoped queries", async () => {
      const db = environment.authenticatedContext("member").firestore();
      await assertSucceeds(
        getDocs(
          query(
            collection(db, "chatRuns"),
            where("createdBy", "==", "member"),
            where("requestId", "==", "not-created-yet"),
          ),
        ),
      );
      await assertFails(getDocs(collection(db, "chatRuns")));
      await assertFails(
        getDocs(
          query(collection(db, "chatRuns"), where("createdBy", "==", "other")),
        ),
      );
    });
    it("revokes read access when internal membership is disabled", async () => {
      await environment.withSecurityRulesDisabled((context) =>
        setDoc(doc(context.firestore(), "users/member"), { active: false }),
      );
      await assertFails(
        getDoc(
          doc(
            environment.authenticatedContext("member").firestore(),
            "chatRuns/run",
          ),
        ),
      );
    });
  },
);
