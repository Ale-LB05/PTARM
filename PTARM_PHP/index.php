<?php require_once __DIR__ . '/config/db.php'; ?>
<!--
  Pantalla de login.
  Carga js/auth.js, que consulta /api/auth/status y envia credenciales a
  /api/auth/login por medio de api/index.php.
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
    <title>Partes de tránsito</title>
    <link rel="icon" type="image/png" href="<?= app_url('img/logot.png') ?>" />
    <link href="<?= app_url('vendor/fontawesome-free/css/all.min.css') ?>" rel="stylesheet" />
    <link rel="stylesheet" href="<?= app_url('css/styles.css') ?>?v=20260616historyphoto" />
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  </head>
  <body class="auth-page">
    <main class="login-card">
      <img src="<?= app_url('img/Logo.png') ?>" alt="FGE" />
      <h1>Partes de tránsito</h1>
      <h2>Iniciar sesión</h2>
      <p>Ingresa tu correo electrónico o CURP para iniciar sesión</p>
      <form id="loginForm">
        <input type="text" name="usuario" placeholder="Correo electrónico o CURP" required />
        <div class="password-wrap">
          <input type="password" name="password" placeholder="Contraseña" required />
          <button type="button" onclick="togglePassword(this)" aria-label="Mostrar contraseña"><i class="fas fa-eye"></i></button>
        </div>
        <button type="submit">Iniciar sesión</button>
      </form>
      <p><small>Al hacer clic en Continuar aceptas nuestros términos de servicio y políticas.</small></p>
    </main>
    <script src="<?= app_url('vendor/jquery/jquery.min.js') ?>"></script>
    <script src="<?= app_url('vendor/bootstrap/js/bootstrap.bundle.min.js') ?>"></script>
    <script src="<?= app_url('js/auth.js') ?>?v=20260616historyphoto"></script>
  </body>
</html>



