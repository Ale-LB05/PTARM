setupLayout("inicio");

const homeRows = document.getElementById("homeRows");
const homeSearch = document.getElementById("homeSearch");
const homePageSize = document.getElementById("homePageSize");
const homePrevPage = document.getElementById("homePrevPage");
const homeNextPage = document.getElementById("homeNextPage");
const homePageInfo = document.getElementById("homePageInfo");

let homePartes = [];
let homePage = 1;

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
      <td><a class="link" href="${pageUrl("registroPartes/partes.php")}">${parte.respondiente_nombre || "Parte de tránsito"}</a></td>
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
