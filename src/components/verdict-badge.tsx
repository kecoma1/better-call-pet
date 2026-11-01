import { Badge } from "./ui/badge";
import { Check, Minus, Clock3 } from "lucide-react";
import type { Verdict } from "../domain";
export default function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const Icon =
    verdict === "deductible"
      ? Check
      : verdict === "not_deductible"
        ? Minus
        : Clock3;
  return (
    <Badge variant="secondary" className={"verdict " + verdict}>
      <Icon size={12} />
      {verdict === "deductible"
        ? "Deductible"
        : verdict === "not_deductible"
          ? "Not deductible"
          : "Needs review"}
    </Badge>
  );
}
