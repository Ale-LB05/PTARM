<?php
/*
 * Configuracion compartida del sistema PTARM.
 *
 * Este archivo es incluido por las vistas PHP y por api/index.php. Centraliza:
 * - Conexion PDO a MySQL.
 * - Helpers de rutas para que el proyecto funcione dentro de /Pruebas/PTARM_PHP.
 * - Sesion actual, permisos, flashes y registro de historial.
 * - Subida segura de foto de perfil.
 *
 * Si una pantalla necesita base de datos, URLs absolutas del proyecto o validar
 * sesion, debe incluir este archivo con require_once.
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Variables de entorno opcionales. Si no existen, usa los valores locales de XAMPP.
$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbName = getenv('DB_NAME') ?: 'partesdetransito_local';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASSWORD') ?: '';

// Conexion unica a MySQL. PDO se comparte mediante la funcion db().
try {
    $pdo = new PDO(
        "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4",
        $dbUser,
        $dbPass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $error) {
    http_response_code(500);
    exit('No se pudo conectar con la base de datos. Revisa config/db.php o las variables de entorno.');
}

function db(): PDO
{
    global $pdo;
    return $pdo;
}

// Escapa texto antes de imprimirlo en HTML desde PHP.
function h($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

// Calcula la base publica de la app sin importar desde que carpeta se abra.
function app_base(): string
{
    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    foreach (['/cruds/', '/menu/', '/registroUser/', '/registroPartes/', '/config/', '/api/'] as $marker) {
        $pos = strpos($script, $marker);
        if ($pos !== false) {
            return rtrim(substr($script, 0, $pos), '/');
        }
    }

    $dir = str_replace('\\', '/', dirname($script));
    return $dir === '/' ? '' : rtrim($dir, '/');
}

function app_url(string $path = ''): string
{
    $base = app_base();
    return ($base === '' ? '' : $base) . '/' . ltrim($path, '/');
}

// Resuelve imagenes/archivos: acepta URLs externas, rutas locales o fallback.
function asset_path(?string $path, string $fallback = 'img/usuario.png'): string
{
    $path = trim((string) $path);
    if ($path === '') {
        return app_url($fallback);
    }
    if (preg_match('#^https?://#i', $path)) {
        return $path;
    }
    return app_url(ltrim($path, '/'));
}

function redirect_to(string $path): void
{
    header('Location: ' . app_url($path));
    exit;
}

// Guarda un mensaje temporal para mostrarlo tras una redireccion.
function set_flash(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function get_flash(): ?array
{
    if (empty($_SESSION['flash'])) {
        return null;
    }
    $flash = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return $flash;
}

// Crea roles base si la tabla esta vacia o incompleta.
function ensure_roles(): void
{
    db()->exec(
        "INSERT IGNORE INTO roles (id_rol, nombre, descripcion) VALUES
        (1, 'Administrador', 'Control total del sistema'),
        (2, 'Capturista', 'Creacion y edicion de partes'),
        (3, 'Consulta', 'Consulta y exportacion de partes')"
    );
}

function has_users(): bool
{
    try {
        return (int) db()->query('SELECT COUNT(*) FROM usuarios')->fetchColumn() > 0;
    } catch (Throwable $error) {
        return false;
    }
}

// Devuelve el usuario de la sesion PHP tradicional usada por vistas PHP.
function current_user(): ?array
{
    static $user = null;

    if ($user !== null) {
        return $user;
    }
    if (empty($_SESSION['id_usuario'])) {
        return null;
    }

    $stmt = db()->prepare(
        "SELECT u.*, r.nombre AS rol
         FROM usuarios u
         INNER JOIN roles r ON r.id_rol = u.id_rol
         WHERE u.id_usuario = ? AND u.activo = 1
         LIMIT 1"
    );
    $stmt->execute([$_SESSION['id_usuario']]);
    $user = $stmt->fetch() ?: null;

    if (!$user) {
        session_destroy();
    }
    return $user;
}

function require_login(): array
{
    $user = current_user();
    if (!$user) {
        redirect_to('index.php');
    }
    return $user;
}

// Compara roles de forma flexible para ocultar o bloquear pantallas.
function user_has_role($roles): bool
{
    $user = current_user();
    if (!$user) {
        return false;
    }
    $allowed = array_map('strtolower', (array) $roles);
    return in_array(strtolower((string) $user['rol']), $allowed, true);
}

function require_role($roles): void
{
    if (!user_has_role($roles)) {
        set_flash('error', 'No tienes permiso para acceder a esa seccion.');
        redirect_to('cruds/inicio.php');
    }
}

// Guarda eventos generales para el historial/estadisticas sin bloquear la accion.
function ensure_exported_parts_table(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS actividad_exportaciones_partes (
          id_actividad bigint(20) NOT NULL,
          id_parte bigint(20) NOT NULL,
          folio varchar(100) DEFAULT NULL,
          PRIMARY KEY (id_actividad, id_parte),
          KEY idx_exportacion_parte (id_parte)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

function record_activity(string $type, ?int $userId = null, ?int $partId = null, string $detail = ''): ?int
{
    try {
        $stmt = db()->prepare(
            'INSERT INTO actividad_sistema (tipo_evento, id_usuario, id_parte, detalle) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$type, $userId, $partId, $detail ?: null]);
        return (int) db()->lastInsertId();
    } catch (Throwable $error) {
      // El historial no debe romper la operacion principal.
        return null;
    }
}

function record_exported_parts(?int $activityId, array $partIds): void
{
    if (!$activityId) return;
    $ids = array_values(array_unique(array_filter(array_map('intval', $partIds))));
    if (!$ids) return;
    ensure_exported_parts_table();
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $stmt = db()->prepare("SELECT id_parte, folio FROM partes WHERE id_parte IN ($marks)");
    $stmt->execute($ids);
    $insert = db()->prepare('INSERT IGNORE INTO actividad_exportaciones_partes (id_actividad, id_parte, folio) VALUES (?, ?, ?)');
    foreach ($stmt->fetchAll() as $part) {
        $insert->execute([$activityId, (int) $part['id_parte'], $part['folio']]);
    }
}

function record_history(string $action, ?int $partId, int $userId, string $description): void
{
    try {
        $stmt = db()->prepare(
            'INSERT INTO historial_cambios (id_parte, id_usuario, accion, descripcion) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$partId, $userId, $action, $description]);
    } catch (Throwable $error) {
        // El historial no debe romper la operacion principal.
    }
}

// Valida, guarda y reemplaza imagenes de perfil subidas desde personal/perfil.
function upload_profile_image(array $file, ?string $current = null): ?string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return $current;
    }
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo subir la imagen.');
    }
    if (($file['size'] ?? 0) > 2 * 1024 * 1024) {
        throw new RuntimeException('La imagen no debe superar 2 MB.');
    }

    $info = @getimagesize($file['tmp_name']);
    $mime = $info['mime'] ?? '';
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($allowed[$mime])) {
        throw new RuntimeException('Solo se permiten imagenes JPG, PNG o WEBP.');
    }

    $folder = dirname(__DIR__) . '/uploads/perfiles';
    if (!is_dir($folder)) {
        mkdir($folder, 0775, true);
    }

    $name = time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', basename((string) $file['name']));
    if (!move_uploaded_file($file['tmp_name'], $folder . '/' . $name)) {
        throw new RuntimeException('No se pudo guardar la imagen.');
    }

    if ($current && strpos($current, 'uploads/perfiles/') === 0) {
        $old = dirname(__DIR__) . '/' . $current;
        if (is_file($old)) {
            @unlink($old);
        }
    }

    return 'uploads/perfiles/' . $name;
}

function selected($a, $b): string
{
    return (string) $a === (string) $b ? 'selected' : '';
}

function checked(bool $value): string
{
    return $value ? 'checked' : '';
}
