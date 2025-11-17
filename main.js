const ATHENS_COORDS = { latitude: 37.98, longitude: 23.72 };
const DAYS_OF_HISTORY = 365;
const METRIC_DEFS = [
  {
    id: "temperature",
    label: "Temperature",
    color: "#E16A01",
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
    color: "#1E7D1E",
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
    id: "windRange",
    label: "Wind",
    color: "#8e44ad",
    type: "range",
    axis: "wind",
    accessors: {
      min: (d) => d.windRange?.min ?? null,
      max: (d) => d.windRange?.max ?? null,
      mean: (d) => d.windRange?.mean ?? null,
    },
    units: " km/h",
  },
  {
    id: "windGust",
    label: "Wind Gust",
    color: "#BC70DD",
    type: "line",
    axis: "wind",
    accessors: {
      value: (d) => d.windGust ?? null,
    },
    units: " km/h",
    options: {
      strokeDasharray: "6 6",
    },
  },
  {
    id: "precipitation",
    label: "Precipitation",
    color: "#055991",
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
    color: "#E5B300",
    type: "bar",
    axis: "daylight",
    accessors: {
      value: (d) => d.daylightHours,
    },
    units: " h",
  },
  {
    id: "windDirection",
    label: "Wind Direction",
    color: "#BBBBBB",
    type: "windDirection",
    axis: null,
    accessors: {
      value: (d) => d.windDirection,
    },
    units: "°",
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
  windRange: [
    { offset: "0%", color: "#d2b4de", opacity: 0.25 },
    { offset: "100%", color: "#8e44ad", opacity: 0.55 },
  ],
};

const AXIS_LABELS = {
  temperature: "Temperature (°C)",
  humidity: "Humidity (%)",
  wind: "Wind Speed (km/h)",
  precipitation: "Precipitation (mm)",
  daylight: "Daylight (hours)",
};

const DEFAULT_VISIBLE_SERIES = new Set([]);

const seriesVisibility = METRIC_DEFS.reduce((acc, def) => {
  acc[def.id] = DEFAULT_VISIBLE_SERIES.has(def.id);
  return acc;
}, {});

// 5 main categories that can be selected (max 3)
const MAIN_CATEGORIES = new Set(["temperature", "humidity", "precipitation", "wind", "daylight"]);

// Wind sub-values that can be toggled individually when wind is selected
// Note: windRange and windDirection are combined (toggle together)
const WIND_SUB_VALUES = new Set(["windRange", "windGust", "windDirection"]);
const WIND_RANGE_GROUP = new Set(["windRange", "windDirection"]); // These toggle together

// Map main category to its sub-metrics
const CATEGORY_TO_METRICS = {
  temperature: ["temperature"],
  humidity: ["humidity"],
  precipitation: ["precipitation"],
  wind: ["windRange", "windGust", "windDirection"],
  daylight: ["daylight"],
};

// Track selection order for axis assignment (stores main category IDs)
let selectionOrder = [];

// Get the main category for a metric
function getMainCategory(metricId) {
  for (const [category, metrics] of Object.entries(CATEGORY_TO_METRICS)) {
    if (metrics.includes(metricId)) {
      return category;
    }
  }
  return null;
}

// Get all selected main categories
function getSelectedMainCategories() {
  const selected = new Set();
  METRIC_DEFS.forEach((metric) => {
    if (seriesVisibility[metric.id]) {
      const category = getMainCategory(metric.id);
      if (category) {
        selected.add(category);
      }
    }
  });
  return Array.from(selected);
}

// Get the count of selected main categories
function getMainCategoryCount() {
  return getSelectedMainCategories().length;
}

// Check if a main category is selected
function isMainCategorySelected(categoryId) {
  const metrics = CATEGORY_TO_METRICS[categoryId] || [];
  return metrics.some(metricId => seriesVisibility[metricId]);
}

// Get count of selected range/line types (temperature, humidity, wind)
function getSelectedRangeLineCount() {
  const rangeLineCategories = ["temperature", "humidity", "wind"];
  return rangeLineCategories.filter(cat => isMainCategorySelected(cat)).length;
}

// Get count of selected bar types (precipitation, daylight)
function getSelectedBarCount() {
  const barCategories = ["precipitation", "daylight"];
  return barCategories.filter(cat => isMainCategorySelected(cat)).length;
}

// Check if a metric can be selected (not at max 3 categories)
function canSelectMetric(metricId) {
  const mainCategory = getMainCategory(metricId);
  if (!mainCategory) return false;
  
  // windDirection is hidden from legend and always toggles with windRange
  if (metricId === "windDirection") {
    return false; // Hidden from legend
  }
  
  const isWindSubValue = WIND_SUB_VALUES.has(metricId);
  const currentMainCategoryCount = getMainCategoryCount();
  
  // If already selected, can always deselect
  if (seriesVisibility[metricId]) {
    return true;
  }
  
  // Wind gust can only be selected if wind category is already selected
  if (metricId === "windGust") {
    return isMainCategorySelected("wind");
  }
  
  // Other wind sub-values (windRange/windDirection) can be selected if wind category is already selected
  if (isWindSubValue && isMainCategorySelected("wind")) {
    return true;
  }
  
  // Check type constraints: max 2 range/line + 1 bar OR max 2 bar + 1 range/line
  const metric = METRIC_DEFS.find(m => m.id === metricId);
  if (!metric) return false;
  
  // For wind sub-values, check if wind category can be selected
  if (isWindSubValue && !isMainCategorySelected("wind")) {
    const rangeCount = getSelectedRangeLineCount();
    const barCount = getSelectedBarCount();
    
    // Wind is a range/line type - can select if: (rangeCount < 2 && barCount <= 1) OR (rangeCount < 1 && barCount <= 2)
    // This allows: max 2 range/line + 1 bar OR max 2 bar + 1 range/line
    if (!((rangeCount < 2 && barCount <= 1) || (rangeCount < 1 && barCount <= 2))) {
      return false;
    }
  }
  
  // For main category metrics, check type constraints
  if (!isWindSubValue) {
    const rangeCount = getSelectedRangeLineCount();
    const barCount = getSelectedBarCount();
    
    // If this is a range/line type (temperature, humidity, wind)
    if (mainCategory === "temperature" || mainCategory === "humidity" || mainCategory === "wind") {
      // Can select if: (rangeCount < 2 && barCount <= 1) OR (rangeCount < 1 && barCount <= 2)
      // This allows: max 2 range/line + 1 bar OR max 2 bar + 1 range/line
      if (!((rangeCount < 2 && barCount <= 1) || (rangeCount < 1 && barCount <= 2))) {
        return false;
      }
    }
    // If this is a bar type (precipitation, daylight)
    else if (mainCategory === "precipitation" || mainCategory === "daylight") {
      // Can select if: (rangeCount <= 2 && barCount < 1) OR (rangeCount <= 1 && barCount < 2)
      // This allows: max 2 range/line + 1 bar OR max 2 bar + 1 range/line
      if (!((rangeCount <= 2 && barCount < 1) || (rangeCount <= 1 && barCount < 2))) {
        return false;
      }
    }
  }
  
  return true;
}

// Check if a metric should be drawn on the chart (max 3 selections, max 2 axes)
function shouldDrawMetric(metricId) {
  // Max 3 values on graph (wind direction is special, doesn't count)
  if (selectionOrder.length === 0) return false;
  
  const mainCategory = getMainCategory(metricId);
  if (!mainCategory) return false;
  
  // Check if this metric is selected
  if (!seriesVisibility[metricId]) return false;
  
  const first = selectionOrder[0];
  const second = selectionOrder.length >= 2 ? selectionOrder[1] : null;
  const third = selectionOrder.length >= 3 ? selectionOrder[2] : null;
  
  // Wind direction is special - it's drawn at top when wind is selected (doesn't count toward 3)
  if (metricId === "windDirection") {
    return (first === "wind" || second === "wind" || third === "wind");
  }
  
  // Draw if metric's category is in first, second, or third selection
  if (first === mainCategory || second === mainCategory || third === mainCategory) {
    if (mainCategory === "wind") {
      // For wind, check if this specific sub-value is selected
      return true;
    } else {
      const metric = METRIC_DEFS.find(m => m.id === metricId);
      // Only draw if it has an axis (windDirection doesn't have an axis)
      return metric && metric.axis !== null;
    }
  }
  
  return false;
}

// Get which axis scale a metric should use for drawing
// First selection → left axis, Second → right axis, Third → right axis scale (no axis displayed)
function getMetricAxis(metricId) {
  const mainCategory = getMainCategory(metricId);
  if (!mainCategory) return null;
  
  const first = selectionOrder[0];
  const second = selectionOrder.length >= 2 ? selectionOrder[1] : null;
  const third = selectionOrder.length >= 3 ? selectionOrder[2] : null;
  
  // First selection uses left axis
  if (first === mainCategory) {
    const metric = METRIC_DEFS.find(m => m.id === metricId);
    if (metric && metric.axis) {
      return { axis: metric.axis, side: "left" };
    }
    if (mainCategory === "wind") {
      return { axis: "wind", side: "left" };
    }
  }
  
  // Second selection uses right axis
  if (second === mainCategory) {
    const metric = METRIC_DEFS.find(m => m.id === metricId);
    if (metric && metric.axis) {
      return { axis: metric.axis, side: "right" };
    }
    if (mainCategory === "wind") {
      return { axis: "wind", side: "right" };
    }
  }
  
  // Third selection uses right axis scale (from second selection if same type, or its own scale)
  // But it doesn't get its own axis displayed
  if (third === mainCategory) {
    const metric = METRIC_DEFS.find(m => m.id === metricId);
    if (metric && metric.axis) {
      // Check if second selection has the same axis type
      const secondMetric = METRIC_DEFS.find(m => m.id === second);
      const secondAxis = secondMetric && secondMetric.axis ? secondMetric.axis : (second === "wind" ? "wind" : null);
      
      // If same axis type, reuse second's scale; otherwise use own scale
      if (metric.axis === secondAxis) {
        return { axis: metric.axis, side: "right" };
      } else {
        // Use its own scale but on right side (no axis displayed)
        return { axis: metric.axis, side: "right" };
      }
    }
    if (mainCategory === "wind") {
      return { axis: "wind", side: "right" };
    }
  }
  
  return null;
}

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
  const checkboxes = document.querySelectorAll(
    'input[type="checkbox"][data-series]'
  );
  
  // Initialize selection order with no default selection
  selectionOrder = [];
  
  checkboxes.forEach((checkbox) => {
    const seriesId = checkbox.dataset.series;
    if (seriesId in seriesVisibility) {
      checkbox.checked = !!seriesVisibility[seriesId];
      checkbox.addEventListener("change", () => {
        handleMetricToggle(seriesId, checkbox.checked);
      });
    }
  });

  const resetBtn = document.getElementById("resetSelections");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      // Reset to no selection
      Object.keys(seriesVisibility).forEach((id) => {
        seriesVisibility[id] = false;
      });
      selectionOrder = [];
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
      updateSeriesVisibility();
    });
  }
}

function handleMetricToggle(metricId, isChecked) {
  const mainCategory = getMainCategory(metricId);
  if (!mainCategory) return;
  
  const isWindSubValue = WIND_SUB_VALUES.has(metricId);
  const currentMainCategoryCount = getMainCategoryCount();
  
  if (isChecked) {
    if (isWindSubValue) {
      // Toggling a wind sub-value - check if wind category is already selected
      const windSelected = isMainCategorySelected("wind");
      if (!windSelected) {
        // Can't select wind sub-values if wind category isn't selected
        // Check type constraints: max 2 range/line + 1 bar OR max 2 bar + 1 range/line
        const rangeCount = getSelectedRangeLineCount();
        const barCount = getSelectedBarCount();
        
        // Wind is a range/line type - can select if: (rangeCount < 2 && barCount <= 1) OR (rangeCount < 1 && barCount <= 2)
        // This allows: max 2 range/line + 1 bar OR max 2 bar + 1 range/line
        if (!((rangeCount < 2 && barCount <= 1) || (rangeCount < 1 && barCount <= 2))) {
          const checkbox = document.querySelector(`input[data-series="${metricId}"]`);
          if (checkbox) {
            checkbox.checked = false;
          }
          return;
        }
        // Add wind category to selection order
        if (!selectionOrder.includes("wind")) {
          selectionOrder.push("wind");
        }
      }
      
      // If windRange or windDirection, toggle both together
      if (WIND_RANGE_GROUP.has(metricId)) {
        WIND_RANGE_GROUP.forEach((id) => {
          seriesVisibility[id] = true;
        });
      } else if (metricId === "windGust") {
        // Wind gust can only be selected if wind category is already selected
        if (isMainCategorySelected("wind")) {
          seriesVisibility[metricId] = true;
        } else {
          // Prevent selection if wind is not selected
          const checkbox = document.querySelector(`input[data-series="${metricId}"]`);
          if (checkbox) {
            checkbox.checked = false;
          }
          return;
        }
      }
    } else {
      // Toggling a main category metric
      // Check type constraints: max 2 range/line + 1 bar OR max 2 bar + 1 range/line
      const rangeCount = getSelectedRangeLineCount();
      const barCount = getSelectedBarCount();
      
      // If this is a range/line type (temperature, humidity, wind)
      if (mainCategory === "temperature" || mainCategory === "humidity" || mainCategory === "wind") {
        // Can select if: (rangeCount < 2 && barCount <= 1) OR (rangeCount < 1 && barCount <= 2)
        // This allows: max 2 range/line + 1 bar OR max 2 bar + 1 range/line
        if (!((rangeCount < 2 && barCount <= 1) || (rangeCount < 1 && barCount <= 2))) {
          const checkbox = document.querySelector(`input[data-series="${metricId}"]`);
          if (checkbox) {
            checkbox.checked = false;
          }
          return;
        }
      }
      // If this is a bar type (precipitation, daylight)
      else if (mainCategory === "precipitation" || mainCategory === "daylight") {
        // Can select if: (rangeCount <= 2 && barCount < 1) OR (rangeCount <= 1 && barCount < 2)
        // This allows: max 2 range/line + 1 bar OR max 2 bar + 1 range/line
        if (!((rangeCount <= 2 && barCount < 1) || (rangeCount <= 1 && barCount < 2))) {
          const checkbox = document.querySelector(`input[data-series="${metricId}"]`);
          if (checkbox) {
            checkbox.checked = false;
          }
          return;
        }
      }
      
      // Add to selection order if it's a new category
      if (!selectionOrder.includes(mainCategory)) {
        selectionOrder.push(mainCategory);
      }
      
      // Enable the metric
      seriesVisibility[metricId] = true;
      
      // Note: wind sub-values are not auto-enabled when selecting a non-wind metric
    }
  } else {
    // Unchecking
    if (isWindSubValue) {
      // If windRange or windDirection, uncheck both together
      if (WIND_RANGE_GROUP.has(metricId)) {
        WIND_RANGE_GROUP.forEach((id) => {
          seriesVisibility[id] = false;
        });
        // When windRange is unchecked, also uncheck windGust
        seriesVisibility["windGust"] = false;
        const windGustCheckbox = document.querySelector(`input[data-series="windGust"]`);
        if (windGustCheckbox) {
          windGustCheckbox.checked = false;
        }
      } else if (metricId === "windGust") {
        // For windGust, just uncheck it
        seriesVisibility[metricId] = false;
      }
      
      // Check if all wind sub-values are now unchecked
      const allWindUnchecked = Array.from(WIND_SUB_VALUES).every(
        id => !seriesVisibility[id]
      );
      
      if (allWindUnchecked) {
        // Remove wind from selection order
        const windIndex = selectionOrder.indexOf("wind");
        if (windIndex !== -1) {
          selectionOrder.splice(windIndex, 1);
        }
      }
    } else {
      // Unchecking a main category metric
      seriesVisibility[metricId] = false;
      
      // If it's wind category, disable all wind sub-values (including windGust)
      if (mainCategory === "wind") {
        // Deselect all wind sub-values
        WIND_SUB_VALUES.forEach((id) => {
          seriesVisibility[id] = false;
        });
        // Ensure windGust is deselected and checkbox is unchecked
        seriesVisibility["windGust"] = false;
        const windGustCheckbox = document.querySelector(`input[data-series="windGust"]`);
        if (windGustCheckbox) {
          windGustCheckbox.checked = false;
        }
      }
      
      // Remove from selection order
      const index = selectionOrder.indexOf(mainCategory);
      if (index !== -1) {
        selectionOrder.splice(index, 1);
      }
    }
  }
  
  updateSeriesVisibility();
  // Update legend availability after toggling
  updateLegendAvailability();
}

function showError(error) {
  const chart = document.getElementById("chart");
  if (!chart) return;
  chart.innerHTML = `<div class="error">Failed to load weather data. Please try again later.<br/>${error.message}</div>`;
}

async function fetchWeatherData() {
  const [humidityResponse, weatherResponse, windDailyResponse, windDirectionResponse] = await Promise.all([
    fetch("humidity-daily.csv"),
    fetch("weather-day.csv"),
    fetch("wind-daily.csv"),
    fetch("wind-direction-daily.csv"),
  ]);

  if (!humidityResponse.ok) {
    throw new Error(`Failed to load humidity data (${humidityResponse.status})`);
  }
  if (!weatherResponse.ok) {
    throw new Error(`Failed to load weather data (${weatherResponse.status})`);
  }
  if (!windDailyResponse.ok) {
    throw new Error(`Failed to load wind data (${windDailyResponse.status})`);
  }
  if (!windDirectionResponse.ok) {
    throw new Error(`Failed to load wind direction data (${windDirectionResponse.status})`);
  }

  const [humidityText, weatherText, windDailyText, windDirectionText] = await Promise.all([
    humidityResponse.text(),
    weatherResponse.text(),
    windDailyResponse.text(),
    windDirectionResponse.text(),
  ]);

  return {
    humidity: parseHumidityDailyCsv(humidityText),
    weather: parseWeatherDailyCsv(weatherText),
    windDaily: parseWindDailyCsv(windDailyText),
    windDirection: parseWindDirectionDailyCsv(windDirectionText),
  };
}

function transformWeatherData(raw) {
  const humidityByDate = new Map(
    (raw.humidity || []).map((entry) => [entry.date, entry])
  );
  const windDailyByDate = new Map(
    (raw.windDaily || []).map((entry) => [entry.date, entry])
  );
  const windDirectionByDate = new Map(
    (raw.windDirection || []).map((entry) => [entry.date, entry])
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

    const windDaily = windDailyByDate.get(day.date) ?? { min: null, max: null, mean: null };
    const windRange = {
      min: windDaily.min ?? null,
      max: windDaily.max ?? null,
      mean: windDaily.mean ?? null,
    };

    const windDirectionData = windDirectionByDate.get(day.date);
    const windDirection = windDirectionData?.mean ?? null;

    return {
      date,
      isoDate: day.date,
      temperature: {
        min: tempMin,
        max: tempMax,
        mean: tempMean,
      },
      humidity,
      windRange,
      windGust: typeof day.windGustMax === "number" ? day.windGustMax : null,
      windDirection,
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

function parseWindDailyCsv(text) {
  const dataSection = extractDataSection(text, "date,");
  return d3.csvParse(dataSection, (row) => ({
    date: row.date,
    min: parseNumber(row.wind_speed_min_km_h),
    max: parseNumber(row.wind_speed_max_km_h),
    mean: parseNumber(row.wind_speed_mean_km_h),
  }));
}

function parseWindDirectionDailyCsv(text) {
  const dataSection = extractDataSection(text, "date,");
  return d3.csvParse(dataSection, (row) => ({
    date: row.date,
    mean: parseNumber(row["wind_direction_mean_10m (°)"]),
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

  const legends = buildLegends(chartContainer);

  const chart = {
    container: chartContainer,
    legends,
    dataset,
  };

  currentChart = chart;

  renderChart(chart);

  const resizeObserver = new ResizeObserver(() => renderChart(chart));
  resizeObserver.observe(chartContainer);
}

function buildLegends(chartContainer) {
  const ensureLegend = (modifier) => {
    let legend = chartContainer.querySelector(`.legend--${modifier}`);
    if (!legend) {
      legend = document.createElement("div");
      legend.className = `legend legend--${modifier}`;
      chartContainer.appendChild(legend);
    }
    return legend;
  };

  const legends = {
    primary: ensureLegend("primary"),
    secondary: ensureLegend("secondary"),
  };

  const renderLegendContent = (legend) => {
    legend.innerHTML = "";
    METRIC_DEFS.forEach((metric) => {
      // Hide windDirection from legend since it's combined with windRange
      if (metric.id === "windDirection") {
        return;
      }
      
      const item = document.createElement("button");
      item.className = "legend-item";
      item.dataset.series = metric.id;
      item.style.setProperty("--series-color", metric.color);
      item.textContent = metric.label;
      item.addEventListener("click", () => {
        const newState = !seriesVisibility[metric.id];
        handleMetricToggle(metric.id, newState);
      });
      legend.appendChild(item);
    });
    // Update availability after rendering
    updateLegendAvailability();
  };

  Object.values(legends).forEach(renderLegendContent);

  return legends;
}

function positionLegends(chart) {
  if (!chart || !chart.legends) {
    return;
  }
  const { container, legends } = chart;
  const primaryLayer = container.querySelector(".chart-layer--primary");
  const secondaryLayer = container.querySelector(".chart-layer--secondary");

  if (primaryLayer && legends.primary) {
    container.insertBefore(legends.primary, primaryLayer);
  }

  if (secondaryLayer && legends.secondary) {
    container.insertBefore(legends.secondary, secondaryLayer);
  }
}

function getTooltipMap(container) {
  const map = new Map();
  const root =
    (container && (container.closest(".chart-panel") || container.parentElement)) ||
    document;
  const tooltips = root.querySelectorAll(".tooltip");
  tooltips.forEach((tooltip, index) => {
    const key = tooltip.dataset.layer || (index === 0 ? "primary" : "");
    if (key) {
      map.set(key, tooltip);
    } else {
      map.set(`tooltip-${index}`, tooltip);
    }
  });
  if (!map.has("primary") && tooltips[0]) {
    map.set("primary", tooltips[0]);
  }
  if (!map.has("secondary") && tooltips[1]) {
    map.set("secondary", tooltips[1]);
  }
  return map;
}

function computeLayerTopOffset(ctx, container) {
  if (!ctx?.svg || !container) {
    return 0;
  }
  const svgElement = ctx.svg.node ? ctx.svg.node() : null;
  if (!svgElement) {
    return 0;
  }
  const containerRect = container.getBoundingClientRect();
  const svgRect = svgElement.getBoundingClientRect();
  return Math.max(0, svgRect.top - containerRect.top);
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
        drawLineSeries(chartG, dataset, xScale, yScales);
        drawWindDirection(chartG, dataset, xScale, innerHeight);
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
        drawWindDirection(chartG, dataset, xScale, gradientInnerHeight);
        drawGradientRangeSeries(
          svgLayer,
          chartG,
          dataset,
          xScale,
          gradientYScales,
          gradientInnerHeight,
          { layerKey: "secondary" }
        );
        drawLineSeries(chartG, dataset, xScale, gradientYScales);
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

  positionLegends(chart);

  setupLayerInteractions(layerContexts, dataset, xScale, margin, chart);

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
  const windRangeValues = dataset.flatMap((d) => [
    d.windRange?.min ?? null,
    d.windRange?.max ?? null,
    d.windRange?.mean ?? null,
  ]);
  const windGustValues = dataset.map((d) => d.windGust ?? null);
  const windValues = [...windRangeValues, ...windGustValues];
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
  // Max 2 axes total: First = left axis, Second = right axis
  // Third selection uses right axis scale but doesn't get its own axis
  const left = [];
  const right = [];
  
  if (selectionOrder.length === 0) {
    return { left, right };
  }
  
  // Get first selection (left axis) - dynamic placement
  if (selectionOrder.length >= 1) {
    const first = selectionOrder[0];
    if (first === "wind") {
      left.push("wind");
    } else {
      const metric = METRIC_DEFS.find(m => m.id === first);
      if (metric && metric.axis) {
        left.push(metric.axis);
      }
    }
  }
  
  // Get second selection (right axis) - dynamic placement
  if (selectionOrder.length >= 2) {
    const second = selectionOrder[1];
    if (second === "wind") {
      right.push("wind");
    } else {
      const metric = METRIC_DEFS.find(m => m.id === second);
      if (metric && metric.axis) {
        right.push(metric.axis);
      }
    }
  }
  
  // Third selection does NOT get its own axis - it uses the right axis scale
  
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

  const drawAxis = (axisId, side, index) => {
    const config = AXIS_CONFIG[axisId];
    const scale = yScales[axisId];
    if (!config || !scale) {
      return;
    }

    // Use dynamic side assignment instead of config.side
    const axisGenerator = side === "left" ? d3.axisLeft(scale) : d3.axisRight(scale);

    if (config.ticks != null) {
      axisGenerator.ticks(config.ticks);
    }
    if (typeof config.format === "function") {
      axisGenerator.tickFormat(config.format);
    }

    const offset = side === "left" ? -AXIS_GAP * index : AXIS_GAP * index;

    chartG
      .append("g")
      .attr("class", `axis axis--${axisId}`)
      .attr(
        "transform",
        side === "left"
          ? `translate(${offset},0)`
          : `translate(${innerWidth + offset},0)`
      )
      .call(axisGenerator);

    const labelX =
      side === "left"
        ? -AXIS_LABEL_OFFSET - AXIS_GAP * index
        : innerWidth + AXIS_LABEL_OFFSET + AXIS_GAP * index;
    const labelY = innerHeight / 2;

    // axis titles intentionally hidden
  };

  activeAxes.left.forEach((axisId, index) => drawAxis(axisId, "left", index));
  activeAxes.right.forEach((axisId, index) => drawAxis(axisId, "right", index));
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

  METRIC_DEFS.filter((def) => def.type === "bar" && shouldDrawMetric(def.id)).forEach((metric, index) => {
    const offset = index === 0 ? -barWidth / 4 : barWidth / 4;
    const axisInfo = getMetricAxis(metric.id);
    const axisId = axisInfo ? axisInfo.axis : metric.axis;
    const scale = yScales[axisId];
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

function drawWindDirection(chartG, dataset, xScale, innerHeight) {
  const windDirectionMetric = METRIC_DEFS.find((def) => def.type === "windDirection");
  if (!windDirectionMetric || !shouldDrawMetric(windDirectionMetric.id)) return;

  const windDirectionGroup = chartG.append("g").attr("class", "series-wind-direction");
  
  // Position at the top of the chart (y = 0, with some padding)
  const iconY = -20;
  const iconSize = 14;
  
  // Navigation icon path data (from navigation.svg)
  const navigationPath = "M11.0212 9.91506L7.35195 2.36117C7.2908 2.23374 7.19487 2.12618 7.07524 2.05089C6.95561 1.97561 6.81713 1.93566 6.67578 1.93566C6.53443 1.93566 6.39596 1.97561 6.27632 2.05089C6.15669 2.12618 6.06077 2.23374 5.99961 2.36117L2.33039 9.91506C2.26051 10.0549 2.23667 10.2132 2.26227 10.3674C2.28787 10.5216 2.36161 10.6638 2.47292 10.7735L2.48286 10.7835C2.5945 10.8956 2.73949 10.9685 2.89607 10.9912C3.05266 11.0139 3.21238 10.9852 3.35128 10.9094L6.67247 9.15271L9.99697 10.9061C10.1363 10.9816 10.2961 11.0104 10.453 10.9884C10.6099 10.9663 10.7556 10.8945 10.8687 10.7835C10.9832 10.6738 11.0597 10.5304 11.0871 10.3742C11.1145 10.2181 11.0914 10.0572 11.0212 9.91506Z";
  const fillColor = "#C5C5C5";

  const icons = windDirectionGroup
    .selectAll("g.wind-direction-icon")
    .data(dataset)
    .join("g")
    .attr("class", "wind-direction-icon")
    .attr("data-series", windDirectionMetric.id)
    .attr("data-date", (d) => d.isoDate)
    .attr("transform", (d) => {
      const x = xScale(d.date);
      const direction = windDirectionMetric.accessors.value(d);
      // Rotate based on wind direction (wind direction is where wind comes FROM)
      // Icon points north (0°), so we rotate it to point in the wind direction
      const rotation = typeof direction === "number" ? direction : 0;
      return `translate(${x}, ${iconY}) rotate(${rotation} 0 0)`;
    })
    .style("opacity", (d) => {
      const direction = windDirectionMetric.accessors.value(d);
      return typeof direction === "number" ? 0.8 : 0;
    });

  icons
    .append("path")
    .attr("d", navigationPath)
    .attr("fill", fillColor)
    .attr("class", "wind-direction-path")
    .attr("transform", `translate(-${iconSize / 2}, -${iconSize / 2})`);
}

function drawRangeSeries(chartG, dataset, xScale, yScales) {
  const rangesGroup = chartG.append("g").attr("class", "series-ranges");

  METRIC_DEFS.filter((def) => def.type === "range" && shouldDrawMetric(def.id)).forEach((metric) => {
    const axisInfo = getMetricAxis(metric.id);
    const axisId = axisInfo ? axisInfo.axis : metric.axis;
    const scale = yScales[axisId];
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
      .attr("fill-opacity", 0.07)
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
      .attr("stroke-dasharray", "3 2")
      .attr("d", minLine);

    group
      .append("path")
      .datum(dataset)
      .attr("class", "range-line range-line--max")
      .attr("fill", "none")
      .attr("stroke", metric.color)
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "3 2")
      .attr("d", maxLine);

    const showMeanLine =
      typeof metric.accessors.mean === "function" &&
      metric.options?.showMean !== false;
    if (showMeanLine) {
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
        .attr("stroke-width", 2)
        .attr("d", meanLine);
    }
  });
}

function drawLineSeries(chartG, dataset, xScale, yScales) {
  const linesGroup = chartG.append("g").attr("class", "series-lines");

  METRIC_DEFS.filter((def) => def.type === "line" && shouldDrawMetric(def.id)).forEach((metric) => {
    const axisInfo = getMetricAxis(metric.id);
    const axisId = axisInfo ? axisInfo.axis : metric.axis;
    const scale = yScales[axisId];
    if (!scale || typeof metric.accessors.value !== "function") {
      return;
    }

    const lineGenerator = d3
      .line()
      .defined((d) => typeof metric.accessors.value(d) === "number")
      .x((d) => xScale(d.date))
      .y((d) => scale(metric.accessors.value(d)));

    const path = linesGroup
      .append("path")
      .datum(dataset)
      .attr("class", `series series--line series--${metric.id}`)
      .attr("data-series", metric.id)
      .attr("fill", "none")
      .attr("stroke", metric.color)
      .attr("stroke-width", 1.5)
      .attr("d", lineGenerator);

    if (metric.options?.strokeDasharray) {
      path.attr("stroke-dasharray", metric.options.strokeDasharray);
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

  METRIC_DEFS.filter((def) => def.type === "range" && shouldDrawMetric(def.id)).forEach((metric) => {
    const axisInfo = getMetricAxis(metric.id);
    const axisId = axisInfo ? axisInfo.axis : metric.axis;
    const scale = yScales[axisId];
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

    const showMeanLine =
      typeof metric.accessors.mean === "function" &&
      metric.options?.showMean !== false;
    if (showMeanLine) {
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
        .attr("stroke-width", 2)
        .attr("d", meanLine);
    }
  });
}

function setupLayerInteractions(layerContexts, dataset, xScale, margin, chart) {
  if (!layerContexts.length) {
    return;
  }

  const tooltipMap = getTooltipMap(chart?.container);
  const bisect = d3.bisector((d) => d.date).center;
  const contextByKey = new Map(layerContexts.map((ctx) => [ctx.key, ctx]));
  const fillColor = "#C5C5C5"; // Light gray for wind direction icons

  const focusLayers = layerContexts.map((ctx) =>
    createFocusLayer(ctx.chartG, xScale, ctx.yScales, ctx.innerHeight, ctx.key)
  );

  const handleMove = (event, ctx) => {
    const [x] = d3.pointer(event, ctx.chartG.node());
    const date = xScale.invert(x);
    const index = bisect(dataset, date);
    const datum = dataset[Math.max(0, Math.min(dataset.length - 1, index))];

    tooltipMap.forEach((tooltipEl, key) => {
      if (!tooltipEl) return;
      const targetCtx = contextByKey.get(key) || ctx;
      const layerTop = computeLayerTopOffset(targetCtx, chart?.container);
      const targetInnerHeight = targetCtx?.innerHeight ?? ctx.innerHeight;
      updateTooltip(
        datum,
        { x },
        {
          margin,
          innerHeight: targetInnerHeight,
          layerKey: key,
          layerTop,
          container: chart?.container,
        },
        tooltipEl
      );
    });

    focusLayers.forEach((layer) => {
      layer.show();
      layer.update(datum, seriesVisibility);
    });

    // Darken wind direction icon for the hovered day
    layerContexts.forEach((layerCtx) => {
      layerCtx.chartG.selectAll("g.wind-direction-icon")
        .selectAll("path.wind-direction-path")
        .attr("fill", function() {
          const iconGroup = d3.select(this.parentNode);
          const iconDate = iconGroup.attr("data-date");
          return iconDate === datum.isoDate ? "#666666" : fillColor;
        });
    });
  };

  const handleLeave = () => {
    tooltipMap.forEach((tooltip) => {
      if (tooltip) {
        tooltip.hidden = true;
      }
    });
    focusLayers.forEach((layer) => layer.hide());
    
    // Reset wind direction icons to normal color
    layerContexts.forEach((ctx) => {
      ctx.chartG.selectAll("g.wind-direction-icon")
        .selectAll("path.wind-direction-path")
        .attr("fill", fillColor);
    });
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
    const hasMean =
      typeof metric.accessors.mean === "function" &&
      metric.options?.showMean !== false;
    if (hasMean) {
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

  METRIC_DEFS.filter((def) => def.type === "line").forEach((metric) => {
    const scale = yScales[metric.axis];
    if (!scale || typeof metric.accessors.value !== "function") {
      return;
    }
    const circle = focusGroup
      .append("circle")
      .attr(
        "class",
        `focus-point focus-point--${metric.id} focus-point--value`
      )
      .attr("r", 4)
      .attr("fill", metric.color)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5)
      .attr("data-series", metric.id)
      .attr("pointer-events", "none");
    focusPoints.push({
      metricId: metric.id,
      stat: "value",
      circle,
      accessor: metric.accessors.value,
      scale,
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

// Convert wind direction degrees to cardinal direction (N, NE, E, SE, S, SW, W, NW)
function degreesToCardinal(degrees) {
  if (typeof degrees !== "number" || isNaN(degrees)) return null;
  
  // Normalize to 0-360
  const normalized = ((degrees % 360) + 360) % 360;
  
  // Map to 8 main directions
  // N: 337.5-22.5, NE: 22.5-67.5, E: 67.5-112.5, SE: 112.5-157.5
  // S: 157.5-202.5, SW: 202.5-247.5, W: 247.5-292.5, NW: 292.5-337.5
  if (normalized >= 337.5 || normalized < 22.5) {
    return "N";
  } else if (normalized >= 22.5 && normalized < 67.5) {
    return "NE";
  } else if (normalized >= 67.5 && normalized < 112.5) {
    return "E";
  } else if (normalized >= 112.5 && normalized < 157.5) {
    return "SE";
  } else if (normalized >= 157.5 && normalized < 202.5) {
    return "S";
  } else if (normalized >= 202.5 && normalized < 247.5) {
    return "SW";
  } else if (normalized >= 247.5 && normalized < 292.5) {
    return "W";
  } else {
    return "NW";
  }
}

function updateTooltip(datum, pointer, layout, tooltipEl) {
  if (!tooltipEl || !datum) return;
  const { x } = pointer;
  const { margin, layerTop = 0 } = layout;

  const activeMetrics = METRIC_DEFS.filter(
    (metric) => seriesVisibility[metric.id]
  );
  
  // Group metrics by category for better organization
  const metricGroups = {
    temperature: null,
    humidity: null,
    wind: [],
    precipitation: null,
    daylight: null,
  };
  
  activeMetrics.forEach((metric) => {
    if (metric.type === "range") {
      const minAccessor = metric.accessors.min;
      const maxAccessor = metric.accessors.max;
      const meanAccessor = metric.accessors.mean;
      const min =
        typeof minAccessor === "function" ? minAccessor(datum) : null;
      const max =
        typeof maxAccessor === "function" ? maxAccessor(datum) : null;
      const mean =
        typeof meanAccessor === "function" ? meanAccessor(datum) : null;

      const meanStr = formatValue(mean, metric.units);
      const minStr = formatValue(min, metric.units);
      const maxStr = formatValue(max, metric.units);

      if (metric.id === "temperature") {
        metricGroups.temperature = { metric, mean: meanStr, min: minStr, max: maxStr };
      } else if (metric.id === "humidity") {
        metricGroups.humidity = { metric, mean: meanStr, min: minStr, max: maxStr };
      } else if (metric.id === "windRange") {
        metricGroups.wind.push({ metric, mean: meanStr, min: minStr, max: maxStr, type: "range" });
      }
    }

    if (metric.type === "bar") {
      const value = metric.accessors.value(datum);
      const valueStr = formatValue(value, metric.units);
      if (valueStr) {
        if (metric.id === "precipitation") {
          metricGroups.precipitation = { metric, value: valueStr };
        } else if (metric.id === "daylight") {
          metricGroups.daylight = { metric, value: valueStr };
        }
      }
    }

    if (metric.type === "line") {
      const accessor = metric.accessors.value;
      if (typeof accessor === "function") {
        const value = accessor(datum);
        const valueStr = formatValue(value, metric.units);
        if (valueStr && metric.id === "windGust") {
          metricGroups.wind.push({ metric, value: valueStr, type: "line" });
        }
      }
    }

    if (metric.type === "windDirection") {
      const accessor = metric.accessors.value;
      if (typeof accessor === "function") {
        const value = accessor(datum);
        if (typeof value === "number") {
          const cardinal = degreesToCardinal(value);
          metricGroups.wind.push({ metric, direction: cardinal, degrees: value, type: "direction" });
        }
      }
    }
  });

  // Build tooltip HTML with new layout: color | mean | min/max
  const tooltipItems = [];
  
  if (metricGroups.temperature) {
    const { metric, mean, min, max } = metricGroups.temperature;
    tooltipItems.push(`
      <div class="tooltip-series" style="--series-color:${metric.color}">
        <div class="tooltip-col-label">
          <span class="tooltip-item-label">${metric.label}</span>
        </div>
        <div class="tooltip-col-mean">
          ${mean ? `<strong>${mean}</strong>` : '–'}
        </div>
        <div class="tooltip-col-minmax">
          ${min ? `<div>Min ${min}</div>` : ''}
          ${max ? `<div>Max ${max}</div>` : ''}
        </div>
      </div>
    `);
  }
  
  if (metricGroups.humidity) {
    const { metric, mean, min, max } = metricGroups.humidity;
    tooltipItems.push(`
      <div class="tooltip-series" style="--series-color:${metric.color}">
        <div class="tooltip-col-label">
          <span class="tooltip-item-label">${metric.label}</span>
        </div>
        <div class="tooltip-col-mean">
          ${mean ? `<strong>${mean}</strong>` : '–'}
        </div>
        <div class="tooltip-col-minmax">
          ${min ? `<div>Min ${min}</div>` : ''}
          ${max ? `<div>Max ${max}</div>` : ''}
        </div>
      </div>
    `);
  }
  
  if (metricGroups.wind.length > 0) {
    const windRange = metricGroups.wind.find(w => w.type === "range");
    const windGust = metricGroups.wind.find(w => w.type === "line");
    const windDirection = metricGroups.wind.find(w => w.type === "direction");
    const windMetric = windRange?.metric || windGust?.metric || METRIC_DEFS.find(m => m.id === "windRange");
    
    tooltipItems.push(`
      <div class="tooltip-series" style="--series-color:${windMetric?.color || "#8e44ad"}">
        <div class="tooltip-col-label">
          <span class="tooltip-color-indicator"></span>
          <span class="tooltip-item-label">Wind</span>
        </div>
        <div class="tooltip-col-mean">
          ${windRange?.mean ? `<strong>${windRange.mean}</strong>` : '–'}
        </div>
        <div class="tooltip-col-minmax">
          ${windRange?.min ? `<div>Min ${windRange.min}</div>` : ''}
          ${windRange?.max ? `<div>Max ${windRange.max}</div>` : ''}
          ${windGust?.value ? `<div>Gust ${windGust.value}</div>` : ''}
          ${windDirection?.direction ? `<div>Direction ${windDirection.direction}</div>` : ''}
        </div>
      </div>
    `);
  }
  
  if (metricGroups.daylight) {
    const { metric, value } = metricGroups.daylight;
    tooltipItems.push(`
      <div class="tooltip-series" style="--series-color:${metric.color}">
        <div class="tooltip-col-label">
          <span class="tooltip-item-label">${metric.label}</span>
        </div>
        <div class="tooltip-col-mean">
          ${value ? `<strong>${value}</strong>` : '–'}
        </div>
        <div class="tooltip-col-minmax">
        </div>
      </div>
    `);
  }
  
  if (metricGroups.precipitation) {
    const { metric, value } = metricGroups.precipitation;
    tooltipItems.push(`
      <div class="tooltip-series" style="--series-color:${metric.color}">
        <div class="tooltip-col-label">
          <span class="tooltip-item-label">${metric.label}</span>
        </div>
        <div class="tooltip-col-mean">
          ${value ? `<strong>${value}</strong>` : '–'}
        </div>
        <div class="tooltip-col-minmax">
        </div>
      </div>
    `);
  }

  tooltipEl.innerHTML = `
    <div class="tooltip-header">${d3.timeFormat("%B %d, %Y")(datum.date)}</div>
    ${tooltipItems.length > 0 ? tooltipItems.join("") : "<span class='tooltip-empty'>No series active</span>"}
  `;

  tooltipEl.hidden = false;

  const container =
    layout.container || document.getElementById("chart") || tooltipEl.parentElement;
  if (!container) {
    return;
  }
  const containerRect = container.getBoundingClientRect();
  const tooltipWidth = tooltipEl.offsetWidth || 200;
  const tooltipOffset = 30; // Offset to the right from the hovered day
  const left = Math.min(
    containerRect.width - tooltipWidth - 16,
    Math.max(16, margin.left + x + tooltipOffset)
  );
  tooltipEl.style.left = `${left}px`;
  const top = Math.max(0, layerTop + 16);
  tooltipEl.style.top = `${top}px`;
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
        // If windRange or windDirection, sync the other one's checkbox too
        if (WIND_RANGE_GROUP.has(metric.id)) {
          const otherId = metric.id === "windRange" ? "windDirection" : "windRange";
          const otherNodes = document.querySelectorAll(`[data-series="${otherId}"]`);
          otherNodes.forEach((otherNode) => {
            if (otherNode instanceof HTMLInputElement) {
              otherNode.checked = !hidden;
            }
          });
        }
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
  // Update legend availability after visibility changes
  updateLegendAvailability();
}

function updateLegendAvailability() {
  METRIC_DEFS.forEach((metric) => {
    const canSelect = canSelectMetric(metric.id);
    const nodes = document.querySelectorAll(`[data-series="${metric.id}"]`);
    nodes.forEach((node) => {
      if (node instanceof HTMLButtonElement) {
        // Hide if can't be selected and not already selected
        const shouldHide = !canSelect && !seriesVisibility[metric.id];
        node.style.display = shouldHide ? "none" : "";
        // Also disable/enable the button
        node.disabled = !canSelect && !seriesVisibility[metric.id];
        
        // Special case: windGust should be hidden when wind is not selected
        if (metric.id === "windGust" && !isMainCategorySelected("wind")) {
          node.style.display = "none";
          node.disabled = true;
        }
      }
    });
  });
}

