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
const historyDate = document.getElementById("historyDate");
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
const statsCards = document.getElementById("statsCards");
const statsChart = document.getElementById("statsChart");
const statsChartTitle = document.getElementById("statsChartTitle");
const statsSummaryText = document.getElementById("statsSummaryText");
const statsUsers = document.getElementById("statsUsers");
const statsRows = document.getElementById("statsRows");

const statsColors = ["#2563eb", "#0f766e", "#7c3aed", "#b7791f", "#dc2626", "#1499d3"];

/** Cierra cualquier modal del historial por su id. */
function closeModal(id) {
  document.getElementById(id)?.classList.remove("show");
}

/** Carga el historial filtrando por accion, texto o fecha seleccionada. */
async function loadHistory() {
  if (historyAction === "ESTADISTICAS") return loadStats();
  const params = new URLSearchParams({ accion: historyAction });
  const query = historyDate.value ? formatDateForSearch(historyDate.value) : historySearch.value.trim();
  if (query) params.set("q", query);

  const data = await api(`/api/historial?${params.toString()}`);
  if (!data?.success) return;
  historyRawItems = data.data;
  historyItems = hasHistoryAdvancedSearch() ? filterHistoryAdvanced(data.data) : data.data;
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
  historyDate.value = "";
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
    ? events.map((event) => `<tr><td>${escapeHtml(event.etiqueta)}</td><td>${event.total}</td><td>${event.porcentaje}%</td></tr>`).join("")
    : `<tr><td colspan="3">Sin datos para este periodo.</td></tr>`;
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
        <thead><tr><th>Actividad</th><th>Total</th><th>Porcentaje</th></tr></thead>
        <tbody>${events.length ? events.map((event) => `<tr><td>${escapeHtml(event.etiqueta)}</td><td>${event.total}</td><td>${event.porcentaje}%</td></tr>`).join("") : `<tr><td colspan="3">Sin datos para este periodo.</td></tr>`}</tbody>
      </table>
    </div>
  `;
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

/** Convierte yyyy-mm-dd al formato usado por la busqueda del historial. */
function formatDateForSearch(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/** Formatea la hora del evento para mostrarla como etiqueta. */
function formatTime(date) {
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/** Enfoca el input de fecha y abre el selector si el navegador lo permite. */
function focusHistoryDate() {
  historyDate.showPicker?.();
  historyDate.focus();
}

document.querySelectorAll(".history-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".history-tabs button").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    historyAction = button.dataset.action;
    historyDate.value = "";
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
  historyDate.value = "";
  loadHistory();
});

historyDate.addEventListener("change", () => {
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
statsMonth.addEventListener("change", loadStats);
statsYear.addEventListener("change", loadStats);
statsView.addEventListener("change", renderStats);

const currentDate = new Date();
statsMonth.value = String(currentDate.getMonth() + 1);
statsYear.value = String(currentDate.getFullYear());
applyHistoryMode();
syncHistoryAdvancedInput();
renderHistoryAdvancedFilterList();
updateHistoryAdvancedSummary();
loadHistory();
