/* ============================================================
   goldChart.js — D3 v7 chart class
   GoldChart(selector, data)
     .draw()          → initial animated render
     .updateSweep(yr) → animate area sweep from year
   ============================================================ */

class GoldChart {

  // ── Constructor ─────────────────────────────────────────────
  constructor(selector, data) {
    this.selector = selector;
    this.data     = data;

    // Layout
    this.margin = { top: 28, right: 40, bottom: 44, left: 72 };

    // D3 handles
    this._svg        = null;
    this._xScale     = null;
    this._yScale     = null;
    this._lineGen    = null;
    this._areaGen    = null;
    this._sweepArea  = null;
    this._sweepBound = null;

    // Tooltip DOM node
    this._tooltip = document.getElementById("chartTooltip");
  }

  // ── Public: draw ────────────────────────────────────────────
  draw() {
    this._buildScales();
    this._buildSVG();
    this._drawGrid();
    this._drawAxes();
    this._drawArea();          // sweep area (initially hidden)
    this._drawLine();          // animated line draw
    this._drawEventNodes();
    this.updateSweep(this.data[0].year);  // initialise sweep at first year
  }

  // ── Public: updateSweep ────────────────────────────────────
  updateSweep(startYear) {
    const subsetData = this.data.filter(d => d.year >= startYear);
    if (subsetData.length < 2) return;

    const areaPath  = this._areaGen(subsetData);
    const lineGen   = d3.line()
      .x(d => this._xScale(d.year))
      .y(d => this._yScale(d.price))
      .curve(d3.curveMonotoneX);
    const boundPath = lineGen(subsetData);

    const t = d3.transition()
      .duration(500)
      .ease(d3.easeExpOut);

    this._sweepArea
      .transition(t)
      .attr("d", areaPath);

    this._sweepBound
      .transition(t)
      .attr("d", boundPath);
  }

  // ── Private: scales ─────────────────────────────────────────
  _buildScales() {
    const container = document.querySelector(this.selector);
    this._width  = container.clientWidth  - this.margin.left - this.margin.right;
    this._height = Math.max(340, Math.min(480, window.innerHeight * 0.42))
                   - this.margin.top - this.margin.bottom;

    this._xScale = d3.scaleLinear()
      .domain(d3.extent(this.data, d => d.year))
      .range([0, this._width]);

    this._yScale = d3.scaleLinear()
      .domain([0, d3.max(this.data, d => d.price) * 1.1])
      .range([this._height, 0])
      .nice();

    // Line generator
    this._lineGen = d3.line()
      .x(d => this._xScale(d.year))
      .y(d => this._yScale(d.price))
      .curve(d3.curveMonotoneX);

    // Area generator (for sweep)
    this._areaGen = d3.area()
      .x(d => this._xScale(d.year))
      .y0(this._height)
      .y1(d => this._yScale(d.price))
      .curve(d3.curveMonotoneX);
  }

  // ── Private: SVG scaffold ───────────────────────────────────
  _buildSVG() {
    const totalW = this._width  + this.margin.left + this.margin.right;
    const totalH = this._height + this.margin.top  + this.margin.bottom;

    this._svg = d3.select(this.selector)
      .append("svg")
        .attr("width",  "100%")
        .attr("height", totalH)
        .attr("viewBox", `0 0 ${totalW} ${totalH}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
        .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

    // Clip path — keeps line/area inside axes
    this._svg.append("defs")
      .append("clipPath")
        .attr("id", "chartClip")
      .append("rect")
        .attr("width",  this._width)
        .attr("height", this._height);
  }

  // ── Private: grid lines ─────────────────────────────────────
  _drawGrid() {
    const ticks = this._yScale.ticks(5);

    this._svg.selectAll(".grid-line")
      .data(ticks)
      .join("line")
        .attr("class", "grid-line")
        .attr("x1", 0)
        .attr("x2", this._width)
        .attr("y1", d => this._yScale(d))
        .attr("y2", d => this._yScale(d));
  }

  // ── Private: axes ───────────────────────────────────────────
  _drawAxes() {
    // X axis — years, avoid crowding
    const xAxis = d3.axisBottom(this._xScale)
      .tickFormat(d3.format("d"))
      .ticks(Math.min(this.data.length, 9))
      .tickSize(0)
      .tickPadding(12);

    this._svg.append("g")
      .attr("class", "axis-x")
      .attr("transform", `translate(0, ${this._height})`)
      .call(xAxis);

    // Y axis — prices
    const yAxis = d3.axisLeft(this._yScale)
      .ticks(5)
      .tickFormat(d => "$" + d3.format(",.0f")(d))
      .tickSize(0)
      .tickPadding(12);

    this._svg.append("g")
      .attr("class", "axis-y")
      .call(yAxis);
  }

  // ── Private: sweep area & boundary (initially at full range) ─
  _drawArea() {
    const g = this._svg.append("g").attr("clip-path", "url(#chartClip)");

    this._sweepArea = g.append("path")
      .attr("class", "sweep-area")
      .attr("d", this._areaGen(this.data));

    this._sweepBound = g.append("path")
      .attr("class", "sweep-boundary")
      .attr("d", this._lineGen(this.data));
  }

  // ── Private: main gold line with draw animation ─────────────
  _drawLine() {
    const g = this._svg.append("g").attr("clip-path", "url(#chartClip)");

    const path = g.append("path")
      .datum(this.data)
      .attr("class", "gold-line")
      .attr("d", this._lineGen);

    // stroke-dasharray animation trick
    const totalLength = path.node().getTotalLength();

    path
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
        .duration(2000)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);
  }

  // ── Private: event nodes ────────────────────────────────────
  _drawEventNodes() {
    const eventData = this.data.filter(d => d.event && d.event.length > 0);
    const self = this;

    this._svg.selectAll(".event-node")
      .data(eventData)
      .join("circle")
        .attr("class", "event-node")
        .attr("cx", d => this._xScale(d.year))
        .attr("cy", d => this._yScale(d.price))
        .attr("r", 5)
        .style("opacity", 0)
        // Fade nodes in after line draw completes
        .transition()
          .delay(2050)
          .duration(400)
          .style("opacity", 1)
        .selection()  // exit transition, bind mouse events
        .on("mouseover", function(event, d) { self._nodeMouseOver(event, d, this); })
        .on("mousemove", function(event, d) { self._nodeMouseMove(event, d); })
        .on("mouseout",  function(event, d) { self._nodeMouseOut(this); });
  }

  // ── Tooltip helpers ─────────────────────────────────────────
  _nodeMouseOver(event, d, el) {
    // Scale node up
    d3.select(el)
      .transition().duration(200)
      .attr("r", 9);

    // Populate tooltip
    document.getElementById("tooltipYear").textContent  = d.year;
    document.getElementById("tooltipPrice").textContent =
      "$" + d3.format(",.0f")(d.price) + " CAD";
    document.getElementById("tooltipEvent").textContent = d.event || "";

    // Show tooltip
    this._tooltip.classList.add("visible");
    this._positionTooltip(event);
  }

  _nodeMouseMove(event) {
    this._positionTooltip(event);
  }

  _nodeMouseOut(el) {
    d3.select(el)
      .transition().duration(200)
      .attr("r", 5);

    this._tooltip.classList.remove("visible");
  }

  _positionTooltip(event) {
    const tip  = this._tooltip;
    const tw   = tip.offsetWidth;
    const th   = tip.offsetHeight;
    const pad  = 16;
    const vpW  = window.innerWidth;

    let x = event.clientX + pad;
    let y = event.clientY - th / 2;

    // Flip if too close to right edge
    if (x + tw > vpW - pad) x = event.clientX - tw - pad;
    // Keep within vertical bounds
    y = Math.max(pad, Math.min(y, window.innerHeight - th - pad));

    tip.style.left = x + "px";
    tip.style.top  = y + "px";
  }
}