/** Lee del navegador los datos del usuario que inicio sesion. */
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

/** Evita entrar a paginas privadas si no hay sesion activa. */
function requireAuth() {
  if (!token()) location.href = "/";
}

/** Normaliza el rol del usuario para comparar permisos sin depender de mayusculas. */
function normalizedRole() {
  const role = String(getUser().rol || "").trim().toLowerCase();
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
  const allowedPages = allowedPagesForRole();
  if (!allowedPages.includes(active)) {
    location.href = allowedPages.includes("partes") ? "/partes.html" : "/perfil.html";
    return;
  }
  if (localStorage.getItem("sidebarCollapsed") === "1") {
    document.querySelector(".app-shell")?.classList.add("sidebar-collapsed");
  }
  const user = getUser();
  const userPhoto = user.foto || user.imagen_perfil || "/img/usuario.png";
  document.querySelectorAll("[data-user-name]").forEach((el) => {
    el.textContent = `${user.nombre || "Usuario"} - ${user.cargo || user.rol || "Cargo"}`;
  });
  document.querySelectorAll("[data-user-photo]").forEach((img) => {
    img.src = userPhoto;
    img.onerror = () => {
      img.src = "/img/usuario.png";
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
}

/** Activa el menu de perfil para abrirlo por click y cerrarlo al hacer click fuera. */
function setupUserMenu() {
  document.querySelectorAll(".user-menu").forEach((menu) => {
    const trigger = menu.querySelector(".user-top");
    const dropdown = menu.querySelector(".user-dropdown");
    if (!trigger || !dropdown || trigger.dataset.menuReady === "1") return;

    trigger.dataset.menuReady = "1";
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = menu.classList.toggle("open");
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    dropdown.addEventListener("click", (event) => event.stopPropagation());
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".user-menu.open").forEach((menu) => {
    menu.classList.remove("open");
    menu.querySelector(".user-top")?.setAttribute("aria-expanded", "false");
  });
});

/** Contrae o expande la barra lateral y recuerda la preferencia. */
function toggleSidebar() {
  const shell = document.querySelector(".app-shell");
  if (!shell) return;
  shell.classList.toggle("sidebar-collapsed");
  localStorage.setItem("sidebarCollapsed", shell.classList.contains("sidebar-collapsed") ? "1" : "0");
}

/** Cierra sesion tras confirmacion y limpia los datos locales. */
function logout() {
  showConfirm("Cerrar sesion", "Seguro que deseas salir?", () => {
    localStorage.clear();
    location.href = "/";
  });
}

/** Muestra mensajes de exito/error usando SweetAlert o el toast local. */
function showToast(message, type = "success") {
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

/** Llama a la API con autenticacion y manejo comun de errores/sesion expirada. */
async function api(path, options = {}) {
  const headers = options.body instanceof FormData ? authHeaders() : { ...authHeaders(), "Content-Type": "application/json" };
  try {
    const res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    if (res.status === 401) {
      localStorage.clear();
      location.href = "/";
      return null;
    }
    const data = await res.json();
    if (!res.ok && !data?.error) return { success: false, error: "Ocurrio un error en el servidor" };
    return data;
  } catch {
    return { success: false, error: "No se pudo conectar con el servidor" };
  }
}
