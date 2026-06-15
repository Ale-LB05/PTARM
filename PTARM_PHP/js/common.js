/** Lee del navegador los datos del usuario que iniciÃ³ sesiÃ³n. */
function appBase() {
  return (window.PTARM_BASE || "").replace(/\/$/, "");
}

function pageUrl(path = "") {
  const clean = String(path || "").replace(/^\//, "");
  const base = appBase();
  return (base + "/" + clean).replace(/\/$/, "") || "/";
}

function assetUrl(path = "") {
  return pageUrl(String(path || "").replace(/^\//, ""));
}

function apiUrl(path = "") {
  if (String(path).startsWith("/api/")) {
    return pageUrl("api/index.php?path=" + encodeURIComponent(path));
  }
  return path;
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch {
    return {};
  }
}

/** Obtiene el token JWT guardado en localStorage. */
function token() {
  return localStorage.getItem("token");
}

/** Construye los encabezados de autenticacion para llamadas a la API. */
function authHeaders() {
  return { Authorization: `Bearer ${token()}` };
}

/** Evita entrar a pÃ¡ginas privadas si no hay sesiÃ³n activa. */
function requireAuth() {
  if (!token()) location.href = pageUrl("");
}

/** Normaliza el rol del usuario para comparar permisos sin depender de mayusculas. */
function normalizedRole() {
  const role = String(getUser().rol || "").trim().toLowerCase();
  if (role === "admin") return "administrador";
  return role === "consulta" ? "auxiliar" : role;
}

/** Revisa si el usuario actual tiene alguno de los roles indicados. */
function hasRole(...roles) {
  const current = normalizedRole();
  return roles.map((role) => String(role).trim().toLowerCase()).includes(current);
}

/** Define que paginas puede ver cada rol dentro del sistema. */
function allowedPagesForRole() {
  if (hasRole("administrador")) return ["inicio", "personal", "partes", "historial", "perfil"];
  if (hasRole("capturista")) return ["inicio", "partes", "historial", "perfil"];
  if (hasRole("auxiliar")) return ["inicio", "partes", "historial", "perfil"];
  return ["perfil"];
}

/** Configura layout comun: autenticacion, usuario, sidebar, permisos y menu superior. */
function setupLayout(active) {
  requireAuth();
  applyTheme();
  const allowedPages = allowedPagesForRole();
  if (!allowedPages.includes(active)) {
    location.href = allowedPages.includes("partes") ? pageUrl("registroPartes/partes.php") : pageUrl("cruds/perfil.php");
    return;
  }
  if (localStorage.getItem("sidebarCollapsed") === "1") {
    document.querySelector(".app-shell")?.classList.add("sidebar-collapsed");
  }
  document.documentElement.classList.toggle("sidebar-start-collapsed", localStorage.getItem("sidebarCollapsed") === "1");
  const user = getUser();
  const userPhoto = user.foto || user.imagen_perfil || assetUrl("img/usuario.png");
  document.querySelectorAll("[data-user-name]").forEach((el) => {
    el.textContent = `${user.nombre || "Usuario"} - ${user.cargo || user.rol || "Cargo"}`;
  });
  document.querySelectorAll("[data-user-photo]").forEach((img) => {
    img.src = userPhoto;
    img.onerror = () => {
      img.src = assetUrl("img/usuario.png");
    };
  });
  document.querySelectorAll(".side-nav a").forEach((link) => {
    if (link.dataset.page && !allowedPages.includes(link.dataset.page)) {
      link.hidden = true;
      link.style.display = "none";
      return;
    }
    if (link.dataset.page === active) link.classList.add("active");
  });
  document.querySelectorAll(".menu-card[data-page]").forEach((card) => {
    card.hidden = !allowedPages.includes(card.dataset.page);
  });
  setupUserMenu();
  document.documentElement.classList.remove("booting");
}

/** Aplica el tema visual guardado para todo el sistema. */
function applyTheme() {
  const isDark = localStorage.getItem("theme") === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  document.documentElement.classList.toggle("theme-dark", isDark);
}

/** Alterna entre modo claro y modo oscuro y devuelve el tema activo. */
function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", nextTheme);
  applyTheme();
  return nextTheme;
}

/** Activa el menu de perfil para abrirlo por click y cerrarlo al hacer click fuera. */
function setupUserMenu() {
  document.querySelectorAll(".user-menu").forEach((menu) => {
    const trigger = menu.querySelector(".user-top");
    const dropdown = menu.querySelector(".user-dropdown");
    if (!trigger || !dropdown || trigger.dataset.menuReady === "1") return;
    const bell = trigger.querySelector(".fa-bell");
    const notifications = ensureNotificationPanel(menu);

    trigger.dataset.menuReady = "1";
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");
    bell?.classList.add("notification-trigger");
    bell?.setAttribute("title", "Notificaciones");

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (event.target.closest(".notification-trigger")) {
        menu.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        const isOpen = notifications.classList.toggle("show");
        if (isOpen) loadNotifications(notifications);
        return;
      }
      notifications.classList.remove("show");
      const isOpen = menu.classList.toggle("open");
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    dropdown.addEventListener("click", (event) => event.stopPropagation());
    notifications.addEventListener("click", (event) => event.stopPropagation());
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".user-menu.open").forEach((menu) => {
    menu.classList.remove("open");
    menu.querySelector(".user-top")?.setAttribute("aria-expanded", "false");
  });
  document.querySelectorAll(".notification-panel.show").forEach((panel) => panel.classList.remove("show"));
});

/** Crea el panel de notificaciones una sola vez junto al menu de usuario. */
function ensureNotificationPanel(menu) {
  let panel = menu.querySelector(".notification-panel");
  if (panel) return panel;
  panel = document.createElement("div");
  panel.className = "notification-panel";
  panel.innerHTML = `
    <div class="notification-head">Centro de notificaciones</div>
    <div class="notification-list" data-notification-list>
      <div class="notification-item">
        <span class="notification-icon"><i class="far fa-file-alt"></i></span>
        <div><strong>Cargando...</strong><p>Buscando actividad reciente.</p></div>
      </div>
    </div>
    <a class="notification-foot" href="${pageUrl("cruds/historial.php")}">Ver historial</a>
  `;
  menu.appendChild(panel);
  return panel;
}

/** Carga actividades relevantes para partes creados por el usuario actual. */
async function loadNotifications(panel) {
  const list = panel.querySelector("[data-notification-list]");
  list.innerHTML = `
    <div class="notification-item">
      <span class="notification-icon"><i class="far fa-file-alt"></i></span>
      <div><strong>Cargando...</strong><p>Buscando actividad reciente.</p></div>
    </div>
  `;
  const data = await api("/api/historial/notificaciones");
  if (!data?.success) {
    list.innerHTML = `
      <div class="notification-item">
        <span class="notification-icon"><i class="fas fa-exclamation"></i></span>
        <div><strong>No se pudieron cargar</strong><p>Intenta de nuevo mÃ¡s tarde.</p></div>
      </div>
    `;
    return;
  }

  if (!data.data.length) {
    list.innerHTML = `
      <div class="notification-item">
        <span class="notification-icon"><i class="far fa-file-alt"></i></span>
        <div><strong>Sin actividad reciente</strong><p>No hay cambios en tus partes creados.</p></div>
      </div>
    `;
    return;
  }

  list.innerHTML = data.data.map((item) => {
    const deleted = item.accion === "ELIMINAR";
    const folio = item.folio || extractNotificationFolio(item.descripcion) || "Sin folio";
    const action = deleted ? "Eliminado" : "Modificado";
    const verb = deleted ? "eliminÃ³" : "modificÃ³";
    const actor = item.usuario_nombre || "Usuario no disponible";
    const time = formatNotificationTime(item.fecha);
    return `
      <div class="notification-item ${deleted ? "delete" : "edit"}">
        <span class="notification-icon"><i class="${deleted ? "far fa-trash-alt" : "far fa-edit"}"></i></span>
        <div>
          <strong>${escapeHtml(folio)} Â· ${action}</strong>
          <p>${escapeHtml(actor)} ${verb} este parte${time ? ` a las ${time}` : ""}.</p>
        </div>
      </div>
    `;
  }).join("");
}

/** Extrae un folio desde descripciones de historial de partes eliminados. */
function extractNotificationFolio(text = "") {
  const match = String(text).match(/Parte\s+([^|]+?)\s+(?:eliminado|editado|actualizado)/i);
  return match ? match[1].trim() : "";
}

/** Formatea solo la hora de una actividad de notificacion. */
function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/** Escapa texto antes de insertarlo como HTML. */
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

/** Contrae o expande la barra lateral y recuerda la preferencia. */
function toggleSidebar() {
  const shell = document.querySelector(".app-shell");
  if (!shell) return;
  shell.classList.toggle("sidebar-collapsed");
  const isCollapsed = shell.classList.contains("sidebar-collapsed");
  localStorage.setItem("sidebarCollapsed", isCollapsed ? "1" : "0");
  document.documentElement.classList.toggle("sidebar-start-collapsed", isCollapsed);
}

/** Cierra sesiÃ³n tras confirmaciÃ³n y limpia los datos locales. */
function logout() {
  showConfirm("Cerrar sesi\u00f3n", "\u00bfSeguro que deseas salir?", () => {
    localStorage.clear();
    location.href = pageUrl("registroUser/logout.php");
  });
}

/** Corrige textos con mojibake antes de mostrarlos en alertas. */
function repairAlertText(value) {
  let text = String(value ?? "");
  for (let i = 0; i < 2 && /[\u00c3\u00c2]/.test(text); i += 1) {
    const bytes = [];
    for (const char of text) {
      const code = char.charCodeAt(0);
      if (code > 255) {
        bytes.length = 0;
        break;
      }
      bytes.push(code);
    }
    if (!bytes.length) break;
    try {
      const decoded = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
      if (!decoded || decoded === text) break;
      text = decoded;
    } catch {
      break;
    }
  }
  return text;
}

/** Muestra mensajes de exito/error usando SweetAlert o el toast local. */
function showToast(message, type = "success") {
  message = repairAlertText(message);
  if (window.Swal) {
    Swal.fire({
      icon: type,
      title: message,
      showConfirmButton: false,
      timer: 1600,
      timerProgressBar: true,
      customClass: {
        popup: "ptarm-swal-popup",
      },
    });
    return;
  }

  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerHTML = `<div class="${type === "success" ? "success-icon" : "alert-icon"}">${type === "success" ? "OK" : "!"}</div><strong>${message}</strong>`;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1700);
}

/** Muestra una confirmacion antes de ejecutar una accion sensible. */
function showConfirm(title, text, onConfirm) {
  title = repairAlertText(title);
  text = repairAlertText(text);
  if (window.Swal) {
    Swal.fire({
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e34242",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Aceptar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      customClass: {
        popup: "ptarm-swal-popup",
        confirmButton: "ptarm-swal-confirm",
        cancelButton: "ptarm-swal-cancel",
      },
      showClass: {
        popup: "animate__animated animate__fadeInDown",
      },
      hideClass: {
        popup: "animate__animated animate__fadeOutUp",
      },
    }).then((result) => {
      if (result.isConfirmed) onConfirm();
    });
    return;
  }

  const modal = document.getElementById("confirmModal");
  if (!modal) return;
  modal.querySelector("[data-confirm-title]").textContent = title;
  modal.querySelector("[data-confirm-text]").textContent = text;
  modal.classList.add("show");
  const yes = modal.querySelector("[data-confirm-yes]");
  const no = modal.querySelector("[data-confirm-no]");
  const cleanup = () => {
    modal.classList.remove("show");
    yes.onclick = null;
    no.onclick = null;
  };
  yes.onclick = () => {
    cleanup();
    onConfirm();
  };
  no.onclick = cleanup;
}

/** Llama a la API con autenticaciÃ³n y manejo comÃºn de errores/sesiÃ³n expirada. */
async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const requestOptions = { ...options };
  if (isFormData && ["PUT", "PATCH"].includes(String(requestOptions.method || "").toUpperCase())) {
    requestOptions.body.append("_method", requestOptions.method.toUpperCase());
    requestOptions.method = "POST";
  }
  const headers = isFormData ? authHeaders() : { ...authHeaders(), "Content-Type": "application/json" };
  try {
    const res = await fetch(apiUrl(path), { ...requestOptions, headers: { ...headers, ...(requestOptions.headers || {}) } });
    if (res.status === 401) {
      localStorage.clear();
      location.href = pageUrl("");
      return null;
    }
    const data = await res.json();
    if (!res.ok && !data?.error) return { success: false, error: "OcurriÃ³ un error en el servidor" };
    return data;
  } catch {
    return { success: false, error: "No se pudo conectar con el servidor" };
  }
}

