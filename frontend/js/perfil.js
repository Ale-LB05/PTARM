setupLayout("perfil");

const form = document.getElementById("profileForm");
const photo = document.getElementById("profilePhoto");
const rows = document.getElementById("profilePartes");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileCurp = document.getElementById("profileCurp");
const profileCargo = document.getElementById("profileCargo");
const profileInstitute = document.getElementById("profileInstitute");
const emailForm = document.getElementById("emailForm");
const curpForm = document.getElementById("curpForm");
const passwordForm = document.getElementById("passwordForm");
const openEmailModal = document.getElementById("openEmailModal");
const openCurpModal = document.getElementById("openCurpModal");
const openPasswordModal = document.getElementById("openPasswordModal");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const defaultPhoto = "/img/usuario.png";

/** Carga la información del perfil y los partes relacionados con el usuario. */
async function loadProfile() {
  const data = await api("/api/perfil");
  if (!data?.success) {
    showToast(data?.error || "No se pudo cargar el perfil", "error");
    return;
  }
  const user = data.data.usuario;
  profileName.textContent = user.nombre || "Sin nombre";
  profileEmail.textContent = user.correo || "Sin correo registrado";
  profileCurp.textContent = user.curp || "Sin CURP registrada";
  profileCargo.textContent = user.cargo_grado || "Sin cargo";
  profileInstitute.textContent = user.instituto || "Sin institución";
  emailForm.correo.value = user.correo || "";
  curpForm.curp.value = user.curp || "";
  photo.src = user.imagen_perfil || defaultPhoto;
  updateStoredUser({
    nombre: user.nombre || "",
    correo: user.correo || "",
    curp: user.curp || "",
    instituto: user.instituto || "",
    cargo: user.cargo_grado || "",
    rol: user.rol || "",
    foto: user.imagen_perfil || defaultPhoto,
  });
  rows.innerHTML = data.data.partes.map((parte) => `
    <tr><td>${parte.folio}</td><td>${parte.respondiente_nombre || "Parte de tránsito"}</td><td>${parte.gravedad_general}</td><td>${formatDate(parte.fecha)}</td><td>${parte.mp_nombre || ""}</td></tr>
  `).join("") || `<tr><td colspan="5">Aun no hay partes creados o asignados.</td></tr>`;
}

/** Cierra uno de los modales del perfil por su id. */
function closeProfileModal(id) {
  document.getElementById(id).classList.remove("show");
}

// Abre el modal para actualizar solo el correo del usuario.
openEmailModal.addEventListener("click", () => {
  emailForm.correo.value = profileEmail.textContent === "Sin correo registrado" ? "" : profileEmail.textContent;
  document.getElementById("emailModal").classList.add("show");
});

// Abre el modal para actualizar solo la CURP del usuario.
openCurpModal.addEventListener("click", () => {
  curpForm.curp.value = profileCurp.textContent === "Sin CURP registrada" ? "" : profileCurp.textContent;
  document.getElementById("curpModal").classList.add("show");
});

// Abre el modal para cambiar solo la contraseña del usuario.
openPasswordModal.addEventListener("click", () => {
  passwordForm.reset();
  document.getElementById("passwordModal").classList.add("show");
});

// Guarda el nuevo correo en la API y actualiza los datos locales del encabezado.
emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const correo = emailForm.correo.value.trim();
  const data = await api("/api/perfil/correo", { method: "PATCH", body: JSON.stringify({ correo }) });
  if (data?.success) {
    profileEmail.textContent = correo;
    updateStoredUser({ correo });
    closeProfileModal("emailModal");
    showToast(data.message || "Correo actualizado");
  } else {
    showToast(data?.error || "No se pudo actualizar el correo", "error");
  }
});

// Guarda la nueva CURP en la API.
curpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const curp = curpForm.curp.value.trim().toUpperCase();
  const data = await api("/api/perfil/curp", { method: "PATCH", body: JSON.stringify({ curp }) });
  if (data?.success) {
    profileCurp.textContent = curp || "Sin CURP registrada";
    updateStoredUser({ curp });
    closeProfileModal("curpModal");
    showToast(data.message || "CURP actualizada");
  } else {
    showToast(data?.error || "No se pudo actualizar la CURP", "error");
  }
});

// Envía el cambio de contraseña después de validar los campos en backend.
passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(passwordForm));
  const data = await api("/api/perfil/password", { method: "PATCH", body: JSON.stringify(payload) });
  if (data?.success) {
    passwordForm.reset();
    closeProfileModal("passwordModal");
    showToast(data.message || "Contraseña actualizada");
  } else {
    showToast(data?.error || "No se pudo actualizar la contraseña", "error");
  }
});

// Permite mostrar u ocultar temporalmente los campos de contraseña.
document.querySelectorAll(".toggle-secret").forEach((button) => {
  button.addEventListener("click", () => {
    const input = button.parentElement.querySelector("input");
    input.type = input.type === "password" ? "text" : "password";
    button.querySelector("i").classList.toggle("fa-eye");
    button.querySelector("i").classList.toggle("fa-eye-slash");
  });
});

form.addEventListener("submit", (event) => event.preventDefault());

/** Actualiza el boton del tema segun el modo actual. */
function syncThemeButton() {
  const isDark = document.documentElement.dataset.theme === "dark";
  themeToggleBtn.innerHTML = `<i class="fas ${isDark ? "fa-sun" : "fa-moon"}"></i> ${isDark ? "Modo claro" : "Modo oscuro"}`;
}

themeToggleBtn.addEventListener("click", () => {
  toggleTheme();
  syncThemeButton();
});

/** Sincroniza localStorage y la barra superior con los cambios del perfil. */
function updateStoredUser(changes) {
  const current = getUser();
  const updated = {
    ...current,
    ...changes,
    foto: changes.foto || changes.imagen_perfil || current.foto || defaultPhoto,
  };
  localStorage.setItem("usuario", JSON.stringify(updated));
  document.querySelectorAll("[data-user-name]").forEach((el) => {
    el.textContent = `${updated.nombre || "Usuario"} - ${updated.cargo || updated.rol || "Cargo"}`;
  });
  document.querySelectorAll("[data-user-photo]").forEach((img) => {
    img.src = updated.foto || defaultPhoto;
    img.onerror = () => {
      img.src = defaultPhoto;
    };
  });
}

/** Formatea una fecha conservando solo yyyy-mm-dd. */
function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

syncThemeButton();
loadProfile();
