const loginForm = document.getElementById("loginForm");
const setupForm = document.getElementById("setupForm");

function togglePassword(button) {
  const input = button.parentElement.querySelector("input");
  const icon = button.querySelector("i");
  input.type = input.type === "password" ? "text" : "password";
  icon.classList.toggle("fa-eye");
  icon.classList.toggle("fa-eye-slash");
}

async function checkStatus() {
  const res = await fetch("/api/auth/status");
  const data = await res.json();
  if (!data.hasUsers && !location.pathname.endsWith("/setup.html")) {
    location.href = "/setup.html";
  }
  if (data.hasUsers && location.pathname.endsWith("/setup.html")) {
    location.href = "/";
  }
}

if (loginForm) {
  checkStatus();
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(loginForm));
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) {
      showAuthAlert("Error", data.error || "No se pudo iniciar sesion", "error");
      return;
    }
    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(data.usuario));
    showAuthAlert("Bienvenido", "Inicio de sesion correcto", "success", () => {
      location.href = "/inicio.html";
    });
  });
}

if (setupForm) {
  checkStatus();
  setupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(setupForm));
    const res = await fetch("/api/auth/setup-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) {
      showAuthAlert("Error", data.error || "No se pudo crear el administrador", "error");
      return;
    }
    showAuthAlert("Administrador creado", "Ya puedes iniciar sesion", "success", () => {
      location.href = "/";
    });
  });
}

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
