setupLayout("inicio");

const homeRows = document.getElementById("homeRows");
const homeSearch = document.getElementById("homeSearch");
const homePageSize = document.getElementById("homePageSize");
const homePrevPage = document.getElementById("homePrevPage");
const homeNextPage = document.getElementById("homeNextPage");
const homePageInfo = document.getElementById("homePageInfo");

let homePartes = [];
let homePage = 1;

/** Ajusta las explicaciones del menú a las acciones disponibles para el rol actual. */
function updateHomeMenuForRole() {
  const role = normalizedRole();
  const contentByRole = {
    administrador: {
      intro: "Administra registros, actividad del sistema, reportes y personal autorizado.",
      partes: ["Gestión integral de partes", "Crea, edita, consulta, filtra y exporta partes de tránsito."],
      historial: ["Historial y estadísticas", "Supervisa actividad, consulta estadísticas y exporta reportes configurables."],
      perfil: ["Mi perfil", "Actualiza tus datos, foto de perfil y revisa los partes a tu cargo."],
      personal: ["Administración de personal", "Gestiona usuarios, roles, ministerios públicos y respondientes."],
    },
    capturista: {
      intro: "Registra y administra partes de tránsito; consulta actividad y genera reportes.",
      partes: ["Registro y gestión de partes", "Crea, edita, consulta, filtra y exporta los partes asignados a tu operación."],
      historial: ["Historial y estadísticas", "Consulta la actividad del sistema y genera reportes por periodo y actividad."],
      perfil: ["Mi perfil", "Actualiza tus datos, foto de perfil y revisa tus partes asignados."],
    },
    auxiliar: {
      intro: "Consulta los registros disponibles, su actividad y los reportes autorizados.",
      partes: ["Consulta de partes", "Busca, filtra, consulta y exporta los partes disponibles para tu rol."],
      historial: ["Historial y estadísticas", "Consulta actividad, estadísticas y reportes autorizados."],
      perfil: ["Mi perfil", "Consulta y actualiza tus datos de cuenta, foto y partes asignados."],
    },
  };
  const content = contentByRole[role] || contentByRole.auxiliar;
  document.getElementById("systemMenuIntro").textContent = content.intro;
  document.querySelectorAll(".menu-card[data-page]").forEach((card) => {
    const [title, description] = content[card.dataset.page] || [];
    if (title) card.querySelector("[data-menu-title]").textContent = title;
    if (description) card.querySelector("[data-menu-description]").textContent = description;
  });
}

/** Carga los partes que se muestran en el inicio aplicando el buscador. */
async function loadHome() {
  const data = await api(`/api/partes?q=${encodeURIComponent(homeSearch.value || "")}`);
  if (!data || !data.success) {
    showToast(data?.error || "No se pudieron cargar los partes", "error");
    return;
  }
  homePartes = data.data;
  homePage = 1;
  renderHomePage();
}

/** Pinta la pagina actual de partes en el inicio y actualiza paginacion. */
function renderHomePage() {
  const pageSize = Number(homePageSize.value || 5);
  const totalPages = Math.max(1, Math.ceil(homePartes.length / pageSize));
  homePage = Math.min(Math.max(homePage, 1), totalPages);
  const start = (homePage - 1) * pageSize;
  const visible = homePartes.slice(start, start + pageSize);

  homeRows.innerHTML = visible.map((parte) => `
    <tr>
      <td>${parte.folio || ""}</td>
      <td><a class="link" href="/partes.html">${parte.respondiente_nombre || "Parte de tránsito"}</a></td>
      <td>${formatDate(parte.fecha)}</td>
      <td>${parte.encargado_nombre || "Sin asignar"}</td>
    </tr>
  `).join("") || `<tr><td colspan="4">No hay partes registrados.</td></tr>`;

  homePageInfo.textContent = `Página ${homePage} de ${totalPages}`;
  homePrevPage.disabled = homePage <= 1;
  homeNextPage.disabled = homePage >= totalPages;
}

/** Formatea una fecha conservando solo yyyy-mm-dd. */
function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

homeSearch.addEventListener("input", loadHome);
homePageSize.addEventListener("change", () => {
  homePage = 1;
  renderHomePage();
});
homePrevPage.addEventListener("click", () => {
  homePage -= 1;
  renderHomePage();
});
homeNextPage.addEventListener("click", () => {
  homePage += 1;
  renderHomePage();
});
loadHome();
updateHomeMenuForRole();
