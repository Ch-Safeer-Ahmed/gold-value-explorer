/* ================================================================
   dashboard.js — The Heirloom Calculator
   Modular, vanilla D3 v7. No frameworks.
   v2: Dynamic purity dropdown per metal toggle.
================================================================ */

/* ── Constants ───────────────────────────────────────────── */
const DATA_PATH  = "data/precious_metals.csv";
const TROY_G     = 31.103;
const INFLATION  = 0.025;   // 2.5% annual mock rate
const SCRAP_RATE = 0.80;
const MAX_YEAR   = 2026;

const PURITY_MAP = {
  ".925":        0.925,
  "pure_silver": 0.999,
  "10k":         0.417,
  "14k":         0.583,
  "18k":         0.750,
  "22k":         0.917,
  "24k":         0.999,
};

/* ── Purity options per metal ────────────────────────────── */
const PURITY_OPTIONS = {
  gold: [
    { label: "10k (41.7%)",  value: "10k"  },
    { label: "14k (58.3%)",  value: "14k"  },
    { label: "18k (75.0%)",  value: "18k"  },
    { label: "22k (91.6%)",  value: "22k"  },
    { label: "24k (99.9%)",  value: "24k"  },
  ],
  silver: [
    { label: "Sterling Silver (92.5%)", value: ".925"        },
    { label: "Pure Silver (99.9%)",     value: "pure_silver" },
  ],
};

const CRISIS_BANDS = [
  { start: 1999, end: 2002, label: "Dot-com" },
  { start: 2007, end: 2010, label: "GFC"     },
  { start: 2019, end: 2022, label: "COVID"   },
];

/* ── Application State ───────────────────────────────────── */
const state = {
  data:        [],
  metal:       "gold",
  inflation:   false,
  sliderYear:  1970,
};

/* ── DOM References ──────────────────────────────────────── */
const dom = {
  metalToggle:    document.getElementById("metalToggle"),
  inflToggle:     document.getElementById("inflationToggle"),
  presetBtns:     document.querySelectorAll(".preset-btn"),
  gramInput:      document.getElementById("gramWeight"),
  puritySelect:   document.getElementById("puritySelect"),
  rawValue:       document.getElementById("rawValue"),
  scrapValue:     document.getElementById("scrapValue"),
  roiBadge:       document.getElementById("roiBadge"),
  roiPct:         document.getElementById("roiPct"),
  roiYear:        document.getElementById("roiYear"),
  slider:         document.getElementById("yearSlider"),
  sliderPill:     document.getElementById("sliderPill"),
  sliderBoundMin: document.getElementById("sliderBoundMin"),
  sliderBoundMax: document.getElementById("sliderBoundMax"),
  chartContainer: document.getElementById("chartContainer"),
  floatTip:       document.getElementById("floatTip"),
  tipYear:        document.getElementById("tipYear"),
  tipPrice:       document.getElementById("tipPrice"),
  tipEvent:       document.getElementById("tipEvent"),
  chartSub:       document.getElementById("chartSub"),
  legendSwatch:   document.getElementById("legendSwatch"),
  legendText:     document.getElementById("legendText"),
};

/* ── Formatters ──────────────────────────────────────────── */
const fmtCAD = v => "$" + d3.format(",.0f")(v) + " CAD";
const fmtPct = v => (v >= 0 ? "+" : "") + d3.format(".1f")(v) + "%";

/* ── Inflation Helpers ───────────────────────────────────── */
function inflationFactor(fromYear, toYear) {
  return Math.pow(1 + INFLATION, toYear - fromYear);
}

function getAdjustedPrice(row, field, baseYear) {
  return row[field] * inflationFactor(row.year, baseYear);
}

/* ── Data Accessors ──────────────────────────────────────── */
function priceField() {
  return state.metal === "gold" ? "gold_price" : "silver_price";
}

function getSeriesData() {
  const field    = priceField();
  const baseYear = state.data[state.data.length - 1].year;
  return state.data.map(d => ({
    year:  d.year,
    price: state.inflation
      ? getAdjustedPrice(d, field, baseYear)
      : d[field],
    event: d.event,
  }));
}

function getPriceAtYear(year) {
  const series = getSeriesData();
  const row    = series.find(d => d.year === year);
  if (row) return row.price;

  const sorted = [...series].sort((a, b) => a.year - b.year);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].year <= year && sorted[i + 1].year >= year) {
      const t = (year - sorted[i].year) / (sorted[i + 1].year - sorted[i].year);
      return sorted[i].price + t * (sorted[i + 1].price - sorted[i].price);
    }
  }
  return null;
}

function getLatestPrice() {
  const series = getSeriesData();
  return series[series.length - 1].price;
}

/* ── Purity Dropdown ─────────────────────────────────────── */
function populatePurityDropdown(metal) {
  const select  = dom.puritySelect;
  const options = PURITY_OPTIONS[metal] || PURITY_OPTIONS.gold;

  // Clear existing options
  select.innerHTML = "";

  // Rebuild with metal-appropriate options
  options.forEach(({ label, value }) => {
    const opt        = document.createElement("option");
    opt.value        = value;
    opt.textContent  = label;
    select.appendChild(opt);
  });

  // Default to first option
  select.selectedIndex = 0;

  // Re-run math immediately with the new default purity
  updateOutputs(state.sliderYear);
}

/* ── Calculator Math ─────────────────────────────────────── */
function calcRawValue(spotPrice, grams, purityKey) {
  const purity = PURITY_MAP[purityKey] || 0.583;
  return (spotPrice / TROY_G) * grams * purity;
}

function updateOutputs(year) {
  const grams    = parseFloat(dom.gramInput.value) || 0;
  const purity   = dom.puritySelect.value;
  const spotNow  = getLatestPrice();
  const spotThen = getPriceAtYear(year);

  if (!spotNow || grams <= 0) {
    dom.rawValue.textContent   = "—";
    dom.scrapValue.textContent = "—";
    dom.roiPct.textContent     = "—";
    dom.roiYear.textContent    = year;
    return;
  }

  const rawNow  = calcRawValue(spotNow, grams, purity);
  const scrap   = rawNow * SCRAP_RATE;
  dom.rawValue.textContent   = fmtCAD(rawNow);
  dom.scrapValue.textContent = fmtCAD(scrap);
  dom.roiYear.textContent    = year;

  if (spotThen && year !== state.data[state.data.length - 1].year) {
    const rawThen = calcRawValue(spotThen, grams, purity);
    const roi     = rawThen > 0 ? ((rawNow - rawThen) / rawThen) * 100 : 0;
    dom.roiPct.textContent = fmtPct(roi);
    dom.roiBadge.classList.toggle("negative", roi < 0);
    dom.roiBadge.style.display = "flex";
  } else {
    dom.roiPct.textContent     = "—";
    dom.roiBadge.style.display = "flex";
  }
}

/* ── Chart Subtitle / Legend Sync ────────────────────────── */
function syncLabels() {
  const metalName = state.metal === "gold" ? "Gold" : "Silver";
  const adjLabel  = state.inflation ? "Inflation-Adj." : "Nominal";
  const color     = state.metal === "gold" ? "#D4AF37" : "#A8A9AD";
  dom.chartSub.textContent          = `${metalName} · ${adjLabel} CAD per troy oz`;
  dom.legendSwatch.style.background = color;
  dom.legendText.textContent        = metalName;
}

/* ════════════════════════════════════════════════════════════
   CHART MODULE
════════════════════════════════════════════════════════════ */
const Chart = (() => {

  let svg, gMain;
  let xScale, yScale;
  let linePath, sweepArea, sweepEdge;
  let crossH, crossV, crossDot, overlay;
  let lineGen, areaGen;
  let W, H;

  const MARGIN = { top: 16, right: 30, bottom: 44, left: 72 };
  const bisect = d3.bisector(d => d.year).left;

  function measure() {
    const el = dom.chartContainer;
    W = el.clientWidth  - MARGIN.left - MARGIN.right;
    H = el.clientHeight - MARGIN.top  - MARGIN.bottom;
  }

  function buildSVG() {
    d3.select(dom.chartContainer).selectAll("*").remove();

    const tw = W + MARGIN.left + MARGIN.right;
    const th = H + MARGIN.top  + MARGIN.bottom;

    svg = d3.select(dom.chartContainer)
      .append("svg")
        .attr("width", tw).attr("height", th)
        .attr("viewBox", `0 0 ${tw} ${th}`);

    const defs = svg.append("defs");
    defs.append("clipPath").attr("id", "hc-clip")
      .append("rect").attr("width", W).attr("height", H + 4);

    const grad = defs.append("linearGradient")
      .attr("id", "sweepGrad").attr("x1","0%").attr("y1","0%")
      .attr("x2","0%").attr("y2","100%");
    grad.append("stop").attr("offset","0%")
      .attr("stop-color","#D4AF37").attr("stop-opacity", 0.25);
    grad.append("stop").attr("offset","100%")
      .attr("stop-color","#D4AF37").attr("stop-opacity", 0.02);

    gMain = svg.append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
  }

  function buildScales(series) {
    const years  = series.map(d => d.year);
    const prices = series.map(d => d.price);

    xScale = d3.scaleLinear()
      .domain([d3.min(years), d3.max(years)])
      .range([0, W]);

    yScale = d3.scaleLinear()
      .domain([0, d3.max(prices) * 1.12])
      .range([H, 0])
      .nice();

    lineGen = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    areaGen = d3.area()
      .x(d => xScale(d.year))
      .y0(H)
      .y1(d => yScale(d.price))
      .curve(d3.curveMonotoneX);
  }

  function drawCrisisBands(series) {
    const maxY = d3.max(series, d => d.year);
    const g    = gMain.append("g").attr("class", "crisis-layers");

    CRISIS_BANDS.forEach(({ start, end, label }) => {
      if (start > maxY) return;
      const x0 = xScale(start);
      const x1 = xScale(Math.min(end, maxY));

      g.append("rect").attr("class","crisis-band")
        .attr("x", x0).attr("y", 0)
        .attr("width", x1 - x0).attr("height", H)
        .attr("fill", "#B05C38").attr("opacity", 0.07);

      g.append("line").attr("class","crisis-band")
        .attr("x1", x0).attr("x2", x0)
        .attr("y1", 0).attr("y2", H)
        .attr("stroke","#B05C38").attr("stroke-width", 1)
        .attr("stroke-dasharray","3 4").attr("opacity", 0.22);

      g.append("text").attr("class","crisis-band")
        .attr("x", x0 + (x1 - x0) / 2).attr("y", 12)
        .attr("text-anchor","middle")
        .attr("font-size","9px").attr("font-family","'Outfit',sans-serif")
        .attr("letter-spacing",".1em").attr("fill","#B05C38").attr("opacity",.5)
        .text(label.toUpperCase());
    });
  }

  function drawGrid() {
    gMain.append("g").attr("class","grid")
      .selectAll(".grid-line")
      .data(yScale.ticks(5))
      .join("line")
        .attr("class","grid-line")
        .attr("x1",0).attr("x2",W)
        .attr("y1",d=>yScale(d)).attr("y2",d=>yScale(d));
  }

  function drawAxes() {
    gMain.append("g").attr("class","axis-x")
      .attr("transform",`translate(0,${H})`)
      .call(
        d3.axisBottom(xScale)
          .tickFormat(d3.format("d"))
          .ticks(Math.min(state.data.length, 8))
          .tickSize(0).tickPadding(14)
      );

    gMain.append("g").attr("class","axis-y")
      .call(
        d3.axisLeft(yScale)
          .ticks(5)
          .tickFormat(d => "$" + d3.format(",.0f")(d))
          .tickSize(0).tickPadding(12)
      );
  }

  function buildSweepLayers() {
    const g = gMain.append("g").attr("clip-path","url(#hc-clip)");
    sweepArea = g.append("path").attr("class","sweep-fill");
    sweepEdge = g.append("path").attr("class","sweep-edge");
  }

  function drawLine(series) {
    const metalClass = state.metal === "gold" ? "gold-line" : "silver-line";
    const g = gMain.append("g").attr("clip-path","url(#hc-clip)");

    linePath = g.append("path")
      .datum(series)
      .attr("class", metalClass)
      .attr("d", lineGen);

    const len = linePath.node().getTotalLength();
    linePath
      .attr("stroke-dasharray", `${len} ${len}`)
      .attr("stroke-dashoffset", len)
      .transition().duration(2000).ease(d3.easeCubicInOut)
      .attr("stroke-dashoffset", 0);
  }

  function buildCrosshair() {
    crossH = gMain.append("line").attr("class","crosshair-h")
      .attr("x1",0).attr("x2",W);
    crossV = gMain.append("line").attr("class","crosshair-v")
      .attr("y1",0).attr("y2",H);
    crossDot = gMain.append("circle").attr("class","crosshair-dot").attr("r",5);

    overlay = gMain.append("rect")
      .attr("width",W).attr("height",H)
      .attr("fill","transparent").attr("cursor","crosshair");

    overlay.on("mousemove", onMouseMove)
           .on("mouseleave", onMouseLeave);
  }

  function onMouseMove(event) {
    const series = getSeriesData();
    const [mx]   = d3.pointer(event, this);
    const xVal   = xScale.invert(mx);
    const idx    = bisect(series, xVal);
    const d0     = series[Math.max(0, idx - 1)];
    const d1     = series[Math.min(series.length - 1, idx)];
    const d      = d1 && (xVal - d0.year) > (d1.year - xVal) ? d1 : d0;
    if (!d) return;

    const cx           = xScale(d.year);
    const cy           = yScale(d.price);
    const accentColor  = state.metal === "gold" ? "#D4AF37" : "#A8A9AD";

    crossV.attr("x1",cx).attr("x2",cx).attr("opacity",.85);
    crossH.attr("y1",cy).attr("y2",cy).attr("opacity",.85);
    crossDot.attr("cx",cx).attr("cy",cy).attr("opacity",1)
      .attr("fill", accentColor);

    dom.tipYear.textContent  = d.year;
    dom.tipPrice.textContent = "$" + d3.format(",.0f")(d.price) + " CAD";
    dom.tipEvent.textContent = d.event || "";
    dom.floatTip.classList.add("show");
    dom.floatTip.style.borderLeftColor = accentColor;

    positionTip(event);
  }

  function onMouseLeave() {
    crossV.attr("opacity",0);
    crossH.attr("opacity",0);
    crossDot.attr("opacity",0);
    dom.floatTip.classList.remove("show");
  }

  function positionTip(event) {
    const pad = 14;
    const tw  = dom.floatTip.offsetWidth;
    const th  = dom.floatTip.offsetHeight;
    let tx    = event.clientX + pad;
    let ty    = event.clientY - th / 2;
    if (tx + tw + pad > window.innerWidth) tx = event.clientX - tw - pad;
    ty = Math.max(pad, Math.min(ty, window.innerHeight - th - pad));
    dom.floatTip.style.left = tx + "px";
    dom.floatTip.style.top  = ty + "px";
  }

  function updateSweep(startYear) {
    const series = getSeriesData();
    const subset = series.filter(d => d.year >= startYear);
    if (subset.length < 2) return;

    const accentColor = state.metal === "gold" ? "#D4AF37" : "#A8A9AD";
    const t = d3.transition().duration(500).ease(d3.easeExpOut);

    sweepArea
      .attr("fill", "url(#sweepGrad)")
      .transition(t)
      .attr("d", areaGen(subset));

    sweepEdge
      .attr("stroke", accentColor)
      .transition(t)
      .attr("d", lineGen(subset));
  }

  function morphChart() {
    const series      = getSeriesData();
    const accentColor = state.metal === "gold" ? "#D4AF37" : "#A8A9AD";

    const newYMax = d3.max(series, d => d.price) * 1.12;
    yScale.domain([0, newYMax]).nice();

    const t = d3.transition().duration(1000).ease(d3.easeCubicInOut);

    gMain.select(".axis-y").transition(t)
      .call(
        d3.axisLeft(yScale)
          .ticks(5)
          .tickFormat(d => "$" + d3.format(",.0f")(d))
          .tickSize(0).tickPadding(12)
      );

    gMain.select(".grid").selectAll(".grid-line")
      .data(yScale.ticks(5))
      .join("line")
        .attr("class","grid-line")
        .transition(t)
        .attr("x1",0).attr("x2",W)
        .attr("y1",d=>yScale(d)).attr("y2",d=>yScale(d));

    const metalClass = state.metal === "gold" ? "gold-line" : "silver-line";
    linePath
      .datum(series)
      .attr("stroke-dasharray", null)
      .attr("stroke-dashoffset", null)
      .attr("class", metalClass)
      .transition(t)
      .attr("d", lineGen);

    updateSweep(state.sliderYear);
  }

  function init() {
    measure();
    const series = getSeriesData();
    buildSVG();
    buildScales(series);
    drawCrisisBands(series);
    drawGrid();
    drawAxes();
    buildSweepLayers();
    drawLine(series);
    buildCrosshair();
    updateSweep(state.sliderYear);
  }

  return { init, updateSweep, morphChart };

})();

/* ════════════════════════════════════════════════════════════
   TOGGLE MODULE
════════════════════════════════════════════════════════════ */
const Toggle = (() => {

  function initPill(el, onSwitch) {
    const opts  = el.querySelectorAll(".toggle-pill__opt");
    const thumb = el.querySelector(".toggle-pill__thumb");

    function setThumb(activeOpt) {
      thumb.style.width     = activeOpt.offsetWidth + "px";
      thumb.style.transform = `translateX(${activeOpt.offsetLeft}px)`;
    }

    const firstActive = el.querySelector(".active");
    if (firstActive) requestAnimationFrame(() => setThumb(firstActive));

    opts.forEach(opt => {
      opt.addEventListener("click", () => {
        if (opt.classList.contains("active")) return;
        opts.forEach(o => o.classList.remove("active"));
        opt.classList.add("active");
        setThumb(opt);
        onSwitch(opt.dataset.val);
      });
    });
  }

  function init() {
    initPill(dom.metalToggle, val => {
      state.metal = val;
      populatePurityDropdown(val);   // rebuild dropdown for this metal
      syncLabels();
      Chart.morphChart();
      updateOutputs(state.sliderYear);
    });

    initPill(dom.inflToggle, val => {
      state.inflation = (val === "adjusted");
      syncLabels();
      Chart.morphChart();
      updateOutputs(state.sliderYear);
    });
  }

  return { init };
})();

/* ════════════════════════════════════════════════════════════
   SLIDER MODULE
════════════════════════════════════════════════════════════ */
const Slider = (() => {

  let _animFrame = null;

  function setYear(year) {
    state.sliderYear           = year;
    dom.slider.value           = year;
    dom.sliderPill.textContent = year;
    Chart.updateSweep(year);
    updateOutputs(year);
  }

  function animateTo(targetYear, ms) {
    if (_animFrame) cancelAnimationFrame(_animFrame);
    const startYear = state.sliderYear;
    const dist      = targetYear - startYear;
    const t0        = performance.now();

    function step(now) {
      const t    = Math.min((now - t0) / ms, 1);
      const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
      setYear(Math.round(startYear + dist * ease));
      if (t < 1) _animFrame = requestAnimationFrame(step);
    }
    _animFrame = requestAnimationFrame(step);
  }

  function init(minYear, maxYear) {
    dom.slider.min = minYear;
    dom.slider.max = maxYear;
    dom.sliderBoundMin.textContent = minYear;
    dom.sliderBoundMax.textContent = maxYear;
    setYear(minYear);

    dom.slider.addEventListener("input", function () {
      dom.presetBtns.forEach(b => b.classList.remove("active"));
      setYear(+this.value);
    });
  }

  return { init, animateTo, setYear };
})();

/* ════════════════════════════════════════════════════════════
   PRESETS MODULE
════════════════════════════════════════════════════════════ */
const Presets = (() => {

  function syncToggleThumb(metal) {
    const opts  = dom.metalToggle.querySelectorAll(".toggle-pill__opt");
    const thumb = dom.metalToggle.querySelector(".toggle-pill__thumb");
    opts.forEach(o => o.classList.toggle("active", o.dataset.val === metal));
    const activeOpt = dom.metalToggle.querySelector(".active");
    if (activeOpt && thumb) {
      thumb.style.width     = activeOpt.offsetWidth + "px";
      thumb.style.transform = `translateX(${activeOpt.offsetLeft}px)`;
    }
  }

  function init() {
    dom.presetBtns.forEach(btn => {
      btn.addEventListener("click", function () {
        const year   = +this.dataset.year;
        const grams  = this.dataset.grams;
        const purity = this.dataset.purity;
        const metal  = this.dataset.metal;

        // Switch metal + rebuild dropdown if needed
        if (metal && metal !== state.metal) {
          state.metal = metal;
          syncToggleThumb(metal);
          populatePurityDropdown(metal);
          syncLabels();
          Chart.morphChart();
        }

        // Set purity to preset value if it exists in the rebuilt dropdown
        const optExists = [...dom.puritySelect.options]
          .some(o => o.value === purity);
        if (optExists) dom.puritySelect.value = purity;

        dom.gramInput.value = grams;

        dom.presetBtns.forEach(b => b.classList.remove("active"));
        this.classList.add("active");

        Slider.animateTo(year, 800);
      });
    });
  }

  return { init };
})();

/* ════════════════════════════════════════════════════════════
   BOOTSTRAP
════════════════════════════════════════════════════════════ */
d3.csv(DATA_PATH, row => ({
  year:         +row.year,
  gold_price:   +row.gold_price,
  silver_price: +row.silver_price,
  event:         row.event ? row.event.trim() : "",
}))
.then(data => {
  data.sort((a, b) => a.year - b.year);
  state.data = data;

  const minYear = data[0].year;
  const maxYear = data[data.length - 1].year;
  state.sliderYear = minYear;

  syncLabels();
  Chart.init();
  Slider.init(minYear, maxYear);
  Toggle.init();
  Presets.init();

  // Populate dropdown for the initial metal (gold) on first load
  populatePurityDropdown(state.metal);

  // Wire up calculator inputs
  dom.gramInput.addEventListener("input",   () => updateOutputs(state.sliderYear));
  dom.puritySelect.addEventListener("change", () => updateOutputs(state.sliderYear));

  // Remove preset highlight on manual slider interaction
  dom.slider.addEventListener("mousedown", () => {
    dom.presetBtns.forEach(b => b.classList.remove("active"));
  });
})
.catch(err => {
  console.error("Failed to load precious_metals.csv:", err);
  dom.chartContainer.innerHTML =
    `<p style="padding:2rem;color:#c0392b;font-family:sans-serif">
      ⚠ Could not load <code>data/precious_metals.csv</code>.
      Verify the file path and column names.
    </p>`;
});