/*
 * Pantallad del Personal.
 * Lo carga cruds/personal.php. Administra usuarios, ministerios publicos y
 * catalogos relacionados. Las operaciones CRUD se envian a api/index.php.
 */
setupLayout("personal");

// Estado en memoria de usuarios/catalogos y del registro que se esta editando.
let users = [];
let mps = [];
let editingUser = null;
let editingMp = null;
let userViewMode = localStorage.getItem("userViewMode") || "list";
let mpViewMode = localStorage.getItem("mpViewMode") || "list";
let userPage = 1;
const rows = document.getElementById("userRows");
const form = document.getElementById("userForm");
const mpRows = document.getElementById("mpRows");
const mpForm = document.getElementById("mpForm");
const search = document.getElementById("userSearch");
const mpSearch = document.getElementById("mpSearch");
const preview = document.getElementById("userPreview");
const defaultUserPhoto = assetUrl("img/usuario.png");
const userListView = document.getElementById("userListView");
const userGridView = document.getElementById("userGridView");
const mpListView = document.getElementById("mpListView");
const mpGridView = document.getElementById("mpGridView");
const userListViewBtn = document.getElementById("userListViewBtn");
const userGridViewBtn = document.getElementById("userGridViewBtn");
const mpListViewBtn = document.getElementById("mpListViewBtn");
const mpGridViewBtn = document.getElementById("mpGridViewBtn");
const userPageSize = document.getElementById("userPageSize");
const userPrevPage = document.getElementById("userPrevPage");
const userNextPage = document.getElementById("userNextPage");
const userPageInfo = document.getElementById("userPageInfo");

/** Cambia entre la administracion de usuarios y el catalogo de MP. */
function setPersonalTab(tab) {
  document.querySelectorAll("[data-personal-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.personalTab === tab);
  });
  document.querySelectorAll("[data-personal-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.personalPanel !== tab;
  });
}

/** Cierra cualquier modal del panel de personal por su id. */
function closeModal(id) {
  document.getElementById(id).classList.remove("show");
}

/** Carga usuarios desde la API y aplica el buscador local. */
async function loadUsers() {
  const data = await api("/api/usuarios");
  if (!data?.success) {
    showToast(data?.error || "No se pudieron cargar los usuarios", "error");
    return;
  }
  const q = (search.value || "").toLowerCase();
  users = data.data.filter((u) => `${u.nombre} ${u.rol} ${u.correo} ${u.curp || ""}`.toLowerCase().includes(q));
  userPage = 1;
  renderUsers();
}

/** Carga los MP activos desde la API y aplica el buscador local. */
async function loadMps() {
  const data = await api("/api/mps");
  if (!data?.success) {
    showToast(data?.error || "No se pudieron cargar los MP", "error");
    return;
  }
  const q = (mpSearch.value || "").toLowerCase();
  mps = data.data.filter((mp) => `${mp.nombre} ${mp.cargo_grado || ""}`.toLowerCase().includes(q));
  renderMps();
}

/** Pinta los usuarios en tabla y en tarjetas segun la vista elegida. */
function renderUsers() {
  const visible = pagedUsers();

  rows.innerHTML = visible.map((u) => `
    <tr>
      <td>${String(u.id_usuario).padStart(5, "0")}</td>
      <td><span class="person-cell"><img class="avatar-mini" src="${u.imagen_perfil || defaultUserPhoto}" alt="" /> ${u.nombre}</span></td>
      <td>${roleLabel(u.rol)}</td>
      <td><span class="actions"><button class="icon-btn edit" onclick="openUserModal('edit', ${u.id_usuario})"><i class="fas fa-edit"></i></button><button class="icon-btn delete" onclick="deleteUser(${u.id_usuario})"><i class="fas fa-trash"></i></button><button class="icon-btn view" onclick="openUserModal('view', ${u.id_usuario})"><i class="fas fa-eye"></i></button></span></td>
    </tr>
  `).join("") || `<tr><td colspan="4">Aun no hay usuarios registrados.</td></tr>`;

  userGridView.innerHTML = visible.map((u) => `
    <article class="user-card">
      <img class="profile-avatar small" src="${u.imagen_perfil || defaultUserPhoto}" alt="" />
      <div>
        <h3>${u.nombre || "Usuario"}</h3>
        <p>${roleLabel(u.rol)}</p>
        <p>${u.cargo_grado || "Sin cargo"}</p>
      </div>
      <div class="card-actions">
        <button class="icon-btn edit" onclick="openUserModal('edit', ${u.id_usuario})"><i class="fas fa-edit"></i></button>
        <button class="icon-btn delete" onclick="deleteUser(${u.id_usuario})"><i class="fas fa-trash"></i></button>
        <button class="icon-btn view" onclick="openUserModal('view', ${u.id_usuario})"><i class="fas fa-eye"></i></button>
      </div>
    </article>
  `).join("") || `<p class="empty-state">Aun no hay usuarios registrados.</p>`;

  renderUserPageControls();
  applyUserViewMode();
}

/** Pinta el catalogo de MP en tabla o tarjetas segun la vista elegida. */
function renderMps() {
  mpRows.innerHTML = mps.map((mp) => `
    <tr>
      <td>${String(mp.id_mp).padStart(5, "0")}</td>
      <td><span class="person-cell"><i class="fas fa-user-shield muted-icon"></i> ${escapeHtml(mp.nombre)}</span></td>
      <td>${escapeHtml(mp.cargo_grado || "Sin cargo")}</td>
      <td><span class="actions"><button class="icon-btn edit" onclick="openMpModal('edit', ${mp.id_mp})"><i class="fas fa-edit"></i></button><button class="icon-btn delete" onclick="deleteMp(${mp.id_mp})"><i class="fas fa-trash"></i></button></span></td>
    </tr>
  `).join("") || `<tr><td colspan="4">Aun no hay MP registrados.</td></tr>`;

  mpGridView.innerHTML = mps.map((mp) => `
    <article class="mp-card">
      <span class="mp-card-icon"><i class="fas fa-user-shield"></i></span>
      <div>
        <h3>${escapeHtml(mp.nombre || "MP")}</h3>
        <p>${escapeHtml(mp.cargo_grado || "Sin cargo")}</p>
      </div>
      <div class="card-actions">
        <button class="icon-btn edit" onclick="openMpModal('edit', ${mp.id_mp})"><i class="fas fa-edit"></i></button>
        <button class="icon-btn delete" onclick="deleteMp(${mp.id_mp})"><i class="fas fa-trash"></i></button>
      </div>
    </article>
  `).join("") || `<p class="empty-state">Aun no hay MP registrados.</p>`;

  applyMpViewMode();
}

/** Muestra el nombre publico del rol como debe verse en la interfaz. */
function roleLabel(role = "") {
  return String(role).trim().toLowerCase() === "consulta" ? "Auxiliar" : role || "Sin rol";
}

/** Devuelve la pagina actual de usuarios segun el tamaño seleccionado. */
function pagedUsers() {
  const pageSize = Number(userPageSize.value || 5);
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  userPage = Math.min(Math.max(userPage, 1), totalPages);
  const start = (userPage - 1) * pageSize;
  return users.slice(start, start + pageSize);
}

/** Actualiza texto y estado de los botones de paginacion de personal. */
function renderUserPageControls() {
  const pageSize = Number(userPageSize.value || 5);
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  userPageInfo.textContent = `Página ${userPage} de ${totalPages}`;
  userPrevPage.disabled = userPage <= 1;
  userNextPage.disabled = userPage >= totalPages;
}

/** Abre el modal de usuario en modo crear, editar o solo visualizar. */
function openUserModal(mode, id = null) {
  form.reset();
  editingUser = id;
  const user = users.find((item) => item.id_usuario === id);
  document.getElementById("userModalTitle").textContent = mode === "edit" ? "Editar Empleado" : mode === "view" ? "Visualizar Empleado" : "Nuevo Empleado";
  document.getElementById("userSubmit").textContent = mode === "edit" ? "Guardar" : "Crear nuevo";
  document.getElementById("userSubmit").style.display = mode === "view" ? "none" : "";
  [...form.elements].forEach((el) => {
    if (el.name) el.disabled = mode === "view";
  });
  // Si el usuario se crea sin fotografia, se muestra y guarda la imagen default.
  preview.src = defaultUserPhoto;
  if (user) {
    form.nombre.value = user.nombre || "";
    form.correo.value = user.correo || "";
    form.curp.value = user.curp || "";
    form.instituto.value = user.instituto || "";
    form.cargo_grado.value = user.cargo_grado || "";
    form.id_rol.value = user.id_rol || 2;
    preview.src = user.imagen_perfil || defaultUserPhoto;
  }
  document.getElementById("userModal").classList.add("show");
}

/** Abre el modal de MP para crear o editar un registro del catalogo. */
function openMpModal(mode, id = null) {
  mpForm.reset();
  editingMp = id;
  const mp = mps.find((item) => item.id_mp === id);
  document.getElementById("mpModalTitle").textContent = mode === "edit" ? "Editar MP" : "Nuevo MP";
  document.getElementById("mpSubmit").textContent = mode === "edit" ? "Guardar MP" : "Crear MP";
  if (mp) {
    mpForm.nombre.value = mp.nombre || "";
    mpForm.cargo_grado.value = mp.cargo_grado || "";
  }
  document.getElementById("mpModal").classList.add("show");
}

// Muestra una vista previa de la foto elegida antes de guardar el usuario.
form.imagen.addEventListener("change", () => {
  const file = form.imagen.files[0];
  if (file) preview.src = URL.createObjectURL(file);
});

// Crea o actualiza un usuario enviando el formulario completo a la API.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = new FormData(form);
  const data = await api(editingUser ? `/api/usuarios/${editingUser}` : "/api/usuarios", {
    method: editingUser ? "PUT" : "POST",
    body,
  });
  if (data?.success) {
    closeModal("userModal");
    showToast(data.message);
    loadUsers();
  } else {
    showToast(data?.error || "No se pudo guardar el usuario", "error");
  }
});

// Crea o actualiza un MP y refresca el catalogo visible en Personal.
mpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(mpForm));
  const data = await api(editingMp ? `/api/mps/${editingMp}` : "/api/mps", {
    method: editingMp ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });
  if (data?.success) {
    closeModal("mpModal");
    showToast(data.message);
    loadMps();
  } else {
    showToast(data?.error || "No se pudo guardar el MP", "error");
  }
});

/** Elimina un usuario tras confirmacion y refresca la lista. */
function deleteUser(id) {
  showConfirm("Eliminar usuario", "Se eliminara el usuario aunque sea administrador. Sus partes quedaran sin asignar.", async () => {
    const data = await api(`/api/usuarios/${id}`, { method: "DELETE" });
    if (data?.success) {
      showToast("Usuario eliminado");
      loadUsers();
    } else {
      showToast(data?.error || "No se pudo eliminar el usuario", "error");
    }
  });
}

/** Da de baja un MP para quitarlo de nuevas asignaciones sin borrar historial. */
function deleteMp(id) {
  showConfirm("Dar de baja MP", "El MP dejara de aparecer para nuevos partes. Los partes existentes conservaran su historial.", async () => {
    const data = await api(`/api/mps/${id}`, { method: "DELETE" });
    if (data?.success) {
      showToast("MP dado de baja");
      loadMps();
    } else {
      showToast(data?.error || "No se pudo dar de baja el MP", "error");
    }
  });
}

search.addEventListener("input", loadUsers);
mpSearch.addEventListener("input", loadMps);
userListViewBtn.addEventListener("click", () => setUserViewMode("list"));
userGridViewBtn.addEventListener("click", () => setUserViewMode("grid"));
mpListViewBtn.addEventListener("click", () => setMpViewMode("list"));
mpGridViewBtn.addEventListener("click", () => setMpViewMode("grid"));
document.querySelectorAll("[data-personal-tab]").forEach((button) => {
  button.addEventListener("click", () => setPersonalTab(button.dataset.personalTab));
});
userPageSize.addEventListener("change", () => {
  userPage = 1;
  renderUsers();
});
userPrevPage.addEventListener("click", () => {
  userPage -= 1;
  renderUsers();
});
userNextPage.addEventListener("click", () => {
  userPage += 1;
  renderUsers();
});

/** Aplica la vista de lista o tarjetas en el panel de personal. */
function applyUserViewMode() {
  const grid = userViewMode === "grid";
  userListView.hidden = grid;
  userGridView.hidden = !grid;
  userListViewBtn.classList.toggle("active", !grid);
  userGridViewBtn.classList.toggle("active", grid);
}

/** Aplica la vista de lista o tarjetas para el catalogo de MP. */
function applyMpViewMode() {
  const grid = mpViewMode === "grid";
  mpListView.hidden = grid;
  mpGridView.hidden = !grid;
  mpListViewBtn.classList.toggle("active", !grid);
  mpGridViewBtn.classList.toggle("active", grid);
}

/** Guarda la vista preferida de personal y la aplica en pantalla. */
function setUserViewMode(mode) {
  userViewMode = mode;
  localStorage.setItem("userViewMode", mode);
  applyUserViewMode();
}

/** Guarda la vista preferida del catalogo de MP y la aplica en pantalla. */
function setMpViewMode(mode) {
  mpViewMode = mode;
  localStorage.setItem("mpViewMode", mode);
  applyMpViewMode();
}

applyUserViewMode();
applyMpViewMode();
loadUsers();
loadMps();
