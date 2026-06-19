<?php require_once __DIR__ . '/../config/db.php'; ?>
<!--Pantalla Gestionar partes.
js/partes.js maneja listado, formulario, ubicacion, personas, vehiculos,
busqueda avanzada y exportaciones. Sus datos vienen de /api/partes.-->
<!doctype html>
<html lang="es">
  <head>
    <script>window.PTARM_BASE = <?= json_encode(app_base()) ?>;</script>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script>
      (() => {
        const root = document.documentElement;
        root.classList.add("booting");
        try {
          const isDark = localStorage.getItem("theme") === "dark";
          root.dataset.theme = isDark ? "dark" : "light";
          root.classList.toggle("theme-dark", isDark);
          root.classList.toggle("sidebar-start-collapsed", localStorage.getItem("sidebarCollapsed") === "1");
        } catch (_) {
          root.dataset.theme = "light";
        }
      })();
    </script>
    <style>
      html.booting[data-theme="dark"],
      html.booting[data-theme="dark"] body {
        background: #0b1220;
      }
    </style>
    <title>Partes | PTARM</title>
    <link rel="icon" type="image/png" href="<?= app_url('img/logot.png') ?>" />
    <link href="<?= app_url('vendor/fontawesome-free/css/all.min.css') ?>" rel="stylesheet" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="<?= app_url('css/styles.css') ?>?v=20260619advancedmodal" />
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  </head>
  <body>
    <div class="app-shell">
      <aside class="sidebar">
        <a class="side-brand" href="<?= app_url('cruds/inicio.php') ?>">
          <span class="brand-icon"><img src="<?= app_url('img/logot.png') ?>" alt="PTARM" /></span>
          <span class="brand-text">PTARM</span>
        </a>
        <nav class="side-nav">
          <a data-page="inicio" href="<?= app_url('cruds/inicio.php') ?>"
            ><span class="nav-icon"><img src="<?= app_url('img/iconos/Inicio.png') ?>" alt="" /></span
            ><span>Inicio</span></a
          >
          <div class="side-section">Administración</div>
          <a data-page="personal" href="<?= app_url('cruds/personal.php') ?>"
            ><span class="nav-icon"><img src="<?= app_url('img/iconos/personal.png') ?>" alt="" /></span
            ><span>Personal</span></a
          ><a data-page="partes" href="<?= app_url('registroPartes/partes.php') ?>"
            ><span class="nav-icon"
              ><img src="<?= app_url('img/iconos/gestion.png') ?>" alt="" /></span
            ><span>Gestionar partes</span></a
          ><a data-page="historial" href="<?= app_url('cruds/historial.php') ?>"
            ><span class="nav-icon"><img src="<?= app_url('img/iconos/historial.png') ?>" alt="" /></span
            ><span>Historial</span></a
          >
          <div class="side-section">Sesión</div>
          <button onclick="logout()">
            <span class="nav-icon"><img src="<?= app_url('img/iconos/salida.png') ?>" alt="" /></span
            ><span>Cerrar sesión</span></button
          ><button class="collapse-btn" onclick="toggleSidebar()">
            <span class="nav-icon"><i class="fas fa-chevron-left"></i></span
            ><span>Ocultar</span>
          </button>
        </nav>
      </aside>
      <main class="content">
        <header class="topbar">
          <a class="topbar-brand" href="<?= app_url('cruds/inicio.php') ?>">
            <img class="logo" src="<?= app_url('img/Logo.png') ?>" alt="FGE" />
            <span>Sistema de partes</span>
          </a>
          <div class="user-menu">
            <button class="user-top" type="button">
              <i class="fas fa-bell"></i><span data-user-name></span
              ><img data-user-photo alt="Perfil" />
            </button>
            <div class="user-dropdown animated--grow-in">
              <a href="<?= app_url('cruds/perfil.php') ?>"><i class="fas fa-user"></i> Perfil</a
              >
            </div>
          </div>
        </header>
        <section class="page">
          <h1>Partes de tránsito</h1>
          <div class="toolbar">
            <div class="toolbar-left">
              <input
                id="partSearch"
                class="search"
                placeholder="Buscar partes"
              /><button
                class="btn blue outline advanced-search-trigger"
                id="advancedSearchBtn"
                type="button"
                title="Búsqueda avanzada"
              >
                <i class="fas fa-search-plus"></i> Avanzada</button
              ><button
                class="btn icon-only view-toggle active"
                id="listViewBtn"
                type="button"
                title="Vista de lista"
              >
                <i class="fas fa-list"></i></button
              ><button
                class="btn icon-only view-toggle"
                id="gridViewBtn"
                type="button"
                title="Vista de cuadros"
              >
                <i class="fas fa-th"></i></button>
            </div>
            <div class="toolbar-right">
              <button class="btn blue" id="openExportBtn" onclick="openExport()">
                <i class="fas fa-file-export"></i> Exportar</button>
                <button class="btn amber outline" id="openImportBtn" onclick="openImport()">
                <i class="fas fa-file-import"></i> Importar</button>
              <button class="btn green" id="createParteBtn" type="button" onclick="openParteModal('create')">
                <i class="fas fa-file-medical"></i> Crear nuevo
              </button>
            </div>
          </div>
          <div id="advancedSearchSummary" class="advanced-search-summary" hidden></div>
          <div class="table-controls compact">
            <label class="inline-check"
              >Mostrar
              <select id="partesPageSize">
                <option value="5">5 partes</option>
                <option value="10">10 partes</option>
                <option value="15">15 partes</option>
                <option value="20">20 partes</option>
              </select></label
            >
            <div class="pager">
              <button class="btn icon-only" id="partesPrevPage" type="button" title="Página anterior">
                <i class="fas fa-chevron-left"></i>
              </button>
              <span id="partesPageInfo"></span>
              <button class="btn icon-only" id="partesNextPage" type="button" title="Página siguiente">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
          <div id="partesListView" class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No. parte</th>
                  <th>Respondiente</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>MP</th>
                  <th>Encargado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="partesRows"></tbody>
            </table>
          </div>
          <div id="partesGridView" class="partes-grid-view"></div>
        </section>
      </main>
    </div>

    <div id="parteModal" class="modal-backdrop">
      <div class="modal parte-modal">
        <div class="modal-title">
          <h2 id="parteModalTitle">Nuevo parte</h2>
          <button class="modal-close" onclick="closeModal('parteModal')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <form id="parteForm" class="modal-body">
          <input type="hidden" name="id_parte" />
          <section class="parte-form-section">
            <div class="parte-section-head">
              <div>
                <strong>Datos generales</strong>
                <span>Informacion principal del parte y asignacion inicial.</span>
              </div>
            </div>
          <div class="form-grid cols-3">
            <label
              >Folio del parte<input
                name="folio"
                placeholder="Crea un folio..." /></label
            ><label
              >Motivo del parte<select name="tipo_parte">
                <option value="">Selecciona un motivo</option>
                <option>Accidente de tránsito</option>
                <option>Robo</option>
                <option>Daño al vehículo</option>
                <option>Otro</option>
              </select></label
            ><label>Fecha<input type="date" name="fecha" /></label
            ><label>Hora<input type="time" name="hora" /></label>
          </div>
          <div class="form-grid cols-2">
            <label
              >MP asignado<select
                name="id_mp"
                id="mpSelect">
                  <option value="">Sin MP</option>
                </select></label
            ><label
              >Respondiente<div class="lookup-field"><input
                name="respondiente_nombre"
                list="respondienteOptions"
                autocomplete="off"
                placeholder="Selecciona un respondiente"
            /><i class="fas fa-search"></i></div><datalist id="respondienteOptions"></datalist></label>
          </div>
          </section>
          <fieldset class="location-fieldset">
            <legend><i class="fas fa-map-marker-alt"></i> Ubicación por kilometraje</legend>
            <div class="form-grid cols-2">
              <label
                >Kilómetro o referencia
                <div class="lookup-field">
                  <input
                    name="ubicacion_kilometro"
                    id="locationKilometer"
                    autocomplete="off"
                    placeholder="Ej. Km 12 carretera Morelia-Pátzcuaro"
                  /><i class="fas fa-road"></i></div></label
              ><label
                >Resultado de OpenStreetMap
                <div class="lookup-field">
                  <input
                    name="ubicacion_direccion"
                    id="locationAddress"
                    placeholder="Dirección encontrada"
                  /><i class="fas fa-map"></i></div></label
              >
            </div>
            <input type="hidden" name="ubicacion_lat" id="locationLat" />
            <input type="hidden" name="ubicacion_lng" id="locationLng" />
            <input type="hidden" name="google_place_id" id="locationPlaceId" />
            <div class="location-actions">
              <button class="btn blue outline" id="searchLocationBtn" type="button">
                <i class="fas fa-search-location"></i> Buscar ubicación
              </button>
              <button class="btn red outline" id="clearLocationBtn" type="button">
                <i class="fas fa-times"></i> Limpiar ubicación
              </button>
              <span id="locationStatus">Sistema listo para buscar.</span>
            </div>
            <div class="location-preview" id="locationPreview">
              <i class="fas fa-map-marked-alt"></i>
              <span>Sin ubicación seleccionada</span>
            </div>
            <div class="location-map" id="locationMap" hidden></div>
          </fieldset>
          <datalist id="corralonOptions"></datalist>
          <section class="parte-form-section vehicle-section">
          <div class="sub-row">
            <span>Vehiculos involucrados</span
            ><button class="tiny-add" id="addVehicleBtn" type="button">
              Agregar nuevo vehículo +
            </button>
          </div>
          <div id="vehiclesWrap" class="vehicles-wrap"></div>
          </section>
          <section class="parte-form-section people-section">
          <div class="sub-row"><span>Personas involucradas</span></div>
          <fieldset class="people-fieldset">
            <div class="people-grid">
              <div class="form-grid">
                <label
                  >No. personas<input
                    type="number"
                    min="0"
                    name="numero_personas"
                    placeholder="Número de personas" /></label
                >
              </div>
              <div id="peopleAssignmentPanel" class="people-assignment-panel" hidden>
                <div class="people-assignment-head">
                  <strong>Listado de personas</strong>
                  <button class="btn blue outline" id="togglePeopleTableBtn" type="button">
                    <i class="fas fa-eye-slash"></i> Ocultar tabla
                  </button>
                </div>
                <div id="peopleAssignmentTableWrap" class="people-assignment-table-wrap">
                  <div class="people-table-controls">
                    <label class="inline-check"
                      >Mostrar
                      <select id="peoplePageSize">
                        <option value="5">5 personas</option>
                        <option value="10">10 personas</option>
                        <option value="20">20 personas</option>
                        <option value="50">50 personas</option>
                      </select></label
                    >
                    <div class="pager compact-pager">
                      <button class="btn icon-only" id="peoplePrevPage" type="button" title="Página anterior">
                        <i class="fas fa-chevron-left"></i>
                      </button>
                      <span id="peoplePageInfo"></span>
                      <button class="btn icon-only" id="peopleNextPage" type="button" title="Página siguiente">
                        <i class="fas fa-chevron-right"></i>
                      </button>
                    </div>
                  </div>
                  <table class="people-assignment-table">
                    <thead>
                      <tr>
                        <th>Persona</th>
                        <th>Nombre</th>
                        <th>Vehículo</th>
                        <th>Participación</th>
                      </tr>
                    </thead>
                    <tbody id="peopleAssignmentRows"></tbody>
                  </table>
                </div>
              </div>
              <div>
                <strong>Complementos</strong>
                <div class="check-list">
                  <label><input type="checkbox" name="personas_fallecidas" /> Personas fallecidas</label>
                  <label><input type="checkbox" name="personas_heridas" /> Personas heridas</label>
                  <label><input type="checkbox" name="otros" /> Otros...</label>
                </div>
              </div>
            </div>
            <div id="complementQuestions" class="complement-questions">
              <div class="complement-panel" data-complement-panel="personas_fallecidas" hidden>
                <h4>Datos de personas fallecidas</h4>
                <div class="form-grid cols-2">
                  <label
                    >¿Cuántas personas fallecieron?<input
                      type="number"
                      name="numero_fallecidos"
                      placeholder="Número de personas" /></label
                  ><label
                    >Observación de fallecidos<input
                      name="observacion_fallecidos"
                      placeholder="Detalle breve" /></label
                  >
                </div>
              </div>
              <div class="complement-panel" data-complement-panel="personas_heridas" hidden>
                <h4>Datos de personas heridas</h4>
                <div class="form-grid cols-2">
                  <label
                    >¿Cuántas personas hubo heridas?<input
                      type="number"
                      name="numero_heridos"
                      placeholder="Número de personas" /></label
                  ><div>
                    <strong>?Gravedad?</strong>
                    <div class="radio-list">
                      <label
                        ><input type="radio" name="gravedad" value="Bajo" />
                        Bajo</label
                      ><label
                        ><input type="radio" name="gravedad" value="Alto" />
                        Alto</label
                      ><label
                        ><input type="radio" name="gravedad" value="Medio" />
                        Medio</label
                      ><label
                        ><input type="radio" name="gravedad" value="Otro" />
                        Otro</label
                      >
                    </div>
                  </div>
                </div>
              </div>
              <div class="complement-panel" data-complement-panel="otros" hidden>
                <h4>Otros datos</h4>
                <label
                  >Observaciones generales<input
                    name="observaciones"
                    placeholder="Describe otro dato relevante" /></label
                >
              </div>
            </div>
          </fieldset>
          <fieldset class="part-history-panel" id="partHistoryPanel" hidden>
            <legend><i class="fas fa-history"></i> Historial del parte</legend>
            <div id="partHistoryRows" class="part-history-list"></div>
          </fieldset>
          </section>
          <section class="parte-form-section control-section">
            <div class="parte-section-head">
              <div>
                <strong>Control del parte</strong>
                <span>Estado operativo y nivel general de gravedad.</span>
              </div>
            </div>
          <div class="form-grid cols-3">
            <label
              >Usuario encargado<select
                name="asignado_a"
                id="asignadoSelect"
              ></select></label
            ><label
              >Estado<select name="estado">
                <option>Activo</option>
                <option>Borrador</option>
                <option>Cerrado</option>
                <option>Archivado</option>
                <option>Cancelado</option>
              </select></label
            ><label
              >Gravedad general<select name="gravedad_general">
                <option>Sin clasificar</option>
                <option>Bajo</option>
                <option>Medio</option>
                <option>Alto</option>
                <option>Otro</option>
              </select></label
            >
          </div>
          </section>
          <div class="form-actions">
            <button
              type="button"
              class="btn red"
              onclick="closeModal('parteModal')"
            >
              Cancelar</button
            ><button class="btn green" type="submit" id="parteSubmit">
              Crear nuevo
            </button>
          </div>
        </form>
      </div>
    </div>

    <div id="partDetailModal" class="modal-backdrop">
      <div class="modal detail">
        <div class="modal-title">
          <h2>Información del parte</h2>
          <button class="modal-close" onclick="closeModal('partDetailModal')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body" id="partDetailBody"></div>
      </div>
    </div>

    <div id="advancedSearchModal" class="modal-backdrop">
      <div class="modal advanced-search-modal">
        <div class="modal-title">
          <h2><i class="fas fa-search-plus"></i> Búsqueda avanzada</h2>
          <button class="modal-close" onclick="closeModal('advancedSearchModal')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <form id="advancedSearchForm" class="modal-body">
          <div class="advanced-search-intro">
            <strong>Filtrar partes por apartado</strong>
            <span>Agrega uno o más filtros y se mostrarán solo los partes que cumplan todos.</span>
          </div>
          <div id="advancedFilterList" class="advanced-filter-list" hidden></div>
          <div class="form-grid cols-2 advanced-search-grid">
            <label
              >Apartado
              <select id="advancedSearchField" required>
                <option value="">Selecciona un apartado</option>
                <option value="folio">No. parte / folio</option>
                <option value="tipo_parte">Motivo del parte</option>
                <option value="fecha">Fecha</option>
                <option value="hora">Hora</option>
                <option value="estado">Estado</option>
                <option value="gravedad">Gravedad</option>
                <option value="mp">MP asignado</option>
                <option value="respondiente">Respondiente</option>
                <option value="encargado">Usuario encargado</option>
                <option value="placa">No. placa</option>
                <option value="serie">No. serie</option>
                <option value="marca">Marca del vehículo</option>
                <option value="modelo">Modelo del vehículo</option>
                <option value="corralon">Corralón</option>
                <option value="estatus_vehiculo">Estatus del vehículo</option>
                <option value="danos_vehiculo">Daños del vehículo</option>
              </select></label
            ><label
              >Dato a buscar
              <input
                id="advancedSearchValue"
                list="advancedSearchOptions"
                placeholder="Escribe el dato..."
                required
              />
              <datalist id="advancedSearchOptions"></datalist></label>
              
          </div>
          <div class="advanced-search-hint">
            <i class="fas fa-info-circle"></i>
            <span>Cuando agregues un filtro aparecer? listo el espacio para colocar otro.</span>
          </div>
          <div class="modal-actions">
            <button class="btn red outline" type="button" id="clearAdvancedSearchBtn">
              Limpiar búsqueda</button
            ><button class="btn blue outline" type="button" id="addAdvancedFilterBtn">
              <i class="fas fa-plus"></i> Agregar filtro</button
            ><button class="btn green" type="submit">
              <i class="fas fa-search"></i> Buscar
            </button>
          </div>
        </form>
      </div>
    </div>

    <div id="importModal" class="modal-backdrop">
      <div class="modal import">
        <div class="modal-title">
          <h2>Importar</h2>
          <button class="modal-close" onclick="closeModal('importModal')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="import-head">
            <div>
              <strong>Partes de tránsito</strong>
              <p>Selecciona los registros que deseas preparar. Cada parte se exportar? con sus datos completos.</p>
            </div>
            <button class="btn amber outline" type="button" id="downloadImportTemplateBtn">
              <i class="fas fa-download"></i> Plantilla Excel
            </button>
          </div>
          <div class="import-type-grid">
            <button class="import-type-card active" type="button" data-import-type="excel">
              <i class="fas fa-file-excel"></i><strong>Excel</strong>
              <span>Lee la plantilla o encabezados equivalentes.</span>
            </button>
            <button class="import-type-card" type="button" data-import-type="image">
              <i class="fas fa-image"></i><strong>Imagen</strong>
              <span>Lee una o varias fotos del mismo parte.</span>
            </button>
            <button class="import-type-card" type="button" data-import-type="pdf">
              <i class="fas fa-file-pdf"></i><strong>PDF</strong>
              <span>Extrae la informacion disponible del documento.</span>
            </button>
          </div>
          <div class="import-template-note">
            <i class="fas fa-table"></i>
            <div><strong>Excel flexible</strong><span> La plantilla es recomendada. Tambien se reconocen encabezados como Folio, Motivo, Fecha, Placa, MP y Respondiente.</span></div>
          </div>
          <div class="image-import-note" id="imageImportNote" hidden>
            <i class="fas fa-images"></i>
            <span>Las imagenes que agregues aqui se unen en un solo parte. Usa "Subir otra imagen" solo para otra pagina o foto del mismo documento.</span>
          </div>
          <label class="import-dropzone" for="importFileInput">
            <input id="importFileInput" type="file" accept=".xlsx,.xls,.csv,.html" />
            <i class="fas fa-cloud-upload-alt"></i>
            <strong id="importFileTitle">Seleccionar archivo</strong>
            <span id="importFileHint">Formatos aceptados: .xlsx, .xls, .csv, imagen o PDF.</span>
          </label>
          <button class="btn amber add-image-btn" type="button" id="addAnotherImageBtn" hidden>
            <i class="fas fa-plus"></i> Subir otra imagen
          </button>
          <div class="import-status-row">
            <span class="import-count" id="importCount">0 partes detectados</span>
            <span id="importStatus">Descarga la plantilla o selecciona un archivo para previsualizar.</span>
          </div>
          <div class="table-wrap import-preview-wrap">
            <table class="import-preview-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Folio</th>
                  <th>Motivo</th>
                  <th>Fecha</th>
                  <th>MP</th>
                  <th>Respondiente</th>
                  <th>Estado</th>
                  <th>Avisos</th>
                </tr>
              </thead>
              <tbody id="importRows"></tbody>
            </table>
          </div>
          <div class="form-actions">
            <button class="btn amber" type="button" id="createImportedPartesBtn">
              <i class="fas fa-file-import"></i> Crear partes importados</button>
          </div>
        </div>
      </div>
    </div>

    <div id="exportModal" class="modal-backdrop">
      <div class="modal export">
        <div class="modal-title">
          <h2>Exportar</h2>
          <button class="modal-close" onclick="closeModal('exportModal')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="export-head">
            <div>
              <strong>Partes de tránsito</strong>
              <p>Selecciona los registros que deseas preparar. Cada parte se exportar? con sus datos completos.</p>
            </div>
            <div class="export-count" id="exportCount">0 seleccionados</div>
          </div>
          <div class="toolbar export-toolbar">
            <input id="exportSearch" class="search" placeholder="Buscar partes" />
            <label class="inline-check"
              ><input id="exportSelectAll" type="checkbox" /> Seleccionar todo</label
            >
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>No. parte</th>
                  <th>Nombre</th>
                  <th>Fecha</th>
                  <th>MP</th>
                  <th>Encargado</th>
                  <th>Seleccionar</th>
                </tr>
              </thead>
              <tbody id="exportRows"></tbody>
            </table>
          </div>
          <div class="form-actions">
            <button class="btn blue" type="button" onclick="exportPartes('pdf')">
              <i class="fas fa-file-pdf"></i> PDF</button
            ><button class="btn green" type="button" onclick="exportPartes('excel')">
              <i class="fas fa-file-excel"></i> Excel</button>
          </div>
        </div>
      </div>
    </div>

    <div id="toast" class="toast"></div>
    <div id="confirmModal" class="modal-backdrop">
      <div class="modal small">
        <div class="modal-title"><h2 data-confirm-title></h2></div>
        <div class="modal-body" style="text-align: center">
          <div class="alert-icon">!</div>
          <p data-confirm-text></p>
          <div class="form-actions">
            <button class="btn" data-confirm-no>Cancelar</button
            ><button class="btn red" data-confirm-yes>Aceptar</button>
          </div>
        </div>
      </div>
    </div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="<?= app_url('js/common.js') ?>?v=20260616historyphoto"></script>
    <script src="<?= app_url('js/partes.js') ?>?v=20260619advancedmodal"></script>
    <script src="<?= app_url('vendor/jquery/jquery.min.js') ?>"></script>
    <script src="<?= app_url('vendor/bootstrap/js/bootstrap.bundle.min.js') ?>"></script>
    <script src="<?= app_url('vendor/jquery-easing/jquery.easing.min.js') ?>"></script>
    <script src="<?= app_url('js/sb-admin-2.min.js') ?>?v=20260616historyphoto"></script>
  </body>
</html>
