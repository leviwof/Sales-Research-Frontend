import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const leadFile = path.join(dataDir, "leads.json");
const briefFile = path.join(dataDir, "briefs.json");

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readJson(filePath: string, fallback: any = []) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const file = fs.readFileSync(filePath, "utf8");
    return JSON.parse(file);
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, value: any) {
  ensureDataDir();
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function GET() {
  const leads = readJson(leadFile, []);
  const briefs = readJson(briefFile, []);
  const puterAuthToken = process.env.PUTER_AUTH_TOKEN || "";

  return NextResponse.json({
    leads,
    briefs,
    llmConfigured: Boolean(puterAuthToken),
    llmProvider: "puter"
  });
}
