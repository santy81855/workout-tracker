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
const defaultRecord: ActiveProgramRecord = {
  document: defaultProgram,
  startsOn: "2026-08-10",
  activatedAt: "2026-08-08T00:00:00.000Z",
};

let databasePromise: ReturnType<typeof openDB<ProgramConfigDatabase>> | null = null;

function database() {
  databasePromise ??= openDB<ProgramConfigDatabase>("workout-program-config", 1, {
    upgrade(db) { db.createObjectStore("config"); },
  });
  return databasePromise;
}

export async function getActiveProgramRecord(): Promise<ActiveProgramRecord> {
  return (await (await database()).get("config", "active")) ?? defaultRecord;
}

export async function saveActiveProgramRecord(record: ActiveProgramRecord) {
  const validated: ActiveProgramRecord = {
    document: programDocumentSchema.parse(record.document),
    startsOn: record.startsOn,
    activatedAt: record.activatedAt,
  };
  await (await database()).put("config", validated, "active");
}
