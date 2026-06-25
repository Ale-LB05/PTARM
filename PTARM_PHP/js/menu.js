/*
 * Script del menu/formulario anterior.
 *
 * Conserva compatibilidad con la interfaz previa de partes. Si una pantalla lo
 * usa, carga partes desde la API, dibuja tabla y envia formularios al servidor.
 */
const token = localStorage.getItem("token");
const nombre = localStorage.getItem("usuario");
const rol = localStorage.getItem("rol");
const cargo = localStorage.getItem("cargo");
const foto = localStorage.getItem("foto") || "/img/user.png";

const linkLogin = document.getElementById("linkLogin");
const nombreUsuarioTop = document.getElementById("nombreUsuarioTop");
const fotoUsuarioTop = document.getElementById("fotoUsuarioTop");
const tablaPartes = document.getElementById("tablaPartes");
const buscarPartes = document.getElementById("buscarPartes");
const btnCerrarSesion = document.getElementById("btnCerrarSesion");
const btnCerrarSesionPerfil = document.getElementById("btnCerrarSesionPerfil");
const btnMenu = document.getElementById("btnMenu");
const barraLateral = document.getElementById("barraLateral");
const btnPerfil = document.getElementById("btnPerfil");
const panelPerfil = document.getElementById("panelPerfil");
const btnNotificaciones = document.getElementById("btnNotificaciones");
const panelNotificaciones = document.getElementById("panelNotificaciones");
const btnAbrirParte = document.getElementById("btnAbrirParte");
const opcionCrearParte = document.getElementById("opcionCrearParte");
const linkGestionarPartes = document.getElementById("linkGestionarPartes");
const modalParte = document.getElementById("modalParte");
const formParte = document.getElementById("formParte");
const btnCerrarModal = document.getElementById("btnCerrarModal");
const btnCancelarParte = document.getElementById("btnCancelarParte");
const btnAgregarVehiculo = document.getElementById("btnAgregarVehiculo");
const contenedorVehiculos = document.getElementById("contenedorVehiculos");
const mpParte = document.getElementById("mpParte");
const respondienteParte = document.getElementById("respondienteParte");

let contadorVehiculos = 0;

/** Configura nombre, cargo/foto y estado visual del usuario en el encabezado. */
function configurarUsuario() {
  if (!token) return;

  linkLogin.classList.add("oculto");
  nombreUsuarioTop.classList.remove("oculto");
  const rolTexto = rol ? rol.toLowerCase() : "";
  nombreUsuarioTop.textContent = `${nombre || "Usuario"}${cargo ? " - " + cargo : rolTexto ? " - " + rolTexto : ""}`;
  fotoUsuarioTop.src = foto.includes("user.jpg") ? "/img/user.png" : foto;
  fotoUsuarioTop.onerror = function () {
    this.src = "/img/user.png";
  };
}

/** Convierte fechas yyyy-mm-dd a dd/mm/yyyy para mostrarlas en tablas. */
function formatoFecha(fecha) {
  if (!fecha) return "-";
  const fechaLimpia = String(fecha).split("T")[0];
  const partes = fechaLimpia.split("-");
  if (partes.length !== 3) return fechaLimpia;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/** Obtiene solo el anio de una fecha. */
function obtenerAnio(fecha) {
  if (!fecha) return "-";
  return String(fecha).split("-")[0];
}

/** Pinta la tabla de partes del menu anterior. */
function dibujarPartes(partes) {
  if (!Array.isArray(partes) || partes.length === 0) {
    tablaPartes.innerHTML = '<tr><td colspan="5" class="mensaje-tabla">No hay partes registrados.</td></tr>';
    return;
  }

  tablaPartes.innerHTML = partes
    .map((parte) => {
      const folio = parte.folio || String(parte.id_parte).padStart(8, "0");
      const nombreParte = parte.placas ? `Parte con placas ${parte.placas}` : "Parte de tránsito";

      return `
        <tr>
          <td>${folio}</td>
          <td><a href="#">${nombreParte}</a></td>
          <td>${formatoFecha(parte.fecha)}</td>
          <td>${obtenerAnio(parte.fecha)}</td>
          <td>${parte.ministerio_publico || "Sin asignar"}</td>
        </tr>
      `;
    })
    .join("");
}

/** Carga partes desde la API usando el token guardado. */
async function cargarPartes(busqueda = "") {
  if (!token) return;

  try {
    const respuesta = await fetch(`/api/partes?buscar=${encodeURIComponent(busqueda)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      tablaPartes.innerHTML = `<tr><td colspan="5" class="mensaje-tabla">${resultado.error || "No se pudo cargar la información."}</td></tr>`;
      if (respuesta.status === 401) {
        localStorage.clear();
        linkLogin.classList.remove("oculto");
        nombreUsuarioTop.classList.add("oculto");
      }
      return;
    }

    dibujarPartes(resultado.data);
  } catch (error) {
    tablaPartes.innerHTML = '<tr><td colspan="5" class="mensaje-tabla">Error de conexion con el servidor.</td></tr>';
  }
}

/** Carga catálogos de MP y respondientes para el formulario anterior. */
async function cargarCatalogos() {
  if (!token) return;

  try {
    const respuesta = await fetch("/api/catalogos", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const resultado = await respuesta.json();

    if (!respuesta.ok) return;

    mpParte.innerHTML = '<option value="">Selecciona un MP</option>';
    respondienteParte.innerHTML = '<option value="">Selecciona un respondiente</option>';

    resultado.data.ministerios.forEach((mp) => {
      mpParte.innerHTML += `<option value="${mp.id_mp}">${mp.nombre}</option>`;
    });

    resultado.data.respondientes.forEach((respondiente) => {
      respondienteParte.innerHTML += `<option value="${respondiente.id_respondiente}">${respondiente.nombre}</option>`;
    });
  } catch (error) {
    console.error("No se pudieron cargar catalogos", error);
  }
}

/** Agrega una seccion de Vehiculo con campos de vehiculo y personas involucradas. */
function crearVehiculo() {
  contadorVehiculos += 1;
  const numero = contadorVehiculos;
  const Vehiculo = document.createElement("section");
  Vehiculo.className = "Vehiculo-parte";
  Vehiculo.dataset.numero = numero;

  Vehiculo.innerHTML = `
    <div class="Vehiculo-encabezado">
      <span>Vehiculo#${numero}</span>
      <button type="button" class="btnMinimizarVehiculo" title="Minimizar o abrir">
        <i class="fas fa-minus"></i>
      </button>
    </div>
    <div class="Vehiculo-contenido">
      <div class="Vehiculo-grid">
        <div class="Vehiculo-campo">
          <label>Marca
            <input type="text" name="marca" placeholder="Marca del Vehiculo..." />
          </label>
        </div>
        <div class="Vehiculo-campo">
          <label>Modelo
            <input type="text" name="modelo" placeholder="Modelo del Vehiculo..." />
          </label>
        </div>
        <div class="Vehiculo-campo">
          <label>No. Serie
            <input type="text" name="numero_serie" placeholder="No. serie del Vehiculo..." />
          </label>
        </div>
        <div class="Vehiculo-campo">
          <label>Tipo
            <input type="text" name="tipo" placeholder="Tipo del Vehiculo..." />
          </label>
        </div>
        <div class="Vehiculo-campo">
          <label>No. Placa
            <input type="text" name="numero_placa" placeholder="No. placa del Vehiculo..." />
          </label>
        </div>
      </div>

      <div class="personas-Vehiculo">
        <div>
          <h4>Personas involucradas</h4>
          <label class="Vehiculo-campo">No. Personas
            <input type="number" min="0" name="numero_personas" placeholder="Número de personas" />
          </label>
        </div>
        <div>
          <h4>Complementos</h4>
          <label class="check-linea">
            <input type="checkbox" name="personas_fallecidas" />
            Personas fallecidas
          </label>
          <label class="check-linea">
            <input type="checkbox" name="personas_heridas" />
            Personas heridas
          </label>
          <label class="check-linea">
            <input type="checkbox" name="otros" />
            Otros
          </label>
        </div>
        <div>
          <h4>Personas heridas</h4>
          <label class="Vehiculo-campo">¿Cuántas personas hubo heridas?
            <input type="number" min="0" name="numero_heridos" placeholder="Número de personas heridas" />
          </label>
          <h4>Gravedad</h4>
          <div class="gravedad-grid">
            <label class="radio-linea"><input type="radio" name="gravedad_${numero}" value="Bajo" /> Bajo</label>
            <label class="radio-linea"><input type="radio" name="gravedad_${numero}" value="Alto" /> Alto</label>
            <label class="radio-linea"><input type="radio" name="gravedad_${numero}" value="Medio" /> Medio</label>
            <label class="radio-linea"><input type="radio" name="gravedad_${numero}" value="Otro" /> Otro</label>
          </div>
        </div>
      </div>
    </div>
  `;

  contenedorVehiculos.appendChild(Vehiculo);
}

/** Abre el modal de crear parte y prepara catalogos/Vehiculo inicial. */
function abrirModalParte() {
  if (!token) {
    Swal.fire({
      icon: "warning",
      title: "Inicia sesión",
      text: "Necesitas iniciar sesión para crear un parte.",
      confirmButtonColor: "#030b5d",
    }).then(() => {
      window.location.href = window.pageUrl ? window.pageUrl("") : "/";
    });
    return;
  }

  modalParte.classList.remove("oculto");
  cargarCatalogos();

  if (contenedorVehiculos.children.length === 0) {
    crearVehiculo();
  }
}

/** Cierra el modal anterior de crear parte. */
function cerrarModalParte() {
  modalParte.classList.add("oculto");
}

/** Lee y limpia el valor de un campo dentro de una tarjeta de Vehiculo. */
function obtenerValor(Vehiculo, nombreCampo) {
  const campo = Vehiculo.querySelector(`[name="${nombreCampo}"]`);
  return campo ? campo.value.trim() : "";
}

/** Convierte todas las tarjetas de Vehiculo en objetos para enviarlos a la API. */
function obtenerVehiculos() {
  return [...contenedorVehiculos.querySelectorAll(".Vehiculo-parte")].map((Vehiculo) => {
    const numero = Vehiculo.dataset.numero;
    const gravedad = Vehiculo.querySelector(`[name="gravedad_${numero}"]:checked`);

    return {
      marca: obtenerValor(Vehiculo, "marca"),
      modelo: obtenerValor(Vehiculo, "modelo"),
      tipo: obtenerValor(Vehiculo, "tipo"),
      numero_serie: obtenerValor(Vehiculo, "numero_serie"),
      numero_placa: obtenerValor(Vehiculo, "numero_placa"),
      personas: {
        numero_personas: obtenerValor(Vehiculo, "numero_personas"),
        personas_fallecidas: Vehiculo.querySelector('[name="personas_fallecidas"]').checked,
        personas_heridas: Vehiculo.querySelector('[name="personas_heridas"]').checked,
        otros: Vehiculo.querySelector('[name="otros"]').checked,
        numero_heridos: obtenerValor(Vehiculo, "numero_heridos"),
        gravedad: gravedad ? gravedad.value : "Sin clasificar",
      },
    };
  });
}

/** Guarda un parte desde el formulario anterior y recarga la tabla. */
async function guardarParte(e) {
  e.preventDefault();

  const datos = {
    folio: document.getElementById("folioParte").value.trim(),
    fecha: document.getElementById("fechaParte").value,
    hora: document.getElementById("horaParte").value,
    id_mp: mpParte.value,
    id_respondiente: respondienteParte.value,
    vehiculos: obtenerVehiculos(),
  };

  try {
    const respuesta = await fetch("/api/partes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(datos),
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      Swal.fire({
        icon: "error",
        title: "No se pudo crear",
        text: resultado.error || "Revisa la información del parte.",
        confirmButtonColor: "#030b5d",
      });
      return;
    }

    Swal.fire({
      icon: "success",
      title: "Creado correctamente",
      text: "El parte fue guardado en la base de datos.",
      confirmButtonColor: "#030b5d",
    });

    formParte.reset();
    contenedorVehiculos.innerHTML = "";
    contadorVehiculos = 0;
    crearVehiculo();
    cerrarModalParte();
    cargarPartes(buscarPartes.value.trim());
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error de conexion",
      text: "No se pudo conectar con el servidor.",
      confirmButtonColor: "#030b5d",
    });
  }
}

/** Cierra los paneles desplegables del encabezado. */
function cerrarDesplegables() {
  panelPerfil.classList.remove("abierto");
  panelNotificaciones.classList.remove("abierto");
}

/** Abre o cierra un panel desplegable manteniendo solo uno activo. */
function alternarDesplegable(panel) {
  const estabaAbierto = panel.classList.contains("abierto");
  cerrarDesplegables();
  if (!estabaAbierto) panel.classList.add("abierto");
}

/** Confirma el cierre de sesión, limpia datos locales y vuelve al login. */
function cerrarSesion() {
  Swal.fire({
    title: "Cerrar sesión",
    text: "Tu sesión actual se cerrar?.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Cerrar sesión",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#030b5d",
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.clear();
      window.location.href = window.pageUrl ? window.pageUrl("") : "/";
    }
  });
}

configurarUsuario();
cargarPartes();

buscarPartes.addEventListener("input", () => {
  cargarPartes(buscarPartes.value.trim());
});

btnCerrarSesion.addEventListener("click", cerrarSesion);
btnCerrarSesionPerfil.addEventListener("click", cerrarSesion);

btnMenu.addEventListener("click", () => {
  barraLateral.classList.toggle("contraida");
});

btnPerfil.addEventListener("click", (e) => {
  e.stopPropagation();
  alternarDesplegable(panelPerfil);
});

btnNotificaciones.addEventListener("click", (e) => {
  e.stopPropagation();
  alternarDesplegable(panelNotificaciones);
});

panelPerfil.addEventListener("click", (e) => e.stopPropagation());
panelNotificaciones.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", cerrarDesplegables);

btnAbrirParte.addEventListener("click", abrirModalParte);
opcionCrearParte.addEventListener("click", (e) => {
  e.preventDefault();
  abrirModalParte();
});
linkGestionarPartes.addEventListener("click", (e) => {
  e.preventDefault();
  abrirModalParte();
});
btnCerrarModal.addEventListener("click", cerrarModalParte);
btnCancelarParte.addEventListener("click", cerrarModalParte);
btnAgregarVehiculo.addEventListener("click", crearVehiculo);
formParte.addEventListener("submit", guardarParte);
contenedorVehiculos.addEventListener("click", (e) => {
  const boton = e.target.closest(".btnMinimizarVehiculo");
  if (!boton) return;

  const Vehiculo = boton.closest(".Vehiculo-parte");
  Vehiculo.classList.toggle("minimizado");
  boton.innerHTML = Vehiculo.classList.contains("minimizado") ? '<i class="fas fa-plus"></i>' : '<i class="fas fa-minus"></i>';
});

