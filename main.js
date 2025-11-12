const ATHENS_COORDS = { latitude: 37.98, longitude: 23.72 };
const DAYS_OF_HISTORY = 365;
const METRIC_DEFS = [
  {
    id: "temperature",
    label: "Temperature",
    color: "#ff7f0e",
    type: "range",
    axis: "temperature",
    accessors: {
      min: (d) => d.temperature.min,
      max: (d) => d.temperature.max,
      mean: (d) => d.temperature.mean,
    },
    units: "°C",
  },
  {
    id: "humidity",
    label: "Humidity",
    color: "#2ca02c",
    type: "range",
    axis: "humidity",
    accessors: {
      min: (d) => d.humidity.min,
      max: (d) => d.humidity.max,
      mean: (d) => d.humidity.mean,
    },
    units: "%",
  },
  {
    id: "wind",
    label: "Wind Speed",
    color: "#e377c2",
    type: "range",
    axis: "wind",
    accessors: {
      min: (d) => d.wind.min,
      max: (d) => d.wind.max,
      mean: (d) => d.wind.mean,
    },
    units: " km/h",
  },
  {
    id: "precipitation",
    label: "Precipitation",
    color: "#1f78b4",
    type: "bar",
    axis: "precipitation",
    accessors: {
      value: (d) => d.precipitation,
    },
    units: " mm",
  },
  {
    id: "daylight",
    label: "Daylight",
    color: "#fdae6b",
    type: "bar",
    axis: "daylight",
    accessors: {
      value: (d) => d.daylightHours,
    },
    units: " h",
  },
];

const RANGE_GRADIENT_DEFS = {
  temperature: [
    { offset: "0%", color: "#1b4f72", opacity: 0.25 },
    { offset: "50%", color: "#f39c12", opacity: 0.45 },
    { offset: "100%", color: "#ff7043", opacity: 0.75 },
  ],
  humidity: [
    { offset: "0%", color: "#8c564b", opacity: 0.3 },
    { offset: "100%", color: "#2ca02c", opacity: 0.7 },
  ],
};

const AXIS_LABELS = {
  temperature: "Temperature (°C)",
  humidity: "Humidity (%)",
  wind: "Wind Speed (km/h)",
  precipitation: "Precipitation (mm)",
  daylight: "Daylight (hours)",
};

const DEFAULT_VISIBLE_SERIES = new Set(["temperature"]);

const seriesVisibility = METRIC_DEFS.reduce((acc, def) => {
  acc[def.id] = DEFAULT_VISIBLE_SERIES.has(def.id);
  return acc;
}, {});

const BASE_MARGINS = {
  top: 50,
  bottom: 50,
  left: 100,
  right: 180,
};
const AXIS_GAP = 60;
const AXIS_LABEL_OFFSET = 45;

const AXIS_ORDER = ["temperature", "precipitation", "humidity", "wind", "daylight"];

const AXIS_CONFIG = {
  temperature: { side: "left", ticks: 6, format: (d) => `${d}°C` },
  precipitation: { side: "left", ticks: 5, format: (d) => `${d} mm` },
  humidity: { side: "right", ticks: 5, format: (d) => `${d}%` },
  wind: { side: "right", ticks: 5, format: (d) => `${d} km/h` },
  daylight: { side: "right", ticks: 5, format: (d) => `${d} h` },
};

let currentChart = null;

document.addEventListener("DOMContentLoaded", async () => {
  attachControlHandlers();
  try {
    const raw = await fetchWeatherData();
    const dataset = transformWeatherData(raw);
    setupChart(dataset);
  } catch (error) {
    showError(error);
  }
});

function attachControlHandlers() {
  const checkboxes = document.querySelectorAll('[data-series]');
  checkboxes.forEach((checkbox) => {
    const seriesId = checkbox.dataset.series;
    if (seriesId in seriesVisibility) {
      checkbox.checked = !!seriesVisibility[seriesId];
      checkbox.addEventListener("change", () => {
        seriesVisibility[seriesId] = checkbox.checked;
        updateSeriesVisibility();
      });
    }
  });

  const resetBtn = document.getElementById("resetSelections");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      Object.keys(seriesVisibility).forEach((id) => {
        seriesVisibility[id] = true;
      });
      checkboxes.forEach((checkbox) => {
        checkbox.checked = true;
      });
      updateSeriesVisibility();
    });
  }
}

function showError(error) {
  const chart = document.getElementById("chart");
  if (!chart) return;
  chart.innerHTML = `<div class="error">Failed to load weather data. Please try again later.<br/>${error.message}</div>`;
}

async function fetchWeatherData() {
  const [humidityResponse, weatherResponse] = await Promise.all([
    fetch("humidity-daily.csv"),
    fetch("weather-day.csv"),
  ]);

  if (!humidityResponse.ok) {
    throw new Error(`Failed to load humidity data (${humidityResponse.status})`);
  }
  if (!weatherResponse.ok) {
    throw new Error(`Failed to load weather data (${weatherResponse.status})`);
  }

  const [humidityText, weatherText] = await Promise.all([
    humidityResponse.text(),
    weatherResponse.text(),
  ]);

  return {
    humidity: parseHumidityDailyCsv(humidityText),
    weather: parseWeatherDailyCsv(weatherText),
  };
}

function transformWeatherData(raw) {
  const humidityByDate = new Map(
    (raw.humidity || []).map((entry) => [entry.date, entry])
  );

  const results = (raw.weather || []).map((day) => {
    const date = new Date(day.date);
    const humidity = humidityByDate.get(day.date) ?? {
      min: null,
      max: null,
      mean: null,
    };

    const tempMin = day.temperatureMin;
    const tempMax = day.temperatureMax;
    const tempMean = computeMean([tempMin, tempMax]);

    const windSpeedMax = day.windSpeedMax;
    const windGustMax = day.windGustMax ?? windSpeedMax;
    const windMin =
      typeof day.windSpeedMin === "number" ? day.windSpeedMin : windSpeedMax;
    const windMean =
      typeof day.windSpeedMean === "number"
        ? day.windSpeedMean
        : computeMean(
            [windMin, windSpeedMax, windGustMax].filter(
              (v) => typeof v === "number"
            )
          );

    const wind = {
      min: windMin,
      mean: windMean,
      max: windGustMax,
    };

    return {
      date,
      isoDate: day.date,
      temperature: {
        min: tempMin,
        max: tempMax,
        mean: tempMean,
      },
      humidity,
      wind,
      precipitation: day.precipitationSum,
      daylightHours:
        typeof day.sunshineSeconds === "number"
          ? day.sunshineSeconds / 3600
          : null,
    };
  });

  return results.sort((a, b) => a.date - b.date);
}

function parseHumidityDailyCsv(text) {
  const dataSection = extractDataSection(text, "date,");
  return d3.csvParse(dataSection, (row) => ({
    date: row.date,
    min: parseNumber(row.min),
    max: parseNumber(row.max),
    mean: parseNumber(row.mean),
  }));
}

function parseWeatherDailyCsv(text) {
  const dataSection = extractDataSection(text, "time,");
  return d3.csvParse(dataSection, (row) => ({
    date: row.time,
    temperatureMax: parseNumber(row["temperature_2m_max (°C)"]),
    temperatureMin: parseNumber(row["temperature_2m_min (°C)"]),
    sunshineSeconds: parseNumber(row["sunshine_duration (s)"]),
    precipitationSum: parseNumber(row["precipitation_sum (mm)"]),
    windSpeedMin: parseNumber(row["wind_speed_10m_min (km/h)"]),
    windSpeedMean: parseNumber(row["wind_speed_10m_mean (km/h)"]),
    windSpeedMax: parseNumber(row["wind_speed_10m_max (km/h)"]),
    windGustMax: parseNumber(row["wind_gusts_10m_max (km/h)"]),
  }));
}

function extractDataSection(text, headerPrefix) {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith(headerPrefix));
  if (headerIndex === -1) {
    throw new Error(`CSV header starting with "${headerPrefix}" not found`);
  }
  return lines.slice(headerIndex).join("\n");
}

function parseNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function computeMean(values) {
  const valid = values.filter((v) => typeof v === "number");
  if (!valid.length) {
    return null;
  }
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function formatValue(value, units = "") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  const magnitude = Math.abs(value);
  const precision = magnitude >= 100 ? 0 : 1;
  const formatted = value.toFixed(precision);
  return `${formatted}${units}`;
}

function setupChart(dataset) {
  const chartContainer = document.getElementById("chart");
  if (!chartContainer) return;

  const legend = buildLegend(chartContainer);

  const chart = {
    container: chartContainer,
    legend,
    dataset,
  };

  currentChart = chart;

  renderChart(chart);

  const resizeObserver = new ResizeObserver(() => renderChart(chart));
  resizeObserver.observe(chartContainer);
}

function buildLegend(chartContainer) {
  let legend = chartContainer.querySelector(".legend");
  if (!legend) {
    legend = document.createElement("div");
    legend.className = "legend";
    chartContainer.appendChild(legend);
  }

  legend.innerHTML = "";

  METRIC_DEFS.forEach((metric) => {
    const item = document.createElement("button");
    item.className = "legend-item";
    item.dataset.series = metric.id;
    item.style.setProperty("--series-color", metric.color);
    item.textContent = metric.label;
    item.addEventListener("click", () => {
      seriesVisibility[metric.id] = !seriesVisibility[metric.id];
      const checkbox = document.querySelector(
        `[data-series="${metric.id}"]`
      );
      if (checkbox) {
        checkbox.checked = seriesVisibility[metric.id];
      }
      updateSeriesVisibility();
    });
    legend.appendChild(item);
  });

  return legend;
}

function renderChart(chart) {
  const { container, dataset } = chart;
  container.classList.add("loading");
  container.setAttribute("aria-busy", "true");

  const width = container.clientWidth || 960;
  const height = 600;
  const activeAxes = getActiveAxes();
  const margin = computeChartMargins(activeAxes);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(dataset, (d) => d.date))
    .range([0, innerWidth]);

  const groupDomains = computeGroupDomains(dataset);
  const yScales = {
    temperature: d3
      .scaleLinear()
      .domain(groupDomains.temperature)
      .nice()
      .range([innerHeight, 0]),
    humidity: d3
      .scaleLinear()
      .domain(groupDomains.humidity)
      .nice()
      .range([innerHeight, 0]),
    wind: d3
      .scaleLinear()
      .domain(groupDomains.wind)
      .nice()
      .range([innerHeight, 0]),
    precipitation: d3
      .scaleLinear()
      .domain(groupDomains.precipitation)
      .nice()
      .range([innerHeight, 0]),
    daylight: d3
      .scaleLinear()
      .domain(groupDomains.daylight)
      .nice()
      .range([innerHeight, 0]),
  };

  chart.activeAxes = activeAxes;
  chart.margin = margin;
  chart.innerWidth = innerWidth;
  chart.innerHeight = innerHeight;
  chart.width = width;
  chart.height = height;

  const gradientHeight = Math.max(360, Math.round(height * 0.75));
  const gradientInnerHeight = gradientHeight - margin.top - margin.bottom;
  const gradientYScales = Object.fromEntries(
    Object.entries(yScales).map(([axis, scale]) => [
      axis,
      scale.copy().range([gradientInnerHeight, 0]),
    ])
  );

  const layerContexts = [];

  const chartLayersConfig = [
    {
      key: "primary",
      height,
      render: (svgLayer) => {
        const chartG = svgLayer
          .append("g")
          .attr("transform", `translate(${margin.left},${margin.top})`);

        drawAxes(chartG, innerHeight, innerWidth, xScale, yScales, activeAxes);
        drawGrid(chartG, innerWidth, innerHeight, xScale);
        drawBars(chartG, dataset, xScale, yScales, innerHeight, innerWidth);
        drawRangeSeries(chartG, dataset, xScale, yScales);
        return {
          chartG,
          innerHeight,
          innerWidth,
          yScales,
        };
      },
    },
    {
      key: "secondary",
      height: gradientHeight,
      render: (svgLayer) => {
        const chartG = svgLayer
          .append("g")
          .attr("transform", `translate(${margin.left},${margin.top})`);

        drawAxes(
          chartG,
          gradientInnerHeight,
          innerWidth,
          xScale,
          gradientYScales,
          activeAxes
        );
        drawGrid(chartG, innerWidth, gradientInnerHeight, xScale);
        drawBars(
          chartG,
          dataset,
          xScale,
          gradientYScales,
          gradientInnerHeight,
          innerWidth
        );
        drawGradientRangeSeries(
          svgLayer,
          chartG,
          dataset,
          xScale,
          gradientYScales,
          gradientInnerHeight,
          { layerKey: "secondary" }
        );
        return {
          chartG,
          innerHeight: gradientInnerHeight,
          innerWidth,
          yScales: gradientYScales,
        };
      },
    },
  ];

  const svgLayers = d3
    .select(container)
    .selectAll("svg.chart-layer")
    .data(chartLayersConfig, (d) => d.key)
    .join(
      (enter) =>
        enter
          .append("svg")
          .attr("class", (d) => `chart-layer chart-layer--${d.key}`)
          .attr("data-chart-layer", (d) => d.key),
      (update) => update,
      (exit) => exit.remove()
    );

  svgLayers.each(function (layer) {
    const svg = d3.select(this);
    svg
      .attr("viewBox", `0 0 ${width} ${layer.height}`)
      .attr("height", layer.height)
      .attr("role", "img")
      .attr(
        "aria-label",
        layer.key === "primary"
          ? "Historical weather metrics for Athens"
          : "Historical weather metrics with gradient visualisation"
      );

    svg.selectAll("*").remove();
    const context = layer.render(svg);
    if (context) {
      layerContexts.push({
        key: layer.key,
        svg,
        ...context,
      });
    }
  });

  setupLayerInteractions(layerContexts, dataset, xScale, margin);

  container.classList.remove("loading");
  container.removeAttribute("aria-busy");

  applySeriesVisibility();
}

function computeGroupDomains(dataset) {
  const temperatureValues = dataset.flatMap((d) => [
    d.temperature.min,
    d.temperature.mean,
    d.temperature.max,
  ]);
  const humidityValues = dataset.flatMap((d) => [
    d.humidity.min,
    d.humidity.mean,
    d.humidity.max,
  ]);
  const windValues = dataset.flatMap((d) => [
    d.wind.min,
    d.wind.mean,
    d.wind.max,
  ]);
  const precipitationValues = dataset.map((d) => d.precipitation);
  const daylightValues = dataset.map((d) => d.daylightHours);

  return {
    temperature: computeExtent(temperatureValues, [-10, 45]),
    humidity: computeExtent(humidityValues, [0, 100]),
    wind: computeExtent(windValues, [0, 60]),
    precipitation: computeExtent(precipitationValues, [0, 60]),
    daylight: computeExtent(daylightValues, [0, 18]),
  };
}

function computeExtent(values, defaultDomain) {
  const filtered = values.filter((v) => typeof v === "number");
  if (!filtered.length) {
    return defaultDomain;
  }
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return defaultDomain;
  }
  if (min === max) {
    return [min - 1, max + 1];
  }
  return [min, max];
}

function getActiveAxes() {
  const active = new Set();

  METRIC_DEFS.forEach((metric) => {
    if (!seriesVisibility[metric.id]) {
      return;
    }
    if (metric.axis) {
      active.add(metric.axis);
    }
  });

  const left = [];
  const right = [];

  AXIS_ORDER.forEach((axisId) => {
    if (!active.has(axisId)) {
      return;
    }
    const config = AXIS_CONFIG[axisId];
    if (!config) {
      return;
    }
    if (config.side === "left") {
      left.push(axisId);
    } else {
      right.push(axisId);
    }
  });

  return { left, right };
}

function computeChartMargins(activeAxes) {
  const leftCount = activeAxes.left.length;
  const rightCount = activeAxes.right.length;

  return {
    top: BASE_MARGINS.top,
    bottom: BASE_MARGINS.bottom,
    left: BASE_MARGINS.left + Math.max(0, leftCount - 1) * AXIS_GAP,
    right: BASE_MARGINS.right + Math.max(0, rightCount - 1) * AXIS_GAP,
  };
}

function drawAxes(chartG, innerHeight, innerWidth, xScale, yScales, activeAxes) {
  const axisBottom = d3
    .axisBottom(xScale)
    .ticks(12)
    .tickFormat(d3.timeFormat("%b %Y"));

  chartG
    .append("g")
    .attr("class", "axis axis--x")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(axisBottom)
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end");

  const drawAxis = (axisId, index) => {
    const config = AXIS_CONFIG[axisId];
    const scale = yScales[axisId];
    if (!config || !scale) {
      return;
    }

    const axisGenerator =
      config.side === "left" ? d3.axisLeft(scale) : d3.axisRight(scale);

    if (config.ticks != null) {
      axisGenerator.ticks(config.ticks);
    }
    if (typeof config.format === "function") {
      axisGenerator.tickFormat(config.format);
    }

    const offset =
      config.side === "left" ? -AXIS_GAP * index : AXIS_GAP * index;

    chartG
      .append("g")
      .attr("class", `axis axis--${axisId}`)
      .attr(
        "transform",
        config.side === "left"
          ? `translate(${offset},0)`
          : `translate(${innerWidth + offset},0)`
      )
      .call(axisGenerator);

    const labelX =
      config.side === "left"
        ? -AXIS_LABEL_OFFSET - AXIS_GAP * index
        : innerWidth + AXIS_LABEL_OFFSET + AXIS_GAP * index;
    const labelY = innerHeight / 2;

    // axis titles intentionally hidden
  };

  activeAxes.left.forEach((axisId, index) => drawAxis(axisId, index));
  activeAxes.right.forEach((axisId, index) => drawAxis(axisId, index));
}

function drawGrid(chartG, innerWidth, innerHeight, xScale) {
  const grid = chartG.append("g").attr("class", "grid");
  grid
    .append("g")
    .attr("class", "grid-lines")
    .selectAll("line")
    .data(xScale.ticks(12))
    .join("line")
    .attr("x1", (d) => xScale(d))
    .attr("x2", (d) => xScale(d))
    .attr("y1", 0)
    .attr("y2", innerHeight);
}

function drawBars(chartG, dataset, xScale, yScales, innerHeight, innerWidth) {
  const barsGroup = chartG.append("g").attr("class", "series-bars");
  const barWidth = Math.max(1, (innerWidth / dataset.length) * 0.7);

  METRIC_DEFS.filter((def) => def.type === "bar").forEach((metric, index) => {
    const offset = index === 0 ? -barWidth / 4 : barWidth / 4;
    const scale = yScales[metric.axis];
    const bar = barsGroup
      .append("g")
      .attr("class", `series series--bar series--${metric.id}`)
      .attr("data-series", metric.id)
      .style("color", metric.color);

    bar
      .selectAll("rect")
      .data(dataset)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (d) => xScale(d.date) - barWidth / 2 + offset)
      .attr("width", barWidth / 2)
      .attr("fill", metric.color)
      .attr("opacity", 0.7)
      .attr("y", (d) => {
        const value = metric.accessors.value(d);
        return typeof value === "number" ? scale(value) : innerHeight;
      })
      .attr("height", (d) => {
        const value = metric.accessors.value(d);
        if (typeof value !== "number") return 0;
        return Math.max(0, innerHeight - scale(value));
      });
  });
}

function drawRangeSeries(chartG, dataset, xScale, yScales) {
  const rangesGroup = chartG.append("g").attr("class", "series-ranges");

  METRIC_DEFS.filter((def) => def.type === "range").forEach((metric) => {
    const scale = yScales[metric.axis];
    const group = rangesGroup
      .append("g")
      .attr("class", `series series--range series--${metric.id}`)
      .attr("data-series", metric.id)
      .style("color", metric.color);

    const areaGenerator = d3
      .area()
      .defined(
        (d) =>
          typeof metric.accessors.min(d) === "number" &&
          typeof metric.accessors.max(d) === "number"
      )
      .x((d) => xScale(d.date))
      .y0((d) => scale(metric.accessors.min(d)))
      .y1((d) => scale(metric.accessors.max(d)));

    group
      .append("path")
      .datum(dataset)
      .attr("class", "range-area")
      .attr("fill", metric.color)
      .attr("fill-opacity", 0.15)
      .attr("stroke", "none")
      .attr("d", areaGenerator);

    const minLine = d3
      .line()
      .defined((d) => typeof metric.accessors.min(d) === "number")
      .x((d) => xScale(d.date))
      .y((d) => scale(metric.accessors.min(d)));

    const maxLine = d3
      .line()
      .defined((d) => typeof metric.accessors.max(d) === "number")
      .x((d) => xScale(d.date))
      .y((d) => scale(metric.accessors.max(d)));

    group
      .append("path")
      .datum(dataset)
      .attr("class", "range-line range-line--min")
      .attr("fill", "none")
      .attr("stroke", metric.color)
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "4 3")
      .attr("d", minLine);

    group
      .append("path")
      .datum(dataset)
      .attr("class", "range-line range-line--max")
      .attr("fill", "none")
      .attr("stroke", metric.color)
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "4 3")
      .attr("d", maxLine);

    if (metric.id !== "wind") {
      const meanLine = d3
        .line()
        .defined((d) => typeof metric.accessors.mean(d) === "number")
        .x((d) => xScale(d.date))
        .y((d) => scale(metric.accessors.mean(d)));

      group
        .append("path")
        .datum(dataset)
        .attr("class", "range-line range-line--mean")
        .attr("fill", "none")
        .attr("stroke", metric.color)
        .attr("stroke-width", 1.8)
        .attr("d", meanLine);
    }
  });
}

function drawGradientRangeSeries(
  svg,
  chartG,
  dataset,
  xScale,
  yScales,
  innerHeight,
  options = {}
) {
  const { layerKey = "layer" } = options;
  const rangesGroup = chartG
    .append("g")
    .attr("class", "series-ranges series-ranges--gradient");
  const defs = svg.select("defs").empty()
    ? svg.insert("defs", ":first-child")
    : svg.select("defs");

  METRIC_DEFS.filter((def) => def.type === "range").forEach((metric) => {
    const scale = yScales[metric.axis];
    const gradientId = `series-gradient-${layerKey}-${metric.id}`;
    const gradientStops =
      RANGE_GRADIENT_DEFS[metric.id] ??
      [
        { offset: "0%", color: metric.color, opacity: 0.2 },
        { offset: "100%", color: metric.color, opacity: 0.5 },
      ];

    const gradient = defs
      .append("linearGradient")
      .attr("id", gradientId)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", innerHeight)
      .attr("y2", 0);

    gradientStops.forEach((stop) => {
      const stopSelection = gradient
        .append("stop")
        .attr("offset", stop.offset)
        .attr("stop-color", stop.color);
      if (stop.opacity != null) {
        stopSelection.attr("stop-opacity", stop.opacity);
      }
    });

    const group = rangesGroup
      .append("g")
      .attr("class", `series series--range series--${metric.id} series--gradient`)
      .attr("data-series", metric.id)
      .style("color", metric.color);

    const areaGenerator = d3
      .area()
      .defined(
        (d) =>
          typeof metric.accessors.min(d) === "number" &&
          typeof metric.accessors.max(d) === "number"
      )
      .x((d) => xScale(d.date))
      .y0((d) => scale(metric.accessors.min(d)))
      .y1((d) => scale(metric.accessors.max(d)));

    group
      .append("path")
      .datum(dataset)
      .attr("class", "range-area range-area--gradient")
      .attr("fill", `url(#${gradientId})`)
      .attr("fill-opacity", 0.85)
      .attr("stroke", "none")
      .attr("d", areaGenerator);

    const minLine = d3
      .line()
      .defined((d) => typeof metric.accessors.min(d) === "number")
      .x((d) => xScale(d.date))
      .y((d) => scale(metric.accessors.min(d)));

    const maxLine = d3
      .line()
      .defined((d) => typeof metric.accessors.max(d) === "number")
      .x((d) => xScale(d.date))
      .y((d) => scale(metric.accessors.max(d)));

    group
      .append("path")
      .datum(dataset)
      .attr("class", "range-line range-line--min")
      .attr("fill", "none")
      .attr("stroke", metric.color)
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "4 3")
      .attr("d", minLine);

    group
      .append("path")
      .datum(dataset)
      .attr("class", "range-line range-line--max")
      .attr("fill", "none")
      .attr("stroke", metric.color)
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "4 3")
      .attr("d", maxLine);

    if (metric.id !== "wind") {
      const meanLine = d3
        .line()
        .defined((d) => typeof metric.accessors.mean(d) === "number")
        .x((d) => xScale(d.date))
        .y((d) => scale(metric.accessors.mean(d)));

      group
        .append("path")
        .datum(dataset)
        .attr("class", "range-line range-line--mean")
        .attr("fill", "none")
        .attr("stroke", metric.color)
        .attr("stroke-width", 1.8)
        .attr("d", meanLine);
    }
  });
}

function setupLayerInteractions(layerContexts, dataset, xScale, margin) {
  if (!layerContexts.length) {
    return;
  }

  const tooltipEl = document.getElementById("tooltip");
  const bisect = d3.bisector((d) => d.date).center;

  const focusLayers = layerContexts.map((ctx) =>
    createFocusLayer(ctx.chartG, xScale, ctx.yScales, ctx.innerHeight, ctx.key)
  );

  const handleMove = (event, ctx) => {
    const [x] = d3.pointer(event, ctx.chartG.node());
    const date = xScale.invert(x);
    const index = bisect(dataset, date);
    const datum = dataset[Math.max(0, Math.min(dataset.length - 1, index))];

    updateTooltip(datum, { x }, { margin, innerHeight: ctx.innerHeight }, tooltipEl);

    focusLayers.forEach((layer) => {
      layer.show();
      layer.update(datum, seriesVisibility);
    });
  };

  const handleLeave = () => {
    if (tooltipEl) {
      tooltipEl.hidden = true;
    }
    focusLayers.forEach((layer) => layer.hide());
  };

  layerContexts.forEach((ctx) => {
    ctx.chartG
      .append("rect")
      .attr("class", "overlay")
      .attr("width", ctx.innerWidth)
      .attr("height", ctx.innerHeight)
      .attr("fill", "transparent")
      .on("mousemove", function (event) {
        handleMove(event, ctx);
      })
      .on("mouseleave", handleLeave);
  });
}

function createFocusLayer(chartG, xScale, yScales, innerHeight, layerKey) {
  const focusGroup = chartG
    .append("g")
    .attr("class", `focus-layer focus-layer--${layerKey}`)
    .style("display", "none");

  const focusPoints = [];

  METRIC_DEFS.filter((def) => def.type === "range").forEach((metric) => {
    const scale = yScales[metric.axis];
    if (!scale) return;

    const stats = ["min", "max"];
    if (metric.id !== "wind" && typeof metric.accessors.mean === "function") {
      stats.push("mean");
    }

    stats.forEach((stat) => {
      const accessor = metric.accessors[stat];
      if (typeof accessor !== "function") return;
      const circle = focusGroup
        .append("circle")
        .attr("class", `focus-point focus-point--${metric.id} focus-point--${stat}`)
        .attr("r", 4)
        .attr("fill", metric.color)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.5)
        .attr("data-series", metric.id)
        .attr("pointer-events", "none");
      focusPoints.push({
        metricId: metric.id,
        stat,
        circle,
        accessor,
        scale,
      });
    });
  });

  return {
    show() {
      focusGroup.style("display", null);
    },
    hide() {
      focusGroup.style("display", "none");
      focusPoints.forEach(({ circle }) => circle.attr("display", "none"));
    },
    update(datum, visibility) {
      const x = xScale(datum.date);
      let anyVisible = false;
      focusPoints.forEach(({ metricId, circle, accessor, scale }) => {
        if (!visibility[metricId]) {
          circle.attr("display", "none");
          return;
        }
        const value = accessor(datum);
        if (typeof value === "number") {
          circle.attr("display", null).attr("cx", x).attr("cy", scale(value));
          anyVisible = true;
        } else {
          circle.attr("display", "none");
        }
      });
      focusGroup.style("display", anyVisible ? null : "none");
    },
  };
}

function updateTooltip(datum, pointer, layout, tooltipEl) {
  if (!tooltipEl || !datum) return;
  const { x } = pointer;
  const { margin, innerHeight } = layout;

  const activeMetrics = METRIC_DEFS.filter(
    (metric) => seriesVisibility[metric.id]
  );
  const lines = activeMetrics
    .map((metric) => {
      if (metric.type === "range") {
        const min = metric.accessors.min(datum);
        const max = metric.accessors.max(datum);
        const mean = metric.accessors.mean(datum);

        const meanStr = formatValue(mean, metric.units);
        const minStr = formatValue(min, metric.units);
        const maxStr = formatValue(max, metric.units);

        const segments = [];
        if (meanStr) {
          segments.push(`Mean <strong>${meanStr}</strong>`);
        }
        if (minStr || maxStr) {
          segments.push(
            `Min ${minStr ?? "–"} · Max ${maxStr ?? "–"}`
          );
        }

        if (!segments.length) {
          return null;
        }

        return `<span class="tooltip-series" style="--series-color:${metric.color}">
          ${metric.label}: ${segments.join(" · ")}
        </span>`;
      }

      if (metric.type === "bar") {
        const value = metric.accessors.value(datum);
        const valueStr = formatValue(value, metric.units);
        if (!valueStr) {
          return null;
        }
        return `<span class="tooltip-series" style="--series-color:${metric.color}">
          ${metric.label}: <strong>${valueStr}</strong>
        </span>`;
      }

      return null;
    })
    .filter(Boolean)
    .join("");

  tooltipEl.innerHTML = `
    <div class="tooltip-header">${d3.timeFormat("%B %d, %Y")(datum.date)}</div>
    ${lines || "<span class='tooltip-empty'>No series active</span>"}
  `;

  tooltipEl.hidden = false;

  const containerRect = document
    .getElementById("chart")
    .getBoundingClientRect();
  const tooltipWidth = tooltipEl.offsetWidth || 200;
  const left = Math.min(
    containerRect.width - tooltipWidth - 16,
    Math.max(16, margin.left + x + 12)
  );
  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${margin.top + 16}px`;
}

function updateSeriesVisibility() {
  if (currentChart) {
    renderChart(currentChart);
  } else {
    applySeriesVisibility();
  }
}

function applySeriesVisibility() {
  METRIC_DEFS.forEach((metric) => {
    const nodes = document.querySelectorAll(`[data-series="${metric.id}"]`);
    nodes.forEach((node) => {
      const hidden = !seriesVisibility[metric.id];
      if (node instanceof HTMLInputElement) {
        node.checked = !hidden;
        return;
      }
      if (node instanceof HTMLButtonElement) {
        node.classList.toggle("legend-item--hidden", hidden);
        return;
      }
      if ("classList" in node) {
        node.classList.toggle("series-hidden", hidden);
      }
      if ("style" in node) {
        node.style.display = hidden ? "none" : null;
      }
    });
  });
}

