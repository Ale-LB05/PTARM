<?php require_once __DIR__ . '/../config/db.php'; ?>
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
    <title>Historial | PTARM</title>
    <link rel="icon" type="image/png" href="<?= app_url('img/logot.png') ?>" />
    <link href="<?= app_url('vendor/fontawesome-free/css/all.min.css') ?>" rel="stylesheet" />
    <link rel="stylesheet" href="<?= app_url('css/styles.css') ?>?v=20260615alertfix3" />
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
        <section class="page history-page">
          <h1>Historial de actividades</h1>
          <div class="history-tabs" role="tablist">
            <button class="active" data-action="CREAR" type="button">
              <i class="far fa-file-alt"></i> Partes creados
            </button>
            <button data-action="EDITAR" type="button">
              <i class="far fa-edit"></i> Partes actualizados
            </button>
            <button data-action="ELIMINAR" type="button">
              <i class="far fa-trash-alt"></i> Partes eliminados
            </button>
            <button data-action="ESTADISTICAS" type="button">
              <i class="fas fa-chart-bar"></i> Estadísticas
            </button>
          </div>
          <div class="history-tools" id="historyTools">
            <div class="search-wrap no-icon">
              <input id="historySearch" placeholder="Buscar actividad con folio, creador o fecha" />
            </div>
            <button class="btn blue outline advanced-search-trigger" id="historyAdvancedSearchBtn" type="button">
              <i class="fas fa-search-plus"></i> Avanzada
            </button>
          </div>
          <div id="historyAdvancedSearchSummary" class="advanced-search-summary" hidden></div>
          <div class="stats-panel" id="statsPanel" hidden>
            <div class="stats-controls">
              <label
                >Mes
                <select id="statsMonth">
                  <option value="1">Enero</option>
                  <option value="2">Febrero</option>
                  <option value="3">Marzo</option>
                  <option value="4">Abril</option>
                  <option value="5">Mayo</option>
                  <option value="6">Junio</option>
                  <option value="7">Julio</option>
                  <option value="8">Agosto</option>
                  <option value="9">Septiembre</option>
                  <option value="10">Octubre</option>
                  <option value="11">Noviembre</option>
                  <option value="12">Diciembre</option>
                </select></label
              ><label
                >Año<input id="statsYear" type="number" min="2020" max="2100" /></label
              ><label
                >Vista
                <select id="statsView">
                  <option value="bars">Barras</option>
                  <option value="pie">Pastel</option>
                  <option value="table">Tabla</option>
                </select></label
              ><button class="btn blue" id="refreshStatsBtn" type="button">
                <i class="fas fa-sync-alt"></i> Actualizar
              </button>
            </div>
            <div class="stats-export-panel">
              <div>
                <strong>Exportar estadísticas</strong>
                <span>Genera un reporte por mes, año o rango con las gráficas que necesites.</span>
              </div>
              <div class="stats-export-actions">
                <button class="btn blue" id="openStatsExportModalBtn" type="button">
                  <i class="fas fa-file-export"></i> Exportar
                </button>
              </div>
            </div>
            <div class="stats-cards" id="statsCards"></div>
            <div class="stats-layout">
              <div class="stats-chart-panel">
                <div class="section-head tight">
                  <h2 id="statsChartTitle">Actividad mensual</h2>
                  <p id="statsSummaryText"></p>
                </div>
                <div id="statsChart" class="stats-chart"></div>
              </div>
              <div class="stats-side-panel">
                <h3>Usuarios con más actividad</h3>
                <div id="statsUsers" class="stats-user-list"></div>
              </div>
            </div>
            <div class="table-wrap stats-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Actividad</th>
                    <th>Total</th>
                    <th>Porcentaje</th>
                    <th>Datos</th>
                  </tr>
                </thead>
                <tbody id="statsRows"></tbody>
              </table>
            </div>
          </div>
          <div class="table-controls compact history-table" id="historyTableControls">
            <label class="inline-check"
              >Mostrar
              <select id="historyPageSize">
                <option value="5">5 actividades</option>
                <option value="10">10 actividades</option>
                <option value="15">15 actividades</option>
                <option value="20">20 actividades</option>
              </select></label
            >
            <div class="pager">
              <button class="btn icon-only" id="historyPrevPage" type="button" title="Página anterior">
                <i class="fas fa-chevron-left"></i>
              </button>
              <span id="historyPageInfo"></span>
              <button class="btn icon-only" id="historyNextPage" type="button" title="Página siguiente">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
          <div class="table-wrap history-table" id="historyTableWrap">
            <table>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th id="historyPersonLabel">Creador</th>
                  <th>Hora</th>
                  <th>Fecha</th>
                  <th>MP</th>
                  <th>Encargado</th>
                </tr>
              </thead>
              <tbody id="historyRows"></tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
    <div id="historyAdvancedSearchModal" class="modal-backdrop">
      <div class="modal advanced-search-modal">
        <div class="modal-title">
          <h2>Búsqueda avanzada</h2>
          <button class="modal-close" onclick="closeModal('historyAdvancedSearchModal')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <form id="historyAdvancedSearchForm" class="modal-body">
          <div class="advanced-search-intro">
            <strong>Filtrar historial por apartado</strong>
            <span>Agrega uno o más filtros y se mostrarán solo las actividades que cumplan todos.</span>
          </div>
          <div id="historyAdvancedFilterList" class="advanced-filter-list" hidden></div>
          <div class="form-grid cols-2 advanced-search-grid">
            <label
              >Apartado
              <select id="historyAdvancedSearchField" required>
                <option value="">Selecciona un apartado</option>
                <option value="folio">Folio</option>
                <option value="usuario">Usuario</option>
                <option value="fecha">Fecha</option>
                <option value="hora">Hora</option>
                <option value="mp">MP</option>
                <option value="encargado">Encargado</option>
                <option value="descripcion">Descripción</option>
              </select></label
            ><label
              >Dato a buscar
              <input id="historyAdvancedSearchValue" list="historyAdvancedSearchOptions" placeholder="Escribe el dato..." required />
              <datalist id="historyAdvancedSearchOptions"></datalist></label
            >
          </div>
          <div class="advanced-search-hint">
            <i class="fas fa-info-circle"></i>
            <span>Agrega un filtro y el formulario quedar? listo para colocar otro.</span>
          </div>
          <div class="modal-actions">
            <button class="btn red outline" type="button" id="clearHistoryAdvancedSearchBtn">
              Limpiar búsqueda</button
            ><button class="btn blue outline" type="button" id="addHistoryAdvancedFilterBtn">
              <i class="fas fa-plus"></i> Agregar filtro</button
            ><button class="btn green" type="submit">
              Buscar
            </button>
          </div>
        </form>
      </div>
    </div>
    <div id="statsDetailModal" class="modal-backdrop">
      <div class="modal stats-detail-modal">
        <div class="modal-title">
          <h2 id="statsDetailTitle">Detalle de estadística</h2>
          <button class="modal-close" onclick="closeStatsDetailModal()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="stats-detail-summary" id="statsDetailSummary"></div>
          <div class="table-wrap stats-detail-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Folio</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody id="statsDetailRows"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    <div id="statsExportModal" class="modal-backdrop">
      <div class="modal export stats-export-modal">
        <div class="modal-title">
          <h2>Exportar estadísticas</h2>
          <button class="modal-close" onclick="closeModal('statsExportModal')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="export-head">
            <div>
              <strong>Configura el reporte</strong>
              <p>Selecciona desde un mes específico hasta un rango de varios años y elige qué gráficas incluir.</p>
            </div>
            <div class="export-count" id="statsExportRangeCount">1 mes</div>
          </div>
          <div class="form-grid cols-2 stats-export-grid">
            <label
              >Desde mes
              <select id="statsExportStartMonth">
                <option value="1">Enero</option>
                <option value="2">Febrero</option>
                <option value="3">Marzo</option>
                <option value="4">Abril</option>
                <option value="5">Mayo</option>
                <option value="6">Junio</option>
                <option value="7">Julio</option>
                <option value="8">Agosto</option>
                <option value="9">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select></label
            ><label
              >Desde año<input id="statsExportStartYear" type="number" min="2020" max="2100" /></label
            ><label
              >Hasta mes
              <select id="statsExportEndMonth">
                <option value="1">Enero</option>
                <option value="2">Febrero</option>
                <option value="3">Marzo</option>
                <option value="4">Abril</option>
                <option value="5">Mayo</option>
                <option value="6">Junio</option>
                <option value="7">Julio</option>
                <option value="8">Agosto</option>
                <option value="9">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select></label
            ><label
              >Hasta año<input id="statsExportEndYear" type="number" min="2020" max="2100" /></label
            >
          </div>
          <div class="export-chart-options">
            <label class="inline-check"><input id="statsExportBars" type="checkbox" checked /> Barras</label>
            <label class="inline-check"><input id="statsExportPie" type="checkbox" checked /> Pastel</label>
            <label class="inline-check"><input id="statsExportTable" type="checkbox" checked /> Tabla</label>
          </div>
          <div class="modal-actions">
            <button class="btn red outline" type="button" onclick="closeModal('statsExportModal')">Cancelar</button
            ><button class="btn red" id="exportStatsPdfBtn" type="button">
              <i class="fas fa-file-pdf"></i> PDF</button
            ><button class="btn green" id="exportStatsExcelBtn" type="button">
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
    <script src="<?= app_url('js/common.js') ?>?v=20260615alertfix3"></script>
    <script src="<?= app_url('js/historial.js') ?>?v=20260615alertfix3"></script>
  </body>
</html>



