setupLayout("inicio");

const homeRows = document.getElementById("homeRows");
const homeSearch = document.getElementById("homeSearch");

async function loadHome() {
  const data = await api(`/api/partes?q=${encodeURIComponent(homeSearch.value || "")}`);
  if (!data || !data.success) {
    showToast(data?.error || "No se pudieron cargar los partes", "error");
    return;
  }
  homeRows.innerHTML = data.data.slice(0, 5).map((parte) => `
    <tr>
      <td>${parte.folio || ""}</td>
      <td><a class="link" href="/partes.html">${parte.respondiente_nombre || "Parte de Transito"}</a></td>
      <td>${formatDate(parte.fecha)}</td>
      <td>${parte.encargado_nombre || "Sin asignar"}</td>
    </tr>
  `).join("") || `<tr><td colspan="4">No hay partes registrados.</td></tr>`;
}

function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

homeSearch.addEventListener("input", loadHome);
loadHome();
