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
    <title>Crear administrador</title>
    <link rel="icon" type="image/png" href="<?= app_url('img/logot.png') ?>" />
    <link href="<?= app_url('vendor/fontawesome-free/css/all.min.css') ?>" rel="stylesheet" />
    <link rel="stylesheet" href="<?= app_url('css/styles.css') ?>?v=20260615alertfix3" />
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  </head>
  <body class="auth-page">
    <main class="login-card">
      <img src="<?= app_url('img/Logo.png') ?>" alt="FGE" />
      <h1>Crear administrador</h1>
      <p>Antes de usar el sistema crea el primer usuario administrador.</p>
      <form id="setupForm">
        <input type="text" name="nombre" placeholder="Nombre completo" required />
        <input type="email" name="correo" placeholder="correo@dominio.com" required />
        <input type="text" name="curp" maxlength="18" placeholder="CURP" />
        <input type="password" name="password" placeholder="Contraseña" required />
        <input type="text" name="instituto" placeholder="Instituto" />
        <input type="text" name="cargo_grado" placeholder="Cargo/Grado" />
        <button type="submit">Crear administrador</button>
      </form>
    </main>
    <script src="<?= app_url('js/auth.js') ?>?v=20260615alertfix3"></script>
  </body>
</html>



