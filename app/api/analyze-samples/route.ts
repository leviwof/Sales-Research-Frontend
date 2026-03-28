import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { analyzeLead } from "@/services/analysisService";

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

async function analyzeAndPersist(leads: any[], overwrite = true, puterAuthToken?: string) {
  const existingBriefs = readJson(briefFile, []);
  const results = [];

  for (const lead of leads) {
    const existing = existingBriefs.find((brief: any) => brief.leadId === lead.id);
    if (existing && !overwrite) {
      results.push(existing);
      continue;
    }

    try {
      const brief = await analyzeLead(lead, puterAuthToken);
      const nextBriefs = existingBriefs.filter((item: any) => item.leadId !== lead.id).concat(brief);
      existingBriefs.length = 0;
      existingBriefs.push(...nextBriefs);
      results.push(brief);
    } catch (error) {
      const brief = {
        leadId: lead.id,
        rawInput: lead.rawInput,
        companyName: lead.companyHint || lead.rawInput,
        website: lead.website || "",
        companyOverview: "Research failed before a brief could be generated.",
        coreProductOrService: "Unknown",
        targetCustomerOrAudience: "Unknown",
        b2bQualified: false,
        b2bQualificationReason: `Pipeline error: ${error instanceof Error ? error.message : "Unknown error"}`,
        salesQuestions: [
          "Was the website reachable during analysis?",
          "Should this lead be retried with a confirmed website?",
          "Is there another trusted source we can use for qualification?"
        ],
        confidence: "low",
        analysisMode: "error",
        researchedAt: new Date().toISOString(),
        sources: []
      };
      const nextBriefs = existingBriefs.filter((item: any) => item.leadId !== lead.id).concat(brief);
      existingBriefs.length = 0;
      existingBriefs.push(...nextBriefs);
      results.push(brief);
    }
  }

  writeJson(briefFile, existingBriefs);
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const overwrite = body.overwrite !== false;
    const leads = readJson(leadFile, []);
    const puterAuthToken = process.env.PUTER_AUTH_TOKEN || "";

    const results = await analyzeAndPersist(leads, overwrite, puterAuthToken);
    return NextResponse.json({ leads, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
