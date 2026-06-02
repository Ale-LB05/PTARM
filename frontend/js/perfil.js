setupLayout("perfil");

const form = document.getElementById("profileForm");
const photo = document.getElementById("profilePhoto");
const rows = document.getElementById("profilePartes");
const defaultPhoto = "/img/usuario.png";

async function loadProfile() {
  const data = await api("/api/perfil");
  if (!data?.success) {
    showToast(data?.error || "No se pudo cargar el perfil", "error");
    return;
  }
  const user = data.data.usuario;
  form.nombre.value = user.nombre || "";
  form.correo.value = user.correo || "";
  form.instituto.value = user.instituto || "";
  form.cargo_grado.value = user.cargo_grado || "";
  photo.src = user.imagen_perfil || defaultPhoto;
  updateStoredUser({
    nombre: user.nombre || "",
    correo: user.correo || "",
    instituto: user.instituto || "",
    cargo: user.cargo_grado || "",
    rol: user.rol || "",
    foto: user.imagen_perfil || defaultPhoto,
  });
  rows.innerHTML = data.data.partes.map((parte) => `
    <tr><td>${parte.folio}</td><td>${parte.respondiente_nombre || "Parte de transito"}</td><td>${parte.gravedad_general}</td><td>${formatDate(parte.fecha)}</td><td>${parte.mp_nombre || ""}</td></tr>
  `).join("") || `<tr><td colspan="5">Aun no hay partes creados o asignados.</td></tr>`;
}

form.imagen.addEventListener("change", () => {
  const file = form.imagen.files[0];
  if (!file) return;
  const previewUrl = URL.createObjectURL(file);
  photo.src = previewUrl;
  document.querySelectorAll("[data-user-photo]").forEach((img) => {
    img.src = previewUrl;
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = new FormData(form);
  const data = await api("/api/perfil", { method: "POST", body });
  if (data?.success) {
    const updatedUser = data.usuario || {
      nombre: form.nombre.value,
      correo: form.correo.value,
      instituto: form.instituto.value,
      cargo: form.cargo_grado.value,
      foto: defaultPhoto,
    };
    updateStoredUser(updatedUser);
    photo.src = updatedUser.foto || defaultPhoto;
    showToast("Perfil actualizado");
    loadProfile();
  } else {
    showToast(data?.error || "No se pudo actualizar el perfil", "error");
  }
});

function updateStoredUser(changes) {
  const current = getUser();
  const updated = {
    ...current,
    ...changes,
    foto: changes.foto || changes.imagen_perfil || defaultPhoto,
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

function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

loadProfile();
