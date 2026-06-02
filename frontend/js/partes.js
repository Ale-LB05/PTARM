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
      <td><img class="avatar-mini" src="${parte.encargado_foto || "/img/usuario.png"}" alt="" /> ${parte.mp_nombre || ""}</td>
      <td><span class="actions"><button class="icon-btn edit" onclick="openParteModal('edit', ${parte.id_parte})"><i class="fas fa-edit"></i></button><button class="icon-btn delete" onclick="deleteParte(${parte.id_parte})"><i class="fas fa-trash"></i></button><button class="icon-btn view" onclick="openParteModal('view', ${parte.id_parte})"><i class="fas fa-eye"></i></button></span></td>
    </tr>
  `).join("") || `<tr><td colspan="5">Aun no hay partes registrados.</td></tr>`;

  partesGridView.innerHTML = partes.map((parte) => `
    <article class="parte-card">
      <div>
        <span class="parte-folio">${parte.folio || "Sin folio"}</span>
        <h3>${parte.respondiente_nombre || "Parte de transito"}</h3>
      </div>
      <p><i class="far fa-calendar"></i> ${formatDate(parte.fecha) || "Sin fecha"}</p>
      <p><i class="fas fa-user-shield"></i> ${parte.mp_nombre || "Sin MP"}</p>
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
  submit.style.display = mode === "view" ? "none" : "";
  [...parteForm.elements].forEach((el) => {
    if (el.name) el.disabled = mode === "view";
  });
  document.getElementById("addVehicleBtn").disabled = mode === "view";

  if (id) {
    const data = await api(`/api/partes/${id}`);
    if (data?.success) fillForm(data.data);
    else showToast(data?.error || "No se pudo abrir el parte", "error");
  }
  document.getElementById("parteModal").classList.add("show");
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
    const values = [parte.folio, parte.respondiente_nombre, parte.fecha, parte.mp_nombre].join(" ").toLowerCase();
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
            <td><img class="avatar-mini" src="${parte.encargado_foto || "/img/usuario.png"}" alt="" /> ${parte.mp_nombre || ""}</td>
            <td><input class="export-check" type="checkbox" value="${parte.id_parte}" ${exportSelectAll.checked ? "checked" : ""} /></td>
          </tr>
        `,
      )
      .join("") || `<tr><td colspan="5">No hay partes para exportar.</td></tr>`;
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

  const names = { pdf: "PDF", excel: "Excel", zip: "ZIP" };
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

  if (type === "zip") {
    const json = JSON.stringify(rows, null, 2);
    downloadBlob(createZip(`partes-${stamp}.json`, json), `partes-${stamp}.zip`, "application/zip");
    return;
  }

  const html = `
    <!doctype html>
    <html><head><meta charset="utf-8"><title>Partes exportados</title>
    <style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:10px;text-align:left}h1{color:#06145f}</style>
    </head><body><h1>Partes de transito</h1>${exportTable(rows)}<script>window.print()</script></body></html>
  `;
  openPrintableExport(html, `partes-${stamp}.html`);
}

function exportTable(rows) {
  return rows.map((parte) => `
    <section class="export-part">
      <h2>${parte.folio || "Parte sin folio"}</h2>
      <table>
        <tbody>
          <tr><th>Respondiente</th><td>${parte.respondiente_nombre || ""}</td><th>MP</th><td>${parte.mp_nombre || ""}</td></tr>
          <tr><th>Fecha</th><td>${formatDate(parte.fecha)}</td><th>Hora</th><td>${parte.hora || ""}</td></tr>
          <tr><th>Estado</th><td>${parte.estado || ""}</td><th>Gravedad</th><td>${parte.gravedad_general || ""}</td></tr>
          <tr><th>Personas</th><td>${parte.numero_personas || ""}</td><th>Heridos</th><td>${parte.numero_heridos || ""}</td></tr>
        </tbody>
      </table>
      <h3>Vehiculos</h3>
      <table>
        <thead><tr><th>#</th><th>Marca</th><th>Modelo</th><th>Tipo</th><th>Serie</th><th>Placa</th></tr></thead>
        <tbody>${renderVehicleRows(parte.vehiculos)}</tbody>
      </table>
    </section>
  `).join("");
}

function toCsv(rows) {
  const header = ["Folio", "Respondiente", "Fecha", "Hora", "MP", "Estado", "Gravedad", "Vehiculos", "Personas", "Heridos"];
  const lines = rows.map((parte) => [
    parte.folio,
    parte.respondiente_nombre,
    formatDate(parte.fecha),
    parte.hora,
    parte.mp_nombre,
    parte.estado,
    parte.gravedad_general,
    vehicleSummary(parte.vehiculos),
    parte.numero_personas,
    parte.numero_heridos,
  ].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

function csvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
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
  vehiclesWrap.appendChild(card);
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

function renderVehicleRows(vehicles = []) {
  return vehicles.length
    ? vehicles.map((vehicle, index) => `<tr><td>${index + 1}</td><td>${vehicle.marca || ""}</td><td>${vehicle.modelo || ""}</td><td>${vehicle.tipo || ""}</td><td>${vehicle.numero_serie || ""}</td><td>${vehicle.numero_placa || ""}</td></tr>`).join("")
    : `<tr><td colspan="6">Sin vehiculos registrados.</td></tr>`;
}

function vehicleSummary(vehicles = []) {
  return vehicles.map((vehicle, index) => `Carro ${index + 1}: ${[vehicle.marca, vehicle.modelo, vehicle.tipo, vehicle.numero_serie, vehicle.numero_placa].filter(Boolean).join(" / ")}`).join(" | ");
}

function escapeAttr(value = "") {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function createZip(filename, content) {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(filename);
  const data = encoder.encode(content);
  const crc = crc32(data);
  const local = new Uint8Array(30 + nameBytes.length + data.length);
  const central = new Uint8Array(46 + nameBytes.length);
  const end = new Uint8Array(22);

  writeZipHeader(local, 0x04034b50, 20, 0, 0, crc, data.length, data.length, nameBytes);
  local.set(nameBytes, 30);
  local.set(data, 30 + nameBytes.length);

  writeZipHeader(central, 0x02014b50, 20, 20, 0, crc, data.length, data.length, nameBytes);
  central.set(nameBytes, 46);
  write32(central, 42, 0);

  write32(end, 0, 0x06054b50);
  write16(end, 8, 1);
  write16(end, 10, 1);
  write32(end, 12, central.length);
  write32(end, 16, local.length);

  const zip = new Uint8Array(local.length + central.length + end.length);
  zip.set(local, 0);
  zip.set(central, local.length);
  zip.set(end, local.length + central.length);
  return zip;
}

function writeZipHeader(target, signature, versionMade, versionNeeded, flags, crc, size, originalSize, nameBytes) {
  write32(target, 0, signature);
  if (signature === 0x02014b50) {
    write16(target, 4, versionMade);
    write16(target, 6, versionNeeded);
    write16(target, 28, nameBytes.length);
  } else {
    write16(target, 4, versionNeeded);
    write16(target, 26, nameBytes.length);
  }
  const offset = signature === 0x02014b50 ? 8 : 6;
  write16(target, offset, flags);
  write16(target, offset + 2, 0);
  write16(target, offset + 4, 0);
  write16(target, offset + 6, 0);
  write32(target, offset + 8, crc);
  write32(target, offset + 12, size);
  write32(target, offset + 16, originalSize);
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function write16(target, offset, value) {
  target[offset] = value & 255;
  target[offset + 1] = (value >>> 8) & 255;
}

function write32(target, offset, value) {
  write16(target, offset, value & 65535);
  write16(target, offset + 2, (value >>> 16) & 65535);
}

function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

partSearch.addEventListener("input", debounce(loadPartes));
listViewBtn.addEventListener("click", () => setViewMode("list"));
gridViewBtn.addEventListener("click", () => setViewMode("grid"));
document.getElementById("addVehicleBtn").addEventListener("click", () => addVehicle());
vehiclesWrap.addEventListener("input", refreshVehicleSelect);

exportSearch.addEventListener("input", renderExportRows);
exportSelectAll.addEventListener("change", renderExportRows);

resetVehicles();
applyViewMode();
loadPartes();
