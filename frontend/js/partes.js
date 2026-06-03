setupLayout("partes");

let partes = [];
let editingId = null;
let viewMode = localStorage.getItem("partesViewMode") || "list";
let vehicleIndex = 0;

const partesRows = document.getElementById("partesRows");
const partesListView = document.getElementById("partesListView");
const partesGridView = document.getElementById("partesGridView");
const exportRows = document.getElementById("exportRows");
const parteForm = document.getElementById("parteForm");
const partSearch = document.getElementById("partSearch");
const exportSearch = document.getElementById("exportSearch");
const exportSelectAll = document.getElementById("exportSelectAll");
const exportCount = document.getElementById("exportCount");
const vehiclesWrap = document.getElementById("vehiclesWrap");
const vehiclePersonSelect = document.getElementById("vehiclePersonSelect");
const listViewBtn = document.getElementById("listViewBtn");
const gridViewBtn = document.getElementById("gridViewBtn");
const partDetailBody = document.getElementById("partDetailBody");

function closeModal(id) {
  document.getElementById(id).classList.remove("show");
}

async function loadPartes() {
  const data = await api(`/api/partes?q=${encodeURIComponent(partSearch.value || "")}`);
  if (!data || !data.success) {
    showToast(data?.error || "No se pudieron cargar los partes", "error");
    return;
  }
  partes = data.data;
  renderPartes();
}

async function loadUsersSelect() {
  const data = await api("/api/usuarios");
  const select = document.getElementById("asignadoSelect");
  select.innerHTML = `<option value="">Sin asignar</option>`;
  if (data?.success) {
    data.data.forEach((u) => {
      select.innerHTML += `<option value="${u.id_usuario}">${u.nombre}</option>`;
    });
  }
}

function renderPartes() {
  partesRows.innerHTML = partes.map((parte) => `
    <tr>
      <td>${parte.folio || ""}</td>
      <td>${parte.respondiente_nombre || "Parte de transito"}</td>
      <td>${formatDate(parte.fecha)}</td>
      <td>${parte.mp_nombre || "Sin MP"}</td>
      <td><span class="person-cell"><img class="avatar-mini" src="${parte.encargado_foto || "/img/usuario.png"}" alt="" /> ${parte.encargado_nombre || "Sin asignar"}</span></td>
      <td><span class="actions"><button class="icon-btn edit" onclick="openParteModal('edit', ${parte.id_parte})"><i class="fas fa-edit"></i></button><button class="icon-btn delete" onclick="deleteParte(${parte.id_parte})"><i class="fas fa-trash"></i></button><button class="icon-btn view" onclick="openParteModal('view', ${parte.id_parte})"><i class="fas fa-eye"></i></button></span></td>
    </tr>
  `).join("") || `<tr><td colspan="6">Aun no hay partes registrados.</td></tr>`;

  partesGridView.innerHTML = partes.map((parte) => `
    <article class="parte-card">
      <div>
        <span class="parte-folio">${parte.folio || "Sin folio"}</span>
        <h3>${parte.respondiente_nombre || "Parte de transito"}</h3>
      </div>
      <p><i class="far fa-calendar"></i> ${formatDate(parte.fecha) || "Sin fecha"}</p>
      <p><i class="fas fa-user-shield"></i> ${parte.mp_nombre || "Sin MP"}</p>
      <p><img class="avatar-mini" src="${parte.encargado_foto || "/img/usuario.png"}" alt="" /> ${parte.encargado_nombre || "Sin asignar"}</p>
      <p><i class="fas fa-circle"></i> ${parte.estado || "Sin estado"}</p>
      <div class="card-actions">
        <button class="icon-btn edit" onclick="openParteModal('edit', ${parte.id_parte})"><i class="fas fa-edit"></i></button>
        <button class="icon-btn delete" onclick="deleteParte(${parte.id_parte})"><i class="fas fa-trash"></i></button>
        <button class="icon-btn view" onclick="openParteModal('view', ${parte.id_parte})"><i class="fas fa-eye"></i></button>
      </div>
    </article>
  `).join("") || `<p class="empty-state">Aun no hay partes registrados.</p>`;

  applyViewMode();
}

async function openParteModal(mode, id = null) {
  await loadUsersSelect();
  parteForm.reset();
  resetVehicles();
  editingId = id;
  const title = document.getElementById("parteModalTitle");
  const submit = document.getElementById("parteSubmit");
  title.textContent = mode === "edit" ? "Editar Parte" : mode === "view" ? "Visualizar Parte" : "Nuevo Parte";
  submit.textContent = mode === "edit" ? "Guardar Parte" : "Crear Nuevo";

  if (id) {
    const data = await api(`/api/partes/${id}`);
    if (data?.success) fillForm(data.data);
    else showToast(data?.error || "No se pudo abrir el parte", "error");
  }
  setParteFormMode(mode);
  document.getElementById("parteModal").classList.add("show");
}

function setParteFormMode(mode) {
  const isView = mode === "view";
  document.getElementById("parteSubmit").style.display = isView ? "none" : "";
  [...parteForm.elements].forEach((el) => {
    if (el.name) el.disabled = isView;
  });
  document.getElementById("addVehicleBtn").disabled = isView;
  vehiclesWrap.querySelectorAll("button").forEach((button) => {
    button.disabled = isView;
  });
  vehiclesWrap.classList.toggle("view-only", isView);
}

function fillForm(parte) {
  Object.entries(parte).forEach(([key, value]) => {
    const el = parteForm.elements[key];
    if (!el || value === null) return;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else if (el.length && el[0]?.type === "radio") [...el].forEach((radio) => radio.checked = radio.value === value);
    else el.value = String(value).slice(0, el.type === "date" ? 10 : undefined);
  });
  resetVehicles(parte.vehiculos?.length ? parte.vehiculos : [parte]);
  vehiclePersonSelect.value = parte.id_vehiculo || "";
}

parteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(parteForm));
  const vehicles = collectVehicles();
  payload.vehiculos = vehicles;
  delete payload.marca;
  delete payload.modelo;
  delete payload.tipo;
  delete payload.numero_serie;
  delete payload.numero_placa;
  payload.personas_fallecidas = parteForm.personas_fallecidas.checked;
  payload.personas_heridas = parteForm.personas_heridas.checked;
  payload.otros = parteForm.otros.checked;
  const path = editingId ? `/api/partes/${editingId}` : "/api/partes";
  const method = editingId ? "PUT" : "POST";
  const data = await api(path, { method, body: JSON.stringify(payload) });
  if (data?.success) {
    closeModal("parteModal");
    showToast(data.message);
    loadPartes();
  } else {
    showToast(data?.error || "No se pudo guardar el parte", "error");
  }
});

function deleteParte(id) {
  showConfirm("Eliminar parte", "Esta accion eliminara el parte seleccionado. Deseas continuar?", async () => {
    const data = await api(`/api/partes/${id}`, { method: "DELETE" });
    if (data?.success) {
      showToast("Parte eliminado");
      loadPartes();
    } else {
      showToast(data?.error || "No se pudo eliminar el parte", "error");
    }
  });
}

function openExport() {
  exportSearch.value = "";
  exportSelectAll.checked = false;
  renderExportRows();
  document.getElementById("exportModal").classList.add("show");
}

function renderExportRows() {
  const q = exportSearch.value.trim().toLowerCase();
  const filtered = partes.filter((parte) => {
    const values = [parte.folio, parte.respondiente_nombre, parte.fecha, parte.mp_nombre, parte.encargado_nombre].join(" ").toLowerCase();
    return !q || values.includes(q);
  });

  exportRows.innerHTML =
    filtered
      .map(
        (parte) => `
          <tr>
            <td>${parte.folio || ""}</td>
            <td>${parte.respondiente_nombre || "Parte de transito"}</td>
            <td>${formatDate(parte.fecha)}</td>
            <td>${parte.mp_nombre || "Sin MP"}</td>
            <td><span class="person-cell"><img class="avatar-mini" src="${parte.encargado_foto || "/img/usuario.png"}" alt="" /> ${parte.encargado_nombre || "Sin asignar"}</span></td>
            <td><input class="export-check" type="checkbox" value="${parte.id_parte}" ${exportSelectAll.checked ? "checked" : ""} /></td>
          </tr>
        `,
      )
      .join("") || `<tr><td colspan="6">No hay partes para exportar.</td></tr>`;
  updateExportCount();
}

function selectedExportPartes() {
  const selected = [...document.querySelectorAll(".export-check:checked")].map((input) => Number(input.value));
  return partes.filter((parte) => selected.includes(Number(parte.id_parte)));
}

async function exportPartes(type) {
  const selected = selectedExportPartes();
  if (!selected.length) {
    showToast("Selecciona al menos un parte para exportar", "error");
    return;
  }

  const names = { pdf: "PDF", excel: "Excel" };
  showConfirm("Exportar partes", `Estas seguro que quieres exportar ${selected.length} parte(s) en ${names[type]}?`, async () => {
    if (window.Swal) {
      Swal.fire({
        title: "Exportando",
        text: "Preparando archivo...",
        allowOutsideClick: false,
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true,
        didOpen: () => Swal.showLoading(),
      });
      await new Promise((resolve) => setTimeout(resolve, 1450));
    }
    const detailed = await loadDetailedParts(selected);
    downloadExport(type, detailed);
    await api("/api/partes/export", { method: "POST", body: JSON.stringify({ tipo: type, total: selected.length }) });
    closeModal("exportModal");
    showToast("Exportacion realizada con exito");
  });
}

async function loadDetailedParts(rows) {
  const detailed = [];
  for (const row of rows) {
    const data = await api(`/api/partes/${row.id_parte}`);
    detailed.push(data?.success ? data.data : row);
  }
  return detailed;
}

function downloadExport(type, rows) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (type === "excel") {
    const csv = toCsv(rows);
    downloadBlob(csv, `partes-${stamp}.csv`, "text/csv;charset=utf-8");
    return;
  }

  const html = exportHtml(rows);
  openPrintableExport(html, `partes-${stamp}.html`);
}

function updateExportCount() {
  const total = document.querySelectorAll(".export-check:checked").length;
  exportCount.textContent = `${total} seleccionado${total === 1 ? "" : "s"}`;
}

function exportHtml(rows) {
  const generatedAt = new Date().toLocaleString("es-MX");
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Partes exportados</title>
        <style>
          *{box-sizing:border-box}
          body{margin:0;background:#f4f6fb;color:#172033;font-family:Arial,sans-serif}
          .sheet{max-width:1020px;margin:0 auto;padding:28px}
          .doc-header{border-bottom:4px solid #06145f;padding:18px 0 14px;margin-bottom:22px}
          .doc-header h1{margin:0;color:#06145f;font-size:26px}
          .doc-header p{margin:6px 0 0;color:#667085}
          .export-part{page-break-inside:avoid;margin:0 0 24px;border:1px solid #d9dde8;border-radius:12px;background:#fff;overflow:hidden}
          .part-title{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:16px 20px;color:#fff;background:#06145f}
          .part-title h2{margin:0;font-size:18px}
          .part-title span{font-size:12px;opacity:.9}
          .part-body{padding:18px 20px}
          .section-title{margin:18px 0 8px;color:#06145f;font-size:14px;text-transform:uppercase;letter-spacing:.05em}
          .info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
          .field{border:1px solid #e5e7ef;border-radius:8px;padding:9px 11px;background:#fbfcff}
          .field b{display:block;margin-bottom:4px;color:#475467;font-size:11px;text-transform:uppercase}
          .field span{font-size:14px}
          .empty-field{color:#9a3412;font-style:italic}
          table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
          th,td{border:1px solid #e5e7ef;padding:8px;text-align:left;vertical-align:top}
          th{color:#06145f;background:#f4f6fb}
          @media print{body{background:#fff}.sheet{padding:0}.export-part{page-break-inside:avoid}}
        </style>
      </head>
      <body>
        <main class="sheet">
          <header class="doc-header">
            <h1>Partes de transito</h1>
            <p>Total de partes: ${rows.length} | Generado: ${escapeHtml(generatedAt)}</p>
          </header>
          ${rows.map(exportPartSection).join("")}
        </main>
        <script>window.print()</script>
      </body>
    </html>
  `;
}

function exportPartSection(parte) {
  return `
    <section class="export-part">
      <div class="part-title">
        <h2>${fieldHtml(parte.folio, "Parte sin folio")}</h2>
        <span>ID: ${fieldHtml(parte.id_parte)}</span>
      </div>
      <div class="part-body">
        <h3 class="section-title">Datos del sistema</h3>
        <div class="info-grid">
          ${exportField("ID del parte", parte.id_parte)}
          ${exportField("Fecha de creacion", formatDateTime(parte.fecha_creacion))}
          ${exportField("ID MP", parte.id_mp)}
          ${exportField("ID respondiente", parte.id_respondiente)}
          ${exportField("ID usuario creador", parte.creado_por)}
          ${exportField("ID usuario encargado", parte.asignado_a)}
        </div>

        <h3 class="section-title">Datos generales</h3>
        <div class="info-grid">
          ${exportField("Folio", parte.folio)}
          ${exportField("Fecha", formatDate(parte.fecha))}
          ${exportField("Hora", parte.hora)}
          ${exportField("Estado", parte.estado)}
          ${exportField("Gravedad general", parte.gravedad_general)}
          ${exportField("Respondiente", parte.respondiente_nombre)}
        </div>

        <h3 class="section-title">Asignacion</h3>
        <div class="info-grid">
          ${exportField("MP asignado", parte.mp_nombre)}
          ${exportField("Usuario encargado", parte.encargado_nombre)}
        </div>

        <h3 class="section-title">Personas involucradas</h3>
        <div class="info-grid">
          ${exportField("Numero de personas", parte.numero_personas)}
          ${exportField("Vehiculo asociado", parte.id_vehiculo)}
          ${exportField("Personas fallecidas", boolText(parte.personas_fallecidas))}
          ${exportField("Personas heridas", boolText(parte.personas_heridas))}
          ${exportField("Otros", boolText(parte.otros))}
          ${exportField("Numero de heridos", parte.numero_heridos)}
          ${exportField("Gravedad", parte.gravedad)}
          ${exportField("Observaciones", parte.observaciones)}
        </div>

        <h3 class="section-title">Vehiculos</h3>
        <table>
          <thead><tr><th>#</th><th>Marca</th><th>Modelo</th><th>Tipo</th><th>No. Serie</th><th>No. Placa</th></tr></thead>
          <tbody>${renderVehicleRows(parte.vehiculos, true)}</tbody>
        </table>
      </div>
    </section>
  `;
}

function exportField(label, value) {
  return `<div class="field"><b>${escapeHtml(label)}</b><span>${fieldHtml(value)}</span></div>`;
}

function toCsv(rows) {
  const header = [
    "ID",
    "Fecha de creacion",
    "ID MP",
    "ID respondiente",
    "ID usuario creador",
    "ID usuario encargado",
    "Folio",
    "Fecha",
    "Hora",
    "Estado",
    "Gravedad general",
    "Respondiente",
    "MP asignado",
    "Usuario encargado",
    "Numero de personas",
    "Vehiculo asociado",
    "Personas fallecidas",
    "Personas heridas",
    "Otros",
    "Numero de heridos",
    "Gravedad personas",
    "Observaciones",
    "Vehiculos",
  ];
  const lines = rows.map((parte) => [
    parte.id_parte,
    formatDateTime(parte.fecha_creacion),
    parte.id_mp,
    parte.id_respondiente,
    parte.creado_por,
    parte.asignado_a,
    parte.folio,
    formatDate(parte.fecha),
    parte.hora,
    parte.estado,
    parte.gravedad_general,
    parte.respondiente_nombre,
    parte.mp_nombre,
    parte.encargado_nombre,
    parte.numero_personas,
    parte.id_vehiculo,
    boolText(parte.personas_fallecidas),
    boolText(parte.personas_heridas),
    boolText(parte.otros),
    parte.numero_heridos,
    parte.gravedad,
    parte.observaciones,
    vehicleSummary(parte.vehiculos),
  ].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

function csvCell(value) {
  return `"${textValue(value).replaceAll('"', '""')}"`;
}

function downloadBlob(content, filename, type) {
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

function openPrintableExport(html, fallbackName) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (!printWindow) {
    downloadBlob(html, fallbackName, "text/html;charset=utf-8");
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function resetVehicles(vehicles = [{}]) {
  vehicleIndex = 0;
  vehiclesWrap.innerHTML = "";
  vehicles.forEach((vehicle) => addVehicle(vehicle));
  if (!vehiclesWrap.children.length) addVehicle();
  refreshVehicleSelect();
}

function addVehicle(vehicle = {}) {
  vehicleIndex += 1;
  const card = document.createElement("fieldset");
  card.className = "vehicle-card";
  card.dataset.vehicleIndex = String(vehicleIndex);
  card.innerHTML = `
    <legend>
      <span>Carro #${vehicleIndex}</span>
      <button class="vehicle-remove" type="button" title="Eliminar carro">
        <i class="fas fa-trash"></i>
      </button>
      <button class="vehicle-toggle" type="button" title="Minimizar carro">
        <i class="fas fa-chevron-up"></i>
      </button>
    </legend>
    <div class="vehicle-body form-grid cols-3">
      <label>Marca<input data-vehicle-field="marca" value="${escapeAttr(vehicle.marca)}" placeholder="Marca del carro..." /></label>
      <label>Modelo<input data-vehicle-field="modelo" value="${escapeAttr(vehicle.modelo)}" placeholder="Modelo del carro..." /></label>
      <label>No. Serie<input data-vehicle-field="numero_serie" value="${escapeAttr(vehicle.numero_serie)}" placeholder="No. Serie..." /></label>
      <label>Tipo<input data-vehicle-field="tipo" value="${escapeAttr(vehicle.tipo)}" placeholder="Tipo o color..." /></label>
      <label>No. Placa<input data-vehicle-field="numero_placa" value="${escapeAttr(vehicle.numero_placa)}" placeholder="No. Placa..." /></label>
    </div>
  `;
  card.querySelector(".vehicle-toggle").addEventListener("click", () => {
    card.classList.toggle("collapsed");
    card.querySelector(".vehicle-toggle i").classList.toggle("fa-chevron-up");
    card.querySelector(".vehicle-toggle i").classList.toggle("fa-chevron-down");
  });
  card.querySelector(".vehicle-remove").addEventListener("click", () => {
    if (vehiclesWrap.querySelectorAll(".vehicle-card").length <= 1) {
      showToast("Debe quedar al menos un carro en el formulario", "error");
      return;
    }
    card.remove();
    renumberVehicles();
    refreshVehicleSelect();
  });
  vehiclesWrap.appendChild(card);
  renumberVehicles();
  refreshVehicleSelect();
}

function collectVehicles() {
  return [...vehiclesWrap.querySelectorAll(".vehicle-card")].map((card, index) => {
    const vehicle = { numero_vehiculo: index + 1 };
    card.querySelectorAll("[data-vehicle-field]").forEach((input) => {
      vehicle[input.dataset.vehicleField] = input.value.trim();
    });
    return vehicle;
  }).filter((vehicle) => ["marca", "modelo", "tipo", "numero_serie", "numero_placa"].some((key) => vehicle[key]));
}

function refreshVehicleSelect() {
  const current = vehiclePersonSelect.value;
  const options = [...vehiclesWrap.querySelectorAll(".vehicle-card")].map((card, index) => {
    const plate = card.querySelector('[data-vehicle-field="numero_placa"]')?.value.trim();
    return `<option value="${index + 1}">Carro #${index + 1}${plate ? ` - ${plate}` : ""}</option>`;
  });
  vehiclePersonSelect.innerHTML = `<option value="">Selecciona un carro</option>${options.join("")}`;
  vehiclePersonSelect.value = current;
}

function renumberVehicles() {
  [...vehiclesWrap.querySelectorAll(".vehicle-card")].forEach((card, index) => {
    card.dataset.vehicleIndex = String(index + 1);
    const title = card.querySelector("legend span");
    if (title) title.textContent = `Carro #${index + 1}`;
  });
}

function applyViewMode() {
  const grid = viewMode === "grid";
  partesListView.hidden = grid;
  partesGridView.hidden = !grid;
  listViewBtn.classList.toggle("active", !grid);
  gridViewBtn.classList.toggle("active", grid);
}

function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem("partesViewMode", mode);
  applyViewMode();
}

function debounce(fn, wait = 250) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

function renderVehicleRows(vehicles = [], forExport = false) {
  return vehicles.length
    ? vehicles.map((vehicle, index) => `<tr><td>${index + 1}</td><td>${forExport ? fieldHtml(vehicle.marca) : vehicle.marca || ""}</td><td>${forExport ? fieldHtml(vehicle.modelo) : vehicle.modelo || ""}</td><td>${forExport ? fieldHtml(vehicle.tipo) : vehicle.tipo || ""}</td><td>${forExport ? fieldHtml(vehicle.numero_serie) : vehicle.numero_serie || ""}</td><td>${forExport ? fieldHtml(vehicle.numero_placa) : vehicle.numero_placa || ""}</td></tr>`).join("")
    : `<tr><td colspan="6">${forExport ? fieldHtml("") : "Sin vehiculos registrados."}</td></tr>`;
}

function vehicleSummary(vehicles = []) {
  return vehicles.length
    ? vehicles.map((vehicle, index) => `Carro ${index + 1}: ${[
        `Marca ${textValue(vehicle.marca)}`,
        `Modelo ${textValue(vehicle.modelo)}`,
        `Tipo ${textValue(vehicle.tipo)}`,
        `Serie ${textValue(vehicle.numero_serie)}`,
        `Placa ${textValue(vehicle.numero_placa)}`,
      ].join(" / ")}`).join(" | ")
    : "Campo vacio";
}

function escapeAttr(value = "") {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function textValue(value, fallback = "Campo vacio") {
  const clean = value === undefined || value === null ? "" : String(value).trim();
  return clean || fallback;
}

function fieldHtml(value, fallback = "Campo vacio") {
  const text = textValue(value, fallback);
  return text === "Campo vacio"
    ? `<span class="empty-field">${text}</span>`
    : escapeHtml(text);
}

function boolText(value) {
  if (value === undefined || value === null || value === "") return "Campo vacio";
  return Number(value) || value === true || value === "true" ? "Si" : "No";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

partSearch.addEventListener("input", debounce(loadPartes));
listViewBtn.addEventListener("click", () => setViewMode("list"));
gridViewBtn.addEventListener("click", () => setViewMode("grid"));
document.getElementById("addVehicleBtn").addEventListener("click", () => addVehicle());
vehiclesWrap.addEventListener("input", refreshVehicleSelect);

exportSearch.addEventListener("input", renderExportRows);
exportSelectAll.addEventListener("change", renderExportRows);
exportRows.addEventListener("change", (event) => {
  if (event.target.classList.contains("export-check")) updateExportCount();
});

resetVehicles();
applyViewMode();
loadPartes();
