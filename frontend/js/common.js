function getUser() {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch {
    return {};
  }
}

function token() {
  return localStorage.getItem("token");
}

function authHeaders() {
  return { Authorization: `Bearer ${token()}` };
}

function requireAuth() {
  if (!token()) location.href = "/";
}

function setupLayout(active) {
  requireAuth();
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
    if (link.dataset.page === active) link.classList.add("active");
  });
}

function toggleSidebar() {
  const shell = document.querySelector(".app-shell");
  if (!shell) return;
  shell.classList.toggle("sidebar-collapsed");
  localStorage.setItem("sidebarCollapsed", shell.classList.contains("sidebar-collapsed") ? "1" : "0");
}

function logout() {
  showConfirm("Cerrar sesion", "Seguro que deseas salir?", () => {
    localStorage.clear();
    location.href = "/";
  });
}

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
