setupLayout("historial");

let historyAction = "CREAR";
let historyItems = [];

const historyRows = document.getElementById("historyRows");
const historySearch = document.getElementById("historySearch");
const historyDate = document.getElementById("historyDate");
const historyPersonLabel = document.getElementById("historyPersonLabel");

async function loadHistory() {
  const params = new URLSearchParams({ accion: historyAction });
  const query = historyDate.value ? formatDateForSearch(historyDate.value) : historySearch.value.trim();
  if (query) params.set("q", query);

  const data = await api(`/api/historial?${params.toString()}`);
  if (!data?.success) return;
  historyItems = data.data;
  renderHistory();
}

function renderHistory() {
  historyPersonLabel.textContent =
    historyAction === "CREAR" ? "Creador" : historyAction === "EDITAR" ? "Editor" : historyAction === "EXPORTAR" ? "Usuario" : "Eliminado por";

  historyRows.innerHTML =
    historyItems
      .map((item) => {
        const date = new Date(item.fecha);
        return `
          <tr>
            <td class="muted-cell">${item.folio || extractFolio(item.descripcion) || "Sin folio"}</td>
            <td>${item.usuario_nombre || "Usuario no disponible"}</td>
            <td><span class="time-pill">${formatTime(date)}</span></td>
            <td class="muted-cell">${formatDisplayDate(date)}</td>
            <td>${renderMp(item)}</td>
            <td class="row-more"><i class="fas fa-ellipsis-h"></i></td>
          </tr>
        `;
      })
      .join("") || `<tr><td colspan="6">No hay actividades registradas para este filtro.</td></tr>`;
}

function renderMp(item) {
  if (historyAction === "EXPORTAR") return item.descripcion || "Exportacion";
  return `<img class="avatar-mini" src="${item.usuario_foto || "/img/usuario.png"}" alt="" /> ${item.mp_nombre || ""}`;
}

function extractFolio(text = "") {
  const match = text.match(/FIG-\d+/i);
  return match ? match[0].toUpperCase() : "";
}

function formatDisplayDate(date) {
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateForSearch(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(date) {
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
}

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

loadHistory();
