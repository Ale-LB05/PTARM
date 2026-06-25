/*
 * Pantalla Historial.
 *
 * Lo carga cruds/historial.php. Consulta actividad del sistema, filtra eventos,
 * arma graficas/estadisticas y prepara exportaciones PDF/Excel del historial.
 * Usa api() y permisos comunes definidos en common.js.
 */
setupLayout("historial");

// Estado de filtros, paginacion y datos base usados para tabla, tarjetas,
// grafica y exportacion.
let historyAction = "CREAR";
let historyItems = [];
let historyRawItems = [];
let historyPage = 1;
let historyAdvancedFilters = [];
let statsData = null;
let exportedPartsByActivity = new Map();

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
const historyAdvancedSearchActions = historyAdvancedSearchForm.querySelector(".modal-actions");
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
<<<<<<< HEAD
const statsExportBars = document.getElementById("statsExportBars");
const statsExportPie = document.getElementById("statsExportPie");
const statsExportTable = document.getElementById("statsExportTable");
const statsExportActivityOptions = document.getElementById("statsExportActivityOptions");
=======
const statsExportBars = document.getElementById("statsExportBars");
const statsExportPie = document.getElementById("statsExportPie");
const statsExportActivityInputs = [...document.querySelectorAll(".stats-export-activity")];
const statsExportActivities = document.querySelector(".stats-export-activities");
const statsExportHeadContent = document.querySelector(".stats-export-modal .export-head > div:first-child");
>>>>>>> 6d7348ee79133054348f757275f51af466273a58
const statsExportRangeCount = document.getElementById("statsExportRangeCount");
const statsCards = document.getElementById("statsCards");
const statsChart = document.getElementById("statsChart");
const statsChartTitle = document.getElementById("statsChartTitle");
const statsSummaryText = document.getElementById("statsSummaryText");
const statsUsers = document.getElementById("statsUsers");
const statsRows = document.getElementById("statsRows");
const statsDetailModal = document.getElementById("statsDetailModal");
const statsDetailTitle = document.getElementById("statsDetailTitle");
<<<<<<< HEAD
const statsDetailSummary = document.getElementById("statsDetailSummary");
const statsDetailRows = document.getElementById("statsDetailRows");
const exportedPartsModal = document.getElementById("exportedPartsModal");
const exportedPartsModalTitle = document.getElementById("exportedPartsModalTitle");
const exportedPartsModalSummary = document.getElementById("exportedPartsModalSummary");
const exportedPartsModalList = document.getElementById("exportedPartsModalList");
=======
const statsDetailSummary = document.getElementById("statsDetailSummary");
const statsDetailHeader = document.getElementById("statsDetailHeader");
const statsDetailRows = document.getElementById("statsDetailRows");
const statsFoliosSummary = document.getElementById("statsFoliosSummary");
const statsFoliosRows = document.getElementById("statsFoliosRows");

// Matches the advanced-search action layout used in Gestionar partes.
historyAdvancedSearchActions.classList.add("advanced-search-actions");
clearHistoryAdvancedSearchBtn.className = "advanced-clear-btn";
clearHistoryAdvancedSearchBtn.title = "Limpiar busqueda";
clearHistoryAdvancedSearchBtn.setAttribute("aria-label", "Limpiar busqueda");
clearHistoryAdvancedSearchBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
addHistoryAdvancedFilterBtn.classList.remove("blue", "outline");
addHistoryAdvancedFilterBtn.classList.add("amber");
>>>>>>> 6d7348ee79133054348f757275f51af466273a58

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
            <td><span class="history-person"><img class="avatar-mini" src="${item.usuario_foto || assetUrl("img/usuario.png")}" alt="" /> ${item.usuario_nombre || "Usuario no disponible"}</span></td>
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
  return `<span class="history-assignee"><img class="avatar-mini" src="${item.encargado_foto || assetUrl("img/usuario.png")}" alt="" /> ${item.encargado_nombre || "Sin asignar"}</span>`;
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

async function openStatsDetail(type) {
  const detail = await fetchStatsDetail(type);
  if (!detail) return;
  const isLoginDetail = type === "LOGIN" || detail.tipo === "LOGIN";
  const isExportDetail = type === "EXPORTACION" || detail.tipo === "EXPORTACION";
  const isCreationDetail = type === "CREACION_PARTE" || detail.tipo === "CREACION_PARTE";
  const isDeletedPartDetail = type === "ELIMINACION_PARTE" || detail.tipo === "ELIMINACION_PARTE";
  const isUserCreationDetail = type === "CREACION_USUARIO" || detail.tipo === "CREACION_USUARIO";
  const hideFolioColumn = isLoginDetail || isExportDetail || isCreationDetail || isDeletedPartDetail || isUserCreationDetail;

  document.getElementById("statsDetailFolioHeader").hidden = hideFolioColumn;
  exportedPartsByActivity = new Map(detail.registros.map((row) => [row.id_actividad || row.id, row.folios || []]));

  statsDetailTitle.textContent = `${detail.etiqueta} - ${statsMonthName(detail.mes)} ${detail.anio}`;
  statsDetailSummary.innerHTML = `
    <div class="stats-detail-card"><span>Total registrado</span><strong>${detail.total}</strong></div>
    <div class="stats-detail-card"><span>Usuarios relacionados</span><strong>${detail.usuarios.length}</strong></div>
    <div class="stats-detail-card"><span>Periodo</span><strong>${statsMonthName(detail.mes)} ${detail.anio}</strong></div>
  `;

<<<<<<< HEAD
  const userSummary = detail.usuarios.length
    ? `<tr><td colspan="${hideFolioColumn ? 3 : 4}"><strong>Resumen por usuario:</strong> ${detail.usuarios.map((user) => `${escapeHtml(user.nombre)}: ${user.total}`).join(" | ")}</td></tr>`
    : "";
  const records = detail.registros.length
    ? detail.registros.map((row) => `<tr>
        <td>${formatStatsDateTime(row.fecha)}</td>
        <td>${escapeHtml(row.usuario)}${row.correo ? `<br><span class="muted-cell">${escapeHtml(row.correo)}</span>` : ""}</td>
        ${hideFolioColumn ? "" : `<td>${escapeHtml(row.folio || "No aplica")}</td>`}
        <td>${escapeHtml(row.detalle || "Sin detalle")}${isExportDetail ? exportedPartsDetailControl(row) : ""}</td>
      </tr>`).join("")
    : `<tr><td colspan="${hideFolioColumn ? 3 : 4}">Sin datos registrados para este periodo.</td></tr>`;
  statsDetailRows.innerHTML = `${userSummary}${records}`;
  statsDetailModal.classList.add("show");
}
=======
  const table = statsDetailTable(detail.tipo, detail.registros);
  statsDetailHeader.innerHTML = `<tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  statsDetailRows.innerHTML = table.rows;
  statsDetailModal.classList.add("show");
}

/** Builds columns suited to each activity instead of reusing a generic table. */
function statsDetailTable(type, records, interactive = true) {
  const visibleRecords = groupStatsPartRecords(type, records);
  const date = (row) => formatStatsDateTime(row.fecha);
  const user = (row) => escapeHtml(row.usuario || row.usuario_nombre || "Sistema");
  const folios = (row) => {
    const values = Array.isArray(row.folios) ? row.folios : extractActivityFolios(row);
    if (!values.length) return "Sin folio";
    if (interactive && values.length > 1) {
      const payload = encodeURIComponent(JSON.stringify(values));
      return `<button class="btn blue outline stats-folios-btn" type="button" onclick="openStatsFoliosModal('${payload}')">Ver folios (${values.length})</button>`;
    }
    if (!interactive) {
      return values.map((folio, index) => `<strong class="export-folio-text">${index + 1}. ${escapeHtml(folio)}</strong>`).join(", ");
    }
    return values.map((folio) => `<span class="stats-folio">${escapeHtml(folio)}</span>`).join(" ");
  };
  const configs = {
    LOGIN: {
      headers: ["Fecha y hora", "Usuario"],
      cells: (row) => [date(row), user(row)],
    },
    EXPORTACION: {
      headers: ["Fecha y hora", "Usuario que exporto", "Folios exportados"],
      cells: (row) => [date(row), user(row), folios(row)],
    },
    CREACION_PARTE: {
      headers: ["Fecha y hora", "Usuario que creo", "Folio creado"],
      cells: (row) => [date(row), user(row), folios(row)],
    },
    EDICION_PARTE: {
      headers: ["Fecha y hora", "Usuario que edito", "Folio editado"],
      cells: (row) => [date(row), user(row), folios(row)],
    },
    ELIMINACION_PARTE: {
      headers: ["Fecha y hora", "Usuario que elimino", "Folio eliminado"],
      cells: (row) => [date(row), user(row), folios(row)],
    },
    CREACION_USUARIO: {
      headers: ["Fecha y hora", "Usuario que creo", "Usuario creado"],
      cells: (row) => [date(row), user(row), escapeHtml(row.usuario_creado || String(row.detalle || "Sin detalle").replace(/^Usuario creado:\s*/i, ""))],
    },
  };
  const config = configs[type] || {
    headers: ["Fecha y hora", "Usuario"],
    cells: (row) => [date(row), user(row)],
  };
  if (["CREACION_PARTE", "EDICION_PARTE", "ELIMINACION_PARTE"].includes(type) && visibleRecords.some((row) => (row.folios || []).length > 1)) {
    config.headers[2] = config.headers[2].replace("Folio", "Folios");
  }
  return {
    headers: config.headers,
    rows: visibleRecords.length
      ? visibleRecords.map((row) => `<tr>${config.cells(row).map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${config.headers.length}">Sin datos registrados para este periodo.</td></tr>`,
  };
}

/** Combines activities that were recorded as one import batch. */
function groupStatsPartRecords(type, records) {
  if (!["CREACION_PARTE", "EDICION_PARTE", "ELIMINACION_PARTE"].includes(type)) return records;
  const groups = new Map();
  records.forEach((row, index) => {
    const key = row.lote ? `lote-${row.lote}` : `single-${index}`;
    const current = groups.get(key) || { ...row, folios: [] };
    const rowFolios = Array.isArray(row.folios) ? row.folios : extractActivityFolios(row);
    current.folios = [...new Set([...current.folios, ...rowFolios])];
    groups.set(key, current);
  });
  return [...groups.values()];
}

/** Opens the list of folios that belong to a single import batch. */
function openStatsFoliosModal(encodedFolios) {
  let folios = [];
  try { folios = JSON.parse(decodeURIComponent(encodedFolios)); } catch (_) { folios = []; }
  statsFoliosSummary.textContent = `${folios.length} folio${folios.length === 1 ? "" : "s"} registrado${folios.length === 1 ? "" : "s"} en este lote.`;
  statsFoliosRows.innerHTML = folios.map((folio) => `<li><span class="stats-folio">${escapeHtml(folio)}</span></li>`).join("") || `<li>Sin folios disponibles.</li>`;
  document.getElementById("statsFoliosModal").classList.add("show");
}

/** Reads folios from older activity details that predate the structured field. */
function extractActivityFolios(row) {
  if (row.folio) return [row.folio];
  const match = String(row.detalle || "").match(/Folios:\s*(.+)$/i);
  if (match) return match[1].split(/[|,]/).map((folio) => folio.trim()).filter(Boolean);
  const single = String(row.detalle || "").match(/Parte\s+([^\s]+)\s+(?:creado|editado|eliminado)/i);
  return single ? [single[1]] : [];
}
>>>>>>> 6d7348ee79133054348f757275f51af466273a58

function closeStatsDetailModal() {
  statsDetailModal.classList.remove("show");
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
    <td><button class="btn blue outline icon-text" type="button" onclick="openStatsDetail('${escapeHtml(event.tipo)}')"><i class="fas fa-eye"></i> Ver datos</button></td>
  </tr>`;
}

function exportedPartsDetailControl(row) {
  const folios = row.folios || [];
  if (folios.length === 1) {
    return `<br><span class="muted-cell">Parte exportada: <strong>${escapeHtml(folios[0])}</strong></span>`;
  }
  if (folios.length > 1) {
    return `<br><button class="btn blue outline icon-text" type="button" onclick="openExportedPartsModal(${Number(row.id_actividad || row.id)})"><i class="fas fa-list"></i> Ver partes exportados</button>`;
  }
  return "";
}

function openExportedPartsModal(activityId) {
  const folios = exportedPartsByActivity.get(Number(activityId)) || [];
  exportedPartsModalTitle.textContent = "Partes exportados";
  exportedPartsModalSummary.textContent = folios.length
    ? `${folios.length} parte${folios.length === 1 ? "" : "s"} exportado${folios.length === 1 ? "" : "s"}`
    : "La lista no esta disponible para esta exportacion anterior.";
  exportedPartsModalList.innerHTML = folios.length ? folios.map((folio) => `<li>${escapeHtml(folio)}</li>`).join("") : "";
  exportedPartsModal.classList.add("show");
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

<<<<<<< HEAD
async function openStatsExportModal() {
  await ensureStatsLoaded();
  statsExportStartMonth.value = statsMonth.value;
=======
function openStatsExportModal() {
  statsExportHeadContent.innerHTML = "<strong>Actividades a exportar</strong>";
  statsExportHeadContent.appendChild(statsExportActivities);
  statsExportStartMonth.value = statsMonth.value;
>>>>>>> 6d7348ee79133054348f757275f51af466273a58
  statsExportEndMonth.value = statsMonth.value;
  statsExportStartYear.value = statsYear.value;
  statsExportEndYear.value = statsYear.value;
  statsExportBars.checked = true;
  statsExportPie.checked = true;
<<<<<<< HEAD
  statsExportTable.checked = true;
  renderStatsExportActivityOptions();
=======
  statsExportActivityInputs.forEach((input) => { input.checked = true; });
>>>>>>> 6d7348ee79133054348f757275f51af466273a58
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
<<<<<<< HEAD
    table: statsExportTable.checked,
    activityTypes: [...statsExportActivityOptions.querySelectorAll(".stats-export-activity:checked")].map((input) => input.value),
  };
}

function renderStatsExportActivityOptions() {
  const events = statsData?.eventos || [];
  statsExportActivityOptions.innerHTML = events.length
    ? events.map((event) => `<label class="inline-check"><input class="stats-export-activity" type="checkbox" value="${escapeHtml(event.tipo)}" checked /> ${escapeHtml(event.etiqueta)}</label>`).join("")
    : `<span class="muted-cell">No hay actividades disponibles.</span>`;
}
=======
  };
}
>>>>>>> 6d7348ee79133054348f757275f51af466273a58

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
  const activityTypes = statsExportActivityTypes();
  if (!periods.length) {
    showToast("Selecciona un rango valido para exportar", "error");
    return null;
  }
  if (periods.length > 120) {
    showToast("El rango maximo para exportar es de 120 meses", "error");
    return null;
  }
<<<<<<< HEAD
  if (!options.bars && !options.pie && !options.table) {
    showToast("Selecciona al menos una grafica para exportar", "error");
    return null;
  }
  if (!options.activityTypes.length) {
=======
  if (!activityTypes.length) {
>>>>>>> 6d7348ee79133054348f757275f51af466273a58
    showToast("Selecciona al menos una actividad para exportar", "error");
    return null;
  }

  const months = [];
  const detailsByType = new Map();
  for (const period of periods) {
    const monthData = await fetchStatsMonth(period.month, period.year);
    if (!monthData) return null;
    const filteredEvents = (monthData.eventos || []).filter((event) => activityTypes.includes(event.tipo));
    months.push({ ...monthData, eventos: filteredEvents, usuarios: [] });
    for (const event of filteredEvents) {
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

  const details = [...detailsByType.values()].map((detail) => ({
<<<<<<< HEAD
    ...detail,
    usuarios: [...detail.usuarios.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total),
    registros: detail.registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
  })).filter((detail) => options.activityTypes.includes(detail.tipo));
  const total = details.reduce((sum, detail) => sum + detail.total, 0);
  const usuarios = new Map();
  details.forEach((detail) => detail.usuarios.forEach((user) => usuarios.set(user.nombre, (usuarios.get(user.nombre) || 0) + user.total)));
  const eventos = details.map((detail) => ({
    tipo: detail.tipo,
    etiqueta: detail.etiqueta,
    total: detail.total,
    porcentaje: total ? Number(((detail.total / total) * 100).toFixed(1)) : 0,
  })).sort((a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta));

  return {
    months: months.map((month) => ({
      ...month,
      eventos: (month.eventos || []).filter((event) => options.activityTypes.includes(event.tipo)),
    })),
    periods,
    options,
    summary: {
      total,
      eventos,
      usuarios: [...usuarios.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total).slice(0, 10),
      actividad_principal: eventos[0] || null,
    },
    details,
  };
=======
      ...detail,
      usuarios: [...detail.usuarios.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total),
      registros: detail.registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    }));
  const summary = aggregateStatsMonths(months);
  const selectedUsers = new Map();
  details.forEach((detail) => detail.usuarios.forEach((user) => {
    selectedUsers.set(user.nombre, (selectedUsers.get(user.nombre) || 0) + user.total);
  }));
  summary.usuarios = [...selectedUsers.entries()]
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  return {
    months,
    periods,
    options,
    summary,
    details,
  };
>>>>>>> 6d7348ee79133054348f757275f51af466273a58
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
  downloadStatsBlob(statsExcelHtml(exportData), statsExportFilename(exportData, "xls"), "application/vnd.ms-excel;charset=utf-8");
  closeModal("statsExportModal");
}

/** Builds a data-first Excel file using the same columns as Ver datos. */
function statsExcelHtml(exportData) {
  const title = `Estadisticas - ${statsExportPeriodLabel(exportData)}`;
  const rows = exportData.details.flatMap((detail) => {
    const detailRows = groupStatsPartRecords(detail.tipo, detail.registros || []);
    return detailRows.map((row) => {
      const folios = Array.isArray(row.folios) ? row.folios : extractActivityFolios(row);
      const folioText = folios.map((folio, index) => `${index + 1}. ${folio}`).join(", ");
      const createdUser = row.usuario_creado || String(row.detalle || "").replace(/^Usuario creado:\s*/i, "");
      return `<tr>
        <td>${escapeHtml(detail.etiqueta)}</td>
        <td>${formatStatsDateTime(row.fecha)}</td>
        <td>${escapeHtml(row.usuario || row.usuario_nombre || "Sistema")}</td>
        <td><strong>${escapeHtml(folioText || "Sin folio")}</strong></td>
        <td>${escapeHtml(detail.tipo === "CREACION_USUARIO" ? createdUser : "")}</td>
      </tr>`;
    });
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8" />
    <style>
      body{font-family:Arial,sans-serif;color:#111827;background:#fff}
      h1{margin:0 0 4px;color:#06145f;font-size:22px}
      p{margin:0 0 14px;color:#64748b}table{border-collapse:collapse;width:100%;margin:0 0 18px;table-layout:auto}
      th{background:#123055;color:#fff;font-weight:800;text-transform:uppercase;white-space:nowrap}
      th,td{border:1px solid #b9c0d4;padding:8px;text-align:left;vertical-align:top;white-space:normal}
      tbody tr:nth-child(even){background:#f8fafc}td strong{color:#000;font-weight:800}
    </style></head><body>
    <h1>${escapeHtml(title)}</h1><p>Generado: ${escapeHtml(new Date().toLocaleString("es-MX"))}</p>
    <table><thead><tr><th>Actividad</th><th>Fecha y hora</th><th>Usuario</th><th>Folio(s)</th><th>Usuario creado</th></tr></thead>
    <tbody>${rows || "<tr><td colspan=\"5\">Sin datos para el periodo y actividades seleccionadas.</td></tr>"}</tbody></table>
  </body></html>`;
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

function statsDetailShowsFolio(detail) {
  return detail.tipo === "EDICION_PARTE";
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
  const detailSections = details.map((detail) => {
    const showFolio = statsDetailShowsFolio(detail);
    return `
    <h2>${escapeHtml(detail.etiqueta)}</h2>
    <p>Total: ${detail.total}. Usuarios relacionados: ${detail.usuarios.length}.</p>
    <table>
      <thead><tr><th>Usuario</th><th>Total</th></tr></thead>
      <tbody>${detail.usuarios.length ? detail.usuarios.map((user) => `<tr><td>${escapeHtml(user.nombre)}</td><td>${user.total}</td></tr>`).join("") : `<tr><td colspan="2">Sin usuarios registrados.</td></tr>`}</tbody>
    </table>
    <table>
      <thead><tr><th>Fecha</th><th>Usuario</th><th>Correo</th>${showFolio ? "<th>Folio</th>" : ""}<th>Detalle</th></tr></thead>
      <tbody>${detail.registros.length ? detail.registros.map((row) => `<tr><td>${formatStatsDateTime(row.fecha)}</td><td>${escapeHtml(row.usuario)}</td><td>${escapeHtml(row.correo || "")}</td>${showFolio ? `<td>${escapeHtml(row.folio || "")}</td>` : ""}<td>${escapeHtml(row.detalle || "Sin detalle")}</td></tr>`).join("") : `<tr><td colspan="${showFolio ? 5 : 4}">Sin registros.</td></tr>`}</tbody>
    </table>
  `;
  }).join("");

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

/** Builds the final report using the same detail columns shown in the modal. */
function statsReportHtml(exportData, mode) {
  const { summary, details, options } = exportData;
  const events = summary.eventos || [];
  const users = summary.usuarios || [];
  const title = `Estadisticas - ${statsExportPeriodLabel(exportData)}`;
  const charts = statsExportChartImages(events, options);
  const detailSections = details.map((detail) => statsDetailExportSection(detail)).join("");
  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  @page{size:letter portrait;margin:10mm}
  *{box-sizing:border-box} body{margin:0;color:#172033;background:#f4f7fb;font-family:Arial,sans-serif;font-size:11px}
  .report{max-width:1100px;margin:0 auto;padding:24px}.report-head{padding:18px 20px;border:1px solid #bfd0e4;border-radius:8px;background:#fff}
  h1{margin:0;color:#123055;font-size:23px}h2{margin:0 0 10px;color:#123055;font-size:15px}.muted{margin:7px 0 0;color:#64748b}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.card{border:1px solid #cbd5e1;border-radius:7px;padding:12px;background:#fff}
  .card span{display:block;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase}.card strong{display:block;margin-top:5px;color:#123055;font-size:21px}
  .report-section{break-inside:avoid;page-break-inside:avoid;margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}
  .chart-image{display:block;width:100%;max-width:980px;margin:0 auto}.two-charts{display:grid;grid-template-columns:1fr 1fr;gap:16px}.two-charts .chart-image{max-width:100%}
  table{width:100%;border-collapse:collapse;margin-top:10px}th,td{padding:8px;border:1px solid #cbd5e1;text-align:left;vertical-align:top}th{color:#fff;background:#123055;font-size:10px;text-transform:uppercase}
  tbody tr:nth-child(even){background:#f8fafc}.export-folio-text{color:#000;font-weight:800}
  .detail-meta{margin:0;color:#64748b}@media print{body{background:#fff}.report{padding:0}.report-section{border-color:#aebdce}}
</style></head><body><main class="report">
  <header class="report-head"><h1>${escapeHtml(title)}</h1><p class="muted">Reporte generado con los datos almacenados del periodo seleccionado.</p></header>
  <section class="summary">
    <div class="card"><span>Total del periodo</span><strong>${summary.total || 0}</strong></div>
    <div class="card"><span>Partes creados</span><strong>${statsSummaryTotal(summary, "CREACION_PARTE")}</strong></div>
    <div class="card"><span>Inicios de sesion</span><strong>${statsSummaryTotal(summary, "LOGIN")}</strong></div>
    <div class="card"><span>Actividad principal</span><strong>${escapeHtml(summary.actividad_principal?.etiqueta || "Sin datos")}</strong></div>
  </section>
  ${charts}
  <section class="report-section"><h2>Usuarios con mas actividad</h2><table><thead><tr><th>Usuario</th><th>Total</th></tr></thead><tbody>${users.length ? users.map((user) => `<tr><td>${escapeHtml(user.nombre)}</td><td>${user.total}</td></tr>`).join("") : `<tr><td colspan="2">Sin usuarios registrados.</td></tr>`}</tbody></table></section>
  ${detailSections || `<section class="report-section"><p>Sin datos detallados para este periodo.</p></section>`}
</main>${mode === "pdf" ? `<script>window.document.title=${JSON.stringify(title)};<\/script>` : ""}</body></html>`;
}

function statsExportActivityTypes() {
  return statsExportActivityInputs.filter((input) => input.checked).map((input) => input.value);
}

/** Creates printable chart images so PDF and HTML-based Excel look the same. */
function statsExportChartImages(events, options) {
  const images = [];
  if (options.bars) images.push({ title: "Grafica de barras", src: statsBarChartImage(events) });
  if (options.pie) images.push({ title: "Grafica de pastel", src: statsPieChartImage(events) });
  if (!images.length) return "";
  const content = images.map((chart) => `<section class="report-section"><h2>${chart.title}</h2>${chart.src ? `<img class="chart-image" src="${chart.src}" alt="${chart.title}" />` : `<p class="muted">Sin datos para graficar.</p>`}</section>`).join("");
  return content;
}

function statsBarChartImage(events) {
  if (!events.length) return "";
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = Math.max(260, events.length * 54 + 70);
  const ctx = canvas.getContext("2d"); const max = Math.max(...events.map((event) => event.total), 1);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = "700 20px Arial"; ctx.fillStyle = "#123055"; ctx.fillText("Actividad registrada", 34, 34);
  events.forEach((event, index) => { const y = 58 + index * 54; const width = Math.max(12, (event.total / max) * 690); ctx.font = "16px Arial"; ctx.fillStyle = "#172033"; ctx.fillText(event.etiqueta, 34, y + 20); ctx.fillStyle = "#e2e8f0"; ctx.fillRect(360, y, 700, 28); ctx.fillStyle = statsColors[index % statsColors.length]; ctx.fillRect(360, y, width, 28); ctx.fillStyle = "#172033"; ctx.font = "700 16px Arial"; ctx.fillText(`${event.total} (${event.porcentaje}%)`, 1080, y + 20); });
  return canvas.toDataURL("image/png");
}

function statsPieChartImage(events) {
  if (!events.length) return "";
  const canvas = document.createElement("canvas"); canvas.width = 920; canvas.height = 430;
  const ctx = canvas.getContext("2d"); const cx = 220; const cy = 225; const radius = 150; let start = -Math.PI / 2;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = "700 20px Arial"; ctx.fillStyle = "#123055"; ctx.fillText("Distribucion por actividad", 34, 34);
  events.forEach((event, index) => { const end = start + (event.porcentaje / 100) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, start, end); ctx.closePath(); ctx.fillStyle = statsColors[index % statsColors.length]; ctx.fill(); start = end; });
  events.forEach((event, index) => { const y = 80 + index * 42; ctx.fillStyle = statsColors[index % statsColors.length]; ctx.fillRect(450, y - 14, 18, 18); ctx.fillStyle = "#172033"; ctx.font = "16px Arial"; ctx.fillText(`${event.etiqueta}: ${event.total} (${event.porcentaje}%)`, 480, y); });
  return canvas.toDataURL("image/png");
}

/** Reuses the modal's per-activity table layout in PDF and Excel exports. */
function statsDetailExportSection(detail) {
  const table = statsDetailTable(detail.tipo, detail.registros || [], false);
  return `<section class="report-section"><h2>${escapeHtml(detail.etiqueta)}</h2><p class="detail-meta">Total registrado: ${detail.total}. Usuarios relacionados: ${(detail.usuarios || []).length}.</p><table><thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${table.rows}</tbody></table></section>`;
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

window.openStatsFoliosModal = openStatsFoliosModal;
