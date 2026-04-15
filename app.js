// Paste the deployed Apps Script web-app URL here after deploying.
const CONFIG = {
  WEBAPP_URL: "https://script.google.com/macros/s/AKfycbx4UvSgKLSMxmrH-167u7l-F3oLyM60xNONehVytvvTSIFJejOqVhrn66U9Et-9-fXBLw/exec",
};

const TOTAL_CITIES = 485;
const NUM_STEPS = 4;
let claimedFips = null;
let currentView = "survey";
let currentStep = 1;
const charts = {};

// Global Chart.js theming so plots match the rest of the page.
if (typeof Chart !== "undefined") {
  Chart.defaults.font.family = '"DM Sans", "Helvetica Neue", sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = "#7A7A72";
  Chart.defaults.borderColor = "#E2E0D8";
}

// ---------- view switching ----------

function makeNavButton(label, onClick) {
  const b = document.createElement("button");
  b.className = "btn btn-secondary btn-sm";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function renderNav() {
  const el = document.getElementById("nav-btns");
  while (el.firstChild) el.removeChild(el.firstChild);
  if (currentView === "survey") {
    el.appendChild(makeNavButton("📊 Results", showResults));
  } else {
    el.appendChild(makeNavButton("← Survey", showSurvey));
    el.appendChild(makeNavButton("🔄 Refresh", refresh));
  }
}

function showSurvey() {
  currentView = "survey";
  document.getElementById("survey-view").classList.remove("hidden");
  document.getElementById("results-view").classList.add("hidden");
  renderNav();
  window.scrollTo({top: 0, behavior: "instant"});
}

function showResults() {
  currentView = "results";
  document.getElementById("survey-view").classList.add("hidden");
  document.getElementById("results-view").classList.remove("hidden");
  renderNav();
  window.scrollTo({top: 0, behavior: "instant"});
  refresh();
}

// ---------- toast ----------

const toastEl = document.getElementById("toast");
function toast(msg, ms = 2000) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.add("hidden"), ms);
}

// ---------- API helpers ----------

async function apiGet() {
  const res = await fetch(CONFIG.WEBAPP_URL);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "GET failed");
  return data.rows;
}

async function apiPost(params) {
  // Form-encoded body so the browser sends a simple CORS request (no preflight).
  // Apps Script reads these via e.parameter.
  const body = new URLSearchParams(params).toString();
  const res = await fetch(CONFIG.WEBAPP_URL, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body,
  });
  return res.json();
}

// ---------- radio toggling ----------

// Turn native-radio visual state into .selected class on the parent label.
function initRadioGroups() {
  document.querySelectorAll(".radio-row").forEach(row => {
    row.addEventListener("change", () => {
      row.querySelectorAll(".radio-opt").forEach(opt => {
        const input = opt.querySelector("input[type='radio']");
        opt.classList.toggle("selected", input.checked);
      });
    });
  });
}

// ---------- stepped survey ----------

// Validation: each policy step needs a radio picked. Step 4 needs name + id.
function validateStep(step) {
  const names = {
    1: ["bodycam_answer"],
    2: ["nondisc_answer"],
    3: ["zeroemiss_answer"],
    4: [],
  };
  for (const n of names[step]) {
    if (!document.querySelector(`input[name="${n}"]:checked`)) {
      return `Please pick Yes, No, or Unsure before continuing.`;
    }
  }
  if (step === 4) {
    const name = document.querySelector('input[name="student_name"]').value.trim();
    const sid = document.querySelector('input[name="student_id"]').value.trim();
    if (!name || !sid) return "Please enter your name and student ID.";
  }
  return null;
}

function renderProgressDots() {
  const el = document.getElementById("progress-dots");
  while (el.firstChild) el.removeChild(el.firstChild);
  for (let i = 1; i <= NUM_STEPS; i++) {
    const d = document.createElement("div");
    d.className = "dot";
    if (i === currentStep) d.classList.add("active");
    else if (i < currentStep) d.classList.add("done");
    el.appendChild(d);
  }
}

function showStep(step) {
  currentStep = step;
  document.querySelectorAll(".step").forEach(s => {
    s.classList.toggle("hidden", Number(s.dataset.step) !== step);
  });
  const back = document.getElementById("step-back");
  const next = document.getElementById("step-next");
  const submit = document.getElementById("step-submit");
  back.disabled = step === 1;
  if (step === NUM_STEPS) {
    next.classList.add("hidden");
    submit.classList.remove("hidden");
  } else {
    next.classList.remove("hidden");
    submit.classList.add("hidden");
  }
  document.getElementById("submit-msg").classList.add("hidden");
  renderProgressDots();
  document.getElementById("form-card").scrollIntoView({behavior: "smooth", block: "start"});
}

function stepNext() {
  const err = validateStep(currentStep);
  const msg = document.getElementById("submit-msg");
  if (err) {
    msg.textContent = err;
    msg.className = "error";
    msg.classList.remove("hidden");
    return;
  }
  if (currentStep < NUM_STEPS) showStep(currentStep + 1);
}

function stepBack() {
  if (currentStep > 1) showStep(currentStep - 1);
}

// ---------- claim / submit ----------

async function claimCity() {
  const btn = document.getElementById("claim-btn");
  const err = document.getElementById("claim-error");
  btn.disabled = true;
  btn.textContent = "Getting your city…";
  err.classList.add("hidden");
  try {
    const data = await apiPost({action: "claim"});
    if (!data.ok) throw new Error(data.error || "claim failed");
    const row = data.row;
    claimedFips = row.fips;
    const label = `${row.city}, ${row.state}`;
    document.getElementById("city-name").textContent = label;
    document.querySelectorAll(".city-inline").forEach(el => { el.textContent = label; });
    document.getElementById("intro").classList.add("hidden");
    document.getElementById("form-card").classList.remove("hidden");
    showStep(1);
    window.scrollTo({top: 0, behavior: "smooth"});
    refresh();
  } catch (e) {
    err.textContent = String(e.message || e);
    err.classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Get my city →";
  }
}

async function submitResponse(ev) {
  ev.preventDefault();
  // Revalidate every step in case the student edited an earlier answer.
  for (let s = 1; s <= NUM_STEPS; s++) {
    const err = validateStep(s);
    if (err) {
      showStep(s);
      const msg = document.getElementById("submit-msg");
      msg.textContent = err;
      msg.className = "error";
      msg.classList.remove("hidden");
      return;
    }
  }
  const form = ev.target;
  const fd = new FormData(form);
  const payload = {
    action: "submit",
    fips: claimedFips,
    bodycam_answer: fd.get("bodycam_answer") || "",
    bodycam_notes: fd.get("bodycam_notes") || "",
    nondisc_answer: fd.get("nondisc_answer") || "",
    nondisc_notes: fd.get("nondisc_notes") || "",
    zeroemiss_answer: fd.get("zeroemiss_answer") || "",
    zeroemiss_notes: fd.get("zeroemiss_notes") || "",
    student_name: fd.get("student_name") || "",
    student_id: fd.get("student_id") || "",
  };

  const msg = document.getElementById("submit-msg");
  msg.classList.add("hidden");
  toast("Submitting…", 5000);

  const data = await apiPost(payload);
  if (!data.ok) {
    toast("Error: " + (data.error || "submit failed"), 4000);
    msg.textContent = "Error: " + (data.error || "submit failed");
    msg.className = "error";
    return;
  }
  toast("Saved!", 1500);
  document.getElementById("form-card").classList.add("hidden");
  document.getElementById("thanks-card").classList.remove("hidden");
  window.scrollTo({top: 0, behavior: "smooth"});
  refresh();
}

// ---------- stats + plots ----------

async function refresh() {
  try {
    const rows = await apiGet();
    renderStats(rows);
    renderPlots(rows);
  } catch (e) {
    console.error(e);
    toast("Couldn't load latest data", 2500);
  }
}

function renderStats(rows) {
  const assigned = rows.filter(r => r.assigned_at).length;
  const submitted = rows.filter(r => r.submitted_at).length;
  document.getElementById("kpi-assigned").textContent = assigned;
  document.getElementById("kpi-submitted").textContent = submitted;
}

// Bin rows into N equal-count bins of x, compute share(y == "yes") per bin.
function binscatter(rows, xField, yField, nBins = 10) {
  const clean = rows
    .filter(r => r[xField] !== "" && r[xField] !== null && r[xField] !== undefined)
    .filter(r => r[yField] === "yes" || r[yField] === "no")
    .map(r => ({x: Number(r[xField]), y: r[yField] === "yes" ? 1 : 0}))
    .filter(r => Number.isFinite(r.x));

  clean.sort((a, b) => a.x - b.x);
  const n = clean.length;
  if (n < nBins) return {bins: [], n};

  const bins = [];
  for (let b = 0; b < nBins; b++) {
    const lo = Math.floor((b * n) / nBins);
    const hi = Math.floor(((b + 1) * n) / nBins);
    const slice = clean.slice(lo, hi);
    if (slice.length === 0) continue;
    const xMean = slice.reduce((s, r) => s + r.x, 0) / slice.length;
    const yMean = slice.reduce((s, r) => s + r.y, 0) / slice.length;
    bins.push({xMean, yMean, count: slice.length});
  }
  return {bins, n};
}

function drawBinscatter(canvasId, msgId, xLabel, result) {
  const msgEl = document.getElementById(msgId);
  if (charts[canvasId]) { charts[canvasId].destroy(); delete charts[canvasId]; }

  if (result.bins.length === 0) {
    msgEl.textContent = `not enough data yet — ${result.n} yes/no responses`;
    const ctx = document.getElementById(canvasId).getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }
  msgEl.textContent = `n = ${result.n} cities`;

  const ctx = document.getElementById(canvasId).getContext("2d");
  charts[canvasId] = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        data: result.bins.map(b => ({x: b.xMean, y: b.yMean, n: b.count})),
        backgroundColor: "#1D4ED8",
        borderColor: "#1D4ED8",
        pointRadius: 5,
        pointHoverRadius: 7,
        showLine: true,
        borderWidth: 1.5,
        tension: 0.25,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {padding: {top: 4, right: 8, bottom: 0, left: 0}},
      plugins: {
        legend: {display: false},
        tooltip: {
          backgroundColor: "#2C2C2C",
          titleFont: {family: '"DM Sans", sans-serif', size: 12, weight: "600"},
          bodyFont: {family: '"DM Sans", sans-serif', size: 12},
          padding: 10,
          displayColors: false,
          callbacks: {
            title: () => "",
            label: (c) => {
              const b = c.raw;
              return `${xLabel}: ${b.x.toFixed(2)} · share yes: ${(b.y * 100).toFixed(0)}% · n=${b.n}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: {display: true, text: xLabel, color: "#7A7A72", font: {size: 11}},
          grid: {color: "#F0EDE4", drawBorder: false},
          ticks: {color: "#7A7A72"},
        },
        y: {
          title: {display: true, text: "Share with policy", color: "#7A7A72", font: {size: 11}},
          min: 0, max: 1,
          ticks: {
            color: "#7A7A72",
            callback: (v) => (v * 100).toFixed(0) + "%",
          },
          grid: {color: "#F0EDE4", drawBorder: false},
        },
      },
    },
  });
}

function renderPlots(rows) {
  drawBinscatter("plot1", "plot1-msg", "MRP support for bodycams (%)",
    binscatter(rows, "mrp_bodycam_support", "bodycam_answer"));
  drawBinscatter("plot2", "plot2-msg", "2024 Dem vote share",
    binscatter(rows, "dvs_2024", "bodycam_answer"));
  drawBinscatter("plot3", "plot3-msg", "2024 Dem vote share",
    binscatter(rows, "dvs_2024", "nondisc_answer"));
  drawBinscatter("plot4", "plot4-msg", "2024 Dem vote share",
    binscatter(rows, "dvs_2024", "zeroemiss_answer"));
}

// ---------- wire up ----------

initRadioGroups();
document.getElementById("claim-btn").addEventListener("click", claimCity);
document.getElementById("response-form").addEventListener("submit", submitResponse);
document.getElementById("step-next").addEventListener("click", stepNext);
document.getElementById("step-back").addEventListener("click", stepBack);
renderNav();

