import { getInboxReferences, getMasterData } from "@/lib/queries/references";
import { TriageFlow } from "./triage-flow";

export const instant = false;

export default async function TriagePage() {
  const [items, masterData] = await Promise.all([
    getInboxReferences(),
    getMasterData(),
  ]);

  return <TriageFlow initialItems={items} masterData={masterData} />;
}
