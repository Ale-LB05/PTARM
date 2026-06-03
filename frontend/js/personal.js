setupLayout("personal");

let users = [];
let editingUser = null;
let userViewMode = localStorage.getItem("userViewMode") || "list";
let userPage = 1;
const rows = document.getElementById("userRows");
const form = document.getElementById("userForm");
const search = document.getElementById("userSearch");
const preview = document.getElementById("userPreview");
const userListView = document.getElementById("userListView");
const userGridView = document.getElementById("userGridView");
const userListViewBtn = document.getElementById("userListViewBtn");
const userGridViewBtn = document.getElementById("userGridViewBtn");
const userPageSize = document.getElementById("userPageSize");
const userPrevPage = document.getElementById("userPrevPage");
const userNextPage = document.getElementById("userNextPage");
const userPageInfo = document.getElementById("userPageInfo");

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
  users = data.data.filter((u) => `${u.nombre} ${u.rol} ${u.correo}`.toLowerCase().includes(q));
  userPage = 1;
  renderUsers();
}

/** Pinta los usuarios en tabla y en tarjetas segun la vista elegida. */
function renderUsers() {
  const visible = pagedUsers();

  rows.innerHTML = visible.map((u) => `
    <tr>
      <td>${String(u.id_usuario).padStart(5, "0")}</td>
      <td><span class="person-cell"><img class="avatar-mini" src="${u.imagen_perfil || "/img/usuario.png"}" alt="" /> ${u.nombre}</span></td>
      <td>${roleLabel(u.rol)}</td>
      <td><span class="actions"><button class="icon-btn edit" onclick="openUserModal('edit', ${u.id_usuario})"><i class="fas fa-edit"></i></button><button class="icon-btn delete" onclick="deleteUser(${u.id_usuario})"><i class="fas fa-trash"></i></button><button class="icon-btn view" onclick="openUserModal('view', ${u.id_usuario})"><i class="fas fa-eye"></i></button></span></td>
    </tr>
  `).join("") || `<tr><td colspan="4">Aun no hay usuarios registrados.</td></tr>`;

  userGridView.innerHTML = visible.map((u) => `
    <article class="user-card">
      <img class="profile-avatar small" src="${u.imagen_perfil || "/img/usuario.png"}" alt="" />
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

/** Muestra el nombre publico del rol como debe verse en la interfaz. */
function roleLabel(role = "") {
  return String(role).trim().toLowerCase() === "consulta" ? "Auxiliar" : role || "Sin rol";
}

/** Devuelve la pagina actual de usuarios segun el tamano seleccionado. */
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
  userPageInfo.textContent = `Pagina ${userPage} de ${totalPages}`;
  userPrevPage.disabled = userPage <= 1;
  userNextPage.disabled = userPage >= totalPages;
}

/** Abre el modal de usuario en modo crear, editar o solo visualizar. */
function openUserModal(mode, id = null) {
  form.reset();
  editingUser = id;
  const user = users.find((item) => item.id_usuario === id);
  document.getElementById("userModalTitle").textContent = mode === "edit" ? "Editar Empleado" : mode === "view" ? "Visualizar Empleado" : "Nuevo Empleado";
  document.getElementById("userSubmit").textContent = mode === "edit" ? "Guardar" : "Crear Nuevo";
  document.getElementById("userSubmit").style.display = mode === "view" ? "none" : "";
  [...form.elements].forEach((el) => {
    if (el.name) el.disabled = mode === "view";
  });
  preview.src = "/img/usuario.png";
  if (user) {
    form.nombre.value = user.nombre || "";
    form.correo.value = user.correo || "";
    form.instituto.value = user.instituto || "";
    form.cargo_grado.value = user.cargo_grado || "";
    form.id_rol.value = user.id_rol || 2;
    preview.src = user.imagen_perfil || "/img/usuario.png";
  }
  document.getElementById("userModal").classList.add("show");
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

search.addEventListener("input", loadUsers);
userListViewBtn.addEventListener("click", () => setUserViewMode("list"));
userGridViewBtn.addEventListener("click", () => setUserViewMode("grid"));
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

/** Guarda la vista preferida de personal y la aplica en pantalla. */
function setUserViewMode(mode) {
  userViewMode = mode;
  localStorage.setItem("userViewMode", mode);
  applyUserViewMode();
}

applyUserViewMode();
loadUsers();
