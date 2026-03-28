const leadInput = document.querySelector("#leadInput");
const fileInput = document.querySelector("#fileInput");
const overwriteInput = document.querySelector("#overwriteInput");
const analyzeButton = document.querySelector("#analyzeButton");
const analyzeSamplesButton = document.querySelector("#analyzeSamplesButton");
const loadSamplesButton = document.querySelector("#loadSamplesButton");
const statusNode = document.querySelector("#status");
const resultsNode = document.querySelector("#results");
const resultCountNode = document.querySelector("#resultCount");
const llmBadge = document.querySelector("#llmBadge");
const template = document.querySelector("#resultTemplate");

let assignmentLeadText = "";

function setBusy(isBusy, message) {
  analyzeButton.disabled = isBusy;
  analyzeSamplesButton.disabled = isBusy;
  loadSamplesButton.disabled = isBusy;
  statusNode.textContent = message;
}

function escapeHtml(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderResults(results) {
  resultsNode.innerHTML = "";
  resultCountNode.textContent = `${results.length} lead${results.length === 1 ? "" : "s"} analyzed`;

  for (const brief of results) {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".company-name").textContent = brief.companyName;
    fragment.querySelector(".raw-input").textContent = brief.rawInput;
    fragment.querySelector(".website").innerHTML = brief.website
      ? `<a href="${escapeHtml(brief.website)}" target="_blank" rel="noreferrer">${escapeHtml(brief.website)}</a>`
      : "Website not resolved.";
    fragment.querySelector(".overview").textContent = brief.companyOverview;
    fragment.querySelector(".service").textContent = brief.coreProductOrService;
    fragment.querySelector(".audience").textContent = brief.targetCustomerOrAudience;
    fragment.querySelector(".reason").textContent = brief.b2bQualificationReason;

    const qualification = fragment.querySelector(".qualification");
    qualification.textContent = brief.b2bQualified ? "B2B: Yes" : "B2B: No";
    qualification.classList.add(brief.b2bQualified ? "yes" : "no");

    const questions = fragment.querySelector(".questions");
    for (const question of brief.salesQuestions || []) {
      const item = document.createElement("li");
      item.textContent = question;
      questions.appendChild(item);
    }

    const sources = fragment.querySelector(".sources");
    for (const source of brief.sources || []) {
      const item = document.createElement("li");
      item.innerHTML = source.url
        ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title || source.url)}</a>`
        : escapeHtml(source.title || "Unknown source");
      sources.appendChild(item);
    }

    fragment.querySelector(".meta").textContent =
      `Mode: ${brief.analysisMode}. Confidence: ${brief.confidence}. Researched at: ${new Date(brief.researchedAt).toLocaleString()}.`;

    resultsNode.appendChild(fragment);
  }
}

async function loadState() {
  const response = await fetch("/api/leads");
  const payload = await response.json();
  assignmentLeadText = payload.leads.map((lead) => lead.rawInput).join("\n");
  const browserSdkReady = typeof window.puter !== "undefined";
  if (payload.llmConfigured) {
    llmBadge.textContent = browserSdkReady ? "Puter backend + browser SDK ready" : "Puter backend configured";
  } else {
    llmBadge.textContent = browserSdkReady ? "Browser Puter loaded, backend token missing" : "Heuristic fallback active";
  }
  renderResults(payload.briefs || []);
}

async function runAnalysis(endpoint, body) {
  setBusy(true, "Researching leads. This can take a little while when websites are slow.");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Analysis failed.");
    }

    renderResults(payload.results || []);
    setBusy(false, `Finished ${payload.results.length} brief${payload.results.length === 1 ? "" : "s"}.`);
  } catch (error) {
    setBusy(false, error.message);
  }
}

analyzeButton.addEventListener("click", async () => {
  await runAnalysis("/api/analyze", {
    leads: leadInput.value,
    overwrite: overwriteInput.checked
  });
});

analyzeSamplesButton.addEventListener("click", async () => {
  await runAnalysis("/api/analyze-samples", {
    overwrite: overwriteInput.checked
  });
});

loadSamplesButton.addEventListener("click", () => {
  leadInput.value = assignmentLeadText;
  statusNode.textContent = "Assignment leads loaded into the input box.";
});

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const text = await file.text();
  leadInput.value = text;
  statusNode.textContent = `Loaded ${file.name}.`;
});

loadState().catch((error) => {
  statusNode.textContent = error.message;
});
