import { defaultCompany, type Company } from "../../src/domain.js";
import { workspaceDocument, type WorkspaceActor } from "./workspace-context.js";
export const companyRef = (actor: WorkspaceActor = "") =>
  workspaceDocument("companies", "primary", actor);
export async function company(actor: WorkspaceActor): Promise<Company> {
  const { workspaceId: _workspaceId, ...saved } = (await companyRef(actor).get()).data() || {};
  return {
    ...defaultCompany,
    name: "Your LTD",
    vatRegistered: false,
    ...saved,
  };
}
