"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Lead {
  id: string;
  rawInput: string;
  companyHint: string;
  website: string;
}

interface Brief {
  leadId: string;
  rawInput: string;
  companyName: string;
  website: string;
  companyOverview: string;
  coreProductOrService: string;
  targetCustomerOrAudience: string;
  b2bQualified: boolean;
  b2bQualificationReason: string;
  salesQuestions: string[];
  confidence: string;
  analysisMode: string;
  sources: Array<{ url: string; title: string }>;
  researchedAt: string;
}

interface ApiResponse {
  leads: Lead[];
  briefs: Brief[];
  llmConfigured: boolean;
  llmProvider: string;
}

function escapeHtml(text: string = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default function Home() {
  const [leadInput, setLeadInput] = useState("");
  const [overwrite, setOverwrite] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [results, setResults] = useState<Brief[]>([]);
  const [llmConfigured, setLlmConfigured] = useState(false);
  const [assignmentLeads, setAssignmentLeads] = useState<Lead[]>([]);

  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://sales-research-backend.onrender.com").replace(/\/$/, "");

  const loadState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/leads`);
      const payload: ApiResponse = await response.json();
      
      setLlmConfigured(payload.llmConfigured);
      setAssignmentLeads(payload.leads || []);
      setResults(payload.briefs || []);
      
      if (payload.briefs?.length) {
        setStatus(`${payload.briefs.length} brief${payload.briefs.length === 1 ? "" : "s"} loaded`);
      }
    } catch (error) {
      setStatus("Failed to load initial state");
    }
  }, [API_BASE]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const runAnalysis = async (endpoint: string, body: any) => {
    setIsBusy(true);
    setStatus("Researching leads. This can take a while when websites are slow...");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Analysis failed");
      }

      setResults(payload.results || []);
      setStatus(`Finished ${payload.results.length} brief${payload.results.length === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setIsBusy(false);
    }
  };

  const handleAnalyze = () => {
    if (!leadInput.trim()) {
      setStatus("Please enter at least one lead");
      return;
    }
    runAnalysis(`${API_BASE}/api/analyze`, { leads: leadInput, overwrite });
  };

  const handleAnalyzeSamples = () => {
    runAnalysis(`${API_BASE}/api/analyze-samples`, { overwrite });
  };

  const handleLoadSamples = () => {
    const leadText = assignmentLeads.map((lead) => lead.rawInput).join("\n");
    setLeadInput(leadText);
    setStatus("Assignment leads loaded into the input box");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setLeadInput(e.target?.result as string || "");
      setStatus(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  };

  const getBadgeClass = () => {
    if (llmConfigured) return "ready";
    return "fallback";
  };

  const getBadgeText = () => {
    if (llmConfigured) return "AI Analysis Ready";
    return "Heuristic Mode Active";
  };

  const analyticsData = useMemo(() => {
    if (results.length === 0) return null;

    const b2bQualified = results.filter((b) => b.b2bQualified).length;
    const b2bNotQualified = results.length - b2bQualified;

    const confidenceCounts = results.reduce(
      (acc, b) => {
        const conf = b.confidence || "Unknown";
        acc[conf] = (acc[conf] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const modeCounts = results.reduce(
      (acc, b) => {
        const mode = b.analysisMode || "Unknown";
        acc[mode] = (acc[mode] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total: results.length,
      b2bQualified,
      b2bNotQualified,
      confidenceData: Object.entries(confidenceCounts).map(([name, value]) => ({
        name,
        value,
      })),
      modeData: Object.entries(modeCounts).map(([name, value]) => ({
        name,
        value,
      })),
    };
  }, [results]);

  const COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="container">
      <section className="hero">
        <span className="eyebrow">Sales Research</span>
        <h1>Turn Messy Lead Lists into Discovery-Ready Sales Briefs</h1>
        <p className="lede">
          Paste company names or URLs, run the analysis, and review structured summaries 
          with B2B qualification calls and tailored discovery questions.
        </p>
      </section>

      <section className="panel controls">
        <div className="controls-header">
          <div>
            <h2>Lead Input</h2>
            <p>Supports one lead per line. You can also upload a text or CSV file.</p>
          </div>
          <span className={`badge ${getBadgeClass()}`}>{getBadgeText()}</span>
        </div>

        <textarea
          id="leadInput"
          value={leadInput}
          onChange={(e) => setLeadInput(e.target.value)}
          placeholder="Enter company names or URLs, one per line...

Example:
https://www.houstonroofingonline.com
BrightPlay Turf - Artificial Turf & Landscaping, Chicago IL
https://www.springhilllandscaping.com"
          spellCheck={false}
        />

        <div className="action-row">
          <label className="upload-button">
            <input 
              type="file" 
              accept=".txt,.csv" 
              onChange={handleFileUpload}
            />
            Upload Leads
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            Re-run existing briefs
          </label>
        </div>

        <div className="action-row">
          <button 
            className="secondary" 
            onClick={handleLoadSamples}
            disabled={isBusy || assignmentLeads.length === 0}
          >
            Load Assignment Leads
          </button>
          <button 
            className="primary" 
            onClick={handleAnalyze}
            disabled={isBusy || !leadInput.trim()}
          >
            {isBusy ? "Analyzing..." : "Analyze Pasted Leads"}
          </button>
          <button 
            className="ghost" 
            onClick={handleAnalyzeSamples}
            disabled={isBusy || assignmentLeads.length === 0}
          >
            Analyze Assignment Leads
          </button>
        </div>

        <div className={`status ${status.includes("Failed") ? "error" : ""} ${status.includes("Finished") ? "success" : ""} ${isBusy ? "loading" : ""}`}>
          {status}
        </div>
      </section>

      <section className="panel results-panel">
        <div className="results-header">
          <h2>Generated Briefs</h2>
          <p>{results.length} lead{results.length === 1 ? "" : "s"} analyzed</p>
        </div>

        {results.length === 0 ? (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p>No briefs generated yet. Enter some leads above to get started.</p>
          </div>
        ) : (
          <div className="results">
            {results.map((brief) => (
              <article key={brief.leadId} className="brief-card">
                <div className="brief-top">
                  <div>
                    <h3 className="company-name">{escapeHtml(brief.companyName)}</h3>
                    <p className="raw-input">{escapeHtml(brief.rawInput)}</p>
                  </div>
                  <span className={`qualification ${brief.b2bQualified ? "yes" : "no"}`}>
                    B2B: {brief.b2bQualified ? "Yes" : "No"}
                  </span>
                </div>
                
                <p className="website">
                  {brief.website ? (
                    <a href={escapeHtml(brief.website)} target="_blank" rel="noopener noreferrer">
                      {escapeHtml(brief.website)}
                    </a>
                  ) : (
                    "Website not resolved"
                  )}
                </p>

                <div className="brief-grid">
                  <div>
                    <h4>Overview</h4>
                    <p>{escapeHtml(brief.companyOverview)}</p>
                  </div>
                  <div>
                    <h4>Core Product or Service</h4>
                    <p>{escapeHtml(brief.coreProductOrService)}</p>
                  </div>
                  <div>
                    <h4>Target Customer or Audience</h4>
                    <p>{escapeHtml(brief.targetCustomerOrAudience)}</p>
                  </div>
                  <div>
                    <h4>Qualification Reason</h4>
                    <p>{escapeHtml(brief.b2bQualificationReason)}</p>
                  </div>
                </div>

                <div>
                  <h4>Sales Questions</h4>
                  <ol className="questions">
                    {(brief.salesQuestions || []).map((question, idx) => (
                      <li key={idx}>{escapeHtml(question)}</li>
                    ))}
                  </ol>
                </div>

                {brief.sources && brief.sources.length > 0 && (
                  <details className="sources-wrap">
                    <summary>Source pages ({brief.sources.length})</summary>
                    <ul className="sources">
                      {brief.sources.map((source, idx) => (
                        <li key={idx}>
                          {source.url ? (
                            <a href={escapeHtml(source.url)} target="_blank" rel="noopener noreferrer">
                              {escapeHtml(source.title || source.url)}
                            </a>
                          ) : (
                            escapeHtml(source.title || "Unknown source")
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <p className="meta">
                  Mode: {brief.analysisMode} | Confidence: {brief.confidence} | 
                  Researched: {new Date(brief.researchedAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {analyticsData && analyticsData.total > 0 && (
        <section className="panel analytics-panel">
          <div className="results-header">
            <h2>Analytics</h2>
            <p>Overview of {analyticsData.total} analyzed leads</p>
          </div>

          <div className="analytics-grid">
            <div className="analytics-card">
              <h3>B2B Qualification</h3>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Qualified", value: analyticsData.b2bQualified },
                        { name: "Not Qualified", value: analyticsData.b2bNotQualified },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#232d3f",
                        border: "1px solid rgba(148, 163, 184, 0.15)",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="analytics-legend">
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: "#10b981" }} />
                  <span>Qualified: {analyticsData.b2bQualified}</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: "#ef4444" }} />
                  <span>Not Qualified: {analyticsData.b2bNotQualified}</span>
                </div>
              </div>
            </div>

            <div className="analytics-card">
              <h3>Confidence Levels</h3>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analyticsData.confidenceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#232d3f",
                        border: "1px solid rgba(148, 163, 184, 0.15)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="analytics-card">
              <h3>Analysis Mode</h3>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analyticsData.modeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                    <XAxis
                      type="number"
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#232d3f",
                        border: "1px solid rgba(148, 163, 184, 0.15)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="analytics-stats">
              <div className="stat-card">
                <span className="stat-value">{analyticsData.total}</span>
                <span className="stat-label">Total Briefs</span>
              </div>
              <div className="stat-card success">
                <span className="stat-value">{analyticsData.b2bQualified}</span>
                <span className="stat-label">B2B Qualified</span>
              </div>
              <div className="stat-card warning">
                <span className="stat-value">
                  {analyticsData.total > 0
                    ? Math.round((analyticsData.b2bQualified / analyticsData.total) * 100)
                    : 0}%
                </span>
                <span className="stat-label">Qualification Rate</span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
