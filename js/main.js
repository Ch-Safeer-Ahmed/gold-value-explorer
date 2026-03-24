/* ============================================================
   main.js — Data loading & application bootstrap
   ============================================================ */

(function () {
  "use strict";

  // ── Config ─────────────────────────────────────────────────
  const DATA_PATH   = "data/gold_data.csv";
  const CONTAINER   = "#chart-container";
  const SLIDER_ID   = "#yearSlider";
  const YEAR_DISPLAY = "#sliderYearDisplay";

  // KPI element refs
  const kpiPeriod = document.getElementById("kpiPeriod");
  const kpiGain   = document.getElementById("kpiGain");
  const kpiStart  = document.getElementById("kpiStart");
  const kpiEnd    = document.getElementById("kpiEnd");

  // ── Formatters ──────────────────────────────────────────────
  const fmtPrice  = d => "$" + d3.format(",.0f")(d) + " CAD";
  const fmtPct    = d => (d >= 0 ? "+" : "") + d3.format(".1f")(d) + "%";

  // ── KPI updater ─────────────────────────────────────────────
  function updateKPIs(data, startYear) {
    const subset = data.filter(d => d.year >= startYear);
    if (subset.length < 2) return;

    const first = subset[0];
    const last  = subset[subset.length - 1];
    const gain  = ((last.price - first.price) / first.price) * 100;

    kpiPeriod.textContent = `${first.year} – ${last.year}`;
    kpiGain.textContent   = fmtPct(gain);
    kpiStart.textContent  = fmtPrice(first.price);
    kpiEnd.textContent    = fmtPrice(last.price);
  }

  // ── Load & initialise ───────────────────────────────────────
  d3.csv(DATA_PATH, row => ({
    year:  +row.year,
    price: +row.price,
    event: row.event ? row.event.trim() : ""
  }))
  .then(data => {
    data.sort((a, b) => a.year - b.year);

    const minYear = data[0].year;
    const maxYear = data[data.length - 1].year;

    // Initialise slider bounds from data
    const slider = document.querySelector(SLIDER_ID);
    slider.min   = minYear;
    slider.max   = maxYear - 1;   // leave at least one year of range
    slider.value = minYear;

    document.querySelector(".slider-endpoints span:first-child").textContent = minYear;
    document.querySelector(".slider-endpoints span:last-child").textContent  = maxYear;

    // Build chart
    const chart = new GoldChart(CONTAINER, data);
    chart.draw();

    // Initial KPI
    updateKPIs(data, minYear);

    // ── Slider interaction ──────────────────────────────────
    slider.addEventListener("input", function () {
      const year = +this.value;
      document.querySelector(YEAR_DISPLAY).textContent = year;
      chart.updateSweep(year);
      updateKPIs(data, year);
    });
  })
  .catch(err => {
    console.error("Failed to load gold data:", err);
    document.querySelector(CONTAINER).innerHTML =
      `<p style="color:#c0392b;padding:2rem;font-family:sans-serif">
        ⚠ Could not load <code>data/gold_data.csv</code>. Please verify the file path.
       </p>`;
  });

}());