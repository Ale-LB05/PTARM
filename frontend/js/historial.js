setupLayout("historial");

let historyAction = "CREAR";
let historyItems = [];
let historyPage = 1;

const historyRows = document.getElementById("historyRows");
const historySearch = document.getElementById("historySearch");
const historyDate = document.getElementById("historyDate");
const historyPersonLabel = document.getElementById("historyPersonLabel");
const historyPageSize = document.getElementById("historyPageSize");
const historyPrevPage = document.getElementById("historyPrevPage");
const historyNextPage = document.getElementById("historyNextPage");
const historyPageInfo = document.getElementById("historyPageInfo");

/** Carga el historial filtrando por accion, texto o fecha seleccionada. */
async function loadHistory() {
  const params = new URLSearchParams({ accion: historyAction });
  const query = historyDate.value ? formatDateForSearch(historyDate.value) : historySearch.value.trim();
  if (query) params.set("q", query);

  const data = await api(`/api/historial?${params.toString()}`);
  if (!data?.success) return;
  historyItems = data.data;
  historyPage = 1;
  renderHistory();
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
  historyPageInfo.textContent = `Pagina ${historyPage} de ${totalPages}`;
  historyPrevPage.disabled = historyPage <= 1;
  historyNextPage.disabled = historyPage >= totalPages;
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
    loadHistory();
  });
});

historySearch.addEventListener("input", () => {
  historyDate.value = "";
  loadHistory();
});

historyDate.addEventListener("change", loadHistory);
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

loadHistory();
