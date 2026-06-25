<?php require_once __DIR__ . '/../config/db.php'; ?>
<!--
  Pantalla Inicio.
  Muestra accesos rapidos y resumen de partes. La logica dinamica vive en
  js/inicio.js y las utilidades compartidas en js/common.js.
-->
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
    <title>Inicio | PTARM</title>
    <link rel="icon" type="image/png" href="<?= app_url('img/logot.png') ?>" />
    <link href="<?= app_url('vendor/fontawesome-free/css/all.min.css') ?>" rel="stylesheet" />
    <link rel="stylesheet" href="<?= app_url('css/styles.css') ?>?v=20260616historyphoto" />
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
          >
          <a data-page="partes" href="<?= app_url('registroPartes/partes.php') ?>"
            ><span class="nav-icon"
              ><img src="<?= app_url('img/iconos/gestion.png') ?>" alt="" /></span
            ><span>Gestionar partes</span></a
          >
          <a data-page="historial" href="<?= app_url('cruds/historial.php') ?>"
            ><span class="nav-icon"><img src="<?= app_url('img/iconos/historial.png') ?>" alt="" /></span
            ><span>Historial</span></a
          >
          <div class="side-section">Sesión</div>
          <button onclick="logout()">
            <span class="nav-icon"><img src="<?= app_url('img/iconos/salida.png') ?>" alt="" /></span
            ><span>Cerrar Sesión</span>
          </button>
          <button class="collapse-btn" onclick="toggleSidebar()">
            <span class="nav-icon"><i class="fas fa-chevron-left"></i></span
            ><span>Ocultar</span>
          </button>
        </nav>
      </aside>
      <main class="content">
        <header class="topbar">
          <a class="topbar-brand" href="<?= app_url('cruds/inicio.php') ?>">
            <img class="logo" src="<?= app_url('img/Logo.png') ?>" alt="FGE" />
            <span>Sistema de Partes</span>
          </a>
          <div class="user-menu">
            <button class="user-top" type="button">
              <i class="fas fa-bell"></i><span data-user-name></span
              ><img data-user-photo alt="Perfil" />
            </button>
            <div class="user-dropdown animated--grow-in">
              <a href="<?= app_url('cruds/perfil.php') ?>"><i class="fas fa-user"></i> Perfil</a>
            </div>
          </div>
        </header>
        <section class="page">
          <div class="hero-card">
            <div>
              <h1>Datos Generales</h1>
              <p>
                Un parte de tránsito es un documento oficial que se elabora
                cuando ocurre un accidente vial o choque de tránsito. Este
                documento registra toda la información relacionada con el
                incidente, como los datos de los vehículos involucrados,
                personas afectadas, ubicación, fecha, hora y observaciones
                realizadas por el personal encargado.
              </p>
            </div>
            <div class="hero-icon">
              <img src="<?= app_url('img/iconos/vehiculos.png') ?>" alt="Escudo digital" />
            </div>
          </div>
          <div class="section-title">
            <h2>Partes Recientes</h2>
            <p>
              Consulta los registros recientes y accede a las funciones
              principales del sistema.
            </p>
          </div>
          <input
            id="homeSearch"
            class="search"
            style="display: block; margin: 0 auto 22px"
            placeholder="Buscar partes"
          />
          <div class="table-controls">
            <label class="inline-check"
              >Mostrar
              <select id="homePageSize">
                <option value="5">5 partes</option>
                <option value="10">10 partes</option>
                <option value="15">15 partes</option>
                <option value="20">20 partes</option>
              </select></label
            >
            <div class="pager">
              <button class="btn icon-only" id="homePrevPage" type="button" title="Página anterior">
                <i class="fas fa-chevron-left"></i>
              </button>
              <span id="homePageInfo"></span>
              <button class="btn icon-only" id="homeNextPage" type="button" title="Página siguiente">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No. Parte</th>
                  <th>Nombre</th>
                  <th>Fecha</th>
                  <th>MP asignado</th>
                </tr>
              </thead>
              <tbody id="homeRows"></tbody>
            </table>
          </div>
          <div class="section-title">
            <h2>Menú del Sistema</h2>
            <p>
              Selecciona una opción para trabajar con los partes de tránsito
            </p>
          </div>
          <div class="menu-grid">
            <a class="menu-card hover-lift" data-page="partes" href="<?= app_url('registroPartes/partes.php') ?>"
              ><span>01</span>
              <h3>Lista de partes</h3>
              <p>Crear, exportar, importar, eliminar, filtrar, consultar información y editar.</p></a
            >
            <a class="menu-card hover-lift" data-page="historial" href="<?= app_url('cruds/historial.php') ?>"
              ><span>02</span>
              <h3>Historial</h3>
              <p>
                Consultar acciones realizadas en el sistema.
              </p></a
            >
            <a class="menu-card hover-lift" data-page="perfil" href="<?= app_url('cruds/perfil.php') ?>"
              ><span>03</span>
              <h3>Mi perfil</h3>
              <p>Ver datos de cuenta, foto de perfil y partes asignados.</p></a
            >
            <a class="menu-card hover-lift" data-page="personal" href="<?= app_url('cruds/personal.php') ?>"
              ><span>04</span>
              <h3>Personal</h3>
              <p>
                Administrar usuarios, ministerios públicos y respondientes.
              </p></a
            >
          </div>
        </section>
      </main>
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
    <script src="<?= app_url('js/common.js') ?>?v=20260616historyphoto"></script>
    <script src="<?= app_url('js/inicio.js') ?>?v=20260616historyphoto"></script>
    <script src="<?= app_url('vendor/jquery/jquery.min.js') ?>"></script>
    <script src="<?= app_url('vendor/bootstrap/js/bootstrap.bundle.min.js') ?>"></script>
    <script src="<?= app_url('vendor/jquery-easing/jquery.easing.min.js') ?>"></script>
    <script src="<?= app_url('js/sb-admin-2.min.js') ?>?v=20260616historyphoto"></script>
  </body>
</html>



