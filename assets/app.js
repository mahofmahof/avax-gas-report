const $ = (id) => document.getElementById(id);
let currentData = null;

const fmt = (value, digits = 3) => Number(value).toFixed(digits);

function classify(avg, policy) {
  const low = Number(BigInt(policy.lowBelowWei)) / 1e9;
  const high = Number(BigInt(policy.highAboveWei)) / 1e9;
  if (avg <= low) return "good";
  if (avg >= high) return "bad";
  return "warn";
}

function drawChart(canvas, hours, policy) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(320 * dpr);

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, 320);

  if (!hours.length) {
    ctx.font = "14px system-ui";
    ctx.fillStyle = "#9aa4b2";
    ctx.fillText("No samples for this day", 24, 48);
    return;
  }

  const pad = { top: 24, right: 18, bottom: 46, left: 54 };
  const width = rect.width - pad.left - pad.right;
  const height = 320 - pad.top - pad.bottom;
  const max = Math.max(...hours.map((h) => h.maxGwei), Number(BigInt(policy.stopAboveWei)) / 1e9, 1);
  const barGap = 4;
  const barW = Math.max(4, (width / hours.length) - barGap);

  ctx.strokeStyle = "#2b3140";
  ctx.lineWidth = 1;
  ctx.font = "12px system-ui";
  ctx.fillStyle = "#9aa4b2";

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (height * i) / 4;
    const value = max - (max * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + width, y);
    ctx.stroke();
    ctx.fillText(fmt(value, 2), 8, y + 4);
  }

  const lowLine = Number(BigInt(policy.lowBelowWei)) / 1e9;
  const highLine = Number(BigInt(policy.highAboveWei)) / 1e9;
  const stopLine = Number(BigInt(policy.stopAboveWei)) / 1e9;
  const lines = [
    [lowLine, "#2ed47a", "low"],
    [highLine, "#f2c94c", "high"],
    [stopLine, "#ff5c5c", "stop"],
  ];

  for (const [value, color, label] of lines) {
    const y = pad.top + height - (value / max) * height;
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + width, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.fillText(label, pad.left + width - 34, y - 5);
  }

  hours.forEach((h, i) => {
    const x = pad.left + i * (width / hours.length);
    const barH = (h.avgGwei / max) * height;
    const y = pad.top + height - barH;
    const cls = classify(h.avgGwei, policy);
    ctx.fillStyle = cls === "good" ? "#2ed47a" : cls === "warn" ? "#f2c94c" : "#ff5c5c";
    ctx.fillRect(x, y, barW, barH);

    if (i % 2 === 0) {
      ctx.save();
      ctx.translate(x + barW / 2, 300);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = "#9aa4b2";
      ctx.fillText(h.hour.slice(11, 16), 0, 0);
      ctx.restore();
    }
  });
}

function render(data) {
  currentData = data;
  const hours = data.hours || [];
  const policy = data.policy || {};
  const totalSamples = hours.reduce((sum, h) => sum + Number(h.samples || 0), 0);
  const avg = hours.reduce((sum, h) => sum + h.avgGwei * h.samples, 0) / Math.max(1, totalSamples);
  const best = [...hours].sort((a, b) => a.avgGwei - b.avgGwei)[0];
  const worst = [...hours].sort((a, b) => b.avgGwei - a.avgGwei)[0];

  const status = data.status === "no-data" ? "No archived samples" : `Generated ${data.generatedAt || "unknown"}`;
  $("status").textContent = `${status} (${data.timezone || "configured timezone"})`;
  $("avgGas").textContent = `${fmt(avg)} gwei`;
  $("bestHour").textContent = best ? `${best.hour.slice(11)} / ${fmt(best.avgGwei)}` : "-";
  $("worstHour").textContent = worst ? `${worst.hour.slice(11)} / ${fmt(worst.avgGwei)}` : "-";
  $("sampleCount").textContent = totalSamples.toLocaleString("en-US");
  $("policyText").textContent = `low ${Number(BigInt(policy.lowBelowWei)) / 1e6}m wei | high ${Number(BigInt(policy.highAboveWei)) / 1e6}m wei | stop ${Number(BigInt(policy.stopAboveWei)) / 1e6}m wei`;
  $("sourceText").textContent = data.source || "";

  $("rows").innerHTML = hours.map((h) => {
    const cls = classify(h.avgGwei, policy);
    return `<tr class="${cls}">
      <td>${h.hour}</td>
      <td>${fmt(h.avgGwei)}</td>
      <td>${fmt(h.minGwei)}</td>
      <td>${fmt(h.maxGwei)}</td>
      <td>${Number(h.samples).toLocaleString("en-US")}</td>
    </tr>`;
  }).join("");

  drawChart($("chart"), hours, policy);
}

function loadDataset(path) {
  $("status").textContent = "Loading data...";
  return fetch(path, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(render)
    .catch((error) => {
      $("status").textContent = `Failed to load data: ${error.message}`;
    });
}

function loadArchiveIndex() {
  return fetch("data/archive/index.json", { cache: "no-store" })
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
    .then((archive) => {
      const select = $("datasetSelect");
      for (const item of archive.items || []) {
        const option = document.createElement("option");
        option.value = item.path;
        option.textContent = `${item.label} archive${item.status === "no-data" ? " (no data)" : ""}`;
        select.appendChild(option);
      }
    })
    .catch(() => {});
}

$("datasetSelect").addEventListener("change", (event) => {
  loadDataset(event.target.value);
});

window.addEventListener("resize", () => {
  if (currentData) drawChart($("chart"), currentData.hours || [], currentData.policy || {});
}, { passive: true });

loadArchiveIndex().finally(() => loadDataset("data/latest.json"));
