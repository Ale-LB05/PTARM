setupLayout("partes");

let partes = [];
let editingId = null;
let viewMode = localStorage.getItem("partesViewMode") || "list";
let vehicleIndex = 0;
let partesPage = 1;
let advancedFilters = [];
let peoplePage = 1;
let peopleAssignments = [];

const partesRows = document.getElementById("partesRows");
const partesListView = document.getElementById("partesListView");
const partesGridView = document.getElementById("partesGridView");
const exportRows = document.getElementById("exportRows");
const parteForm = document.getElementById("parteForm");
const partSearch = document.getElementById("partSearch");
const advancedSearchBtn = document.getElementById("advancedSearchBtn");
const advancedSearchForm = document.getElementById("advancedSearchForm");
const advancedSearchField = document.getElementById("advancedSearchField");
const advancedSearchValue = document.getElementById("advancedSearchValue");
const advancedSearchOptions = document.getElementById("advancedSearchOptions");
const advancedSearchSummary = document.getElementById("advancedSearchSummary");
const advancedFilterList = document.getElementById("advancedFilterList");
const addAdvancedFilterBtn = document.getElementById("addAdvancedFilterBtn");
const clearAdvancedSearchBtn = document.getElementById("clearAdvancedSearchBtn");
const exportSearch = document.getElementById("exportSearch");
const exportSelectAll = document.getElementById("exportSelectAll");
const exportCount = document.getElementById("exportCount");
const vehiclesWrap = document.getElementById("vehiclesWrap");
const peopleAssignmentPanel = document.getElementById("peopleAssignmentPanel");
const peopleAssignmentRows = document.getElementById("peopleAssignmentRows");
const peopleAssignmentTableWrap = document.getElementById("peopleAssignmentTableWrap");
const togglePeopleTableBtn = document.getElementById("togglePeopleTableBtn");
const peoplePageSize = document.getElementById("peoplePageSize");
const peoplePrevPage = document.getElementById("peoplePrevPage");
const peopleNextPage = document.getElementById("peopleNextPage");
const peoplePageInfo = document.getElementById("peoplePageInfo");
const listViewBtn = document.getElementById("listViewBtn");
const gridViewBtn = document.getElementById("gridViewBtn");
const partDetailBody = document.getElementById("partDetailBody");
const partesPageSize = document.getElementById("partesPageSize");
const partesPrevPage = document.getElementById("partesPrevPage");
const partesNextPage = document.getElementById("partesNextPage");
const partesPageInfo = document.getElementById("partesPageInfo");
const respondienteOptions = document.getElementById("respondienteOptions");
const complementQuestions = document.getElementById("complementQuestions");
const canWritePartes = hasRole("administrador", "capturista");
const canExportPartes = hasRole("administrador", "capturista", "auxiliar");
const mpInput = parteForm.elements.id_mp;
const respondienteInput = parteForm.elements.respondiente_nombre;
let catalogsLoaded = false;
let partCatalogs = { mps: [], respondientes: [] };

/** Cierra cualquier modal por su id. */
function closeModal(id) {
  document.getElementById(id).classList.remove("show");
}

/** Carga los partes desde la API aplicando el buscador principal. */
async function loadPartes() {
  const data = await api(partesSearchUrl());
  if (!data || !data.success) {
    showToast(data?.error || "No se pudieron cargar los partes", "error");
    return;
  }
  partes = hasAdvancedSearch() ? await filterAdvancedPartes(data.data) : data.data;
  partesPage = 1;
  renderAdvancedSearchOptions(advancedSearchField.value);
  renderPartes();
}

/** Construye la URL de busqueda general o avanzada para consultar partes. */
function partesSearchUrl() {
  const params = new URLSearchParams();
  if (!hasAdvancedSearch() && partSearch.value.trim()) {
    params.set("q", partSearch.value.trim());
  }
  return `/api/partes${params.toString() ? `?${params.toString()}` : ""}`;
}

/** Indica si hay un filtro avanzado activo. */
function hasAdvancedSearch() {
  return advancedFilters.length > 0;
}

/** Abre el modal de busqueda avanzada y prepara el ultimo filtro usado. */
function openAdvancedSearch() {
  loadPartCatalogs();
  advancedSearchField.value = "";
  advancedSearchValue.value = "";
  syncAdvancedSearchInput();
  renderAdvancedFilterList();
  document.getElementById("advancedSearchModal").classList.add("show");
  advancedSearchField.focus();
}

/** Ajusta el tipo de dato esperado segun el apartado elegido. */
function syncAdvancedSearchInput() {
  const field = advancedSearchField.value;
  advancedSearchValue.type = field === "fecha" ? "date" : field === "hora" ? "time" : "text";
  advancedSearchValue.placeholder = field === "fecha" ? "Selecciona una fecha" : field === "hora" ? "Selecciona una hora" : "Escribe el dato...";
  advancedSearchValue.toggleAttribute("list", !["fecha", "hora"].includes(field));
  if (!["fecha", "hora"].includes(field)) advancedSearchValue.setAttribute("list", "advancedSearchOptions");
  renderAdvancedSearchOptions(field);
}

/** Muestra sugerencias del apartado seleccionado sin bloquear escritura manual. */
function renderAdvancedSearchOptions(field) {
  const options = advancedSearchOptionsForField(field);
  advancedSearchOptions.innerHTML = options.map((value) => `<option value="${escapeAttr(value)}"></option>`).join("");
}

/** Devuelve opciones conocidas para campos con datos fijos o catalogos. */
function advancedSearchOptionsForField(field) {
  const values = {
    estado: ["Activo", "Borrador", "Cerrado", "Archivado", "Cancelado"],
    gravedad: ["Sin clasificar", "Bajo", "Medio", "Alto", "Otro"],
    mp: [...partCatalogs.mps.map((mp) => mp.nombre), ...partes.map((parte) => parte.mp_nombre)],
    respondiente: [...partCatalogs.respondientes.map((respondiente) => respondiente.nombre), ...partes.map((parte) => parte.respondiente_nombre)],
    encargado: partes.map((parte) => parte.encargado_nombre),
    folio: partes.map((parte) => parte.folio),
    placa: partes.flatMap((parte) => splitSearchValues(parte.placas || parte.numero_placa)),
    serie: partes.flatMap((parte) => splitSearchValues(parte.series || parte.numero_serie)),
    marca: partes.flatMap((parte) => splitSearchValues(parte.marcas || parte.marca)),
    modelo: partes.flatMap((parte) => splitSearchValues(parte.modelos || parte.modelo)),
  };
  return uniqueClean(values[field] || []);
}

/** Separa valores agregados de vehiculos para ofrecerlos en la lista. */
function splitSearchValues(value = "") {
  return String(value || "").split(/\s{2,}|\|/).map((item) => item.trim()).filter(Boolean);
}

/** Limpia duplicados y vacios. */
function uniqueClean(values) {
  const seen = new Set();
  return values.filter((value) => {
    const clean = String(value || "").trim();
    const key = clean.toLowerCase();
    if (!clean || clean === "Sin MP" || clean === "Sin asignar" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Aplica el filtro avanzado y recarga la lista. */
function applyAdvancedSearch(event) {
  event.preventDefault();
  addAdvancedFilter({ silent: true });
  if (!hasAdvancedSearch()) {
    showToast("Agrega al menos un filtro", "error");
    return;
  }
  partSearch.value = "";
  closeModal("advancedSearchModal");
  updateAdvancedSearchSummary();
  loadPartes();
}

/** Agrega el filtro capturado y deja listo el espacio para capturar otro. */
function addAdvancedFilter(options = {}) {
  const field = advancedSearchField.value;
  const value = advancedSearchValue.value.trim();
  if (!field || !value) {
    if (!options.silent) showToast("Selecciona un apartado y escribe un dato", "error");
    return false;
  }
  advancedFilters.push({ field, value });
  advancedSearchField.value = "";
  advancedSearchValue.value = "";
  syncAdvancedSearchInput();
  renderAdvancedFilterList();
  updateAdvancedSearchSummary();
  advancedSearchField.focus();
  return true;
}

/** Limpia el filtro avanzado activo y vuelve a mostrar todos los partes. */
function clearAdvancedSearch() {
  advancedFilters = [];
  advancedSearchField.value = "";
  advancedSearchValue.value = "";
  syncAdvancedSearchInput();
  renderAdvancedFilterList();
  updateAdvancedSearchSummary();
  closeModal("advancedSearchModal");
  loadPartes();
}

/** Elimina un filtro avanzado de la lista del modal. */
function removeAdvancedFilter(index) {
  advancedFilters.splice(index, 1);
  renderAdvancedFilterList();
  updateAdvancedSearchSummary();
}

/** Pinta los filtros acumulados dentro del modal. */
function renderAdvancedFilterList() {
  advancedFilterList.hidden = advancedFilters.length === 0;
  advancedFilterList.innerHTML = advancedFilters.map((filter, index) => `
    <span class="advanced-filter-chip">
      <i class="fas fa-filter"></i>
      ${escapeHtml(advancedFilterLabel(filter.field))}: <strong>${escapeHtml(filter.value)}</strong>
      <button type="button" onclick="removeAdvancedFilter(${index})" title="Quitar filtro">
        <i class="fas fa-times"></i>
      </button>
    </span>
  `).join("");
}

/** Muestra una etiqueta compacta del filtro avanzado activo. */
function updateAdvancedSearchSummary() {
  if (!hasAdvancedSearch()) {
    advancedSearchSummary.hidden = true;
    advancedSearchSummary.innerHTML = "";
    advancedSearchBtn.classList.remove("active");
    return;
  }
  advancedSearchSummary.hidden = false;
  advancedSearchSummary.innerHTML = `
    <span><i class="fas fa-filter"></i> ${advancedFilters.length} filtro${advancedFilters.length === 1 ? "" : "s"} activo${advancedFilters.length === 1 ? "" : "s"}</span>
    <button type="button" onclick="clearAdvancedSearch()" title="Limpiar busqueda avanzada">
      <i class="fas fa-times"></i>
    </button>
  `;
  advancedSearchBtn.classList.add("active");
}

/** Filtra en el navegador como respaldo cuando el servidor devuelve todos los registros. */
async function filterAdvancedPartes(rows) {
  if (advancedFilters.some((filter) => isVehicleSearchField(filter.field))) {
    const detailed = await loadDetailedParts(rows);
    return detailed.filter((parte) => matchesAdvancedSearch(parte));
  }
  return rows.filter((parte) => matchesAdvancedSearch(parte));
}

/** Indica si el filtro avanzado debe revisar todos los vehiculos del parte. */
function isVehicleSearchField(field) {
  return ["placa", "serie", "marca", "modelo"].includes(field);
}

/** Compara un parte contra el filtro avanzado activo. */
function matchesAdvancedSearch(parte) {
  return advancedFilters.every((filter) => {
    const needle = normalizeSearchText(filter.value);
    const value = advancedSearchValueForParte(parte, filter.field);
    if (filter.field === "fecha") return String(value || "").slice(0, 10) === filter.value;
    if (filter.field === "hora") return String(value || "").slice(0, 5) === filter.value;
    return normalizeSearchText(value).includes(needle);
  });
}

/** Obtiene el texto visible del apartado elegido. */
function advancedFilterLabel(field) {
  return advancedSearchField.querySelector(`option[value="${field}"]`)?.textContent || "Apartado";
}

/** Obtiene el dato resumido del parte segun el apartado elegido. */
function advancedSearchValueForParte(parte, field) {
  const vehicleValues = vehicleSearchValues(parte);
  const fields = {
    folio: parte.folio,
    fecha: parte.fecha,
    hora: parte.hora,
    estado: parte.estado,
    gravedad: parte.gravedad_general,
    mp: parte.mp_nombre,
    respondiente: parte.respondiente_nombre,
    encargado: parte.encargado_nombre,
    placa: vehicleValues.placa || parte.placas || parte.numero_placa,
    serie: vehicleValues.serie || parte.series || parte.numero_serie,
    marca: vehicleValues.marca || parte.marcas || parte.marca,
    modelo: vehicleValues.modelo || parte.modelos || parte.modelo,
  };
  return fields[field] || "";
}

/** Junta los datos de todos los carros registrados en un parte detallado. */
function vehicleSearchValues(parte) {
  const vehiculos = Array.isArray(parte.vehiculos) ? parte.vehiculos : [];
  return {
    placa: vehiculos.map((vehiculo) => vehiculo.numero_placa).join(" "),
    serie: vehiculos.map((vehiculo) => vehiculo.numero_serie).join(" "),
    marca: vehiculos.map((vehiculo) => vehiculo.marca).join(" "),
    modelo: vehiculos.map((vehiculo) => vehiculo.modelo).join(" "),
  };
}

/** Normaliza texto para buscar sin depender de mayusculas o acentos. */
function normalizeSearchText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Carga MP y respondientes desde base de datos para los campos buscables. */
async function loadPartCatalogs(force = false) {
  if (catalogsLoaded && !force) return;
  const selectedMp = mpInput.value;
  const data = await api("/api/partes/catalogos");
  if (!data?.success) return;
  partCatalogs = data.data;
  mpInput.innerHTML = `<option value="">Sin MP</option>${data.data.mps.map((mp) => `<option value="${escapeAttr(mp.id_mp)}">${escapeHtml(mp.nombre)}</option>`).join("")}`;
  if (selectedMp) mpInput.value = selectedMp;
  respondienteOptions.innerHTML = data.data.respondientes.map((respondiente) => `<option value="${escapeAttr(respondiente.nombre)}"></option>`).join("");
  catalogsLoaded = true;
  renderAdvancedSearchOptions(advancedSearchField.value);
}

/** Llena el select de usuarios que pueden quedar como encargados del parte. */
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

/** Pinta la tabla y las tarjetas de partes segun pagina y modo de vista. */
function renderPartes() {
  const visible = pagedPartes();

  partesRows.innerHTML = visible.map((parte) => `
    <tr>
      <td>${parte.folio || ""}</td>
      <td>${parte.respondiente_nombre || "Parte de tránsito"}</td>
      <td>${formatDate(parte.fecha)}</td>
      <td>${renderStatus(parte.estado)}</td>
      <td>${parte.mp_nombre || "Sin MP"}</td>
      <td><span class="person-cell"><img class="avatar-mini" src="${parte.encargado_foto || "/img/usuario.png"}" alt="" /> ${parte.encargado_nombre || "Sin asignar"}</span></td>
      <td>${renderParteActions(parte)}</td>
    </tr>
  `).join("") || `<tr><td colspan="7">Aún no hay partes registrados.</td></tr>`;

  partesGridView.innerHTML = visible.map((parte) => `
    <article class="parte-card">
      <div>
        <span class="parte-folio">${parte.folio || "Sin folio"}</span>
        <h3>${parte.respondiente_nombre || "Parte de tránsito"}</h3>
      </div>
      <p><i class="far fa-calendar"></i> ${formatDate(parte.fecha) || "Sin fecha"}</p>
      <p><i class="fas fa-user-shield"></i> ${parte.mp_nombre || "Sin MP"}</p>
      <p><img class="avatar-mini" src="${parte.encargado_foto || "/img/usuario.png"}" alt="" /> ${parte.encargado_nombre || "Sin asignar"}</p>
      ${renderStatus(parte.estado)}
      <div class="card-actions">
        ${canWritePartes ? `<button class="icon-btn edit" onclick="openParteModal('edit', ${parte.id_parte})"><i class="fas fa-edit"></i></button>
        <button class="icon-btn delete" onclick="deleteParte(${parte.id_parte})"><i class="fas fa-trash"></i></button>` : ""}
        <button class="icon-btn view" onclick="openParteModal('view', ${parte.id_parte})"><i class="fas fa-eye"></i></button>
      </div>
    </article>
  `).join("") || `<p class="empty-state">Aún no hay partes registrados.</p>`;

  renderPartesPageControls();
  applyViewMode();
}

/** Muestra el estado del parte con punto de color semantico. */
function renderStatus(estado = "") {
  const label = estado || "Sin estado";
  return `<span class="status-pill status-${statusKey(label)}"><span class="status-dot"></span>${escapeHtml(label)}</span>`;
}

/** Convierte el texto de estado en clase CSS segura. */
function statusKey(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Genera los botones permitidos para editar, eliminar o visualizar un parte. */
function renderParteActions(parte) {
  return `
    <span class="actions">
      ${canWritePartes ? `<button class="icon-btn edit" onclick="openParteModal('edit', ${parte.id_parte})"><i class="fas fa-edit"></i></button><button class="icon-btn delete" onclick="deleteParte(${parte.id_parte})"><i class="fas fa-trash"></i></button>` : ""}
      <button class="icon-btn view" onclick="openParteModal('view', ${parte.id_parte})"><i class="fas fa-eye"></i></button>
    </span>
  `;
}

/** Devuelve solo los partes visibles segun paginacion actual. */
function pagedPartes() {
  const pageSize = Number(partesPageSize.value || 5);
  const totalPages = Math.max(1, Math.ceil(partes.length / pageSize));
  partesPage = Math.min(Math.max(partesPage, 1), totalPages);
  const start = (partesPage - 1) * pageSize;
  return partes.slice(start, start + pageSize);
}

/** Actualiza texto y estado de botones de paginacion de partes. */
function renderPartesPageControls() {
  const pageSize = Number(partesPageSize.value || 5);
  const totalPages = Math.max(1, Math.ceil(partes.length / pageSize));
  partesPageInfo.textContent = `Página ${partesPage} de ${totalPages}`;
  partesPrevPage.disabled = partesPage <= 1;
  partesNextPage.disabled = partesPage >= totalPages;
}

/** Abre el modal de parte en modo crear, editar o ver. */
async function openParteModal(mode, id = null) {
  if (mode !== "view" && !canWritePartes) {
    showToast("No tienes permiso para modificar partes", "error");
    return;
  }
  await loadUsersSelect();
  await loadPartCatalogs(true);
  parteForm.reset();
  resetVehicles();
  peoplePage = 1;
  peopleAssignments = [];
  renderPeopleAssignments(0, []);
  peopleAssignmentTableWrap.classList.remove("is-hidden");
  togglePeopleTableBtn.innerHTML = `<i class="fas fa-eye-slash"></i> Ocultar tabla`;
  updateComplementQuestions();
  editingId = id;
  const title = document.getElementById("parteModalTitle");
  const submit = document.getElementById("parteSubmit");
  title.textContent = mode === "edit" ? "Editar Parte" : mode === "view" ? "Visualizar Parte" : "Nuevo Parte";
  submit.textContent = mode === "edit" ? "Guardar parte" : "Crear nuevo";

  if (id) {
    const data = await api(`/api/partes/${id}`);
    if (data?.success) fillForm(data.data);
    else showToast(data?.error || "No se pudo abrir el parte", "error");
  }
  setParteFormMode(mode);
  document.getElementById("parteModal").classList.add("show");
}

/** Bloquea o habilita campos del formulario cuando se visualiza un parte. */
function setParteFormMode(mode) {
  const isView = mode === "view";
  document.getElementById("parteSubmit").style.display = isView ? "none" : "";
  [...parteForm.elements].forEach((el) => {
    if (el.name) el.disabled = isView;
  });
  document.getElementById("addVehicleBtn").disabled = isView;
  peopleAssignmentRows.querySelectorAll("input, select").forEach((field) => {
    field.disabled = isView;
  });
  vehiclesWrap.querySelectorAll("button").forEach((button) => {
    button.disabled = isView;
  });
  vehiclesWrap.classList.toggle("view-only", isView);
}

/** Llena el formulario con la información de un parte existente. */
function fillForm(parte) {
  ensureSelectOption(mpInput, parte.id_mp, parte.mp_nombre);
  Object.entries(parte).forEach(([key, value]) => {
    const el = parteForm.elements[key];
    if (!el || value === null) return;
    if (el.tagName === "SELECT") ensureSelectOption(el, value);
    if (el.type === "checkbox") el.checked = Boolean(value);
    else if (el.length && el[0]?.type === "radio") [...el].forEach((radio) => radio.checked = radio.value === value);
    else el.value = String(value).slice(0, el.type === "date" ? 10 : undefined);
  });
  fillComplementDetails(parte);
  resetVehicles(parte.vehiculos?.length ? parte.vehiculos : [parte]);
  peoplePage = 1;
  peopleAssignments = [];
  renderPeopleAssignments(Number(parte.numero_personas) || 0, parte.personas_detalle || []);
  updateComplementQuestions();
}

/** Agrega una opcion temporal si un parte antiguo usa un valor que ya no esta activo. */
function ensureSelectOption(select, value, label = value) {
  if (value === null || value === undefined || value === "") return;
  const exists = [...select.options].some((option) => option.value === String(value));
  if (exists) return;
  select.innerHTML += `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`;
}

/** Restaura los campos especificos de complementos al abrir un parte existente. */
function fillComplementDetails(parte) {
  parteForm.numero_fallecidos.value = parte.numero_fallecidos || "";
  parteForm.observacion_fallecidos.value = parte.observacion_fallecidos || "";
}

parteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(parteForm));
  const vehicles = collectVehicles();
  payload.vehiculos = vehicles;
  payload.personas_detalle = collectPeopleAssignments();
  delete payload.marca;
  delete payload.modelo;
  delete payload.tipo;
  delete payload.numero_serie;
  delete payload.numero_placa;
  payload.personas_fallecidas = parteForm.personas_fallecidas.checked;
  payload.personas_heridas = parteForm.personas_heridas.checked;
  payload.otros = parteForm.otros.checked;
  if (!payload.personas_fallecidas) {
    payload.numero_fallecidos = "";
    payload.observacion_fallecidos = "";
  }
  if (!payload.personas_heridas) {
    payload.numero_heridos = "";
    payload.gravedad = "";
  }
  payload.observaciones = buildComplementNotes(payload);
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

/** Elimina un parte tras confirmacion y recarga la lista. */
function deleteParte(id) {
  if (!canWritePartes) {
    showToast("No tienes permiso para eliminar partes", "error");
    return;
  }
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

/** Abre el modal de exportacion si el rol tiene permiso. */
function openExport() {
  if (!canExportPartes) {
    showToast("No tienes permiso para exportar partes", "error");
    return;
  }
  exportSearch.value = "";
  exportSelectAll.checked = false;
  renderExportRows();
  document.getElementById("exportModal").classList.add("show");
}

/** Pinta las filas seleccionables dentro del modal de exportacion. */
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
            <td>${parte.respondiente_nombre || "Parte de tránsito"}</td>
            <td>${formatDate(parte.fecha)}</td>
            <td>${parte.mp_nombre || "Sin MP"}</td>
            <td><span class="person-cell"><img class="avatar-mini" src="${parte.encargado_foto || "/img/usuario.png"}" alt="" /> ${parte.encargado_nombre || "Sin asignar"}</span></td>
            <td class="export-select-cell"><input class="export-check" type="checkbox" value="${parte.id_parte}" ${exportSelectAll.checked ? "checked" : ""} /></td>
          </tr>
        `,
      )
      .join("") || `<tr><td colspan="6">No hay partes para exportar.</td></tr>`;
  updateExportCount();
}

/** Obtiene los partes marcados para exportar. */
function selectedExportPartes() {
  const selected = [...document.querySelectorAll(".export-check:checked")].map((input) => Number(input.value));
  return partes.filter((parte) => selected.includes(Number(parte.id_parte)));
}

/** Exporta los partes seleccionados en PDF imprimible o Excel. */
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

/** Solicita a la API los datos completos de cada parte seleccionado. */
async function loadDetailedParts(rows) {
  const detailed = [];
  for (const row of rows) {
    const data = await api(`/api/partes/${row.id_parte}`);
    detailed.push(data?.success ? data.data : row);
  }
  return detailed;
}

/** Decide el tipo de archivo que se descargará según la opción elegida. */
function downloadExport(type, rows) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (type === "excel") {
    const workbook = excelHtml(rows);
    downloadBlob(workbook, `partes-${stamp}.xls`, "application/vnd.ms-excel;charset=utf-8");
    return;
  }

  const html = exportHtml(rows);
  openPrintableExport(html, `partes-${stamp}.html`);
}

/** Actualiza el contador de partes seleccionados para exportar. */
function updateExportCount() {
  const total = document.querySelectorAll(".export-check:checked").length;
  exportCount.textContent = `${total} seleccionado${total === 1 ? "" : "s"}`;
}

/** Construye el HTML imprimible usado para exportar en PDF. */
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
          @page{margin:14mm}
          html,body{min-height:0}
          body{margin:0;background:#f4f6fb;color:#172033;font-family:Arial,sans-serif}
          .sheet{max-width:1020px;margin:0 auto;padding:28px}
          .doc-header{border-bottom:4px solid #06145f;padding:18px 0 14px;margin-bottom:22px}
          .doc-header h1{margin:0;color:#06145f;font-size:26px}
          .doc-header p{margin:6px 0 0;color:#667085}
          .export-part{break-inside:auto;page-break-inside:auto;margin:0 0 24px;border:1px solid #d9dde8;border-radius:12px;background:#fff;overflow:hidden}
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
          @media print{body{background:#fff}.sheet{padding:0}.export-part{break-inside:auto;page-break-inside:auto}.export-part:last-child{margin-bottom:0}}
        </style>
      </head>
      <body>
        <main class="sheet">
          <header class="doc-header">
            <h1>Partes de tránsito</h1>
            <p>Total de partes: ${rows.length} | Generado: ${escapeHtml(generatedAt)}</p>
          </header>
          ${rows.map(exportPartSection).join("")}
        </main>
        <script>window.print()</script>
      </body>
    </html>
  `;
}

/** Construye la seccion individual de un parte dentro del PDF. */
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
          ${exportField("Número de personas", parte.numero_personas)}
          ${exportField("Personas fallecidas", boolText(parte.personas_fallecidas))}
          ${exportField("Número de fallecidos", parte.numero_fallecidos)}
          ${exportField("Observación de fallecidos", parte.observacion_fallecidos)}
          ${exportField("Personas heridas", boolText(parte.personas_heridas))}
          ${exportField("Otros", boolText(parte.otros))}
          ${exportField("Número de heridos", parte.numero_heridos)}
          ${exportField("Gravedad", parte.gravedad)}
          ${exportField("Observaciones", parte.observaciones)}
        </div>
        <table>
          <thead><tr><th>#</th><th>Nombre</th><th>Vehículo</th><th>Participación</th></tr></thead>
          <tbody>${renderPeopleRows(parte.personas_detalle, true)}</tbody>
        </table>

        <h3 class="section-title">Vehículos</h3>
        <table>
          <thead><tr><th>#</th><th>Marca</th><th>Modelo</th><th>Tipo</th><th>No. Serie</th><th>No. Placa</th></tr></thead>
          <tbody>${renderVehicleRows(parte.vehiculos, true)}</tbody>
        </table>
      </div>
    </section>
  `;
}

/** Devuelve un campo de exportacion con etiqueta y valor seguro. */
function exportField(label, value) {
  return `<div class="field"><b>${escapeHtml(label)}</b><span>${fieldHtml(value)}</span></div>`;
}

/** Construye un archivo HTML compatible con Excel con resumen y detalle. */
function excelHtml(rows) {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body{font-family:Arial,sans-serif}
          h1{color:#06145f}
          h2{margin-top:22px;color:#06145f}
          table{border-collapse:collapse;width:100%;margin-bottom:18px}
          th{background:#06145f;color:#fff;font-weight:700}
          th,td{border:1px solid #b9c0d4;padding:8px;text-align:left;vertical-align:top}
          .section{background:#eef2ff;color:#06145f;font-weight:700}
        </style>
      </head>
      <body>
        <h1>Partes de tránsito</h1>
        <p>Total de partes: ${rows.length} | Generado: ${escapeHtml(new Date().toLocaleString("es-MX"))}</p>
        <table>
          <thead>
            <tr>
              <th>Folio</th><th>Fecha</th><th>Hora</th><th>Estado</th><th>Gravedad</th>
              <th>Respondiente</th><th>MP asignado</th><th>Usuario encargado</th>
              <th>Personas</th><th>Detalle personas</th><th>Fallecidos</th><th>Heridos</th><th>Observaciones</th><th>Vehículos</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((parte) => `
              <tr>
                <td>${fieldHtml(parte.folio)}</td>
                <td>${fieldHtml(formatDate(parte.fecha))}</td>
                <td>${fieldHtml(parte.hora)}</td>
                <td>${fieldHtml(parte.estado)}</td>
                <td>${fieldHtml(parte.gravedad_general)}</td>
                <td>${fieldHtml(parte.respondiente_nombre)}</td>
                <td>${fieldHtml(parte.mp_nombre)}</td>
                <td>${fieldHtml(parte.encargado_nombre)}</td>
                <td>${fieldHtml(parte.numero_personas)}</td>
                <td>${fieldHtml(peopleSummary(parte.personas_detalle))}</td>
                <td>${fieldHtml(parte.numero_fallecidos)}</td>
                <td>${fieldHtml(parte.numero_heridos)}</td>
                <td>${fieldHtml(parte.observaciones)}</td>
                <td>${fieldHtml(vehicleSummary(parte.vehiculos))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        ${rows.map((parte) => `
          <h2>${fieldHtml(parte.folio, "Parte sin folio")}</h2>
          <table>
            <tr><td class="section" colspan="2">Datos generales</td></tr>
            <tr><th>Respondiente</th><td>${fieldHtml(parte.respondiente_nombre)}</td></tr>
            <tr><th>MP asignado</th><td>${fieldHtml(parte.mp_nombre)}</td></tr>
            <tr><th>Encargado</th><td>${fieldHtml(parte.encargado_nombre)}</td></tr>
            <tr><th>Personas fallecidas</th><td>${fieldHtml(boolText(parte.personas_fallecidas))}</td></tr>
            <tr><th>Número de fallecidos</th><td>${fieldHtml(parte.numero_fallecidos)}</td></tr>
            <tr><th>Observación de fallecidos</th><td>${fieldHtml(parte.observacion_fallecidos)}</td></tr>
            <tr><th>Personas heridas</th><td>${fieldHtml(boolText(parte.personas_heridas))}</td></tr>
            <tr><th>Otros</th><td>${fieldHtml(boolText(parte.otros))}</td></tr>
            <tr><th>Observaciones</th><td>${fieldHtml(parte.observaciones)}</td></tr>
          </table>
          <table>
            <tr><td class="section" colspan="4">Personas involucradas</td></tr>
            <tr><th>#</th><th>Nombre</th><th>Vehículo</th><th>Participación</th></tr>
            ${renderPeopleRows(parte.personas_detalle, true)}
          </table>
          <table>
            <tr><td class="section" colspan="6">Vehículos</td></tr>
            <tr><th>#</th><th>Marca</th><th>Modelo</th><th>Tipo</th><th>No. Serie</th><th>No. Placa</th></tr>
            ${renderVehicleRows(parte.vehiculos, true)}
          </table>
        `).join("")}
      </body>
    </html>
  `;
}

/** Oculta botones de crear/exportar segun permisos del rol actual. */
function applyPartPermissions() {
  document.getElementById("createParteBtn").hidden = !canWritePartes;
  document.getElementById("openExportBtn").hidden = !canExportPartes;
}

/** Descarga texto o HTML como archivo usando un Blob temporal. */
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

/** Abre el HTML imprimible en otra ventana o descarga si el navegador lo bloquea. */
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

/** Reinicia la lista de vehiculos del formulario. */
function resetVehicles(vehicles = [{}]) {
  vehicleIndex = 0;
  vehiclesWrap.innerHTML = "";
  vehicles.forEach((vehicle) => addVehicle(vehicle));
  if (!vehiclesWrap.children.length) addVehicle();
  refreshPeopleVehicleOptions();
}

/** Agrega una tarjeta de vehiculo al formulario. */
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
    refreshPeopleVehicleOptions();
  });
  vehiclesWrap.appendChild(card);
  renumberVehicles();
  refreshPeopleVehicleOptions();
}

/** Recolecta los vehiculos escritos en el formulario. */
function collectVehicles() {
  return [...vehiclesWrap.querySelectorAll(".vehicle-card")].map((card, index) => {
    const vehicle = { numero_vehiculo: index + 1 };
    card.querySelectorAll("[data-vehicle-field]").forEach((input) => {
      vehicle[input.dataset.vehicleField] = input.value.trim();
    });
    return vehicle;
  }).filter((vehicle) => ["marca", "modelo", "tipo", "numero_serie", "numero_placa"].some((key) => vehicle[key]));
}

/** Reenumera los vehiculos cuando se agregan o eliminan tarjetas. */
function renumberVehicles() {
  [...vehiclesWrap.querySelectorAll(".vehicle-card")].forEach((card, index) => {
    card.dataset.vehicleIndex = String(index + 1);
    const title = card.querySelector("legend span");
    if (title) title.textContent = `Carro #${index + 1}`;
  });
}

/** Devuelve los vehiculos actuales del formulario con etiqueta entendible para personas. */
function currentVehicleOptions() {
  return [...vehiclesWrap.querySelectorAll(".vehicle-card")].map((card, index) => {
    const vehicle = {};
    card.querySelectorAll("[data-vehicle-field]").forEach((input) => {
      vehicle[input.dataset.vehicleField] = input.value.trim();
    });
    const details = [
      vehicle.marca,
      vehicle.modelo,
      vehicle.tipo,
      vehicle.numero_placa ? `Placa ${vehicle.numero_placa}` : "",
    ].filter(Boolean).join(" / ");
    return {
      value: String(index + 1),
      label: `Vehículo #${index + 1}${details ? ` - ${details}` : ""}`,
    };
  });
}

/** Actualiza todos los selectores de vehiculo dentro del listado de personas. */
function refreshPeopleVehicleOptions() {
  const options = currentVehicleOptions();
  peopleAssignmentRows.querySelectorAll("[data-person-field='numero_vehiculo']").forEach((select) => {
    const current = select.value;
    select.innerHTML = `<option value="">Sin vehículo</option>${options.map((vehicle) => `<option value="${escapeAttr(vehicle.value)}">${escapeHtml(vehicle.label)}</option>`).join("")}`;
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  });
}

/** Crea la tabla de personas segun la cantidad capturada. */
function renderPeopleAssignments(count = Number(parteForm.numero_personas.value) || 0, savedPeople = peopleAssignments) {
  syncPeopleAssignmentsFromRows();
  const safeCount = Math.max(0, Number(count) || 0);
  peopleAssignments = Array.from({ length: safeCount }, (_, index) => savedPeople[index] || peopleAssignments[index] || defaultPersonAssignment(index));
  const pageSize = Number(peoplePageSize.value || 5);
  const totalPages = Math.max(1, Math.ceil(safeCount / pageSize));
  peoplePage = Math.min(Math.max(peoplePage, 1), totalPages);
  const start = (peoplePage - 1) * pageSize;
  const visiblePeople = peopleAssignments.slice(start, start + pageSize);
  peopleAssignmentPanel.hidden = safeCount === 0;
  peopleAssignmentRows.innerHTML = "";
  visiblePeople.forEach((saved, rowIndex) => {
    const personIndex = start + rowIndex;
    const row = document.createElement("tr");
    row.dataset.personIndex = String(personIndex);
    row.innerHTML = `
      <td>Persona ${personIndex + 1}</td>
      <td>
        <input data-person-field="nombre" value="${escapeAttr(saved.nombre)}" placeholder="Nombre de la persona" />
      </td>
      <td>
        <select data-person-field="numero_vehiculo" data-saved-vehicle="${escapeAttr(saved.numero_vehiculo || saved.vehiculo_numero)}"></select>
      </td>
      <td>
        <select data-person-field="tipo_participacion">
          ${["Conductor", "Pasajero", "Civil"].map((type) => `<option value="${type}"${(saved.tipo_participacion || "Civil") === type ? " selected" : ""}>${type}</option>`).join("")}
        </select>
      </td>
    `;
    peopleAssignmentRows.appendChild(row);
  });
  refreshPeopleVehicleOptions();
  peopleAssignmentRows.querySelectorAll("[data-person-field='numero_vehiculo']").forEach((select) => {
    const savedVehicle = select.dataset.savedVehicle;
    if (savedVehicle && [...select.options].some((option) => option.value === savedVehicle)) select.value = savedVehicle;
  });
  renderPeoplePageControls(safeCount, totalPages);
}

/** Recolecta el listado individual de personas involucradas. */
function collectPeopleAssignments() {
  syncPeopleAssignmentsFromRows();
  return peopleAssignments.map((person, index) => ({ ...person, numero_persona: index + 1 }));
}

/** Persona base para filas aun no capturadas. */
function defaultPersonAssignment(index) {
  return { numero_persona: index + 1, nombre: "", numero_vehiculo: "", tipo_participacion: "Civil" };
}

/** Guarda lo escrito en las filas visibles antes de repintar o cambiar pagina. */
function syncPeopleAssignmentsFromRows() {
  peopleAssignmentRows.querySelectorAll("tr").forEach((row) => {
    const index = Number(row.dataset.personIndex);
    if (!Number.isInteger(index)) return;
    const person = peopleAssignments[index] || defaultPersonAssignment(index);
    row.querySelectorAll("[data-person-field]").forEach((field) => {
      person[field.dataset.personField] = field.value.trim();
    });
    person.numero_persona = index + 1;
    peopleAssignments[index] = person;
  });
}

/** Actualiza texto y estado de paginacion de personas. */
function renderPeoplePageControls(totalPeople, totalPages) {
  peoplePageInfo.textContent = totalPeople ? `Página ${peoplePage} de ${totalPages}` : "Página 1 de 1";
  peoplePrevPage.disabled = peoplePage <= 1;
  peopleNextPage.disabled = peoplePage >= totalPages;
}

/** Oculta o muestra la tabla completa sin borrar los datos capturados. */
function togglePeopleTable() {
  peopleAssignmentTableWrap.classList.toggle("is-hidden");
  const hidden = peopleAssignmentTableWrap.classList.contains("is-hidden");
  togglePeopleTableBtn.innerHTML = `<i class="fas ${hidden ? "fa-eye" : "fa-eye-slash"}"></i> ${hidden ? "Mostrar tabla" : "Ocultar tabla"}`;
}

/** Muestra las preguntas extra segun complementos seleccionados. */
function updateComplementQuestions() {
  if (!complementQuestions) return;
  complementQuestions.querySelectorAll("[data-complement-panel]").forEach((panel) => {
    const checkbox = parteForm.elements[panel.dataset.complementPanel];
    panel.hidden = !checkbox?.checked;
  });
}

/** Guarda observaciones solo cuando el complemento "Otros" esta activo. */
function buildComplementNotes(payload) {
  const base = textValue(payload.observaciones, "");
  return payload.otros ? base : "";
}

/** Aplica vista de lista o tarjetas en Gestionar partes. */
function applyViewMode() {
  const grid = viewMode === "grid";
  partesListView.hidden = grid;
  partesGridView.hidden = !grid;
  listViewBtn.classList.toggle("active", !grid);
  gridViewBtn.classList.toggle("active", grid);
}

/** Cambia y guarda la vista preferida de Gestionar partes. */
function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem("partesViewMode", mode);
  applyViewMode();
}

/** Evita ejecutar una funcion demasiadas veces durante escritura. */
function debounce(fn, wait = 250) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

/** Pinta filas de vehiculos para pantalla o exportacion. */
function renderVehicleRows(vehicles = [], forExport = false) {
  return vehicles.length
    ? vehicles.map((vehicle, index) => `<tr><td>${index + 1}</td><td>${forExport ? fieldHtml(vehicle.marca) : vehicle.marca || ""}</td><td>${forExport ? fieldHtml(vehicle.modelo) : vehicle.modelo || ""}</td><td>${forExport ? fieldHtml(vehicle.tipo) : vehicle.tipo || ""}</td><td>${forExport ? fieldHtml(vehicle.numero_serie) : vehicle.numero_serie || ""}</td><td>${forExport ? fieldHtml(vehicle.numero_placa) : vehicle.numero_placa || ""}</td></tr>`).join("")
    : `<tr><td colspan="6">${forExport ? fieldHtml("") : "Sin vehiculos registrados."}</td></tr>`;
}

/** Pinta el detalle individual de personas involucradas. */
function renderPeopleRows(people = [], forExport = false) {
  return people?.length
    ? people.map((person, index) => `<tr><td>${index + 1}</td><td>${forExport ? fieldHtml(person.nombre) : escapeHtml(person.nombre || "")}</td><td>${forExport ? fieldHtml(person.vehiculo_label) : escapeHtml(person.vehiculo_label || "Sin vehículo")}</td><td>${forExport ? fieldHtml(person.tipo_participacion) : escapeHtml(person.tipo_participacion || "Civil")}</td></tr>`).join("")
    : `<tr><td colspan="4">${forExport ? fieldHtml("") : "Sin personas registradas."}</td></tr>`;
}

/** Resume todos los vehiculos en una sola cadena para Excel. */
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

/** Resume el detalle de personas para Excel. */
function peopleSummary(people = []) {
  return people?.length
    ? people.map((person, index) => `Persona ${index + 1}: ${[
        textValue(person.nombre, "Sin nombre"),
        textValue(person.vehiculo_label, "Sin vehículo"),
        textValue(person.tipo_participacion, "Civil"),
      ].join(" / ")}`).join(" | ")
    : "Campo vacio";
}

/** Escapa texto para usarlo dentro de atributos HTML. */
function escapeAttr(value = "") {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/** Formatea una fecha conservando solo yyyy-mm-dd. */
function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

/** Formatea fecha y hora para mostrar/exportar. */
function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

/** Convierte valores vacios en un texto de respaldo. */
function textValue(value, fallback = "Campo vacio") {
  const clean = value === undefined || value === null ? "" : String(value).trim();
  return clean || fallback;
}

/** Convierte un valor en HTML seguro y marca campos vacios. */
function fieldHtml(value, fallback = "Campo vacio") {
  const text = textValue(value, fallback);
  return text === "Campo vacio"
    ? `<span class="empty-field">${text}</span>`
    : escapeHtml(text);
}

/** Convierte booleanos o banderas numericas en Si/No. */
function boolText(value) {
  if (value === undefined || value === null || value === "") return "Campo vacio";
  return Number(value) || value === true || value === "true" ? "Si" : "No";
}

/** Escapa texto para insertarlo como contenido HTML seguro. */
function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

partSearch.addEventListener("input", debounce(() => {
  if (hasAdvancedSearch()) {
    advancedFilters = [];
    renderAdvancedFilterList();
    updateAdvancedSearchSummary();
  }
  loadPartes();
}));
advancedSearchBtn.addEventListener("click", openAdvancedSearch);
advancedSearchField.addEventListener("change", syncAdvancedSearchInput);
addAdvancedFilterBtn.addEventListener("click", () => addAdvancedFilter());
advancedSearchForm.addEventListener("submit", applyAdvancedSearch);
clearAdvancedSearchBtn.addEventListener("click", clearAdvancedSearch);
listViewBtn.addEventListener("click", () => setViewMode("list"));
gridViewBtn.addEventListener("click", () => setViewMode("grid"));
partesPageSize.addEventListener("change", () => {
  partesPage = 1;
  renderPartes();
});
partesPrevPage.addEventListener("click", () => {
  partesPage -= 1;
  renderPartes();
});
partesNextPage.addEventListener("click", () => {
  partesPage += 1;
  renderPartes();
});
document.getElementById("addVehicleBtn").addEventListener("click", () => addVehicle());
vehiclesWrap.addEventListener("input", refreshPeopleVehicleOptions);
parteForm.numero_personas.addEventListener("input", () => {
  peoplePage = 1;
  renderPeopleAssignments();
});
togglePeopleTableBtn.addEventListener("click", togglePeopleTable);
peoplePageSize.addEventListener("change", () => {
  peoplePage = 1;
  renderPeopleAssignments();
});
peoplePrevPage.addEventListener("click", () => {
  syncPeopleAssignmentsFromRows();
  peoplePage -= 1;
  renderPeopleAssignments();
});
peopleNextPage.addEventListener("click", () => {
  syncPeopleAssignmentsFromRows();
  peoplePage += 1;
  renderPeopleAssignments();
});
["personas_fallecidas", "personas_heridas", "otros"].forEach((name) => {
  parteForm.elements[name].addEventListener("change", updateComplementQuestions);
});
respondienteInput.addEventListener("focus", () => loadPartCatalogs(true));
respondienteInput.addEventListener("click", () => {
  loadPartCatalogs(true);
  try {
    respondienteInput.showPicker?.();
  } catch {
    // Algunos navegadores no abren datalist programaticamente.
  }
});

exportSearch.addEventListener("input", renderExportRows);
exportSelectAll.addEventListener("change", renderExportRows);
exportRows.addEventListener("change", (event) => {
  if (event.target.classList.contains("export-check")) updateExportCount();
});

resetVehicles();
renderPeopleAssignments(0, []);
updateComplementQuestions();
syncAdvancedSearchInput();
renderAdvancedFilterList();
updateAdvancedSearchSummary();
applyViewMode();
applyPartPermissions();
loadPartCatalogs();
loadPartes();
