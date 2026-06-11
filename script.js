const DATA_URL = "data/fashion_dataset_complete.csv";
const STORAGE_KEY = "fashion-dashboard-d3-state";

let dataset = [];
let activeCharts = [];
let chartCounter = 0;

const monthNames = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const kpiConfigs = [
  {
    id: "views-month",
    name: "Views por mês",
    description: "Como o interesse evolui ao longo do ano.",
    chartType: "Série temporal",
    render: renderLineChart
  },
  {
    id: "tryons-product",
    name: "Peças mais experimentadas",
    description: "As categorias que mais chamaram as pessoas ao provador virtual.",
    chartType: "Ranking horizontal",
    render: renderHorizontalBarChart
  },
  {
    id: "purchases-gender",
    name: "Compras por género",
    description: "Quem avançou para compra, visto por género.",
    chartType: "Distribuição",
    render: renderDonutChart
  },
  {
    id: "preferred-styles",
    name: "Estilos preferidos",
    description: "Os estilos que aparecem com mais frequência nas escolhas.",
    chartType: "Barras",
    render: renderBarChart
  },
  {
    id: "price-satisfaction",
    name: "Preço e satisfação",
    description: "O que acontece à satisfação quando o preço muda.",
    chartType: "Dispersão",
    render: renderScatterPlot
  },
  {
    id: "popular-colors",
    name: "Cores mais populares",
    description: "As cores que mais aparecem nas peças analisadas.",
    chartType: "Bolhas",
    render: renderBubbleChart
  },
  {
    id: "likes-month",
    name: "Likes por mês",
    description: "Como a reação positiva evolui ao longo do tempo.",
    chartType: "Série temporal",
    render: renderLikesByMonthChart
  },
  {
    id: "engagement-style",
    name: "Engagement por estilo",
    description: "Soma de likes, partilhas e saves por preferência.",
    chartType: "Ranking horizontal",
    render: renderEngagementByStyleChart
  },
  {
    id: "purchases-budget",
    name: "Compras por orçamento",
    description: "Distribuição das compras por nível de orçamento.",
    chartType: "Distribuição",
    render: renderPurchasesByBudgetChart
  },
  {
    id: "brand-price",
    name: "Preço médio por marca",
    description: "Marcas com preços médios mais altos no dataset.",
    chartType: "Ranking horizontal",
    render: renderAveragePriceByBrandChart
  },
  {
    id: "experience-scores",
    name: "Scores de experiência",
    description: "Satisfação, conforto, qualidade, fit e sustentabilidade.",
    chartType: "Barras",
    render: renderExperienceScoresChart
  },
  {
    id: "sustainability-fabric",
    name: "Sustentabilidade por tecido",
    description: "Tecidos com melhor score médio de sustentabilidade.",
    chartType: "Ranking horizontal",
    render: renderSustainabilityByFabricChart
  }
];

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  if (!window.d3) {
    document.body.innerHTML = '<main class="chart-message">Não foi possível carregar a biblioteca D3.js.</main>';
    return;
  }

  bindActions();
  renderKpiList();
  setupDashboardDropZone();

  try {
    await loadData();
    loadDashboard();
    renderSummaryStrip();
    renderDashboard();
    setStatus("CSV carregado.");
  } catch (error) {
    console.error(error);
    setStatus("Erro ao carregar CSV.");
    renderEmptyMessage("Não foi possível carregar o ficheiro CSV local.");
  }
}

async function loadData() {
  dataset = await d3.csv(DATA_URL, parseRow);
  return dataset;
}

function parseRow(row) {
  const parsedDate = row.timestamp ? new Date(row.timestamp) : null;
  const parsedMonth = toNumber(row.month);

  return {
    ...row,
    timestamp: parsedDate,
    month: Number.isFinite(parsedMonth) && parsedMonth > 0
      ? parsedMonth
      : parsedDate instanceof Date && !Number.isNaN(parsedDate)
        ? parsedDate.getMonth() + 1
        : null,
    views: toNumber(row.views),
    likes: toNumber(row.likes),
    shares: toNumber(row.shares),
    saves: toNumber(row.saves),
    tryon_count: toNumber(row.tryon_count),
    purchased: toNumber(row.purchased),
    price_usd: toNumber(row.price_usd),
    satisfaction_score: toNumber(row.satisfaction_score),
    trend_score: toNumber(row.trend_score),
    comfort_score: toNumber(row.comfort_score),
    sustainability_score: toNumber(row.sustainability_score),
    quality_score: toNumber(row.quality_score),
    fit_score: toNumber(row.fit_score)
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function renderKpiList() {
  const list = document.getElementById("kpiList");
  list.innerHTML = "";

  kpiConfigs.forEach((kpi) => {
    const item = document.createElement("article");
    item.className = "kpi-item";
    item.draggable = true;
    item.tabIndex = 0;
    item.dataset.kpiId = kpi.id;
    item.innerHTML = `
      <p class="kpi-title">${kpi.name}</p>
      <p class="kpi-description">${kpi.description}</p>
      <span class="kpi-type">${kpi.chartType}</span>
    `;

    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-kpi-id", kpi.id);
      event.dataTransfer.setData("text/plain", kpi.id);
    });

    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        addChart(kpi.id);
      }
    });

    list.appendChild(item);
  });
}

function setupDashboardDropZone() {
  const dashboard = document.getElementById("dashboard");

  dashboard.addEventListener("dragover", (event) => {
    event.preventDefault();
    dashboard.classList.add("is-over");
  });

  dashboard.addEventListener("dragleave", (event) => {
    if (!dashboard.contains(event.relatedTarget)) {
      dashboard.classList.remove("is-over");
    }
  });

  dashboard.addEventListener("drop", (event) => {
    event.preventDefault();
    dashboard.classList.remove("is-over");

    const kpiId = readTransfer(event, "application/x-kpi-id", isValidKpi);
    const chartId = readTransfer(event, "application/x-chart-id", isActiveChart);

    if (kpiId) {
      addChart(kpiId);
      return;
    }

    if (chartId) {
      const targetCard = event.target.closest(".chart-card");
      reorderChart(chartId, targetCard, event);
    }
  });
}

function readTransfer(event, type, validator) {
  const exactValue = event.dataTransfer.getData(type);
  if (validator(exactValue)) {
    return exactValue;
  }

  const plainValue = event.dataTransfer.getData("text/plain");
  return validator(plainValue) ? plainValue : "";
}

function isValidKpi(kpiId) {
  return kpiConfigs.some((kpi) => kpi.id === kpiId);
}

function isActiveChart(chartId) {
  return activeCharts.some((chart) => chart.chartId === chartId);
}

function addChart(kpiId) {
  if (!isValidKpi(kpiId)) {
    return;
  }

  activeCharts.push({
    chartId: `${kpiId}-${Date.now()}-${chartCounter++}`,
    kpiId
  });

  renderDashboard();
  setStatus("Gráfico adicionado.");
}

function removeChart(chartId) {
  activeCharts = activeCharts.filter((chart) => chart.chartId !== chartId);
  renderDashboard();
  setStatus("Gráfico removido.");
}

function reorderChart(chartId, targetCard, event) {
  const sourceIndex = activeCharts.findIndex((chart) => chart.chartId === chartId);
  if (sourceIndex < 0) {
    return;
  }

  const targetChartId = targetCard?.dataset.chartId || "";
  if (targetChartId === chartId) {
    return;
  }

  const [movedChart] = activeCharts.splice(sourceIndex, 1);

  if (!targetChartId) {
    activeCharts.push(movedChart);
    renderDashboard();
    setStatus("Ordem atualizada.");
    return;
  }

  let targetIndex = activeCharts.findIndex((chart) => chart.chartId === targetChartId);
  if (targetIndex < 0) {
    activeCharts.push(movedChart);
    renderDashboard();
    setStatus("Ordem atualizada.");
    return;
  }

  const bounds = targetCard.getBoundingClientRect();
  const shouldPlaceAfter = event.clientY > bounds.top + bounds.height / 2;

  if (shouldPlaceAfter) {
    targetIndex += 1;
  }

  activeCharts.splice(targetIndex, 0, movedChart);
  renderDashboard();
  setStatus("Ordem atualizada.");
}

function saveDashboard() {
  const state = activeCharts.map((chart) => chart.kpiId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  setStatus("Dashboard guardado.");
}

function loadDashboard() {
  const savedState = localStorage.getItem(STORAGE_KEY);
  if (!savedState) {
    activeCharts = [];
    return;
  }

  try {
    const parsedState = JSON.parse(savedState);
    const chartIds = Array.isArray(parsedState)
      ? parsedState
      : Array.isArray(parsedState.charts)
        ? parsedState.charts
        : [];

    activeCharts = chartIds
      .filter(isValidKpi)
      .map((kpiId) => ({
        chartId: `${kpiId}-${Date.now()}-${chartCounter++}`,
        kpiId
      }));
  } catch (error) {
    console.warn("Estado guardado inválido:", error);
    activeCharts = [];
  }
}

async function refreshDashboard() {
  setStatus("A atualizar CSV...");

  try {
    await loadData();
    renderSummaryStrip();
    renderDashboard();
    setStatus("CSV atualizado.");
  } catch (error) {
    console.error(error);
    setStatus("Erro no refresh.");
  }
}

function renderDashboard() {
  const dashboard = document.getElementById("dashboard");
  dashboard.innerHTML = "";

  if (activeCharts.length === 0) {
    renderEmptyMessage("Arraste KPIs para começar");
    return;
  }

  activeCharts.forEach((chart) => {
    const kpi = kpiConfigs.find((item) => item.id === chart.kpiId);
    if (!kpi) {
      return;
    }

    const card = document.createElement("article");
    card.className = "chart-card";
    card.draggable = true;
    card.dataset.chartId = chart.chartId;

    const header = document.createElement("header");
    header.className = "chart-header";
    header.innerHTML = `
      <div>
        <h3 class="chart-title">${kpi.name}</h3>
        <p class="chart-subtitle">${kpi.chartType} · ${kpi.description}</p>
      </div>
    `;

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remover ${kpi.name}`);
    removeButton.addEventListener("click", () => removeChart(chart.chartId));

    const visual = document.createElement("div");
    visual.className = "chart-visual";

    header.appendChild(removeButton);
    card.appendChild(header);
    card.appendChild(visual);

    card.addEventListener("dragstart", (event) => {
      if (event.target.closest("button")) {
        event.preventDefault();
        return;
      }

      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-chart-id", chart.chartId);
      event.dataTransfer.setData("text/plain", chart.chartId);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });

    dashboard.appendChild(card);
    kpi.render(d3.select(visual), dataset);
  });
}

function renderSummaryStrip() {
  const strip = document.getElementById("summaryStrip");
  if (!strip) {
    return;
  }

  if (!dataset.length) {
    strip.innerHTML = "";
    return;
  }

  const uniqueUsers = new Set(dataset.map((row) => row.user_id).filter(Boolean)).size;
  const totalViews = d3.sum(dataset, (row) => row.views);
  const totalEngagement = d3.sum(dataset, (row) => row.likes + row.shares + row.saves);
  const totalPurchases = d3.sum(dataset, (row) => row.purchased);
  const averageSatisfaction = d3.mean(
    dataset.filter((row) => Number.isFinite(row.satisfaction_score)),
    (row) => row.satisfaction_score
  );

  const cards = [
    {
      label: "Registos",
      value: formatNumber(dataset.length),
      note: `${formatNumber(uniqueUsers)} utilizadores analisados`
    },
    {
      label: "Engagement",
      value: formatCompact(totalEngagement),
      note: `${formatCompact(totalViews)} views totais`
    },
    {
      label: "Compras",
      value: formatNumber(totalPurchases),
      note: `${formatPercent(totalPurchases / dataset.length)} taxa de compra`
    },
    {
      label: "Satisfação média",
      value: formatPercent(averageSatisfaction),
      note: "Pontuação global do dataset"
    }
  ];

  strip.innerHTML = cards.map((card) => `
    <article class="summary-card">
      <p class="summary-label">${card.label}</p>
      <p class="summary-value">${card.value}</p>
      <p class="summary-note">${card.note}</p>
    </article>
  `).join("");
}

function renderEmptyMessage(message) {
  const dashboard = document.getElementById("dashboard");
  dashboard.innerHTML = "";

  const emptyState = document.createElement("div");
  emptyState.className = "empty-state";
  emptyState.textContent = message;
  dashboard.appendChild(emptyState);
}

function bindActions() {
  document.getElementById("saveBtn").addEventListener("click", saveDashboard);
  document.getElementById("refreshBtn").addEventListener("click", refreshDashboard);
}

function setStatus(message) {
  const statusText = document.getElementById("statusText");
  statusText.textContent = message;

  window.clearTimeout(setStatus.timeoutId);
  setStatus.timeoutId = window.setTimeout(() => {
    statusText.textContent = "";
  }, 3200);
}

function chartSize(container, fallbackHeight = 420) {
  const node = container.node();
  const width = Math.max(node.clientWidth || 520, 320);
  return { width, height: fallbackHeight };
}

function createSvg(container, height = 420) {
  container.selectAll("*").remove();
  const { width } = chartSize(container, height);

  return container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
}

function showChartMessage(container, message) {
  container.selectAll("*").remove();
  container.append("div").attr("class", "chart-message").text(message);
}

function showTooltip(event, title, rows) {
  const tooltip = d3.select("#tooltip");
  const content = rows.map((row) => `<span>${row}</span>`).join("<br>");

  tooltip
    .html(`<strong>${title}</strong>${content}`)
    .style("left", `${event.clientX + 14}px`)
    .style("top", `${event.clientY + 14}px`)
    .classed("visible", true);
}

function hideTooltip() {
  d3.select("#tooltip").classed("visible", false);
}

function formatNumber(value) {
  return d3.format(",.0f")(value).replace(/,/g, " ");
}

function formatCompact(value) {
  return d3.format(".3s")(value).replace("G", "B");
}

function formatPercent(value) {
  return Number.isFinite(value) ? d3.format(".0%")(value) : "0%";
}

function formatCurrency(value) {
  return `$${d3.format(",.2f")(value)}`;
}

function renderLineChart(container, data) {
  const values = d3.rollups(
    data.filter((row) => row.month && Number.isFinite(row.views)),
    (rows) => d3.sum(rows, (row) => row.views),
    (row) => row.month
  )
    .map(([month, views]) => ({ month, views }))
    .sort((a, b) => d3.ascending(a.month, b.month));

  if (values.length === 0) {
    showChartMessage(container, "Sem dados para views por mês.");
    return;
  }

  const height = 430;
  const margin = { top: 34, right: 36, bottom: 58, left: 82 };
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scalePoint()
    .domain(values.map((row) => row.month))
    .range([0, innerWidth])
    .padding(0.35);

  const y = d3.scaleLinear()
    .domain([0, d3.max(values, (row) => row.views)])
    .nice()
    .range([innerHeight, 0]);

  const group = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  group.append("g")
    .attr("class", "grid-line")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat((month) => monthNames[month - 1] || month));

  group.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatNumber));

  const line = d3.line()
    .x((row) => x(row.month))
    .y((row) => y(row.views))
    .curve(d3.curveMonotoneX);

  const path = group.append("path")
    .datum(values)
    .attr("fill", "none")
    .attr("stroke", "#4fb7c9")
    .attr("stroke-width", 4)
    .attr("d", line);

  const pathLength = path.node().getTotalLength();
  path
    .attr("stroke-dasharray", `${pathLength} ${pathLength}`)
    .attr("stroke-dashoffset", pathLength)
    .transition()
    .duration(800)
    .attr("stroke-dashoffset", 0);

  group.selectAll(".line-point")
    .data(values)
    .join("circle")
    .attr("class", "line-point")
    .attr("cx", (row) => x(row.month))
    .attr("cy", (row) => y(row.views))
    .attr("r", 0)
    .attr("fill", "#d95f78")
    .on("mousemove", (event, row) => {
      showTooltip(event, monthNames[row.month - 1] || `Mês ${row.month}`, [
        `Views: ${formatNumber(row.views)}`
      ]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(650)
    .attr("r", 6);
}

function renderHorizontalBarChart(container, data) {
  const values = d3.rollups(
    data.filter((row) => row.clothing_type),
    (rows) => d3.sum(rows, (row) => row.tryon_count),
    (row) => row.clothing_type
  )
    .map(([clothingType, tryons]) => ({ clothingType, tryons }))
    .sort((a, b) => d3.descending(a.tryons, b.tryons))
    .slice(0, 8);

  if (values.length === 0) {
    showChartMessage(container, "Sem dados de try-ons por produto.");
    return;
  }

  const height = 430;
  const margin = { top: 28, right: 62, bottom: 52, left: 130 };
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleLinear()
    .domain([0, d3.max(values, (row) => row.tryons)])
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleBand()
    .domain(values.map((row) => row.clothingType))
    .range([0, innerHeight])
    .padding(0.24);

  const group = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  group.append("g")
    .attr("class", "grid-line")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(""))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(formatNumber));

  group.selectAll("rect")
    .data(values)
    .join("rect")
    .attr("x", 0)
    .attr("y", (row) => y(row.clothingType))
    .attr("width", 0)
    .attr("height", y.bandwidth())
    .attr("rx", 8)
    .attr("fill", "#4fb7c9")
    .on("mousemove", (event, row) => {
      showTooltip(event, row.clothingType, [`Try-ons: ${formatNumber(row.tryons)}`]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(650)
    .attr("width", (row) => x(row.tryons));

  group.selectAll(".bar-label")
    .data(values)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", (row) => x(row.tryons) + 6)
    .attr("y", (row) => y(row.clothingType) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .attr("fill", "#9bc9c1")
    .attr("font-size", 15)
    .text((row) => formatNumber(row.tryons));
}

function renderDonutChart(container, data) {
  let values = d3.rollups(
    data.filter((row) => row.gender),
    (rows) => d3.sum(rows, (row) => row.purchased),
    (row) => row.gender
  )
    .map(([gender, purchases]) => ({ gender, purchases }))
    .filter((row) => row.purchases > 0)
    .sort((a, b) => d3.descending(a.purchases, b.purchases));

  if (values.length === 0) {
    values = d3.rollups(
      data.filter((row) => row.gender),
      (rows) => rows.length,
      (row) => row.gender
    )
      .map(([gender, purchases]) => ({ gender, purchases }))
      .sort((a, b) => d3.descending(a.purchases, b.purchases));
  }

  if (values.length === 0) {
    showChartMessage(container, "Sem dados de compras por género.");
    return;
  }

  const height = 430;
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const radius = Math.min(width * 0.42, height * 0.42);
  const centerX = width * 0.43;
  const centerY = height / 2;
  const color = d3.scaleOrdinal()
    .domain(values.map((row) => row.gender))
    .range(["#4fb7c9", "#d95f78", "#d5a642", "#67bd8c", "#8176b8", "#55b8aa"]);

  const pie = d3.pie()
    .value((row) => row.purchases)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(radius * 0.58)
    .outerRadius(radius);

  const group = svg.append("g").attr("transform", `translate(${centerX},${centerY})`);

  group.selectAll("path")
    .data(pie(values))
    .join("path")
    .attr("fill", (row) => color(row.data.gender))
    .attr("stroke", "#082522")
    .attr("stroke-width", 3)
    .on("mousemove", (event, row) => {
      showTooltip(event, row.data.gender, [`Compras: ${formatNumber(row.data.purchases)}`]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(700)
    .attrTween("d", function animateArc(row) {
      const interpolation = d3.interpolate({ startAngle: 0, endAngle: 0 }, row);
      return (time) => arc(interpolation(time));
    });

  group.append("text")
    .attr("text-anchor", "middle")
    .attr("y", -4)
    .attr("fill", "#e8fff9")
    .attr("font-size", 34)
    .attr("font-weight", 800)
    .text(formatNumber(d3.sum(values, (row) => row.purchases)));

  group.append("text")
    .attr("text-anchor", "middle")
    .attr("y", 18)
    .attr("fill", "#9bc9c1")
    .attr("font-size", 15)
    .text("compras");

  const legend = svg.append("g")
    .attr("transform", `translate(${Math.min(width - 150, centerX + radius + 28)},${Math.max(26, centerY - values.length * 13)})`);

  const legendItems = legend.selectAll("g")
    .data(values)
    .join("g")
    .attr("transform", (row, index) => `translate(0,${index * 26})`);

  legendItems.append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("rx", 3)
    .attr("fill", (row) => color(row.gender));

  legendItems.append("text")
    .attr("x", 20)
    .attr("y", 10)
    .attr("fill", "#9bc9c1")
    .attr("font-size", 15)
    .text((row) => `${row.gender} (${formatNumber(row.purchases)})`);
}

function renderBarChart(container, data) {
  const values = d3.rollups(
    data.filter((row) => row.style_preference),
    (rows) => rows.length,
    (row) => row.style_preference
  )
    .map(([style, count]) => ({ style, count }))
    .sort((a, b) => d3.descending(a.count, b.count))
    .slice(0, 8);

  if (values.length === 0) {
    showChartMessage(container, "Sem dados de estilos preferidos.");
    return;
  }

  const height = 430;
  const margin = { top: 30, right: 32, bottom: 96, left: 78 };
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleBand()
    .domain(values.map((row) => row.style))
    .range([0, innerWidth])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, d3.max(values, (row) => row.count)])
    .nice()
    .range([innerHeight, 0]);

  const group = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  group.append("g")
    .attr("class", "grid-line")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .call((selection) => {
      selection.selectAll("text")
        .attr("transform", "rotate(-32)")
        .attr("text-anchor", "end")
        .attr("dx", "-0.55em")
        .attr("dy", "0.35em");
    });

  group.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatNumber));

  group.selectAll("rect")
    .data(values)
    .join("rect")
    .attr("x", (row) => x(row.style))
    .attr("y", innerHeight)
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("rx", 8)
    .attr("fill", "#d5a642")
    .on("mousemove", (event, row) => {
      showTooltip(event, row.style, [`Registos: ${formatNumber(row.count)}`]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(650)
    .attr("y", (row) => y(row.count))
    .attr("height", (row) => innerHeight - y(row.count));
}

function renderScatterPlot(container, data) {
  const fullData = data.filter((row) => (
    Number.isFinite(row.price_usd) &&
    Number.isFinite(row.satisfaction_score) &&
    row.price_usd > 0
  ));

  if (fullData.length === 0) {
    showChartMessage(container, "Sem dados de preço e satisfação.");
    return;
  }

  const step = Math.max(1, Math.ceil(fullData.length / 850));
  const values = fullData.filter((row, index) => index % step === 0);

  const height = 430;
  const margin = { top: 32, right: 36, bottom: 70, left: 78 };
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleLinear()
    .domain(d3.extent(fullData, (row) => row.price_usd))
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(fullData, (row) => row.satisfaction_score)])
    .nice()
    .range([innerHeight, 0]);

  const group = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  group.append("g")
    .attr("class", "grid-line")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((value) => `$${value}`));

  group.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5));

  group.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 44)
    .attr("text-anchor", "middle")
    .attr("fill", "#9bc9c1")
    .attr("font-size", 15)
    .text("Preço (USD)");

  group.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -42)
    .attr("text-anchor", "middle")
    .attr("fill", "#9bc9c1")
    .attr("font-size", 15)
    .text("Satisfação");

  group.selectAll("circle")
    .data(values)
    .join("circle")
    .attr("cx", (row) => x(row.price_usd))
    .attr("cy", (row) => y(row.satisfaction_score))
    .attr("r", 0)
    .attr("fill", (row) => row.purchased > 0 ? "#67bd8c" : "#d95f78")
    .attr("opacity", 0.7)
    .on("mousemove", (event, row) => {
      showTooltip(event, row.clothing_type || "Produto", [
        `Preço: ${formatCurrency(row.price_usd)}`,
        `Satisfação: ${d3.format(".2f")(row.satisfaction_score)}`,
        `Comprado: ${row.purchased > 0 ? "sim" : "não"}`
      ]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(550)
    .attr("r", 5);
}

function renderBubbleChart(container, data) {
  const values = d3.rollups(
    data.filter((row) => row.primary_color),
    (rows) => rows.length,
    (row) => row.primary_color
  )
    .map(([colorName, count]) => ({ colorName, count }))
    .sort((a, b) => d3.descending(a.count, b.count))
    .slice(0, 16);

  if (values.length === 0) {
    showChartMessage(container, "Sem dados de cores populares.");
    return;
  }

  const height = 430;
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const color = d3.scaleOrdinal()
    .domain(values.map((row) => row.colorName))
    .range(values.map((row, index) => colorForName(row.colorName, index)));

  const root = d3.hierarchy({ children: values }).sum((row) => row.count);
  d3.pack().size([width - 20, height - 20]).padding(9)(root);

  const group = svg.append("g").attr("transform", "translate(9,9)");

  const bubbles = group.selectAll("g")
    .data(root.leaves())
    .join("g")
    .attr("transform", (row) => `translate(${row.x},${row.y})`);

  bubbles.append("circle")
    .attr("r", 0)
    .attr("fill", (row) => color(row.data.colorName))
    .attr("stroke", "#082522")
    .attr("stroke-width", 3)
    .attr("opacity", 0.92)
    .on("mousemove", (event, row) => {
      showTooltip(event, row.data.colorName, [`Registos: ${formatNumber(row.data.count)}`]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(700)
    .attr("r", (row) => row.r);

  bubbles.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "-0.1em")
    .attr("fill", (row) => needsDarkText(row.data.colorName) ? "#031211" : "#ffffff")
    .attr("font-size", (row) => Math.max(12, Math.min(18, row.r / 3)))
    .attr("font-weight", 800)
    .style("pointer-events", "none")
    .text((row) => row.r > 24 ? row.data.colorName : "");

  bubbles.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "1.15em")
    .attr("fill", (row) => needsDarkText(row.data.colorName) ? "#031211" : "#ffffff")
    .attr("font-size", 13)
    .style("pointer-events", "none")
    .text((row) => row.r > 30 ? formatNumber(row.data.count) : "");
}

function renderLikesByMonthChart(container, data) {
  const values = d3.rollups(
    data.filter((row) => row.month && Number.isFinite(row.likes)),
    (rows) => d3.sum(rows, (row) => row.likes),
    (row) => row.month
  )
    .map(([month, likes]) => ({ month, likes }))
    .sort((a, b) => d3.ascending(a.month, b.month));

  if (values.length === 0) {
    showChartMessage(container, "Sem dados para likes por mês.");
    return;
  }

  const height = 430;
  const margin = { top: 34, right: 36, bottom: 58, left: 82 };
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scalePoint()
    .domain(values.map((row) => row.month))
    .range([0, innerWidth])
    .padding(0.35);

  const y = d3.scaleLinear()
    .domain([0, d3.max(values, (row) => row.likes)])
    .nice()
    .range([innerHeight, 0]);

  const group = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  group.append("g")
    .attr("class", "grid-line")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat((month) => monthNames[month - 1] || month));

  group.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatNumber));

  const line = d3.line()
    .x((row) => x(row.month))
    .y((row) => y(row.likes))
    .curve(d3.curveMonotoneX);

  const path = group.append("path")
    .datum(values)
    .attr("fill", "none")
    .attr("stroke", "#d95f78")
    .attr("stroke-width", 4)
    .attr("d", line);

  const pathLength = path.node().getTotalLength();
  path
    .attr("stroke-dasharray", `${pathLength} ${pathLength}`)
    .attr("stroke-dashoffset", pathLength)
    .transition()
    .duration(800)
    .attr("stroke-dashoffset", 0);

  group.selectAll(".likes-point")
    .data(values)
    .join("circle")
    .attr("class", "likes-point")
    .attr("cx", (row) => x(row.month))
    .attr("cy", (row) => y(row.likes))
    .attr("r", 0)
    .attr("fill", "#d5a642")
    .on("mousemove", (event, row) => {
      showTooltip(event, monthNames[row.month - 1] || `Mês ${row.month}`, [
        `Likes: ${formatNumber(row.likes)}`
      ]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(650)
    .attr("r", 6);
}

function renderEngagementByStyleChart(container, data) {
  const values = d3.rollups(
    data.filter((row) => row.style_preference),
    (rows) => d3.sum(rows, (row) => row.likes + row.shares + row.saves),
    (row) => row.style_preference
  )
    .map(([style, engagement]) => ({ style, engagement }))
    .sort((a, b) => d3.descending(a.engagement, b.engagement))
    .slice(0, 8);

  if (values.length === 0) {
    showChartMessage(container, "Sem dados de engagement por estilo.");
    return;
  }

  const height = 430;
  const margin = { top: 28, right: 70, bottom: 52, left: 138 };
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleLinear()
    .domain([0, d3.max(values, (row) => row.engagement)])
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleBand()
    .domain(values.map((row) => row.style))
    .range([0, innerHeight])
    .padding(0.24);

  const group = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  group.append("g")
    .attr("class", "grid-line")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(""))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(formatNumber));

  group.selectAll("rect")
    .data(values)
    .join("rect")
    .attr("x", 0)
    .attr("y", (row) => y(row.style))
    .attr("width", 0)
    .attr("height", y.bandwidth())
    .attr("rx", 8)
    .attr("fill", "#67bd8c")
    .on("mousemove", (event, row) => {
      showTooltip(event, row.style, [`Engagement: ${formatNumber(row.engagement)}`]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(650)
    .attr("width", (row) => x(row.engagement));

  group.selectAll(".engagement-label")
    .data(values)
    .join("text")
    .attr("class", "engagement-label")
    .attr("x", (row) => x(row.engagement) + 8)
    .attr("y", (row) => y(row.style) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .attr("fill", "#9bc9c1")
    .attr("font-size", 15)
    .text((row) => formatNumber(row.engagement));
}

function renderPurchasesByBudgetChart(container, data) {
  let values = d3.rollups(
    data.filter((row) => row.budget_level),
    (rows) => d3.sum(rows, (row) => row.purchased),
    (row) => row.budget_level
  )
    .map(([budget, purchases]) => ({ budget, purchases }))
    .filter((row) => row.purchases > 0)
    .sort((a, b) => d3.descending(a.purchases, b.purchases));

  if (values.length === 0) {
    values = d3.rollups(
      data.filter((row) => row.budget_level),
      (rows) => rows.length,
      (row) => row.budget_level
    )
      .map(([budget, purchases]) => ({ budget, purchases }))
      .sort((a, b) => d3.descending(a.purchases, b.purchases));
  }

  if (values.length === 0) {
    showChartMessage(container, "Sem dados de compras por orçamento.");
    return;
  }

  const height = 430;
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const radius = Math.min(width * 0.42, height * 0.42);
  const centerX = width * 0.43;
  const centerY = height / 2;
  const color = d3.scaleOrdinal()
    .domain(values.map((row) => row.budget))
    .range(["#4fb7c9", "#d5a642", "#d95f78", "#67bd8c", "#8176b8"]);

  const pie = d3.pie()
    .value((row) => row.purchases)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(radius * 0.58)
    .outerRadius(radius);

  const group = svg.append("g").attr("transform", `translate(${centerX},${centerY})`);

  group.selectAll("path")
    .data(pie(values))
    .join("path")
    .attr("fill", (row) => color(row.data.budget))
    .attr("stroke", "#082522")
    .attr("stroke-width", 3)
    .on("mousemove", (event, row) => {
      showTooltip(event, row.data.budget, [`Compras: ${formatNumber(row.data.purchases)}`]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(700)
    .attrTween("d", function animateArc(row) {
      const interpolation = d3.interpolate({ startAngle: 0, endAngle: 0 }, row);
      return (time) => arc(interpolation(time));
    });

  group.append("text")
    .attr("text-anchor", "middle")
    .attr("y", -4)
    .attr("fill", "#e8fff9")
    .attr("font-size", 34)
    .attr("font-weight", 900)
    .text(formatNumber(d3.sum(values, (row) => row.purchases)));

  group.append("text")
    .attr("text-anchor", "middle")
    .attr("y", 24)
    .attr("fill", "#9bc9c1")
    .attr("font-size", 15)
    .text("compras");

  const legend = svg.append("g")
    .attr("transform", `translate(${Math.min(width - 180, centerX + radius + 30)},${Math.max(36, centerY - values.length * 14)})`);

  const legendItems = legend.selectAll("g")
    .data(values)
    .join("g")
    .attr("transform", (row, index) => `translate(0,${index * 30})`);

  legendItems.append("rect")
    .attr("width", 14)
    .attr("height", 14)
    .attr("rx", 4)
    .attr("fill", (row) => color(row.budget));

  legendItems.append("text")
    .attr("x", 22)
    .attr("y", 12)
    .attr("fill", "#9bc9c1")
    .attr("font-size", 15)
    .text((row) => `${row.budget} (${formatNumber(row.purchases)})`);
}

function renderAveragePriceByBrandChart(container, data) {
  const values = d3.rollups(
    data.filter((row) => row.preferred_brand && row.price_usd > 0),
    (rows) => ({
      averagePrice: d3.mean(rows, (row) => row.price_usd),
      count: rows.length
    }),
    (row) => row.preferred_brand
  )
    .map(([brand, result]) => ({ brand, averagePrice: result.averagePrice, count: result.count }))
    .filter((row) => Number.isFinite(row.averagePrice))
    .sort((a, b) => d3.descending(a.averagePrice, b.averagePrice))
    .slice(0, 8);

  if (values.length === 0) {
    showChartMessage(container, "Sem dados de preço médio por marca.");
    return;
  }

  const height = 430;
  const margin = { top: 28, right: 84, bottom: 52, left: 138 };
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleLinear()
    .domain([0, d3.max(values, (row) => row.averagePrice)])
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleBand()
    .domain(values.map((row) => row.brand))
    .range([0, innerHeight])
    .padding(0.24);

  const group = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  group.append("g")
    .attr("class", "grid-line")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(""))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((value) => `$${value}`));

  group.selectAll("rect")
    .data(values)
    .join("rect")
    .attr("x", 0)
    .attr("y", (row) => y(row.brand))
    .attr("width", 0)
    .attr("height", y.bandwidth())
    .attr("rx", 8)
    .attr("fill", "#d5a642")
    .on("mousemove", (event, row) => {
      showTooltip(event, row.brand, [
        `Preço médio: ${formatCurrency(row.averagePrice)}`,
        `Registos: ${formatNumber(row.count)}`
      ]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(650)
    .attr("width", (row) => x(row.averagePrice));

  group.selectAll(".price-label")
    .data(values)
    .join("text")
    .attr("class", "price-label")
    .attr("x", (row) => x(row.averagePrice) + 8)
    .attr("y", (row) => y(row.brand) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .attr("fill", "#9bc9c1")
    .attr("font-size", 15)
    .text((row) => formatCurrency(row.averagePrice));
}

function renderExperienceScoresChart(container, data) {
  const values = [
    { label: "Satisfação", key: "satisfaction_score", color: "#4fb7c9" },
    { label: "Conforto", key: "comfort_score", color: "#67bd8c" },
    { label: "Qualidade", key: "quality_score", color: "#d5a642" },
    { label: "Fit", key: "fit_score", color: "#d95f78" },
    { label: "Sustent.", key: "sustainability_score", color: "#8176b8" }
  ].map((item) => ({
    ...item,
    score: d3.mean(data, (row) => row[item.key])
  }));

  if (values.some((row) => !Number.isFinite(row.score))) {
    showChartMessage(container, "Sem dados suficientes para scores de experiência.");
    return;
  }

  const height = 430;
  const margin = { top: 30, right: 32, bottom: 92, left: 74 };
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleBand()
    .domain(values.map((row) => row.label))
    .range([0, innerWidth])
    .padding(0.26);

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([innerHeight, 0]);

  const group = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  group.append("g")
    .attr("class", "grid-line")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .call((selection) => {
      selection.selectAll("text")
        .attr("transform", "rotate(-24)")
        .attr("text-anchor", "end")
        .attr("dx", "-0.45em")
        .attr("dy", "0.45em");
    });

  group.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatPercent));

  group.selectAll("rect")
    .data(values)
    .join("rect")
    .attr("x", (row) => x(row.label))
    .attr("y", innerHeight)
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("rx", 9)
    .attr("fill", (row) => row.color)
    .on("mousemove", (event, row) => {
      showTooltip(event, row.label, [`Score médio: ${formatPercent(row.score)}`]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(650)
    .attr("y", (row) => y(row.score))
    .attr("height", (row) => innerHeight - y(row.score));

  group.selectAll(".score-label")
    .data(values)
    .join("text")
    .attr("class", "score-label")
    .attr("x", (row) => x(row.label) + x.bandwidth() / 2)
    .attr("y", (row) => y(row.score) - 10)
    .attr("text-anchor", "middle")
    .attr("fill", "#e8fff9")
    .attr("font-size", 15)
    .attr("font-weight", 900)
    .text((row) => formatPercent(row.score));
}

function renderSustainabilityByFabricChart(container, data) {
  const values = d3.rollups(
    data.filter((row) => row.fabric),
    (rows) => ({
      score: d3.mean(rows, (row) => row.sustainability_score),
      count: rows.length
    }),
    (row) => row.fabric
  )
    .map(([fabric, result]) => ({ fabric, score: result.score, count: result.count }))
    .filter((row) => Number.isFinite(row.score))
    .sort((a, b) => d3.descending(a.score, b.score))
    .slice(0, 8);

  if (values.length === 0) {
    showChartMessage(container, "Sem dados de sustentabilidade por tecido.");
    return;
  }

  const height = 430;
  const margin = { top: 28, right: 78, bottom: 52, left: 138 };
  const svg = createSvg(container, height);
  const width = Number(svg.attr("viewBox").split(" ")[2]);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleLinear()
    .domain([0, 1])
    .range([0, innerWidth]);

  const y = d3.scaleBand()
    .domain(values.map((row) => row.fabric))
    .range([0, innerHeight])
    .padding(0.24);

  const group = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  group.append("g")
    .attr("class", "grid-line")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(""))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0))
    .call((selection) => selection.select(".domain").remove());

  group.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(formatPercent));

  group.selectAll("rect")
    .data(values)
    .join("rect")
    .attr("x", 0)
    .attr("y", (row) => y(row.fabric))
    .attr("width", 0)
    .attr("height", y.bandwidth())
    .attr("rx", 8)
    .attr("fill", "#67bd8c")
    .on("mousemove", (event, row) => {
      showTooltip(event, row.fabric, [
        `Sustentabilidade: ${formatPercent(row.score)}`,
        `Registos: ${formatNumber(row.count)}`
      ]);
    })
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(650)
    .attr("width", (row) => x(row.score));

  group.selectAll(".sustainability-label")
    .data(values)
    .join("text")
    .attr("class", "sustainability-label")
    .attr("x", (row) => x(row.score) + 8)
    .attr("y", (row) => y(row.fabric) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .attr("fill", "#9bc9c1")
    .attr("font-size", 15)
    .text((row) => formatPercent(row.score));
}

function colorForName(name, index) {
  const normalized = String(name).toLowerCase();
  const namedColors = {
    black: "#111615",
    white: "#f7f7f2",
    gray: "#7d908b",
    grey: "#7d908b",
    navy: "#07506f",
    blue: "#4fb7c9",
    green: "#67bd8c",
    red: "#d95f78",
    pink: "#d97c90",
    purple: "#8176b8",
    yellow: "#d5a642",
    orange: "#d08a4b",
    brown: "#8c6a4d",
    beige: "#d8c7a4",
    cream: "#efe4c8",
    tan: "#c8a97e",
    silver: "#b8c1c8",
    gold: "#c89f3d"
  };

  return namedColors[normalized] || d3.schemeTableau10[index % d3.schemeTableau10.length];
}

function needsDarkText(name) {
  const normalized = String(name).toLowerCase();
  return ["white", "yellow", "cream", "beige", "tan", "silver"].includes(normalized);
}
