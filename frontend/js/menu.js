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
const btnAgregarCarro = document.getElementById("btnAgregarCarro");
const contenedorCarros = document.getElementById("contenedorCarros");
const mpParte = document.getElementById("mpParte");
const respondienteParte = document.getElementById("respondienteParte");

let contadorCarros = 0;

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

function formatoFecha(fecha) {
  if (!fecha) return "-";
  const fechaLimpia = String(fecha).split("T")[0];
  const partes = fechaLimpia.split("-");
  if (partes.length !== 3) return fechaLimpia;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function obtenerAnio(fecha) {
  if (!fecha) return "-";
  return String(fecha).split("-")[0];
}

function dibujarPartes(partes) {
  if (!Array.isArray(partes) || partes.length === 0) {
    tablaPartes.innerHTML = '<tr><td colspan="5" class="mensaje-tabla">No hay partes registrados.</td></tr>';
    return;
  }

  tablaPartes.innerHTML = partes
    .map((parte) => {
      const folio = parte.folio || String(parte.id_parte).padStart(8, "0");
      const nombreParte = parte.placas ? `Parte con placas ${parte.placas}` : "Parte de Transito";

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

async function cargarPartes(busqueda = "") {
  if (!token) return;

  try {
    const respuesta = await fetch(`/api/partes?buscar=${encodeURIComponent(busqueda)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      tablaPartes.innerHTML = `<tr><td colspan="5" class="mensaje-tabla">${resultado.error || "No se pudo cargar la informacion."}</td></tr>`;
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

async function cargarCatalogos() {
  if (!token) return;

  try {
    const respuesta = await fetch("/api/catalogos", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const resultado = await respuesta.json();

    if (!respuesta.ok) return;

    mpParte.innerHTML = '<option value="">Selecciona un MP</option>';
    respondienteParte.innerHTML = '<option value="">Selecciona un Respondiente</option>';

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

function crearCarro() {
  contadorCarros += 1;
  const numero = contadorCarros;
  const carro = document.createElement("section");
  carro.className = "carro-parte";
  carro.dataset.numero = numero;

  carro.innerHTML = `
    <div class="carro-encabezado">
      <span>Carro#${numero}</span>
      <button type="button" class="btnMinimizarCarro" title="Minimizar o abrir">
        <i class="fas fa-minus"></i>
      </button>
    </div>
    <div class="carro-contenido">
      <div class="carro-grid">
        <div class="carro-campo">
          <label>Marca
            <input type="text" name="marca" placeholder="Marca del carro..." />
          </label>
        </div>
        <div class="carro-campo">
          <label>Modelo
            <input type="text" name="modelo" placeholder="Modelo del carro..." />
          </label>
        </div>
        <div class="carro-campo">
          <label>No. Serie
            <input type="text" name="numero_serie" placeholder="No. serie del carro..." />
          </label>
        </div>
        <div class="carro-campo">
          <label>Tipo
            <input type="text" name="tipo" placeholder="Tipo del carro..." />
          </label>
        </div>
        <div class="carro-campo">
          <label>No. Placa
            <input type="text" name="numero_placa" placeholder="No. placa del carro..." />
          </label>
        </div>
      </div>

      <div class="personas-carro">
        <div>
          <h4>Personas involucradas</h4>
          <label class="carro-campo">No. Personas
            <input type="number" min="0" name="numero_personas" placeholder="Numero de personas" />
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
          <label class="carro-campo">Cuantas personas hubo heridas?
            <input type="number" min="0" name="numero_heridos" placeholder="Numero de personas heridas" />
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

  contenedorCarros.appendChild(carro);
}

function abrirModalParte() {
  if (!token) {
    Swal.fire({
      icon: "warning",
      title: "Inicia sesion",
      text: "Necesitas iniciar sesion para crear un parte.",
      confirmButtonColor: "#030b5d",
    }).then(() => {
      window.location.href = "/registroUsuarios/login.html";
    });
    return;
  }

  modalParte.classList.remove("oculto");
  cargarCatalogos();

  if (contenedorCarros.children.length === 0) {
    crearCarro();
  }
}

function cerrarModalParte() {
  modalParte.classList.add("oculto");
}

function obtenerValor(carro, nombreCampo) {
  const campo = carro.querySelector(`[name="${nombreCampo}"]`);
  return campo ? campo.value.trim() : "";
}

function obtenerCarros() {
  return [...contenedorCarros.querySelectorAll(".carro-parte")].map((carro) => {
    const numero = carro.dataset.numero;
    const gravedad = carro.querySelector(`[name="gravedad_${numero}"]:checked`);

    return {
      marca: obtenerValor(carro, "marca"),
      modelo: obtenerValor(carro, "modelo"),
      tipo: obtenerValor(carro, "tipo"),
      numero_serie: obtenerValor(carro, "numero_serie"),
      numero_placa: obtenerValor(carro, "numero_placa"),
      personas: {
        numero_personas: obtenerValor(carro, "numero_personas"),
        personas_fallecidas: carro.querySelector('[name="personas_fallecidas"]').checked,
        personas_heridas: carro.querySelector('[name="personas_heridas"]').checked,
        otros: carro.querySelector('[name="otros"]').checked,
        numero_heridos: obtenerValor(carro, "numero_heridos"),
        gravedad: gravedad ? gravedad.value : "Sin clasificar",
      },
    };
  });
}

async function guardarParte(e) {
  e.preventDefault();

  const datos = {
    folio: document.getElementById("folioParte").value.trim(),
    fecha: document.getElementById("fechaParte").value,
    hora: document.getElementById("horaParte").value,
    id_mp: mpParte.value,
    id_respondiente: respondienteParte.value,
    vehiculos: obtenerCarros(),
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
        text: resultado.error || "Revisa la informacion del parte.",
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
    contenedorCarros.innerHTML = "";
    contadorCarros = 0;
    crearCarro();
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

function cerrarDesplegables() {
  panelPerfil.classList.remove("abierto");
  panelNotificaciones.classList.remove("abierto");
}

function alternarDesplegable(panel) {
  const estabaAbierto = panel.classList.contains("abierto");
  cerrarDesplegables();
  if (!estabaAbierto) panel.classList.add("abierto");
}

function cerrarSesion() {
  Swal.fire({
    title: "Cerrar sesion",
    text: "Tu sesion actual se cerrara.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Cerrar sesion",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#030b5d",
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.clear();
      window.location.href = "/registroUsuarios/login.html";
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
btnAgregarCarro.addEventListener("click", crearCarro);
formParte.addEventListener("submit", guardarParte);
contenedorCarros.addEventListener("click", (e) => {
  const boton = e.target.closest(".btnMinimizarCarro");
  if (!boton) return;

  const carro = boton.closest(".carro-parte");
  carro.classList.toggle("minimizado");
  boton.innerHTML = carro.classList.contains("minimizado") ? '<i class="fas fa-plus"></i>' : '<i class="fas fa-minus"></i>';
});
