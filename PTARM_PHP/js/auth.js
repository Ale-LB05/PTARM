const loginForm = document.getElementById("loginForm");
const setupForm = document.getElementById("setupForm");
const googleLoginBtn = document.getElementById("googleLoginBtn");

function appBase() {
  return (window.PTARM_BASE || "").replace(/\/$/, "");
}

function pageUrl(path = "") {
  const clean = String(path || "").replace(/^\//, "");
  const base = appBase();
  return (base + "/" + clean).replace(/\/$/, "") || "/";
}

function apiUrl(path = "") {
  return pageUrl("api/index.php?path=" + encodeURIComponent(path));
}

/** Alterna entre mostrar y ocultar un campo de contraseña. */
function togglePassword(button) {
  const input = button.parentElement.querySelector("input");
  const icon = button.querySelector("i");
  input.type = input.type === "password" ? "text" : "password";
  icon.classList.toggle("fa-eye");
  icon.classList.toggle("fa-eye-slash");
}

/** Revisa si ya existe un usuario para decidir entre login y setup inicial. */
async function checkStatus() {
  const res = await fetch(apiUrl("/api/auth/status"));
  const data = await res.json();
  if (!data.hasUsers && !location.pathname.endsWith("/setup.php")) {
    location.href = pageUrl("registroUser/setup.php");
  }
  if (data.hasUsers && location.pathname.endsWith("/setup.php")) {
    location.href = pageUrl("");
  }
}

if (loginForm) {
  checkStatus();
  showGoogleLoginError();
  // Inicia sesión, guarda token/usuario en localStorage y entra al sistema.
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(loginForm));
    const res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) {
      showAuthAlert("Error", data.error || "No se pudo iniciar sesión", "error");
      return;
    }
    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(data.usuario));
    showAuthAlert("Bienvenido", "Inicio de sesión correcto", "success", () => {
      location.href = pageUrl("cruds/inicio.php");
    });
  });
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", () => {
    location.href = apiUrl("/api/auth/google");
  });
}

function showGoogleLoginError() {
  const error = new URLSearchParams(location.search).get("googleError");
  if (!error) return;
  const messages = {
    missing_config: "Google OAuth todavia no esta configurado en el servidor.",
    no_code: "Google no devolvio un codigo de acceso.",
    token: "No se pudo validar la sesion con Google.",
    profile: "No se pudo leer el perfil de Google.",
    user_not_allowed: "Ese correo de Google no esta registrado como usuario activo.",
    server: "Ocurrio un error al iniciar sesion con Google.",
  };
  showAuthAlert("Google", messages[error] || "No se pudo iniciar sesion con Google", "error", () => {
    history.replaceState({}, document.title, location.pathname);
  });
}

if (setupForm) {
  checkStatus();
  // Crea el primer administrador cuando la base todavia no tiene usuarios.
  setupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(setupForm));
    const res = await fetch(apiUrl("/api/auth/setup-admin"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) {
      showAuthAlert("Error", data.error || "No se pudo crear el administrador", "error");
      return;
    }
    showAuthAlert("Administrador creado", "Ya puedes iniciar sesión", "success", () => {
      location.href = pageUrl("");
    });
  });
}

/** Muestra alertas del login usando SweetAlert cuando esta disponible. */
function showAuthAlert(title, text, icon, onClose) {
  if (window.Swal) {
    Swal.fire({
      title,
      text,
      icon,
      confirmButtonColor: "#06145f",
      timer: icon === "success" ? 1400 : undefined,
      timerProgressBar: icon === "success",
    }).then(() => onClose?.());
    return;
  }
  alert(text);
  onClose?.();
}
