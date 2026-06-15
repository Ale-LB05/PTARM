<?php
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json; charset=utf-8');

$rawPath = urldecode((string) ($_GET['path'] ?? '/'));
$path = parse_url($rawPath, PHP_URL_PATH) ?: '/';
$apiQuery = [];
parse_str(parse_url($rawPath, PHP_URL_QUERY) ?: '', $apiQuery);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$json = json_decode(file_get_contents('php://input') ?: '[]', true);
$body = is_array($json) && $json ? $json : $_POST;
if (!empty($body['_method'])) {
    $method = strtoupper((string) $body['_method']);
}

function out(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400): void
{
    out(['success' => false, 'error' => $message], $status);
}

function b64url(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function make_token(array $user): string
{
    $payload = b64url(json_encode(['id' => (int) $user['id_usuario'], 'exp' => time() + 28800]));
    $signature = b64url(hash_hmac('sha256', $payload, 'ptarm-php-local-secret', true));
    return $payload . '.' . $signature;
}

function token_user(): ?array
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (strpos($header, 'Bearer ') !== 0) {
        return null;
    }

    [$payload, $signature] = array_pad(explode('.', substr($header, 7), 2), 2, '');
    $expected = b64url(hash_hmac('sha256', $payload, 'ptarm-php-local-secret', true));
    if (!hash_equals($expected, $signature)) {
        return null;
    }

    $data = json_decode(base64_decode(strtr($payload, '-_', '+/')) ?: '{}', true);
    if (!$data || ($data['exp'] ?? 0) < time()) {
        return null;
    }

    $stmt = db()->prepare(
        "SELECT u.*, r.nombre AS rol
         FROM usuarios u
         INNER JOIN roles r ON r.id_rol = u.id_rol
         WHERE u.id_usuario = ? AND u.activo = 1
         LIMIT 1"
    );
    $stmt->execute([(int) $data['id']]);
    return $stmt->fetch() ?: null;
}

function api_user(): array
{
    $user = token_user();
    if (!$user) {
        fail('No autorizado', 401);
    }
    return $user;
}

function clean($value): ?string
{
    $value = is_string($value) ? trim($value) : $value;
    return $value === '' || $value === null ? null : (string) $value;
}

function public_user(array $user): array
{
    $foto = $user['imagen_perfil'] ?: 'img/usuario.png';
    return [
        'id' => (int) $user['id_usuario'],
        'nombre' => $user['nombre'],
        'correo' => $user['correo'],
        'curp' => $user['curp'] ?? '',
        'instituto' => $user['instituto'] ?? '',
        'cargo' => $user['cargo_grado'] ?? '',
        'cargo_grado' => $user['cargo_grado'] ?? '',
        'rol' => $user['rol'] === 'Consulta' ? 'Auxiliar' : $user['rol'],
        'foto' => asset_path($foto),
        'imagen_perfil' => asset_path($foto),
    ];
}

function ensure_api_schema(): void
{
    $adds = [
        "ALTER TABLE usuarios ADD COLUMN curp varchar(18) DEFAULT NULL AFTER correo",
        "ALTER TABLE partes ADD COLUMN tipo_parte varchar(80) DEFAULT NULL AFTER folio",
        "ALTER TABLE partes ADD COLUMN ubicacion_kilometro varchar(120) DEFAULT NULL AFTER hora",
        "ALTER TABLE partes ADD COLUMN ubicacion_direccion varchar(255) DEFAULT NULL AFTER ubicacion_kilometro",
        "ALTER TABLE partes ADD COLUMN ubicacion_lat decimal(10,7) DEFAULT NULL AFTER ubicacion_direccion",
        "ALTER TABLE partes ADD COLUMN ubicacion_lng decimal(10,7) DEFAULT NULL AFTER ubicacion_lat",
        "ALTER TABLE partes ADD COLUMN google_place_id varchar(180) DEFAULT NULL AFTER ubicacion_lng",
        "ALTER TABLE vehiculos ADD COLUMN corralon varchar(180) DEFAULT NULL AFTER numero_placa",
        "ALTER TABLE vehiculos ADD COLUMN id_corralon int(11) DEFAULT NULL AFTER corralon",
        "ALTER TABLE vehiculos ADD COLUMN estatus_vehiculo varchar(80) DEFAULT NULL AFTER id_corralon",
        "ALTER TABLE vehiculos ADD COLUMN danos_vehiculo text DEFAULT NULL AFTER estatus_vehiculo",
        "ALTER TABLE personas_involucradas_detalle ADD COLUMN numero_vehiculo int(11) DEFAULT NULL AFTER id_vehiculo",
        "ALTER TABLE personas_involucradas ADD COLUMN observacion_fallecidos text DEFAULT NULL AFTER numero_fallecidos",
    ];
    foreach ($adds as $sql) {
        try {
            db()->exec($sql);
        } catch (Throwable $error) {
        }
    }

    try {
        db()->exec(
            "CREATE TABLE IF NOT EXISTS corralones (
                id_corralon int(11) NOT NULL AUTO_INCREMENT,
                nombre varchar(180) NOT NULL,
                direccion varchar(255) DEFAULT NULL,
                telefono varchar(40) DEFAULT NULL,
                activo tinyint(1) NOT NULL DEFAULT 1,
                fecha_creacion timestamp NOT NULL DEFAULT current_timestamp(),
                PRIMARY KEY (id_corralon),
                UNIQUE KEY uk_corralones_nombre (nombre)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    } catch (Throwable $error) {
    }
}

function find_or_create(string $table, string $idColumn, ?string $name): ?int
{
    $name = clean($name);
    if (!$name) {
        return null;
    }
    $stmt = db()->prepare("SELECT {$idColumn} AS id FROM {$table} WHERE nombre = ? LIMIT 1");
    $stmt->execute([$name]);
    $id = $stmt->fetchColumn();
    if ($id) {
        return (int) $id;
    }
    $stmt = db()->prepare("INSERT INTO {$table} (nombre) VALUES (?)");
    $stmt->execute([$name]);
    return (int) db()->lastInsertId();
}

function save_details(int $idParte, array $data): void
{
    db()->prepare('DELETE FROM personas_involucradas_detalle WHERE id_parte = ?')->execute([$idParte]);
    db()->prepare('DELETE FROM personas_involucradas WHERE id_parte = ?')->execute([$idParte]);
    db()->prepare('DELETE FROM vehiculos WHERE id_parte = ?')->execute([$idParte]);

    $vehiculos = $data['vehiculos'] ?? [];
    if (is_string($vehiculos)) {
        $vehiculos = json_decode($vehiculos, true) ?: [];
    }
    if (!$vehiculos) {
        $vehiculos = [[
            'tipo_vehiculo' => $data['tipo_vehiculo'] ?? 'Carro',
            'marca' => $data['marca'] ?? null,
            'modelo' => $data['modelo'] ?? null,
            'tipo' => $data['tipo'] ?? null,
            'numero_serie' => $data['numero_serie'] ?? null,
            'numero_placa' => $data['numero_placa'] ?? null,
        ]];
    }

    $vehicleIds = [];
    foreach ($vehiculos as $index => $v) {
        $stmt = db()->prepare(
            'INSERT INTO vehiculos (id_parte, numero_vehiculo, tipo_vehiculo, marca, modelo, tipo, numero_serie, numero_placa, corralon, estatus_vehiculo, danos_vehiculo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $idParte,
            $index + 1,
            clean($v['tipo_vehiculo'] ?? null) ?: 'Carro',
            clean($v['marca'] ?? null),
            clean($v['modelo'] ?? null),
            clean($v['tipo'] ?? null),
            clean($v['numero_serie'] ?? null),
            clean($v['numero_placa'] ?? null),
            clean($v['corralon'] ?? null),
            clean($v['estatus_vehiculo'] ?? null) ?: 'Sin clasificar',
            clean($v['danos_vehiculo'] ?? null),
        ]);
        $vehicleIds[$index + 1] = (int) db()->lastInsertId();
    }

    $stmt = db()->prepare(
        'INSERT INTO personas_involucradas
         (id_parte, id_vehiculo, numero_personas, personas_fallecidas, numero_fallecidos, observacion_fallecidos, personas_heridas, otros, numero_heridos, gravedad, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $idParte,
        reset($vehicleIds) ?: null,
        clean($data['numero_personas'] ?? null),
        !empty($data['personas_fallecidas']) ? 1 : 0,
        clean($data['numero_fallecidos'] ?? null),
        clean($data['observacion_fallecidos'] ?? null),
        !empty($data['personas_heridas']) ? 1 : 0,
        !empty($data['otros']) ? 1 : 0,
        clean($data['numero_heridos'] ?? null),
        clean($data['gravedad'] ?? null) ?: 'Sin clasificar',
        clean($data['observaciones'] ?? null),
    ]);

    $people = $data['personas_detalle'] ?? [];
    if (is_string($people)) {
        $people = json_decode($people, true) ?: [];
    }
    foreach ($people as $index => $person) {
        $numVeh = (int) ($person['numero_vehiculo'] ?? 0);
        $stmt = db()->prepare(
            'INSERT INTO personas_involucradas_detalle (id_parte, id_vehiculo, numero_vehiculo, numero_persona, nombre, tipo_participacion)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $idParte,
            $vehicleIds[$numVeh] ?? null,
            $numVeh ?: null,
            (int) ($person['numero_persona'] ?? ($index + 1)),
            clean($person['nombre'] ?? null),
            clean($person['tipo_participacion'] ?? null) ?: 'Civil',
        ]);
    }
}

function get_part(int $id): ?array
{
    $stmt = db()->prepare(
        "SELECT p.*, mp.nombre AS mp_nombre, r.nombre AS respondiente_nombre,
                u.nombre AS encargado_nombre, u.imagen_perfil AS encargado_foto,
                pi.numero_personas, pi.personas_fallecidas, pi.numero_fallecidos, pi.observacion_fallecidos,
                pi.personas_heridas, pi.otros, pi.numero_heridos, pi.gravedad, pi.observaciones
         FROM partes p
         LEFT JOIN ministerios_publicos mp ON mp.id_mp = p.id_mp
         LEFT JOIN respondientes r ON r.id_respondiente = p.id_respondiente
         LEFT JOIN usuarios u ON u.id_usuario = p.asignado_a
         LEFT JOIN personas_involucradas pi ON pi.id_parte = p.id_parte
         WHERE p.id_parte = ?
         LIMIT 1"
    );
    $stmt->execute([$id]);
    $part = $stmt->fetch();
    if (!$part) {
        return null;
    }
    $stmt = db()->prepare('SELECT * FROM vehiculos WHERE id_parte = ? ORDER BY numero_vehiculo');
    $stmt->execute([$id]);
    $part['vehiculos'] = $stmt->fetchAll();
    $stmt = db()->prepare('SELECT * FROM personas_involucradas_detalle WHERE id_parte = ? ORDER BY numero_persona');
    $stmt->execute([$id]);
    $part['personas_detalle'] = $stmt->fetchAll();
    $part['encargado_foto'] = asset_path($part['encargado_foto'] ?? null);
    return $part;
}

ensure_roles();
ensure_api_schema();

try {
    if ($path === '/api/auth/status') {
        out(['success' => true, 'hasUsers' => has_users()]);
    }

    if ($path === '/api/auth/setup-admin' && $method === 'POST') {
        if (has_users()) {
            fail('El administrador inicial ya existe', 403);
        }
        $nombre = clean($body['nombre'] ?? null);
        $correo = clean($body['correo'] ?? null);
        $password = (string) ($body['password'] ?? '');
        if (!$nombre || !$correo || strlen($password) < 6) {
            fail('Nombre, correo y contraseña son obligatorios');
        }
        db()->prepare(
            'INSERT INTO usuarios (nombre, correo, curp, password_hash, instituto, cargo_grado, imagen_perfil, id_rol)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
        )->execute([
            $nombre,
            $correo,
            clean($body['curp'] ?? null),
            password_hash($password, PASSWORD_DEFAULT),
            clean($body['instituto'] ?? null),
            clean($body['cargo_grado'] ?? null),
            'img/usuario.png',
        ]);
        out(['success' => true, 'message' => 'Administrador creado']);
    }

    if ($path === '/api/auth/login' && $method === 'POST') {
        $usuario = clean($body['usuario'] ?? $body['correo'] ?? null);
        $password = (string) ($body['password'] ?? '');
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
            fail('Credenciales inválidas', 401);
        }
        $_SESSION['id_usuario'] = (int) $user['id_usuario'];
        record_activity('LOGIN', (int) $user['id_usuario'], null, 'Inicio de sesión');
        out(['success' => true, 'token' => make_token($user), 'usuario' => public_user($user)]);
    }

    if ($path === '/api/auth/google') {
        fail('Google OAuth no está configurado en la versión PHP.', 503);
    }

    $user = api_user();
    $isAdmin = strtolower((string) $user['rol']) === 'administrador';
    $canWritePartes = in_array(strtolower((string) $user['rol']), ['administrador', 'capturista'], true);

    if ($path === '/api/usuarios') {
        if (!$isAdmin) {
            fail('No tienes permiso', 403);
        }
        if ($method === 'GET') {
            $rows = db()->query(
                "SELECT u.id_usuario, u.nombre, u.correo, u.curp, u.instituto, u.cargo_grado, u.imagen_perfil, u.id_rol, r.nombre AS rol
                 FROM usuarios u
                 INNER JOIN roles r ON r.id_rol = u.id_rol
                 WHERE u.activo = 1
                 ORDER BY u.fecha_creacion DESC"
            )->fetchAll();
            foreach ($rows as &$row) {
                $row['imagen_perfil'] = asset_path($row['imagen_perfil'] ?? null);
            }
            out(['success' => true, 'data' => $rows]);
        }
        if ($method === 'POST') {
            $photo = isset($_FILES['imagen']) ? upload_profile_image($_FILES['imagen'], 'img/usuario.png') : 'img/usuario.png';
            db()->prepare(
                'INSERT INTO usuarios (nombre, correo, curp, password_hash, instituto, cargo_grado, imagen_perfil, id_rol)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                clean($body['nombre'] ?? null),
                clean($body['correo'] ?? null),
                clean($body['curp'] ?? null),
                password_hash((string) ($body['password'] ?? '123456'), PASSWORD_DEFAULT),
                clean($body['instituto'] ?? null),
                clean($body['cargo_grado'] ?? null),
                $photo,
                (int) ($body['id_rol'] ?? 2),
            ]);
            record_activity('CREACION_USUARIO', (int) $user['id_usuario'], null, 'Usuario creado');
            out(['success' => true, 'message' => 'Usuario creado']);
        }
    }

    if (preg_match('#^/api/usuarios/(\d+)$#', $path, $m)) {
        if (!$isAdmin) {
            fail('No tienes permiso', 403);
        }
        $id = (int) $m[1];
        if ($method === 'PUT') {
            $stmt = db()->prepare('SELECT imagen_perfil FROM usuarios WHERE id_usuario = ?');
            $stmt->execute([$id]);
            $current = $stmt->fetchColumn() ?: 'img/usuario.png';
            $photo = isset($_FILES['imagen']) ? upload_profile_image($_FILES['imagen'], (string) $current) : $current;
            $fields = 'nombre = ?, correo = ?, curp = ?, instituto = ?, cargo_grado = ?, imagen_perfil = ?, id_rol = ?';
            $params = [clean($body['nombre'] ?? null), clean($body['correo'] ?? null), clean($body['curp'] ?? null), clean($body['instituto'] ?? null), clean($body['cargo_grado'] ?? null), $photo, (int) ($body['id_rol'] ?? 2)];
            if (!empty($body['password'])) {
                $fields .= ', password_hash = ?';
                $params[] = password_hash((string) $body['password'], PASSWORD_DEFAULT);
            }
            $params[] = $id;
            db()->prepare("UPDATE usuarios SET {$fields} WHERE id_usuario = ?")->execute($params);
            out(['success' => true, 'message' => 'Usuario actualizado']);
        }
        if ($method === 'DELETE') {
            db()->prepare('UPDATE usuarios SET activo = 0 WHERE id_usuario = ?')->execute([$id]);
            out(['success' => true, 'message' => 'Usuario eliminado']);
        }
    }

    if ($path === '/api/mps') {
        if ($method === 'GET') {
            out(['success' => true, 'data' => db()->query('SELECT * FROM ministerios_publicos WHERE activo = 1 ORDER BY nombre')->fetchAll()]);
        }
        if (!$isAdmin) {
            fail('No tienes permiso', 403);
        }
        if ($method === 'POST') {
            db()->prepare('INSERT INTO ministerios_publicos (nombre, cargo_grado, activo) VALUES (?, ?, 1)')
                ->execute([clean($body['nombre'] ?? null), clean($body['cargo_grado'] ?? null)]);
            out(['success' => true, 'message' => 'MP creado']);
        }
    }

    if (preg_match('#^/api/mps/(\d+)$#', $path, $m)) {
        if (!$isAdmin) {
            fail('No tienes permiso', 403);
        }
        if ($method === 'PUT') {
            db()->prepare('UPDATE ministerios_publicos SET nombre = ?, cargo_grado = ? WHERE id_mp = ?')
                ->execute([clean($body['nombre'] ?? null), clean($body['cargo_grado'] ?? null), (int) $m[1]]);
            out(['success' => true, 'message' => 'MP actualizado']);
        }
        if ($method === 'DELETE') {
            db()->prepare('UPDATE ministerios_publicos SET activo = 0 WHERE id_mp = ?')->execute([(int) $m[1]]);
            out(['success' => true, 'message' => 'MP dado de baja']);
        }
    }

    if ($path === '/api/perfil' && $method === 'GET') {
        $stmt = db()->prepare(
            "SELECT p.folio, p.fecha, p.gravedad_general, p.estado, mp.nombre AS mp_nombre, r.nombre AS respondiente_nombre
             FROM partes p
             LEFT JOIN ministerios_publicos mp ON mp.id_mp = p.id_mp
             LEFT JOIN respondientes r ON r.id_respondiente = p.id_respondiente
             WHERE p.creado_por = ? OR p.asignado_a = ?
             ORDER BY p.fecha_creacion DESC
             LIMIT 8"
        );
        $stmt->execute([(int) $user['id_usuario'], (int) $user['id_usuario']]);
        out(['success' => true, 'data' => ['usuario' => public_user($user), 'partes' => $stmt->fetchAll()]]);
    }

    if ($path === '/api/perfil/correo' && $method === 'PATCH') {
        $correo = clean($body['correo'] ?? null);
        db()->prepare('UPDATE usuarios SET correo = ? WHERE id_usuario = ?')->execute([$correo, (int) $user['id_usuario']]);
        out(['success' => true, 'message' => 'Correo actualizado', 'usuario' => ['correo' => $correo]]);
    }
    if ($path === '/api/perfil/curp' && $method === 'PATCH') {
        $curp = clean($body['curp'] ?? null);
        db()->prepare('UPDATE usuarios SET curp = ? WHERE id_usuario = ?')->execute([$curp, (int) $user['id_usuario']]);
        out(['success' => true, 'message' => 'CURP actualizada', 'usuario' => ['curp' => $curp]]);
    }
    if ($path === '/api/perfil/password' && $method === 'PATCH') {
        if (!password_verify((string) ($body['current_password'] ?? ''), (string) $user['password_hash'])) {
            fail('La contraseña actual no es correcta');
        }
        $password = (string) ($body['password'] ?? '');
        if (strlen($password) < 6 || $password !== (string) ($body['confirm_password'] ?? '')) {
            fail('La confirmación no coincide');
        }
        db()->prepare('UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), (int) $user['id_usuario']]);
        out(['success' => true, 'message' => 'Contraseña actualizada']);
    }

    if ($path === '/api/partes/catalogos') {
        out(['success' => true, 'data' => [
            'mps' => db()->query('SELECT id_mp, nombre FROM ministerios_publicos WHERE activo = 1 ORDER BY nombre')->fetchAll(),
            'respondientes' => db()->query('SELECT id_respondiente, nombre FROM respondientes WHERE activo = 1 ORDER BY nombre')->fetchAll(),
            'corralones' => db()->query('SELECT id_corralon, nombre, direccion, telefono FROM corralones WHERE activo = 1 ORDER BY nombre')->fetchAll(),
        ]]);
    }

    if ($path === '/api/partes') {
        if ($method === 'GET') {
            $q = trim((string) ($apiQuery['q'] ?? $_GET['q'] ?? ''));
            $where = '';
            $params = [];
            if ($q !== '') {
                $where = 'WHERE p.folio LIKE ? OR p.tipo_parte LIKE ? OR mp.nombre LIKE ? OR r.nombre LIKE ? OR u.nombre LIKE ? OR v.numero_placa LIKE ? OR v.numero_serie LIKE ?';
                $like = '%' . $q . '%';
                $params = [$like, $like, $like, $like, $like, $like, $like];
            }
            $stmt = db()->prepare(
                "SELECT p.id_parte, p.folio, p.tipo_parte, p.fecha, p.hora, p.estado, p.gravedad_general,
                        mp.nombre AS mp_nombre, r.nombre AS respondiente_nombre, u.nombre AS encargado_nombre,
                        u.imagen_perfil AS encargado_foto,
                        GROUP_CONCAT(DISTINCT v.numero_placa SEPARATOR ' | ') AS placas,
                        GROUP_CONCAT(DISTINCT v.numero_serie SEPARATOR ' | ') AS series,
                        GROUP_CONCAT(DISTINCT v.marca SEPARATOR ' | ') AS marcas,
                        GROUP_CONCAT(DISTINCT v.modelo SEPARATOR ' | ') AS modelos
                 FROM partes p
                 LEFT JOIN ministerios_publicos mp ON mp.id_mp = p.id_mp
                 LEFT JOIN respondientes r ON r.id_respondiente = p.id_respondiente
                 LEFT JOIN usuarios u ON u.id_usuario = p.asignado_a
                 LEFT JOIN vehiculos v ON v.id_parte = p.id_parte
                 {$where}
                 GROUP BY p.id_parte
                 ORDER BY p.fecha_creacion DESC"
            );
            $stmt->execute($params);
            $rows = $stmt->fetchAll();
            foreach ($rows as &$row) {
                $row['encargado_foto'] = asset_path($row['encargado_foto'] ?? null);
            }
            out(['success' => true, 'data' => $rows]);
        }
        if ($method === 'POST') {
            if (!$canWritePartes) {
                fail('No tienes permiso para modificar partes', 403);
            }
            $folio = clean($body['folio'] ?? null) ?: 'FIG-' . time();
            $idMp = clean($body['id_mp'] ?? null) ? (int) $body['id_mp'] : find_or_create('ministerios_publicos', 'id_mp', clean($body['mp_nombre'] ?? null));
            $idResp = clean($body['id_respondiente'] ?? null) ? (int) $body['id_respondiente'] : find_or_create('respondientes', 'id_respondiente', clean($body['respondiente_nombre'] ?? null));
            db()->prepare(
                'INSERT INTO partes (folio, tipo_parte, fecha, hora, ubicacion_kilometro, ubicacion_direccion, ubicacion_lat, ubicacion_lng, google_place_id, id_mp, id_respondiente, estado, gravedad_general, creado_por, asignado_a)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([$folio, clean($body['tipo_parte'] ?? null), clean($body['fecha'] ?? null), clean($body['hora'] ?? null), clean($body['ubicacion_kilometro'] ?? null), clean($body['ubicacion_direccion'] ?? null), clean($body['ubicacion_lat'] ?? null), clean($body['ubicacion_lng'] ?? null), clean($body['google_place_id'] ?? null), $idMp, $idResp, clean($body['estado'] ?? null) ?: 'Activo', clean($body['gravedad_general'] ?? null) ?: 'Sin clasificar', (int) $user['id_usuario'], clean($body['asignado_a'] ?? null)]);
            $id = (int) db()->lastInsertId();
            save_details($id, $body);
            record_history('CREAR', $id, (int) $user['id_usuario'], 'Parte ' . $folio . ' creado desde PHP');
            record_activity('CREACION_PARTE', (int) $user['id_usuario'], $id, 'Parte ' . $folio . ' creado');
            out(['success' => true, 'message' => 'Parte creado', 'id' => $id]);
        }
    }

    if ($path === '/api/partes/export' && $method === 'POST') {
        $exportDetail = 'Exportación ' . strtoupper((string) ($body['tipo'] ?? 'archivo')) . ' de ' . (int) ($body['total'] ?? 0) . ' parte(s)';
        record_history('EXPORTAR', null, (int) $user['id_usuario'], $exportDetail);
        record_activity('EXPORTACION', (int) $user['id_usuario'], null, $exportDetail);
        out(['success' => true, 'message' => 'Exportación registrada']);
    }

    if (preg_match('#^/api/partes/(\d+)/historial$#', $path, $m)) {
        $stmt = db()->prepare(
            "SELECT h.id_historial, h.accion, h.descripcion, h.fecha, u.nombre AS usuario_nombre, u.imagen_perfil AS usuario_foto
             FROM historial_cambios h
             LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
             WHERE h.id_parte = ?
             ORDER BY h.fecha DESC"
        );
        $stmt->execute([(int) $m[1]]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['usuario_foto'] = asset_path($row['usuario_foto'] ?? null);
        }
        out(['success' => true, 'data' => $rows]);
    }

    if (preg_match('#^/api/partes/(\d+)$#', $path, $m)) {
        $id = (int) $m[1];
        if ($method === 'GET') {
            $part = get_part($id);
            if (!$part) {
                fail('Parte no encontrado', 404);
            }
            out(['success' => true, 'data' => $part]);
        }
        if ($method === 'PUT') {
            if (!$canWritePartes) {
                fail('No tienes permiso para modificar partes', 403);
            }
            $folio = clean($body['folio'] ?? null) ?: 'FIG-' . time();
            $idMp = clean($body['id_mp'] ?? null) ? (int) $body['id_mp'] : find_or_create('ministerios_publicos', 'id_mp', clean($body['mp_nombre'] ?? null));
            $idResp = clean($body['id_respondiente'] ?? null) ? (int) $body['id_respondiente'] : find_or_create('respondientes', 'id_respondiente', clean($body['respondiente_nombre'] ?? null));
            db()->prepare(
                'UPDATE partes SET folio = ?, tipo_parte = ?, fecha = ?, hora = ?, ubicacion_kilometro = ?, ubicacion_direccion = ?, ubicacion_lat = ?, ubicacion_lng = ?, google_place_id = ?, id_mp = ?, id_respondiente = ?, estado = ?, gravedad_general = ?, asignado_a = ? WHERE id_parte = ?'
            )->execute([$folio, clean($body['tipo_parte'] ?? null), clean($body['fecha'] ?? null), clean($body['hora'] ?? null), clean($body['ubicacion_kilometro'] ?? null), clean($body['ubicacion_direccion'] ?? null), clean($body['ubicacion_lat'] ?? null), clean($body['ubicacion_lng'] ?? null), clean($body['google_place_id'] ?? null), $idMp, $idResp, clean($body['estado'] ?? null) ?: 'Activo', clean($body['gravedad_general'] ?? null) ?: 'Sin clasificar', clean($body['asignado_a'] ?? null), $id]);
            save_details($id, $body);
            record_history('EDITAR', $id, (int) $user['id_usuario'], 'Parte ' . $folio . ' editado desde PHP');
            record_activity('EDICION_PARTE', (int) $user['id_usuario'], $id, 'Parte ' . $folio . ' editado');
            out(['success' => true, 'message' => 'Parte actualizado']);
        }
        if ($method === 'DELETE') {
            if (!$canWritePartes) {
                fail('No tienes permiso para eliminar partes', 403);
            }
            $part = get_part($id);
            record_history('ELIMINAR', $id, (int) $user['id_usuario'], 'Parte ' . ($part['folio'] ?? $id) . ' eliminado desde PHP');
            record_activity('ELIMINACION_PARTE', (int) $user['id_usuario'], $id, 'Parte ' . ($part['folio'] ?? $id) . ' eliminado');
            db()->prepare('DELETE FROM partes WHERE id_parte = ?')->execute([$id]);
            out(['success' => true, 'message' => 'Parte eliminado']);
        }
    }

    if (strpos($path, '/api/historial') === 0) {
        if ($path === '/api/historial/notificaciones') {
            $rows = db()->query(
                "SELECT h.accion, h.descripcion, h.fecha, p.folio, u.nombre AS usuario_nombre
                 FROM historial_cambios h
                 LEFT JOIN partes p ON p.id_parte = h.id_parte
                 LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
                 WHERE h.accion IN ('EDITAR','ELIMINAR')
                 ORDER BY h.fecha DESC
                 LIMIT 8"
            )->fetchAll();
            out(['success' => true, 'data' => $rows]);
        }

        if ($path === '/api/historial/estadisticas/detalle') {
            $type = (string) ($apiQuery['tipo'] ?? '');
            $month = (int) ($apiQuery['mes'] ?? date('n'));
            $year = (int) ($apiQuery['anio'] ?? date('Y'));
            $start = sprintf('%04d-%02d-01 00:00:00', $year, $month);
            $end = date('Y-m-d H:i:s', strtotime($start . ' +1 month'));
            $stmt = db()->prepare(
                "SELECT a.tipo_evento, a.detalle, a.fecha, p.folio, u.nombre AS usuario_nombre
                 FROM actividad_sistema a
                 LEFT JOIN partes p ON p.id_parte = a.id_parte
                 LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
                 WHERE a.tipo_evento = ? AND a.fecha >= ? AND a.fecha < ?
                 ORDER BY a.fecha DESC"
            );
            $stmt->execute([$type, $start, $end]);
            $records = $stmt->fetchAll();
            $users = [];
            foreach ($records as $record) {
                $name = $record['usuario_nombre'] ?: 'Sistema';
                $users[$name] = ($users[$name] ?? 0) + 1;
            }
            $userRows = [];
            foreach ($users as $name => $total) {
                $userRows[] = ['nombre' => $name, 'total' => $total];
            }
            out(['success' => true, 'data' => [
                'tipo' => $type,
                'etiqueta' => ucwords(strtolower(str_replace('_', ' ', $type))),
                'mes' => $month,
                'anio' => $year,
                'total' => count($records),
                'usuarios' => $userRows,
                'registros' => $records,
            ]]);
        }

        if (strpos($path, '/api/historial/estadisticas') === 0) {
            $month = (int) ($apiQuery['mes'] ?? date('n'));
            $year = (int) ($apiQuery['anio'] ?? date('Y'));
            $start = sprintf('%04d-%02d-01 00:00:00', $year, $month);
            $end = date('Y-m-d H:i:s', strtotime($start . ' +1 month'));
            $stmt = db()->prepare('SELECT tipo_evento AS tipo, COUNT(*) AS total FROM actividad_sistema WHERE fecha >= ? AND fecha < ? GROUP BY tipo_evento ORDER BY total DESC');
            $stmt->execute([$start, $end]);
            $events = $stmt->fetchAll();
            $total = array_sum(array_map('intval', array_column($events, 'total')));
            foreach ($events as &$event) {
                $event['etiqueta'] = ucwords(strtolower(str_replace('_', ' ', $event['tipo'])));
                $event['porcentaje'] = $total ? round(((int) $event['total'] / $total) * 100, 1) : 0;
            }
            $stmt = db()->prepare(
                "SELECT COALESCE(u.nombre, 'Sistema') AS nombre, COUNT(*) AS total
                 FROM actividad_sistema a
                 LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
                 WHERE a.fecha >= ? AND a.fecha < ?
                 GROUP BY nombre
                 ORDER BY total DESC
                 LIMIT 5"
            );
            $stmt->execute([$start, $end]);
            out(['success' => true, 'data' => [
                'eventos' => $events,
                'dias' => [],
                'usuarios' => $stmt->fetchAll(),
                'total' => $total,
                'actividad_principal' => $events[0] ?? null,
            ]]);
        }

        $stmt = db()->query(
            "SELECT h.*, p.folio, p.fecha AS parte_fecha, mp.nombre AS mp_nombre, u.nombre AS usuario_nombre,
                    enc.nombre AS encargado_nombre, enc.imagen_perfil AS encargado_foto
             FROM historial_cambios h
             LEFT JOIN partes p ON p.id_parte = h.id_parte
             LEFT JOIN ministerios_publicos mp ON mp.id_mp = p.id_mp
             LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
             LEFT JOIN usuarios enc ON enc.id_usuario = p.asignado_a
             ORDER BY h.fecha DESC
             LIMIT 200"
        );
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['encargado_foto'] = asset_path($row['encargado_foto'] ?? null);
        }
        out(['success' => true, 'data' => $rows]);
    }

    fail('Ruta no encontrada: ' . $path, 404);
} catch (Throwable $error) {
    fail($error->getMessage(), 500);
}
