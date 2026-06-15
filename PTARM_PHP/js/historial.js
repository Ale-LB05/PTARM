setupLayout("historial");

let historyAction = "CREAR";
let historyItems = [];
let historyRawItems = [];
let historyPage = 1;
let historyAdvancedFilters = [];
let statsData = null;

const historyRows = document.getElementById("historyRows");
const historyTools = document.getElementById("historyTools");
const historySearch = document.getElementById("historySearch");
const historyPersonLabel = document.getElementById("historyPersonLabel");
const historyPageSize = document.getElementById("historyPageSize");
const historyPrevPage = document.getElementById("historyPrevPage");
const historyNextPage = document.getElementById("historyNextPage");
const historyPageInfo = document.getElementById("historyPageInfo");
const historyAdvancedSearchBtn = document.getElementById("historyAdvancedSearchBtn");
const historyAdvancedSearchForm = document.getElementById("historyAdvancedSearchForm");
const historyAdvancedSearchField = document.getElementById("historyAdvancedSearchField");
const historyAdvancedSearchValue = document.getElementById("historyAdvancedSearchValue");
const historyAdvancedSearchOptions = document.getElementById("historyAdvancedSearchOptions");
const historyAdvancedSearchSummary = document.getElementById("historyAdvancedSearchSummary");
const historyAdvancedFilterList = document.getElementById("historyAdvancedFilterList");
const addHistoryAdvancedFilterBtn = document.getElementById("addHistoryAdvancedFilterBtn");
const clearHistoryAdvancedSearchBtn = document.getElementById("clearHistoryAdvancedSearchBtn");
const historyTableControls = document.getElementById("historyTableControls");
const historyTableWrap = document.getElementById("historyTableWrap");
const statsPanel = document.getElementById("statsPanel");
const statsMonth = document.getElementById("statsMonth");
const statsYear = document.getElementById("statsYear");
const statsView = document.getElementById("statsView");
const refreshStatsBtn = document.getElementById("refreshStatsBtn");
const openStatsExportModalBtn = document.getElementById("openStatsExportModalBtn");
const exportStatsExcelBtn = document.getElementById("exportStatsExcelBtn");
const exportStatsPdfBtn = document.getElementById("exportStatsPdfBtn");
const statsExportStartMonth = document.getElementById("statsExportStartMonth");
const statsExportStartYear = document.getElementById("statsExportStartYear");
const statsExportEndMonth = document.getElementById("statsExportEndMonth");
const statsExportEndYear = document.getElementById("statsExportEndYear");
const statsExportBars = document.getElementById("statsExportBars");
const statsExportPie = document.getElementById("statsExportPie");
const statsExportTable = document.getElementById("statsExportTable");
const statsExportRangeCount = document.getElementById("statsExportRangeCount");
const statsCards = document.getElementById("statsCards");
const statsChart = document.getElementById("statsChart");
const statsChartTitle = document.getElementById("statsChartTitle");
const statsSummaryText = document.getElementById("statsSummaryText");
const statsUsers = document.getElementById("statsUsers");
const statsRows = document.getElementById("statsRows");
const statsDetailModal = document.getElementById("statsDetailModal");
const statsDetailTitle = document.getElementById("statsDetailTitle");
const statsDetailSummary = document.getElementById("statsDetailSummary");
const statsDetailRows = document.getElementById("statsDetailRows");

const statsColors = ["#2563eb", "#0f766e", "#7c3aed", "#b7791f", "#dc2626", "#1499d3"];

/** Cierra cualquier modal del historial por su id. */
function closeModal(id) {
  document.getElementById(id)?.classList.remove("show");
}

/** Carga el historial filtrando por accion, texto o fecha seleccionada. */
async function loadHistory() {
  if (historyAction === "ESTADISTICAS") return loadStats();
  const params = new URLSearchParams({ accion: historyAction });
  const query = historySearch.value.trim();
  if (query) params.set("q", query);

  const data = await api(`/api/historial?${params.toString()}`);
  if (!data?.success) {
    historyRawItems = [];
    historyItems = [];
    historyRows.innerHTML = `<tr><td colspan="6">${escapeHtml(data?.error || "No se pudo cargar el historial.")}</td></tr>`;
    renderHistoryPageControls();
    return;
  }
  historyRawItems = Array.isArray(data.data) ? data.data : [];
  historyItems = hasHistoryAdvancedSearch() ? filterHistoryAdvanced(historyRawItems) : historyRawItems;
  historyPage = 1;
  renderHistoryAdvancedOptions(historyAdvancedSearchField.value);
  renderHistory();
}

/** Carga resumen mensual de actividad del sistema. */
async function loadStats() {
  const params = new URLSearchParams({ mes: statsMonth.value, anio: statsYear.value });
  const data = await api(`/api/historial/estadisticas?${params.toString()}`);
  if (!data?.success) {
    showToast(data?.error || "No se pudieron cargar las estadisticas", "error");
    return;
  }
  statsData = data.data;
  renderStats();
}

/** Muestra u oculta las zonas de historial segun la pestana activa. */
function applyHistoryMode() {
  const statsMode = historyAction === "ESTADISTICAS";
  historyTools.hidden = statsMode;
  historyAdvancedSearchSummary.hidden = statsMode || !hasHistoryAdvancedSearch();
  historyTableControls.hidden = statsMode;
  historyTableWrap.hidden = statsMode;
  statsPanel.hidden = !statsMode;
  historyTools.style.display = statsMode ? "none" : "";
  historyTableControls.style.display = statsMode ? "none" : "";
  historyTableWrap.style.display = statsMode ? "none" : "";
  if (statsMode) historyAdvancedSearchSummary.style.display = "none";
  else historyAdvancedSearchSummary.style.display = "";
}

/** Indica si hay filtros avanzados activos en historial. */
function hasHistoryAdvancedSearch() {
  return historyAdvancedFilters.length > 0;
}

/** Abre el modal de busqueda avanzada del historial. */
function openHistoryAdvancedSearch() {
  historyAdvancedSearchField.value = "";
  historyAdvancedSearchValue.value = "";
  syncHistoryAdvancedInput();
  renderHistoryAdvancedFilterList();
  document.getElementById("historyAdvancedSearchModal").classList.add("show");
  historyAdvancedSearchField.focus();
}

/** Ajusta tipo de input segun apartado. */
function syncHistoryAdvancedInput() {
  const field = historyAdvancedSearchField.value;
  historyAdvancedSearchValue.type = field === "fecha" ? "date" : field === "hora" ? "time" : "text";
  historyAdvancedSearchValue.placeholder = field === "fecha" ? "Selecciona una fecha" : field === "hora" ? "Selecciona una hora" : "Escribe el dato...";
  historyAdvancedSearchValue.toggleAttribute("list", !["fecha", "hora"].includes(field));
  if (!["fecha", "hora"].includes(field)) historyAdvancedSearchValue.setAttribute("list", "historyAdvancedSearchOptions");
  renderHistoryAdvancedOptions(field);
}

/** Muestra sugerencias conocidas para el apartado elegido sin impedir escritura manual. */
function renderHistoryAdvancedOptions(field) {
  const rows = historyRawItems.length ? historyRawItems : historyItems;
  const values = {
    folio: rows.map((item) => item.folio || extractFolio(item.descripcion)),
    usuario: rows.map((item) => item.usuario_nombre),
    mp: rows.map((item) => item.mp_nombre),
    encargado: rows.map((item) => item.encargado_nombre),
    descripcion: rows.map((item) => item.descripcion),
  };
  historyAdvancedSearchOptions.innerHTML = uniqueHistoryOptions(values[field] || []).map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
}

function uniqueHistoryOptions(values) {
  const seen = new Set();
  return values.filter((value) => {
    const clean = String(value || "").trim();
    const key = clean.toLowerCase();
    if (!clean || clean === "Sin MP" || clean === "Sin asignar" || clean === "Usuario no disponible" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Agrega un filtro y deja listo el formulario para otro. */
function addHistoryAdvancedFilter(options = {}) {
  const field = historyAdvancedSearchField.value;
  const value = historyAdvancedSearchValue.value.trim();
  if (!field || !value) {
    if (!options.silent) showToast("Selecciona un apartado y escribe un dato", "error");
    return false;
  }
  historyAdvancedFilters.push({ field, value });
  historyAdvancedSearchField.value = "";
  historyAdvancedSearchValue.value = "";
  syncHistoryAdvancedInput();
  renderHistoryAdvancedFilterList();
  updateHistoryAdvancedSummary();
  historyAdvancedSearchField.focus();
  return true;
}

/** Aplica los filtros avanzados sobre el historial visible. */
function applyHistoryAdvancedSearch(event) {
  event.preventDefault();
  addHistoryAdvancedFilter({ silent: true });
  if (!hasHistoryAdvancedSearch()) {
    showToast("Agrega al menos un filtro", "error");
    return;
  }
  historySearch.value = "";
  historyItems = filterHistoryAdvanced(historyRawItems);
  historyPage = 1;
  closeModal("historyAdvancedSearchModal");
  updateHistoryAdvancedSummary();
  renderHistory();
}

/** Limpia la busqueda avanzada y recarga historial. */
function clearHistoryAdvancedSearch() {
  historyAdvancedFilters = [];
  historyAdvancedSearchField.value = "";
  historyAdvancedSearchValue.value = "";
  syncHistoryAdvancedInput();
  renderHistoryAdvancedFilterList();
  updateHistoryAdvancedSummary();
  closeModal("historyAdvancedSearchModal");
  loadHistory();
}

/** Elimina un filtro de historial. */
function removeHistoryAdvancedFilter(index) {
  historyAdvancedFilters.splice(index, 1);
  renderHistoryAdvancedFilterList();
  updateHistoryAdvancedSummary();
}

/** Pinta chips de filtros dentro del modal. */
function renderHistoryAdvancedFilterList() {
  historyAdvancedFilterList.hidden = historyAdvancedFilters.length === 0;
  historyAdvancedFilterList.innerHTML = historyAdvancedFilters.map((filter, index) => `
    <span class="advanced-filter-chip">
      <i class="fas fa-filter"></i>
      ${escapeHtml(historyAdvancedFilterLabel(filter.field))}: <strong>${escapeHtml(filter.value)}</strong>
      <button type="button" onclick="removeHistoryAdvancedFilter(${index})" title="Quitar filtro">
        <i class="fas fa-times"></i>
      </button>
    </span>
  `).join("");
}

/** Actualiza etiqueta compacta de filtros activos. */
function updateHistoryAdvancedSummary() {
  if (!hasHistoryAdvancedSearch()) {
    historyAdvancedSearchSummary.hidden = true;
    historyAdvancedSearchSummary.innerHTML = "";
    historyAdvancedSearchBtn.classList.remove("active");
    return;
  }
  historyAdvancedSearchSummary.hidden = false;
  historyAdvancedSearchSummary.innerHTML = `
    <span><i class="fas fa-filter"></i> ${historyAdvancedFilters.length} filtro${historyAdvancedFilters.length === 1 ? "" : "s"} activo${historyAdvancedFilters.length === 1 ? "" : "s"}</span>
    <button type="button" onclick="clearHistoryAdvancedSearch()" title="Limpiar busqueda avanzada">
      <i class="fas fa-times"></i>
    </button>
  `;
  historyAdvancedSearchBtn.classList.add("active");
}

/** Filtra actividades cumpliendo todos los filtros. */
function filterHistoryAdvanced(rows) {
  return rows.filter((item) => historyAdvancedFilters.every((filter) => matchesHistoryFilter(item, filter)));
}

/** Compara un movimiento contra un filtro. */
function matchesHistoryFilter(item, filter) {
  const value = historyAdvancedValue(item, filter.field);
  if (filter.field === "fecha") return formatInputDate(item.fecha) === filter.value;
  if (filter.field === "hora") return formatInputTime(item.fecha) === filter.value;
  return normalizeHistorySearch(value).includes(normalizeHistorySearch(filter.value));
}

/** Obtiene el valor buscable segun apartado. */
function historyAdvancedValue(item, field) {
  const date = new Date(item.fecha);
  const values = {
    folio: item.folio || extractFolio(item.descripcion),
    usuario: item.usuario_nombre,
    fecha: formatDisplayDate(date),
    hora: formatTime(date),
    mp: item.mp_nombre,
    encargado: item.encargado_nombre,
    descripcion: item.descripcion,
  };
  return values[field] || "";
}

function historyAdvancedFilterLabel(field) {
  return historyAdvancedSearchField.querySelector(`option[value="${field}"]`)?.textContent || "Apartado";
}

function formatInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatInputTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toTimeString().slice(0, 5);
}

function normalizeHistorySearch(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Pinta la tabla del historial y ajusta los encabezados segun la accion. */
function renderHistory() {
  historyPersonLabel.textContent =
    historyAction === "CREAR" ? "Creador" : historyAction === "EDITAR" ? "Editor" : historyAction === "EXPORTAR" ? "Usuario" : "Eliminado por";

  const visible = pagedHistory();

  historyRows.innerHTML =
    visible
      .map((item) => {
        const date = new Date(item.fecha);
        return `
          <tr>
            <td class="muted-cell">${item.folio || extractFolio(item.descripcion) || "Sin folio"}</td>
            <td><span class="history-person"><img class="avatar-mini" src="${item.usuario_foto || "/img/usuario.png"}" alt="" /> ${item.usuario_nombre || "Usuario no disponible"}</span></td>
            <td><span class="time-pill">${formatTime(date)}</span></td>
            <td class="muted-cell">${formatDisplayDate(date)}</td>
            <td>${renderMp(item)}</td>
            <td>${renderEncargado(item)}</td>
          </tr>
        `;
      })
      .join("") || `<tr><td colspan="6">No hay actividades registradas para este filtro.</td></tr>`;
  renderHistoryPageControls();
}

/** Muestra el MP de forma distinta cuando el registro es de exportacion. */
function renderMp(item) {
  if (historyAction === "EXPORTAR") return item.descripcion || "Exportacion";
  return `<span class="history-mp"><i class="fas fa-user-shield"></i> ${item.mp_nombre || "Sin MP"}</span>`;
}

/** Muestra el encargado o "No aplica" cuando el historial es de exportacion. */
function renderEncargado(item) {
  if (historyAction === "EXPORTAR") return "No aplica";
  return `<span class="history-assignee"><img class="avatar-mini" src="${item.encargado_foto || "/img/usuario.png"}" alt="" /> ${item.encargado_nombre || "Sin asignar"}</span>`;
}

/** Devuelve los registros visibles segun la pagina actual. */
function pagedHistory() {
  const pageSize = Number(historyPageSize.value || 5);
  const totalPages = Math.max(1, Math.ceil(historyItems.length / pageSize));
  historyPage = Math.min(Math.max(historyPage, 1), totalPages);
  const start = (historyPage - 1) * pageSize;
  return historyItems.slice(start, start + pageSize);
}

/** Actualiza los controles de paginacion del historial. */
function renderHistoryPageControls() {
  const pageSize = Number(historyPageSize.value || 5);
  const totalPages = Math.max(1, Math.ceil(historyItems.length / pageSize));
  historyPageInfo.textContent = `Página ${historyPage} de ${totalPages}`;
  historyPrevPage.disabled = historyPage <= 1;
  historyNextPage.disabled = historyPage >= totalPages;
}

/** Pinta tarjetas, grafica y tabla de estadisticas. */
function renderStats() {
  if (!statsData) return;
  const events = statsData.eventos || [];
  const main = statsData.actividad_principal;
  statsCards.innerHTML = `
    <div class="stats-card"><span>Total del mes</span><strong>${statsData.total || 0}</strong></div>
    <div class="stats-card"><span>Partes creados</span><strong>${statTotal("CREACION_PARTE")}</strong></div>
    <div class="stats-card"><span>Inicios de sesión</span><strong>${statTotal("LOGIN")}</strong></div>
    <div class="stats-card"><span>Actividad principal</span><strong>${main ? escapeHtml(main.etiqueta) : "Sin datos"}</strong></div>
  `;
  statsSummaryText.textContent = statsData.total
    ? `Este mes tiene ${statsData.total} actividad(es) registradas. ${main ? `${main.etiqueta} representa ${main.porcentaje}%.` : ""}`
    : "Todavía no hay actividad registrada en este mes.";
  statsRows.innerHTML = events.length
    ? events.map((event) => statsTableRow(event)).join("")
    : `<tr><td colspan="4">Sin datos para este periodo.</td></tr>`;
  statsUsers.innerHTML = statsData.usuarios?.length
    ? statsData.usuarios.map((user) => `<div class="stats-user-item"><span>${escapeHtml(user.nombre)}</span><strong>${user.total}</strong></div>`).join("")
    : `<div class="stats-user-item"><span>Sin usuarios con actividad</span><strong>0</strong></div>`;

  if (statsView.value === "pie") renderStatsPie(events);
  else if (statsView.value === "table") renderStatsTableOnly(events);
  else renderStatsBars(events);
}

function statTotal(type) {
  return statsData?.eventos?.find((event) => event.tipo === type)?.total || 0;
}

function renderStatsBars(events) {
  statsChartTitle.textContent = "Actividad mensual";
  const max = Math.max(...events.map((event) => event.total), 1);
  statsChart.innerHTML = events.length
    ? `<div class="stats-bars">${events.map((event, index) => `
        <div class="stats-bar-row">
          <strong>${escapeHtml(event.etiqueta)}</strong>
          <div class="stats-bar-track">
            <div class="stats-bar-fill" style="width:${Math.max(4, (event.total / max) * 100)}%; background:${statsColors[index % statsColors.length]}"></div>
          </div>
          <span>${event.total} (${event.porcentaje}%)</span>
        </div>
      `).join("")}</div>`
    : `<p class="empty-state">Sin datos para graficar.</p>`;
}

function renderStatsPie(events) {
  statsChartTitle.textContent = "Distribución por actividad";
  let current = 0;
  const slices = events.map((event, index) => {
    const start = current;
    current += event.porcentaje;
    return `${statsColors[index % statsColors.length]} ${start}% ${current}%`;
  });
  statsChart.innerHTML = events.length
    ? `<div class="stats-pie-view">
        <div class="stats-pie" style="--pie-gradient: conic-gradient(${slices.join(", ")})"></div>
        <div class="stats-legend">
          ${events.map((event, index) => `
            <div class="stats-legend-item">
              <span class="stats-legend-label"><i class="stats-dot" style="--dot-color:${statsColors[index % statsColors.length]}"></i>${escapeHtml(event.etiqueta)}</span>
              <strong>${event.porcentaje}%</strong>
            </div>
          `).join("")}
        </div>
      </div>`
    : `<p class="empty-state">Sin datos para graficar.</p>`;
}

function renderStatsTableOnly(events) {
  statsChartTitle.textContent = "Tabla de actividad";
  statsChart.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Actividad</th><th>Total</th><th>Porcentaje</th><th>Datos</th></tr></thead>
        <tbody>${events.length ? events.map((event) => statsTableRow(event)).join("") : `<tr><td colspan="4">Sin datos para este periodo.</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function statsTableRow(event) {
  return `<tr>
    <td>${escapeHtml(event.etiqueta)}</td>
    <td>${event.total}</td>
    <td>${event.porcentaje}%</td>
    <td>
      <button class="btn blue outline icon-text" type="button" onclick="openStatsDetail('${escapeHtml(event.tipo)}')">
        <i class="fas fa-eye"></i> Ver datos
      </button>
    </td>
  </tr>`;
}

async function openStatsDetail(type) {
  const detail = await fetchStatsDetail(type);
  if (!detail) return;

  statsDetailTitle.textContent = `${detail.etiqueta} - ${statsMonthName(detail.mes)} ${detail.anio}`;
  statsDetailSummary.innerHTML = `
    <div class="stats-detail-card"><span>Total registrado</span><strong>${detail.total}</strong></div>
    <div class="stats-detail-card"><span>Usuarios relacionados</span><strong>${detail.usuarios.length}</strong></div>
    <div class="stats-detail-card"><span>Periodo</span><strong>${statsMonthName(detail.mes)} ${detail.anio}</strong></div>
  `;

  const userSummary = detail.usuarios.length
    ? `<tr><td colspan="4"><strong>Resumen por usuario:</strong> ${detail.usuarios.map((user) => `${escapeHtml(user.nombre)}: ${user.total}`).join(" | ")}</td></tr>`
    : "";
  const records = detail.registros.length
    ? detail.registros.map((row) => `<tr>
        <td>${formatStatsDateTime(row.fecha)}</td>
        <td>${escapeHtml(row.usuario)}${row.correo ? `<br><span class="muted-cell">${escapeHtml(row.correo)}</span>` : ""}</td>
        <td>${escapeHtml(row.folio || "No aplica")}</td>
        <td>${escapeHtml(row.detalle || "Sin detalle")}</td>
      </tr>`).join("")
    : `<tr><td colspan="4">Sin datos registrados para este periodo.</td></tr>`;
  statsDetailRows.innerHTML = `${userSummary}${records}`;
  statsDetailModal.classList.add("show");
}

function closeStatsDetailModal() {
  statsDetailModal.classList.remove("show");
}

async function fetchStatsDetail(type, month = statsMonth.value, year = statsYear.value) {
  const params = new URLSearchParams({ tipo: type, mes: month, anio: year });
  const data = await api(`/api/historial/estadisticas/detalle?${params.toString()}`);
  if (!data?.success) {
    showToast(data?.error || "No se pudo cargar el detalle de la estadistica", "error");
    return null;
  }
  return data.data;
}

async function ensureStatsLoaded() {
  if (statsData) return true;
  await loadStats();
  return Boolean(statsData);
}

function openStatsExportModal() {
  statsExportStartMonth.value = statsMonth.value;
  statsExportEndMonth.value = statsMonth.value;
  statsExportStartYear.value = statsYear.value;
  statsExportEndYear.value = statsYear.value;
  statsExportBars.checked = true;
  statsExportPie.checked = true;
  statsExportTable.checked = true;
  updateStatsExportRangeCount();
  document.getElementById("statsExportModal").classList.add("show");
}

function statsExportPeriods() {
  const startMonth = Number(statsExportStartMonth.value);
  const startYear = Number(statsExportStartYear.value);
  const endMonth = Number(statsExportEndMonth.value);
  const endYear = Number(statsExportEndYear.value);
  const start = startYear * 12 + startMonth;
  const end = endYear * 12 + endMonth;
  if (!startMonth || !startYear || !endMonth || !endYear || start > end) return [];
  const periods = [];
  for (let cursor = start; cursor <= end; cursor += 1) {
    const year = Math.floor((cursor - 1) / 12);
    const month = ((cursor - 1) % 12) + 1;
    periods.push({ month, year });
  }
  return periods;
}

function statsExportOptions() {
  return {
    bars: statsExportBars.checked,
    pie: statsExportPie.checked,
    table: statsExportTable.checked,
  };
}

function updateStatsExportRangeCount() {
  const periods = statsExportPeriods();
  statsExportRangeCount.textContent = periods.length ? `${periods.length} mes${periods.length === 1 ? "" : "es"}` : "Rango invalido";
}

async function fetchStatsMonth(month, year) {
  const params = new URLSearchParams({ mes: month, anio: year });
  const data = await api(`/api/historial/estadisticas?${params.toString()}`);
  if (!data?.success) {
    showToast(data?.error || "No se pudieron cargar las estadisticas", "error");
    return null;
  }
  return data.data;
}

async function buildStatsExportData() {
  const periods = statsExportPeriods();
  const options = statsExportOptions();
  if (!periods.length) {
    showToast("Selecciona un rango valido para exportar", "error");
    return null;
  }
  if (periods.length > 120) {
    showToast("El rango maximo para exportar es de 120 meses", "error");
    return null;
  }
  if (!options.bars && !options.pie && !options.table) {
    showToast("Selecciona al menos una grafica para exportar", "error");
    return null;
  }

  const months = [];
  const detailsByType = new Map();
  for (const period of periods) {
    const monthData = await fetchStatsMonth(period.month, period.year);
    if (!monthData) return null;
    months.push(monthData);
    for (const event of monthData.eventos || []) {
      const detail = await fetchStatsDetail(event.tipo, period.month, period.year);
      if (!detail) continue;
      const current = detailsByType.get(event.tipo) || {
        tipo: event.tipo,
        etiqueta: detail.etiqueta,
        total: 0,
        usuarios: new Map(),
        registros: [],
      };
      current.total += detail.total;
      detail.usuarios.forEach((user) => current.usuarios.set(user.nombre, (current.usuarios.get(user.nombre) || 0) + user.total));
      current.registros.push(...detail.registros);
      detailsByType.set(event.tipo, current);
    }
  }

  return {
    months,
    periods,
    options,
    summary: aggregateStatsMonths(months),
    details: [...detailsByType.values()].map((detail) => ({
      ...detail,
      usuarios: [...detail.usuarios.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total),
      registros: detail.registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    })),
  };
}

function aggregateStatsMonths(months) {
  const eventsByType = new Map();
  const usersByName = new Map();
  months.forEach((monthData) => {
    (monthData.eventos || []).forEach((event) => {
      const current = eventsByType.get(event.tipo) || { tipo: event.tipo, etiqueta: event.etiqueta, total: 0 };
      current.total += Number(event.total || 0);
      eventsByType.set(event.tipo, current);
    });
    (monthData.usuarios || []).forEach((user) => usersByName.set(user.nombre, (usersByName.get(user.nombre) || 0) + Number(user.total || 0)));
  });
  const total = [...eventsByType.values()].reduce((sum, event) => sum + event.total, 0);
  const eventos = [...eventsByType.values()]
    .sort((a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta))
    .map((event) => ({
      ...event,
      porcentaje: total ? Number(((event.total / total) * 100).toFixed(1)) : 0,
    }));
  return {
    total,
    eventos,
    usuarios: [...usersByName.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total).slice(0, 10),
    actividad_principal: eventos[0] || null,
  };
}

async function exportStatsExcel() {
  const exportData = await buildStatsExportData();
  if (!exportData) return;
  downloadStatsBlob(statsReportHtml(exportData, "excel"), statsExportFilename(exportData, "xls"), "application/vnd.ms-excel;charset=utf-8");
  closeModal("statsExportModal");
}

async function exportStatsPdf() {
  const exportData = await buildStatsExportData();
  if (!exportData) return;
  const reportWindow = window.open("", "_blank");
  const html = statsReportHtml(exportData, "pdf");
  if (!reportWindow) {
    downloadStatsBlob(html, statsExportFilename(exportData, "html"), "text/html;charset=utf-8");
    showToast("Se descargo el reporte en HTML porque el navegador bloqueo la ventana de PDF.", "info");
    return;
  }
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  closeModal("statsExportModal");
  setTimeout(() => reportWindow.print(), 300);
}

function statsReportHtml(exportData, mode) {
  const { summary, details, options } = exportData;
  const events = summary.eventos || [];
  const users = summary.usuarios || [];
  const title = `Estadisticas - ${statsExportPeriodLabel(exportData)}`;
  const max = Math.max(...events.map((event) => event.total), 1);
  const pieRows = events.map((event, index) => `
    <tr>
      <td><span class="dot" style="background:${statsColors[index % statsColors.length]}"></span>${escapeHtml(event.etiqueta)}</td>
      <td>${event.total}</td>
      <td>${event.porcentaje}%</td>
    </tr>
  `).join("");
  const detailSections = details.map((detail) => `
    <h2>${escapeHtml(detail.etiqueta)}</h2>
    <p>Total: ${detail.total}. Usuarios relacionados: ${detail.usuarios.length}.</p>
    <table>
      <thead><tr><th>Usuario</th><th>Total</th></tr></thead>
      <tbody>${detail.usuarios.length ? detail.usuarios.map((user) => `<tr><td>${escapeHtml(user.nombre)}</td><td>${user.total}</td></tr>`).join("") : `<tr><td colspan="2">Sin usuarios registrados.</td></tr>`}</tbody>
    </table>
    <table>
      <thead><tr><th>Fecha</th><th>Usuario</th><th>Correo</th><th>Folio</th><th>Detalle</th></tr></thead>
      <tbody>${detail.registros.length ? detail.registros.map((row) => `<tr><td>${formatStatsDateTime(row.fecha)}</td><td>${escapeHtml(row.usuario)}</td><td>${escapeHtml(row.correo || "")}</td><td>${escapeHtml(row.folio || "No aplica")}</td><td>${escapeHtml(row.detalle || "Sin detalle")}</td></tr>`).join("") : `<tr><td colspan="5">Sin registros.</td></tr>`}</tbody>
    </table>
  `).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; }
    h1 { margin: 0 0 8px; color: #0b2d55; }
    h2 { margin: 26px 0 10px; color: #0b2d55; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
    .card { border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; }
    .card span { display: block; color: #475569; font-size: 12px; font-weight: bold; }
    .card strong { display: block; margin-top: 6px; font-size: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; }
    th, td { border: 1px solid #cbd5e1; padding: 9px; text-align: left; vertical-align: top; }
    th { background: #0b2d55; color: #ffffff; }
    .bar { height: 16px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
    .fill { height: 100%; border-radius: inherit; }
    .dot { width: 10px; height: 10px; display: inline-block; border-radius: 50%; margin-right: 8px; }
    .pie { width: 190px; height: 190px; border-radius: 50%; margin: 12px 0; background: conic-gradient(${statsPieSlices(events).join(", ")}); }
    @media print { body { margin: 16px; } button { display: none; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Reporte generado con los datos almacenados del periodo seleccionado.</p>
  <div class="summary">
    <div class="card"><span>Total del periodo</span><strong>${summary.total || 0}</strong></div>
    <div class="card"><span>Partes creados</span><strong>${statsSummaryTotal(summary, "CREACION_PARTE")}</strong></div>
    <div class="card"><span>Inicios de sesion</span><strong>${statsSummaryTotal(summary, "LOGIN")}</strong></div>
    <div class="card"><span>Actividad principal</span><strong>${escapeHtml(summary.actividad_principal?.etiqueta || "Sin datos")}</strong></div>
  </div>
  ${options.bars ? `<h2>Grafica de barras</h2>
    <table>
      <thead><tr><th>Actividad</th><th>Grafica</th><th>Total</th><th>Porcentaje</th></tr></thead>
      <tbody>${events.length ? events.map((event, index) => `<tr><td>${escapeHtml(event.etiqueta)}</td><td><div class="bar"><div class="fill" style="width:${Math.max(4, (event.total / max) * 100)}%; background:${statsColors[index % statsColors.length]}"></div></div></td><td>${event.total}</td><td>${event.porcentaje}%</td></tr>`).join("") : `<tr><td colspan="4">Sin datos.</td></tr>`}</tbody>
    </table>` : ""}
  ${options.pie ? `<h2>Grafica de pastel</h2>
    <div class="pie"></div>
    <table>
      <thead><tr><th>Actividad</th><th>Total</th><th>Porcentaje</th></tr></thead>
      <tbody>${pieRows || `<tr><td colspan="3">Sin datos.</td></tr>`}</tbody>
    </table>` : ""}
  ${options.table ? `<h2>Tabla de numeros</h2>
    <table>
      <thead><tr><th>Actividad</th><th>Total</th><th>Porcentaje</th></tr></thead>
      <tbody>${events.length ? events.map((event) => `<tr><td>${escapeHtml(event.etiqueta)}</td><td>${event.total}</td><td>${event.porcentaje}%</td></tr>`).join("") : `<tr><td colspan="3">Sin datos.</td></tr>`}</tbody>
    </table>` : ""}
  <h2>Usuarios con mas actividad</h2>
  <table>
    <thead><tr><th>Usuario</th><th>Total</th></tr></thead>
    <tbody>${users.length ? users.map((user) => `<tr><td>${escapeHtml(user.nombre)}</td><td>${user.total}</td></tr>`).join("") : `<tr><td colspan="2">Sin usuarios registrados.</td></tr>`}</tbody>
  </table>
  <h2>Datos almacenados por estadistica</h2>
  ${detailSections || "<p>Sin datos detallados para este periodo.</p>"}
  ${mode === "pdf" ? "<script>document.title = " + JSON.stringify(title) + ";<\/script>" : ""}
</body>
</html>`;
}

function statsPieSlices(events) {
  let current = 0;
  return events.map((event, index) => {
    const start = current;
    current += event.porcentaje;
    return `${statsColors[index % statsColors.length]} ${start}% ${current}%`;
  });
}

function statsMonthName(value) {
  return statsMonth.querySelector(`option[value="${Number(value)}"]`)?.textContent || `Mes ${value}`;
}

function statsSummaryTotal(summary, type) {
  return summary?.eventos?.find((event) => event.tipo === type)?.total || 0;
}

function statsExportPeriodLabel(exportData) {
  const first = exportData.periods[0];
  const last = exportData.periods[exportData.periods.length - 1];
  const start = `${statsMonthName(first.month)} ${first.year}`;
  const end = `${statsMonthName(last.month)} ${last.year}`;
  return start === end ? start : `${start} a ${end}`;
}

function statsExportFilename(exportData, extension) {
  const first = exportData.periods[0];
  const last = exportData.periods[exportData.periods.length - 1];
  const start = `${first.year}-${String(first.month).padStart(2, "0")}`;
  const end = `${last.year}-${String(last.month).padStart(2, "0")}`;
  return `estadisticas-${start}${start === end ? "" : `-a-${end}`}.${extension}`;
}

function downloadStatsBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatStatsDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

/** Intenta extraer un folio desde la descripcion del evento. */
function extractFolio(text = "") {
  const match = text.match(/FIG-\d+/i);
  return match ? match[0].toUpperCase() : "";
}

/** Formatea la fecha para mostrarla en la tabla. */
function formatDisplayDate(date) {
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Formatea la hora del evento para mostrarla como etiqueta. */
function formatTime(date) {
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
}

document.querySelectorAll(".history-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".history-tabs button").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    historyAction = button.dataset.action;
    applyHistoryMode();
    loadHistory();
  });
});

historySearch.addEventListener("input", () => {
  if (hasHistoryAdvancedSearch()) {
    historyAdvancedFilters = [];
    renderHistoryAdvancedFilterList();
    updateHistoryAdvancedSummary();
  }
  loadHistory();
});
historyAdvancedSearchBtn.addEventListener("click", openHistoryAdvancedSearch);
historyAdvancedSearchField.addEventListener("change", syncHistoryAdvancedInput);
addHistoryAdvancedFilterBtn.addEventListener("click", () => addHistoryAdvancedFilter());
historyAdvancedSearchForm.addEventListener("submit", applyHistoryAdvancedSearch);
clearHistoryAdvancedSearchBtn.addEventListener("click", clearHistoryAdvancedSearch);
historyPageSize.addEventListener("change", () => {
  historyPage = 1;
  renderHistory();
});
historyPrevPage.addEventListener("click", () => {
  historyPage -= 1;
  renderHistory();
});
historyNextPage.addEventListener("click", () => {
  historyPage += 1;
  renderHistory();
});
refreshStatsBtn.addEventListener("click", loadStats);
openStatsExportModalBtn.addEventListener("click", openStatsExportModal);
exportStatsExcelBtn.addEventListener("click", exportStatsExcel);
exportStatsPdfBtn.addEventListener("click", exportStatsPdf);
[statsExportStartMonth, statsExportStartYear, statsExportEndMonth, statsExportEndYear].forEach((input) => {
  input.addEventListener("change", updateStatsExportRangeCount);
  input.addEventListener("input", updateStatsExportRangeCount);
});
statsMonth.addEventListener("change", loadStats);
statsYear.addEventListener("change", loadStats);
statsView.addEventListener("change", renderStats);

const currentDate = new Date();
statsMonth.value = String(currentDate.getMonth() + 1);
statsYear.value = String(currentDate.getFullYear());
statsExportStartMonth.value = statsMonth.value;
statsExportEndMonth.value = statsMonth.value;
statsExportStartYear.value = statsYear.value;
statsExportEndYear.value = statsYear.value;
applyHistoryMode();
syncHistoryAdvancedInput();
renderHistoryAdvancedFilterList();
updateHistoryAdvancedSummary();
loadHistory();
