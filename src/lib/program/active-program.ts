import defaultProgramJson from "@/data/programs/hypertrophy-12-week.v1.json";
import { openDB, type DBSchema } from "idb";
import { programDocumentSchema, type ProgramDocument } from "./schema";

export interface ActiveProgramRecord {
  document: ProgramDocument;
  startsOn: string;
  activatedAt: string;
}

interface ProgramConfigDatabase extends DBSchema {
  config: { key: "active"; value: ActiveProgramRecord };
}

export const defaultProgram = programDocumentSchema.parse(defaultProgramJson);
let databasePromise: ReturnType<typeof openDB<ProgramConfigDatabase>> | null = null;

function database() {
  databasePromise ??= openDB<ProgramConfigDatabase>("workout-program-config", 1, {
    upgrade(db) { db.createObjectStore("config"); },
  });
  return databasePromise;
}

export async function getActiveProgramRecord(): Promise<ActiveProgramRecord | null> {
  return (await (await database()).get("config", "active")) ?? null;
}

export async function saveActiveProgramRecord(record: ActiveProgramRecord) {
  const validated: ActiveProgramRecord = {
    document: programDocumentSchema.parse(record.document),
    startsOn: record.startsOn,
    activatedAt: record.activatedAt,
  };
  await (await database()).put("config", validated, "active");
}

export async function clearActiveProgramRecord() { await (await database()).delete("config", "active"); }
