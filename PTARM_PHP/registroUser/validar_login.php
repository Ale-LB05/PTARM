<?php
require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect_to('registroUser/login.php');
}

$action = $_POST['accion'] ?? 'login';

try {
    ensure_roles();

    if ($action === 'setup') {
        if (has_users()) {
            set_flash('error', 'El administrador inicial ya existe.');
            redirect_to('registroUser/login.php');
        }

        $nombre = trim((string) ($_POST['nombre'] ?? ''));
        $correo = trim((string) ($_POST['usuario'] ?? ''));
        $curp = strtoupper(trim((string) ($_POST['curp'] ?? '')));
        $password = (string) ($_POST['password'] ?? '');
        $instituto = trim((string) ($_POST['instituto'] ?? ''));
        $cargo = trim((string) ($_POST['cargo_grado'] ?? ''));

        if ($nombre === '' || !filter_var($correo, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
            set_flash('error', 'Completa nombre, correo válido y contraseña de al menos 6 caracteres.');
            redirect_to('registroUser/login.php');
        }

        $stmt = db()->prepare(
            'INSERT INTO usuarios (nombre, correo, curp, password_hash, instituto, cargo_grado, imagen_perfil, id_rol)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
        );
        $stmt->execute([
            $nombre,
            $correo,
            $curp ?: null,
            password_hash($password, PASSWORD_DEFAULT),
            $instituto ?: null,
            $cargo ?: null,
            'img/usuario.png',
        ]);

        $_SESSION['id_usuario'] = (int) db()->lastInsertId();
        record_activity('CREACION_USUARIO', $_SESSION['id_usuario'], null, 'Administrador inicial creado');
        redirect_to('cruds/inicio.php');
    }

    $usuario = trim((string) ($_POST['usuario'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    $stmt = db()->prepare(
        "SELECT u.*, r.nombre AS rol
         FROM usuarios u
         INNER JOIN roles r ON r.id_rol = u.id_rol
         WHERE (LOWER(u.correo) = LOWER(?) OR UPPER(u.curp) = UPPER(?)) AND u.activo = 1
         LIMIT 1"
    );
    $stmt->execute([$usuario, $usuario]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, (string) $user['password_hash'])) {
        set_flash('error', 'Credenciales inválidas.');
        redirect_to('registroUser/login.php');
    }

    session_regenerate_id(true);
    $_SESSION['id_usuario'] = (int) $user['id_usuario'];
    record_activity('LOGIN', (int) $user['id_usuario'], null, 'Inicio de sesión');
    redirect_to('cruds/inicio.php');
} catch (Throwable $error) {
    set_flash('error', 'No se pudo iniciar sesión. Revisa la base de datos.');
    redirect_to('registroUser/login.php');
}
