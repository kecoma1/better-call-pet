import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { WorkspaceMode } from "../hooks/use-workspace";

export default function WorkspaceSwitcher({
  companyName,
  live,
  onSwitch,
  onError,
}: {
  companyName: string;
  live: boolean;
  onSwitch: (mode: WorkspaceMode) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Select
      value={live ? "live" : "demo"}
      disabled={busy}
      onValueChange={async (value: WorkspaceMode) => {
        setBusy(true);
        try {
          await onSwitch(value);
        } catch (e) {
          onError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <SelectTrigger
        className="company-switch"
        aria-label="Switch workspace"
        title={`${companyName} · ${live ? "Company workspace" : "Demo mode"}`}
      >
        <span className="company-avatar" aria-hidden="true">
          {companyName.slice(0, 1)}
        </span>
        <SelectValue>
          <strong>{companyName}</strong>
          <small>{live ? "Company workspace" : "Demo mode"}</small>
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectItem value="live">Company workspace</SelectItem>
        <SelectItem value="demo">Demo mode</SelectItem>
      </SelectContent>
    </Select>
  );
}
