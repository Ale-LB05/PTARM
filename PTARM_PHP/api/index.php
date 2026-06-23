<?php
    /*
 * API JSON principal de PTARM.
 *
 * Las pantallas JavaScript llaman rutas como /api/partes o /api/usuarios.
 * common.js convierte esas rutas a api/index.php?path=/api/... para que funcione
 * en XAMPP sin configurar reglas de reescritura.
 *
 * Responsabilidades:
 * - Autenticaci?n por token Bearer y sesi?n PHP.
 * - CRUD de usuarios, catalogos y partes.
 * - Historial, notificaciones y estad?sticas.
 * - Normalizaci?n de datos completos de partes para editar/exportar.
 */
    require_once __DIR__ . '/../config/db.php';
    $importConfig = __DIR__ . '/../config/importacion.local.php';
    if (is_file($importConfig)) {
        require_once $importConfig;
    }
    $composerAutoload = __DIR__ . '/../vendor/autoload.php';
    if (is_file($composerAutoload)) {
        require_once $composerAutoload;
    }

    header('Content-Type: application/json; charset=utf-8');

    // La ruta real de API llega en ?path=. Si trae query interna, se separa aqu?.
    $rawPath = urldecode((string) ($_GET['path'] ?? '/'));
    $path = parse_url($rawPath, PHP_URL_PATH) ?: '/';
    $apiQuery = [];
    parse_str(parse_url($rawPath, PHP_URL_QUERY) ?: '', $apiQuery);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // Acepta JSON para fetch() moderno y POST normal para formularios con archivos.
    $json = json_decode(file_get_contents('php://input') ?: '[]', true);
    $body = is_array($json) && $json ? $json : $_POST;
    if (!empty($body['_method'])) {
        $method = strtoupper((string) $body['_method']);
    }

    function out(array $payload, int $status = 200): void
    {
        // Todas las respuestas salen por aqu? para mantener formato JSON uniforme.
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
        // El frontend manda Authorization: Bearer <token> desde common.js/authHeaders().
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
        // Todas las rutas privadas llaman aqu? antes de consultar o modificar datos.
        $user = token_user();
        if (!$user) {
            fail('No autorizado', 401);
        }
        return $user;
    }

    function clean($value): ?string
    {
        $value = is_string($value) ? trim($value) : $value;
        if (is_string($value) && preg_match('/^campo vac[ií]o$/iu', $value)) {
            return null;
        }
        return $value === '' || $value === null ? null : (string) $value;
    }

    function import_clean_key(string $key): string
    {
        $key = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $key) ?: $key;
        $key = strtolower(trim($key));
        $key = preg_replace('/[^a-z0-9]+/', '_', $key) ?: '';
        return trim($key, '_');
    }

    function import_truthy($value): bool
    {
        return in_array(strtolower(trim((string) $value)), ['1', 'si', 'sí', 'true', 'x'], true);
    }

    function import_date_value($value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return $value;
        }
        if (is_numeric($value)) {
            $timestamp = ((float) $value - 25569) * 86400;
            return gmdate('Y-m-d', (int) round($timestamp));
        }
        $time = strtotime($value);
        return $time ? date('Y-m-d', $time) : $value;
    }

    /** Extracts the part folios stored in an activity detail for statistics. */
    function activity_folios(?string $detail, ?string $folio = null): array
    {
        if (clean($folio)) {
            return [(string) $folio];
        }
        $detail = (string) $detail;
        if (preg_match('/Folios:\s*(.+)$/iu', $detail, $match)) {
            return array_values(array_filter(array_map('trim', preg_split('/[|,]/', $match[1]) ?: [])));
        }
        if (preg_match('/Parte\s+([^\s]+)\s+(?:creado|editado|eliminado)/iu', $detail, $match)) {
            return [trim($match[1])];
        }
        return [];
    }

    /** Extracts the name and email saved when an administrator creates a user. */
    function activity_created_user(?string $detail): ?string
    {
        $detail = trim((string) $detail);
        return preg_match('/Usuario creado:\s*(.+)$/iu', $detail, $match) ? trim($match[1]) : null;
    }

    /** Reads the batch identifier used when several parts are created together. */
    function activity_batch(?string $detail): ?string
    {
        return preg_match('/Lote:\s*([a-zA-Z0-9_-]+)/', (string) $detail, $match) ? $match[1] : null;
    }

    function import_first_match(string $text, array $patterns): ?string
    {
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $match)) {
                return clean($match[1] ?? null);
            }
        }
        return null;
    }

    function import_names_from_query(string $sql): array
    {
        try {
            $rows = db()->query($sql)->fetchAll();
            $names = array_values(array_filter(array_map(fn($row) => clean($row['nombre'] ?? null), $rows)));
            usort($names, fn($a, $b) => strlen($b) <=> strlen($a));
            return $names;
        } catch (Throwable $error) {
            return [];
        }
    }

    function import_find_catalog_name(string $text, string $table): ?string
    {
        $names = import_names_from_query("SELECT nombre FROM {$table} WHERE activo = 1");
        foreach ($names as $name) {
            if (stripos($text, $name) !== false) {
                return $name;
            }
        }
        return null;
    }

    function import_label_value(string $text, array $labels): ?string
    {
        foreach ($labels as $label) {
            $pattern = '/(?:^|\R)\s*' . preg_quote($label, '/') . '\s*[:\-]\s*(.+)/iu';
            if (preg_match($pattern, $text, $match)) {
                return clean($match[1]);
            }
        }
        return null;
    }

    function import_known_gravity_pattern(): string
    {
        return 'Sin clasificar|Bajo|Medio|Alto|Otro';
    }

    /** Maps common third-party spreadsheet labels to PTARM import fields. */
    function import_canonical_header(string $header): string
    {
        $key = import_clean_key($header);
        $aliases = [
            'folio' => ['folio', 'no_parte', 'no_de_parte', 'numero_de_parte', 'numero_parte', 'folio_del_parte'],
            'tipo_parte' => ['tipo_parte', 'motivo', 'motivo_del_parte', 'tipo_de_incidente', 'incidente', 'hecho'],
            'fecha' => ['fecha', 'fecha_del_parte', 'fecha_incidente'],
            'hora' => ['hora', 'hora_del_parte', 'hora_incidente'],
            'respondiente_nombre' => ['respondiente', 'respondiente_nombre', 'policia_respondiente', 'autoridad_respondiente'],
            'mp_nombre' => ['mp', 'mp_asignado', 'mp_nombre', 'ministerio_publico', 'ministerio_publico_asignado'],
            'encargado_nombre' => ['encargado', 'encargado_nombre', 'usuario_encargado', 'responsable', 'asignado_a'],
            'estado' => ['estado', 'estatus'],
            'gravedad_general' => ['gravedad', 'gravedad_general', 'nivel_de_gravedad'],
            'ubicacion_kilometro' => ['kilometro', 'km', 'kilometro_o_referencia', 'referencia', 'ubicacion_kilometro'],
            'ubicacion_direccion' => ['direccion', 'domicilio', 'ubicacion', 'ubicacion_direccion'],
            'ubicacion_lat' => ['latitud', 'ubicacion_lat', 'lat'],
            'ubicacion_lng' => ['longitud', 'ubicacion_lng', 'lng', 'lon'],
            'numero_personas' => ['numero_personas', 'total_personas', 'personas'],
            'personas_fallecidas' => ['personas_fallecidas', 'fallecidas', 'hubo_fallecidos'],
            'numero_fallecidos' => ['numero_fallecidos', 'total_fallecidos'],
            'personas_heridas' => ['personas_heridas', 'heridas', 'hubo_heridos'],
            'numero_heridos' => ['numero_heridos', 'total_heridos'],
            'observaciones' => ['observaciones', 'observacion', 'notas', 'comentarios'],
            'tipo_vehiculo' => ['tipo_vehiculo', 'clase_vehiculo', 'clase'],
            'marca' => ['marca', 'marca_vehiculo'],
            'modelo' => ['modelo', 'modelo_vehiculo'],
            'tipo' => ['tipo', 'tipo_de_vehiculo'],
            'numero_serie' => ['numero_serie', 'no_serie', 'serie', 'vin'],
            'numero_placa' => ['numero_placa', 'no_placa', 'placa', 'placas'],
            'corralon' => ['corralon', 'deposito_vehicular'],
            'estatus_vehiculo' => ['estatus_vehiculo', 'estado_vehiculo'],
            'danos_vehiculo' => ['danos_vehiculo', 'danos'],
        ];
        foreach ($aliases as $canonical => $options) {
            if (in_array($key, $options, true)) {
                return $canonical;
            }
        }
        return $key;
    }

    function import_header_score(array $row): int
    {
        $accepted = [
            'id_parte', 'folio', 'motivo', 'fecha', 'hora', 'estado', 'gravedad_general',
            'respondiente', 'mp_asignado', 'usuario_encargado', 'fecha_de_creacion',
            'kilometro_o_referencia', 'direccion', 'total_personas', 'detalle_personas',
            'fallecidas', 'numero_fallecidos', 'heridas', 'numero_heridos', 'otros',
            'gravedad_personas', 'observacion_fallecidos', 'observaciones', 'vehiculos',
            'tipo_parte', 'mp_nombre', 'encargado_nombre', 'ubicacion_kilometro',
        ];
        $score = 0;
        foreach ($row as $cell) {
            if (in_array(import_canonical_header((string) $cell), $accepted, true)) {
                $score++;
            }
        }
        return $score;
    }

    function import_rows_from_matrix(array $matrix): array
    {
        $headerIndex = null;
        foreach ($matrix as $index => $row) {
            if (import_header_score(array_values($row)) >= 2) {
                $headerIndex = $index;
                break;
            }
        }
        if ($headerIndex === null) {
            $lines = [];
            foreach ($matrix as $line) {
                $cells = array_values(array_filter(array_map('trim', array_map('strval', (array) $line)), fn($value) => $value !== ''));
                if (count($cells) >= 2) {
                    $lines[] = $cells[0] . ': ' . $cells[1];
                } elseif ($cells) {
                    $lines[] = implode(' ', $cells);
                }
            }
            return import_rows_from_text(implode("\n", $lines));
        }
        $headers = array_map('import_canonical_header', array_values($matrix[$headerIndex]));
        $rows = [];
        foreach (array_slice($matrix, $headerIndex + 1) as $line) {
            $line = array_values($line);
            if (!array_filter($line, fn($value) => trim((string) $value) !== '')) {
                continue;
            }
            $rows[] = array_combine($headers, array_pad($line, count($headers), '')) ?: [];
        }
        $normalizedRows = array_values(array_filter(array_map('normalize_import_row', $rows)));
        foreach ($normalizedRows as &$normalizedRow) {
            import_add_missing_warnings($normalizedRow);
        }
        unset($normalizedRow);
        return $normalizedRows;
    }

    function parse_import_vehicle_summary(?string $value): array
    {
        $value = trim((string) $value);
        if ($value === '' || stripos($value, 'campo vac') !== false) {
            return [];
        }
        $vehicles = [];
        foreach (explode('|', $value) as $chunk) {
            $read = static function (string $pattern) use ($chunk): ?string {
                return preg_match('/' . $pattern . '\s+([^\/|]+)/iu', $chunk, $match) ? clean($match[1]) : null;
            };
            $vehicle = [
                'tipo_vehiculo' => $read('Clase') ?: 'Vehiculo',
                'marca' => $read('Marca'),
                'modelo' => $read('Modelo'),
                'tipo' => $read('Tipo'),
                'numero_serie' => $read('Serie'),
                'numero_placa' => $read('Placa'),
                'corralon' => $read('Corral[oó]n'),
                'estatus_vehiculo' => $read('Estatus') ?: 'Sin clasificar',
                'danos_vehiculo' => $read('Da[ñn]os'),
            ];
            if (array_filter($vehicle, fn($item) => $item !== null && $item !== '' && $item !== 'Vehiculo' && $item !== 'Sin clasificar')) {
                $vehicles[] = $vehicle;
            }
        }
        return $vehicles;
    }

    function normalize_import_row(array $row): ?array
    {
        $normalized = [];
        foreach ($row as $key => $value) {
            $normalized[import_clean_key((string) $key)] = clean($value) ?? '';
        }
        if (!array_filter($normalized, fn($value) => trim((string) $value) !== '')) {
            return null;
        }
        $vehicles = parse_import_vehicle_summary($normalized['vehiculos'] ?? null);
        return [
            'folio' => clean($normalized['folio'] ?? null),
            'tipo_parte' => clean($normalized['tipo_parte'] ?? ($normalized['motivo'] ?? null)),
            'fecha' => import_date_value($normalized['fecha'] ?? ''),
            'hora' => clean($normalized['hora'] ?? null),
            'respondiente_nombre' => clean($normalized['respondiente_nombre'] ?? ($normalized['respondiente'] ?? null)),
            'mp_nombre' => clean($normalized['mp_nombre'] ?? ($normalized['mp'] ?? ($normalized['mp_asignado'] ?? null))),
            'estado' => clean($normalized['estado'] ?? null) ?: 'Activo',
            'gravedad_general' => clean($normalized['gravedad_general'] ?? null) ?: 'Sin clasificar',
            'ubicacion_kilometro' => clean($normalized['ubicacion_kilometro'] ?? ($normalized['kilometro_o_referencia'] ?? null)),
            'ubicacion_direccion' => clean($normalized['ubicacion_direccion'] ?? ($normalized['direccion'] ?? null)),
            'ubicacion_lat' => clean($normalized['ubicacion_lat'] ?? null),
            'ubicacion_lng' => clean($normalized['ubicacion_lng'] ?? null),
            'numero_personas' => clean($normalized['numero_personas'] ?? ($normalized['total_personas'] ?? null)),
            'personas_fallecidas' => import_truthy($normalized['personas_fallecidas'] ?? ($normalized['fallecidas'] ?? '')),
            'numero_fallecidos' => clean($normalized['numero_fallecidos'] ?? null),
            'personas_heridas' => import_truthy($normalized['personas_heridas'] ?? ($normalized['heridas'] ?? '')),
            'numero_heridos' => clean($normalized['numero_heridos'] ?? null),
            'otros' => import_truthy($normalized['otros'] ?? ''),
            'gravedad' => clean($normalized['gravedad'] ?? ($normalized['gravedad_personas'] ?? null)),
            'observacion_fallecidos' => clean($normalized['observacion_fallecidos'] ?? null),
            'observaciones' => clean($normalized['observaciones'] ?? null),
            'vehiculos' => $vehicles ?: [[
                'tipo_vehiculo' => clean($normalized['tipo_vehiculo'] ?? null) ?: 'Vehiculo',
                'marca' => clean($normalized['marca'] ?? null),
                'modelo' => clean($normalized['modelo'] ?? null),
                'tipo' => clean($normalized['tipo'] ?? null),
                'numero_serie' => clean($normalized['numero_serie'] ?? null),
                'numero_placa' => clean($normalized['numero_placa'] ?? null),
                'corralon' => clean($normalized['corralon'] ?? null),
                'estatus_vehiculo' => clean($normalized['estatus_vehiculo'] ?? null) ?: 'Sin clasificar',
                'danos_vehiculo' => clean($normalized['danos_vehiculo'] ?? null),
            ]],
        ];
    }

    function import_missing_fields(array $rawRow, array $normalized): array
    {
        $checks = [
            'folio' => 'Folio del parte',
            'tipo_parte' => 'Motivo del parte',
            'fecha' => 'Fecha',
            'hora' => 'Hora',
            'estado' => 'Estado',
            'gravedad_general' => 'Gravedad general',
            'respondiente_nombre' => 'Respondiente',
            'mp_nombre' => 'MP asignado',
            'ubicacion_kilometro' => 'Kilometro o referencia',
            'ubicacion_direccion' => 'Direccion',
            'numero_personas' => 'Numero de personas',
            'numero_placa' => 'No. placa',
            'numero_serie' => 'No. serie',
        ];
        $missing = [];
        $vehicle = (array) ($normalized['vehiculos'][0] ?? []);
        foreach ($checks as $key => $label) {
            $value = $normalized[$key] ?? null;
            if ($key === 'numero_placa' || $key === 'numero_serie') {
                $value = $vehicle[$key] ?? null;
            }
            if (!clean($value)) {
                $missing[] = $label;
            }
        }
        return array_values(array_unique($missing));
    }

    /** Adds the warnings consumed by the import preview for every source. */
    function import_add_missing_warnings(array &$row): void
    {
        $missing = import_missing_fields([], $row);
        $row['_missing_fields'] = $missing;
        $row['_warnings'] = array_map(fn($field) => 'No se encontro: ' . $field, $missing);
    }

    function parse_import_csv(string $text): array
    {
        $handle = fopen('php://temp', 'r+');
        fwrite($handle, $text);
        rewind($handle);
        $matrix = [];
        while (($line = fgetcsv($handle)) !== false) {
            $matrix[] = $line;
        }
        fclose($handle);
        return import_rows_from_matrix($matrix);
    }

    function parse_import_html_table(string $html): array
    {
        libxml_use_internal_errors(true);
        $dom = new DOMDocument();
        $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html);
        $matrix = [];
        foreach ($dom->getElementsByTagName('tr') as $tr) {
            $cells = [];
            foreach ($tr->childNodes as $cell) {
                if (in_array($cell->nodeName, ['td', 'th'], true)) {
                    $cells[] = trim($cell->textContent);
                }
            }
            if ($cells) {
                $matrix[] = $cells;
            }
        }
        return import_rows_from_matrix($matrix);
    }

    function parse_import_spreadsheet(array $file): array
    {
        $name = strtolower((string) ($file['name'] ?? ''));
        $tmp = (string) ($file['tmp_name'] ?? '');
        if (preg_match('/\.csv$/', $name)) {
            return parse_import_csv(file_get_contents($tmp) ?: '');
        }
        if (class_exists('\\PhpOffice\\PhpSpreadsheet\\IOFactory')) {
            try {
                $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($tmp);
                $rows = [];
                foreach ($spreadsheet->getWorksheetIterator() as $sheet) {
                    $matrix = array_map('array_values', $sheet->toArray(null, true, true, true));
                    $rows = array_merge($rows, import_rows_from_matrix($matrix));
                }
                return $rows;
            } catch (Throwable $error) {
            }
        }
        $contents = file_get_contents($tmp) ?: '';
        if (stripos($contents, '<table') !== false) {
            return parse_import_html_table($contents);
        }
        fail('Para leer Excel instala PhpSpreadsheet o sube CSV.');
    }

    function import_pdf_lines(string $text): array
    {
        $lines = preg_split('/\R/u', $text) ?: [];
        $lines = array_map(fn($line) => trim(preg_replace('/\s+/u', ' ', (string) $line)), $lines);
        return array_values(array_filter($lines, fn($line) => $line !== ''));
    }

    function import_line_index(array $lines, string $needle): ?int
    {
        $needleKey = import_clean_key($needle);
        foreach ($lines as $index => $line) {
            if (str_contains(import_clean_key($line), $needleKey)) {
                return $index;
            }
        }
        return null;
    }

    function import_line_index_exact(array $lines, string $needle): ?int
    {
        $needleKey = import_clean_key($needle);
        foreach ($lines as $index => $line) {
            if (import_clean_key($line) === $needleKey) {
                return $index;
            }
        }
        return null;
    }

    function import_line_after(array $lines, string $needle): ?string
    {
        $index = import_line_index($lines, $needle);
        return $index !== null ? clean($lines[$index + 1] ?? null) : null;
    }

    function import_line_after_exact(array $lines, string $needle): ?string
    {
        $index = import_line_index_exact($lines, $needle);
        return $index !== null ? clean($lines[$index + 1] ?? null) : null;
    }

    function import_split_pdf_tokens(string $line): array
    {
        $line = preg_replace('/^(\d+)([A-Za-zÁÉÍÓÚÑáéíóúñ]+)(Campo\s+vac[ií]o|Sin\s+clasificar)/u', '$1 $2 $3', $line);
        $line = preg_replace('/(Sin\s+clasificar)(Campo\s+vac[ií]o)/iu', '$1 $2', $line);
        $line = preg_replace('/Campo\s+vac[ií]o/iu', 'Campo_vacio', $line);
        $line = preg_replace('/Sin\s+clasificar/iu', 'Sin_clasificar', $line);
        $tokens = preg_split('/\s+/u', trim((string) $line)) ?: [];
        return array_map(fn($token) => str_replace(['Campo_vacio', 'Sin_clasificar'], ['Campo vacío', 'Sin clasificar'], $token), $tokens);
    }

    function import_split_authority_line(?string $line): array
    {
        $line = clean($line);
        if (!$line) {
            return [null, null];
        }
        foreach (import_names_from_query('SELECT nombre FROM ministerios_publicos WHERE activo = 1') as $mp) {
            if (stripos($line, $mp) === 0) {
                return [$mp, clean(trim(substr($line, strlen($mp))))];
            }
        }
        return [$line, null];
    }

    function import_user_id_by_name(?string $name): ?int
    {
        $name = clean($name);
        if (!$name) {
            return null;
        }
        $stmt = db()->prepare('SELECT id_usuario FROM usuarios WHERE LOWER(nombre) = LOWER(?) AND activo = 1 LIMIT 1');
        $stmt->execute([$name]);
        $id = $stmt->fetchColumn();
        return $id ? (int) $id : null;
    }

    function import_split_location_line(?string $line): array
    {
        $line = clean($line);
        if (!$line) {
            return [null, null];
        }
        if (preg_match('/^(.*?)\s+([A-ZÁÉÍÓÚÑ][^,]+,\s*.+)$/u', $line, $match)) {
            return [clean($match[1]), clean($match[2])];
        }
        return [$line, null];
    }

    function import_vehicle_rows_from_pdf(array $lines): array
    {
        $header = import_line_index($lines, 'CLASE MARCA MODELO');
        if ($header === null) {
            return [];
        }
        $vehicles = [];
        for ($i = $header + 1; $i < count($lines); $i++) {
            $line = $lines[$i];
            if (str_starts_with(import_clean_key($line), '6_control')) {
                break;
            }
            if (!preg_match('/^\d+/', $line)) {
                continue;
            }
            $tokens = import_split_pdf_tokens($line);
            array_shift($tokens);
            $tokens = array_pad($tokens, 9, null);
            $vehicles[] = [
                'tipo_vehiculo' => clean($tokens[0] ?? null) ?: 'Vehiculo',
                'marca' => clean($tokens[1] ?? null),
                'modelo' => clean($tokens[2] ?? null),
                'tipo' => clean($tokens[3] ?? null),
                'numero_serie' => clean($tokens[4] ?? null),
                'numero_placa' => clean($tokens[5] ?? null),
                'corralon' => clean($tokens[6] ?? null),
                'estatus_vehiculo' => clean($tokens[7] ?? null) ?: 'Sin clasificar',
                'danos_vehiculo' => clean($tokens[8] ?? null),
            ];
        }
        return $vehicles;
    }

    function import_exported_pdf_chunks(string $text): array
    {
        preg_match_all('/INFORME POLICIAL HOMOLOGADO.*?(?=INFORME POLICIAL HOMOLOGADO|\z)/su', $text, $matches);
        return $matches[0] ?: [];
    }

    function import_rows_from_exported_pdf(string $text): array
    {
        $rows = [];
        foreach (import_exported_pdf_chunks($text) as $chunk) {
            $lines = import_pdf_lines($chunk);
            $row = [];
            $general = import_line_after($lines, 'NO. DE PARTE');
            if ($general && preg_match('/^(\S+)\s+(\d{4}-\d{2}-\d{2})\s+([0-9:]{5,8})\s+(.+)$/u', $general, $match)) {
                $row['folio'] = $match[1];
                $row['fecha'] = $match[2];
                $row['hora'] = $match[3];
                $row['estado'] = $match[4];
            } else {
                $row['folio'] = import_line_after_exact($lines, 'NO. DE PARTE / FOLIO');
                $row['fecha'] = import_line_after_exact($lines, 'FECHA');
                $row['hora'] = import_line_after_exact($lines, 'HORA');
                $row['estado'] = import_line_after_exact($lines, 'ESTADO');
            }
            $facts = import_line_after($lines, 'MOTIVO DEL PARTE');
            if ($facts && preg_match('/^(.+?)\s+(' . import_known_gravity_pattern() . ')\s+(.+?)(?:\s+\d{2}\/\d{2}\/\d{2},.*)?$/u', $facts, $match)) {
                $row['tipo_parte'] = $match[1];
                $row['gravedad_general'] = $match[2];
                $row['respondiente_nombre'] = $match[3];
            } else {
                $row['tipo_parte'] = import_line_after_exact($lines, 'MOTIVO DEL PARTE');
                $row['gravedad_general'] = import_line_after_exact($lines, 'GRAVEDAD GENERAL');
                $row['respondiente_nombre'] = import_line_after_exact($lines, 'RESPONDIENTE');
            }
            $authority = import_line_after_exact($lines, 'MP ASIGNADO') ?: import_line_after($lines, 'MP ASIGNADO');
            [$mpName, $assignedName] = import_split_authority_line($authority);
            $row['mp_nombre'] = $mpName;
            $row['encargado_nombre'] = $assignedName ?: import_line_after_exact($lines, 'USUARIO ENCARGADO');
            [$kilometer, $address] = import_split_location_line(import_line_after_exact($lines, 'KILÓMETRO O REFERENCIA') ?: import_line_after($lines, 'KILÓMETRO O REFERENCIA'));
            $row['ubicacion_kilometro'] = $kilometer;
            $row['ubicacion_direccion'] = import_line_after_exact($lines, 'DIRECCIÓN OPENSTREETMAP') ?: $address;
            $coordinates = import_line_after($lines, 'LATITUD LONGITUD');
            if ($coordinates && preg_match('/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/', $coordinates, $match)) {
                $row['ubicacion_lat'] = $match[1];
                $row['ubicacion_lng'] = $match[2];
            } else {
                $row['ubicacion_lat'] = import_line_after_exact($lines, 'LATITUD');
                $row['ubicacion_lng'] = import_line_after_exact($lines, 'LONGITUD');
            }
            $personNumbers = import_line_after($lines, 'NÚMERO DE PERSONAS');
            if ($personNumbers && preg_match('/^\d+(?:\s+\d+){0,2}$/', $personNumbers)) {
                $numbers = preg_split('/\s+/', $personNumbers) ?: [];
                $row['numero_personas'] = $numbers[0] ?? null;
                $row['numero_fallecidos'] = $numbers[1] ?? null;
                $row['numero_heridos'] = $numbers[2] ?? null;
            }
            $row['gravedad'] = import_line_after_exact($lines, 'GRAVEDAD') ?: null;
            $row['observacion_fallecidos'] = import_line_after_exact($lines, 'OBSERVACIÓN DE FALLECIDOS');
            $vehicles = import_vehicle_rows_from_pdf($lines);
            if ($vehicles) {
                $row['vehiculos'] = json_encode($vehicles, JSON_UNESCAPED_UNICODE);
            }
            $normalized = normalize_import_row($row);
            if ($normalized) {
                if ($vehicles) {
                    $normalized['vehiculos'] = $vehicles;
                }
                if (!empty($row['encargado_nombre'])) {
                    $normalized['asignado_a'] = import_user_id_by_name($row['encargado_nombre']);
                }
                $missing = import_missing_fields($row, $normalized);
                $normalized['_missing_fields'] = $missing;
                $normalized['_warnings'] = array_map(fn($field) => 'No se encontro: ' . $field, $missing);
                $rows[] = $normalized;
            }
        }
        return $rows;
    }

    function import_text_guess_row(string $text): array
    {
        $row = [
            'folio' => import_label_value($text, ['folio', 'no. parte', 'no parte', 'numero de parte'])
                ?: import_first_match($text, ['/\b((?:FIG|FOLIO|PARTE)[-\s]?[A-Z0-9-]{4,})\b/iu']),
            'tipo_parte' => import_label_value($text, ['motivo', 'motivo del parte', 'tipo de hecho'])
                ?: import_first_match($text, ['/\b(accidente de transito|accidente|robo|dano al vehiculo|hecho de transito|choque|volcadura|atropellamiento)\b/iu']),
            'fecha' => import_label_value($text, ['fecha'])
                ?: import_first_match($text, ['/\b(\d{4}-\d{2}-\d{2})\b/u', '/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/u']),
            'hora' => import_label_value($text, ['hora'])
                ?: import_first_match($text, ['/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/u']),
            'respondiente_nombre' => import_label_value($text, ['respondiente', 'policia respondiente']) ?: import_find_catalog_name($text, 'respondientes'),
            'mp_nombre' => import_label_value($text, ['mp', 'mp asignado', 'ministerio publico']) ?: import_find_catalog_name($text, 'ministerios_publicos'),
            'estado' => import_label_value($text, ['estado']) ?: import_first_match($text, ['/\b(Borrador|Activo|Cerrado|Archivado|Cancelado)\b/iu']),
            'gravedad_general' => import_label_value($text, ['gravedad', 'gravedad general']) ?: import_first_match($text, ['/\b(Sin clasificar|Bajo|Medio|Alto|Otro)\b/iu']),
            'ubicacion_kilometro' => import_label_value($text, ['kilometro', 'referencia', 'ubicacion']),
            'ubicacion_direccion' => import_label_value($text, ['direccion', 'domicilio']),
            'ubicacion_lat' => import_label_value($text, ['latitud']) ?: import_first_match($text, ['/latitud\s*[:\-]?\s*(-?\d+(?:\.\d+)?)/iu']),
            'ubicacion_lng' => import_label_value($text, ['longitud']) ?: import_first_match($text, ['/longitud\s*[:\-]?\s*(-?\d+(?:\.\d+)?)/iu']),
            'numero_personas' => import_label_value($text, ['numero de personas', 'personas involucradas']),
            'numero_fallecidos' => import_label_value($text, ['numero de fallecidos', 'fallecidos']),
            'numero_heridos' => import_label_value($text, ['numero de heridos', 'heridos']),
            'observaciones' => import_label_value($text, ['observaciones', 'observacion']),
            'marca' => import_label_value($text, ['marca']),
            'modelo' => import_label_value($text, ['modelo']),
            'tipo' => import_label_value($text, ['tipo de vehiculo']),
            'numero_serie' => import_label_value($text, ['no. serie', 'numero_serie', 'serie']),
            'numero_placa' => import_label_value($text, ['no. placa', 'numero_placa', 'placa']) ?: import_first_match($text, ['/\b([A-Z]{2,4}[-\s]?\d{2,4}[-\s]?[A-Z0-9]{0,3})\b/u']),
        ];
        if ((!$row['ubicacion_lat'] || !$row['ubicacion_lng']) && preg_match('/(-?\d{1,3}\.\d{4,})\s*,?\s*(-?\d{1,3}\.\d{4,})/', $text, $match)) {
            $row['ubicacion_lat'] = $row['ubicacion_lat'] ?: $match[1];
            $row['ubicacion_lng'] = $row['ubicacion_lng'] ?: $match[2];
        }
        $row['personas_fallecidas'] = !empty($row['numero_fallecidos']) && (int) $row['numero_fallecidos'] > 0 ? 'Si' : null;
        $row['personas_heridas'] = !empty($row['numero_heridos']) && (int) $row['numero_heridos'] > 0 ? 'Si' : null;
        return $row;
    }

    function import_rows_from_text(string $text): array
    {
        if (stripos($text, 'INFORME POLICIAL HOMOLOGADO') !== false) {
            $rows = import_rows_from_exported_pdf($text);
            if ($rows) {
                return $rows;
            }
        }
        $row = import_text_guess_row($text);
        $normalized = normalize_import_row($row);
        if ($normalized) {
            $missing = import_missing_fields($row, $normalized);
            $normalized['_missing_fields'] = $missing;
            $normalized['_warnings'] = array_map(fn($field) => 'No se encontro: ' . $field, $missing);
        }
        return $normalized ? [$normalized] : [];
    }

    function ocr_space_key(): string
    {
        if (defined('OCR_SPACE_API_KEY')) {
            return (string) OCR_SPACE_API_KEY;
        }
        return getenv('OCR_SPACE_API_KEY') ?: '';
    }

    function ocr_space_extract_text(array $file): string
    {
        $key = ocr_space_key();
        if ($key === '') {
            fail('Configura OCR_SPACE_API_KEY para leer im?genes o PDF escaneados con OCR.space.');
        }
        if (!function_exists('curl_init')) {
            fail('PHP cURL debe estar habilitado para usar OCR.space.');
        }
        $curl = curl_init('https://api.ocr.space/parse/image');
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_POSTFIELDS => [
                'apikey' => $key,
                'language' => 'spa',
                'isOverlayRequired' => 'false',
                'file' => new CURLFile($file['tmp_name'], $file['type'] ?: 'application/octet-stream', $file['name']),
            ],
        ]);
        $response = curl_exec($curl);
        $error = curl_error($curl);
        curl_close($curl);
        if (!$response) {
            fail('OCR.space no respondió: ' . ($error ?: 'sin detalle'));
        }
        $data = json_decode($response, true);
        if (!empty($data['IsErroredOnProcessing'])) {
            fail('OCR.space no pudo procesar el archivo: ' . implode(' ', (array) ($data['ErrorMessage'] ?? [])));
        }
        $texts = array_map(fn($item) => (string) ($item['ParsedText'] ?? ''), (array) ($data['ParsedResults'] ?? []));
        return trim(implode("\n", $texts));
    }

    function parse_import_pdf(array $file): array
    {
        $text = '';
        if (class_exists('\\Smalot\\PdfParser\\Parser')) {
            $parser = new \Smalot\PdfParser\Parser();
            $pdf = $parser->parseFile($file['tmp_name']);
            $text = trim($pdf->getText());
        }
        if ($text === '') {
            $text = ocr_space_extract_text($file);
        }
        return import_rows_from_text($text);
    }

    function public_user(array $user): array
    {
        // Esta estructura se guarda en localStorage para pintar nombre, rol y foto.
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
        // Compatibilidad local: agrega columnas/tablas si la base instalada es antigua.
        $adds = [
            "ALTER TABLE usuarios ADD COLUMN curp varchar(18) DEFAULT NULL AFTER correo",
            "ALTER TABLE partes MODIFY folio varchar(80) DEFAULT NULL",
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
        // Usado por partes para aceptar catalogos escritos manualmente.
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

    function part_folio_exists(string $folio, ?int $ignoreId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM partes WHERE folio = ?';
        $params = [$folio];
        if ($ignoreId !== null) {
            $sql .= ' AND id_parte <> ?';
            $params[] = $ignoreId;
        }
        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        return (int) $stmt->fetchColumn() > 0;
    }

    function next_part_folio(): string
    {
        do {
            $folio = 'FIG-' . date('Ymd-His') . '-' . random_int(100, 999);
        } while (part_folio_exists($folio));
        return $folio;
    }

    function filter_duplicate_import_rows(array $rows): array
    {
        $folios = [];
        foreach ($rows as $row) {
            $folio = clean($row['folio'] ?? null);
            if ($folio) {
                $folios[] = $folio;
            }
        }
        $existing = [];
        if ($folios) {
            $placeholders = implode(',', array_fill(0, count($folios), '?'));
            $stmt = db()->prepare("SELECT folio FROM partes WHERE folio IN ({$placeholders})");
            $stmt->execute($folios);
            foreach ($stmt->fetchAll() as $row) {
                $existing[strtolower((string) $row['folio'])] = true;
            }
        }

        $seen = [];
        $filtered = [];
        $skipped = [];
        foreach ($rows as $index => $row) {
            $folio = clean($row['folio'] ?? null);
            if (!$folio) {
                $filtered[] = $row;
                continue;
            }
            $key = strtolower($folio);
            if (isset($seen[$key])) {
                $skipped[] = ['row' => $index + 1, 'folio' => $folio, 'reason' => 'Repetido dentro del archivo'];
                continue;
            }
            if (isset($existing[$key])) {
                $skipped[] = ['row' => $index + 1, 'folio' => $folio, 'reason' => 'Ya existe en el sistema'];
                continue;
            }
            $seen[$key] = true;
            $filtered[] = $row;
        }
        return ['rows' => $filtered, 'skipped' => $skipped];
    }

    function save_details(int $idParte, array $data): void
    {
        // Reemplaza detalles dependientes para que editar un parte no deje restos.
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
        // Une datos base, personas y vehiculos en el formato que consume partes.js.
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
        // Rutas publicas de autenticacion. auth.js las usa antes de entrar al sistema.
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

        // A partir de aqu? todas las rutas requieren token Bearer v?lido.
        $user = api_user();
        $isAdmin = strtolower((string) $user['rol']) === 'administrador';
        $canWritePartes = in_array(strtolower((string) $user['rol']), ['administrador', 'capturista'], true);

        // Usuarios: pantalla Personal. Solo administradores pueden crear/editar/eliminar.
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
                $createdName = clean($body['nombre'] ?? null) ?: 'Sin nombre';
                $createdEmail = clean($body['correo'] ?? null) ?: 'Sin correo';
                record_activity('CREACION_USUARIO', (int) $user['id_usuario'], null, 'Usuario creado: ' . $createdName . ' <' . $createdEmail . '>');
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

        // Ministerios publicos: catalogo usado por Personal y Gestionar partes.
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

        // Perfil: perfil.js consulta y actualiza datos del usuario autenticado.
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

        // Cat?logos de partes: opciones para MP, respondiente y corralon en partes.js.
        if ($path === '/api/partes/catalogos') {
            out(['success' => true, 'data' => [
                'mps' => db()->query('SELECT id_mp, nombre FROM ministerios_publicos WHERE activo = 1 ORDER BY nombre')->fetchAll(),
                'respondientes' => db()->query('SELECT id_respondiente, nombre FROM respondientes WHERE activo = 1 ORDER BY nombre')->fetchAll(),
                'corralones' => db()->query('SELECT id_corralon, nombre, direccion, telefono FROM corralones WHERE activo = 1 ORDER BY nombre')->fetchAll(),
            ]]);
        }

        // Importaci?n: previsualiza Excel, PDF o imagen antes de crear partes en lote.
        if ($path === '/api/partes/import/preview' && $method === 'POST') {
            if (!$canWritePartes) {
                fail('No tienes permiso para importar partes', 403);
            }
            if (empty($_FILES['archivo']) || ($_FILES['archivo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                fail('Sube un archivo v?lido para importar');
            }
            $type = strtolower((string) ($body['tipo'] ?? 'excel'));
            $file = $_FILES['archivo'];
            if ($type === 'excel') {
                $rows = parse_import_spreadsheet($file);
                $checked = filter_duplicate_import_rows($rows);
                out(['success' => true, 'data' => $checked['rows'], 'skipped' => $checked['skipped'], 'source' => 'excel', 'message' => 'Plantilla leida correctamente']);
            }
            if ($type === 'pdf') {
                $rows = parse_import_pdf($file);
                $checked = filter_duplicate_import_rows($rows);
                out(['success' => true, 'data' => $checked['rows'], 'skipped' => $checked['skipped'], 'source' => 'pdf', 'message' => 'PDF leido para previsualizacion']);
            }
            if ($type === 'image') {
                $text = ocr_space_extract_text($file);
                $rows = import_rows_from_text($text);
                $checked = filter_duplicate_import_rows($rows);
                out(['success' => true, 'data' => $checked['rows'], 'skipped' => $checked['skipped'], 'source' => 'ocr_space', 'message' => 'Imagen leida con OCR.space']);
            }
            fail('Tipo de importacion no soportado');
        }

        // Partes: listado, b?squeda, creaci?n y datos resumidos para Gestionar partes.
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
                $importSource = strtolower((string) ($body['_import_source'] ?? ''));
                $allowEmptyFolio = in_array($importSource, ['pdf', 'image'], true);
                $folio = clean($body['folio'] ?? null);
                if (!$folio && !$allowEmptyFolio) {
                    $folio = next_part_folio();
                }
                if ($folio && part_folio_exists($folio)) {
                    fail('El folio ' . $folio . ' ya existe. No se importara para evitar duplicados.', 409);
                }
                $idMp = clean($body['id_mp'] ?? null) ? (int) $body['id_mp'] : find_or_create('ministerios_publicos', 'id_mp', clean($body['mp_nombre'] ?? null));
                $idResp = clean($body['id_respondiente'] ?? null) ? (int) $body['id_respondiente'] : find_or_create('respondientes', 'id_respondiente', clean($body['respondiente_nombre'] ?? null));
                db()->prepare(
                    'INSERT INTO partes (folio, tipo_parte, fecha, hora, ubicacion_kilometro, ubicacion_direccion, ubicacion_lat, ubicacion_lng, google_place_id, id_mp, id_respondiente, estado, gravedad_general, creado_por, asignado_a)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                )->execute([$folio, clean($body['tipo_parte'] ?? null), clean($body['fecha'] ?? null), clean($body['hora'] ?? null), clean($body['ubicacion_kilometro'] ?? null), clean($body['ubicacion_direccion'] ?? null), clean($body['ubicacion_lat'] ?? null), clean($body['ubicacion_lng'] ?? null), clean($body['google_place_id'] ?? null), $idMp, $idResp, clean($body['estado'] ?? null) ?: 'Activo', clean($body['gravedad_general'] ?? null) ?: 'Sin clasificar', (int) $user['id_usuario'], clean($body['asignado_a'] ?? null)]);
                $id = (int) db()->lastInsertId();
                save_details($id, $body);
                $batch = clean($body['_activity_batch'] ?? null);
                $activityDetail = 'Parte ' . ($folio ?: $id) . ' creado';
                if ($batch) {
                    $activityDetail .= ' | Lote: ' . preg_replace('/[^a-zA-Z0-9_-]/', '', $batch);
                }
                record_history('CREAR', $id, (int) $user['id_usuario'], 'Parte ' . $folio . ' creado desde PHP');
                record_activity('CREACION_PARTE', (int) $user['id_usuario'], $id, $activityDetail);
                out(['success' => true, 'message' => 'Parte creado', 'id' => $id]);
            }
        }

        // Exportaci?n: partes.js registra que se preparo PDF o Excel.
        if ($path === '/api/partes/export' && $method === 'POST') {
            $folios = array_values(array_unique(array_filter(array_map('clean', (array) ($body['folios'] ?? [])))));
            $exportDetail = 'Exportación ' . strtoupper((string) ($body['tipo'] ?? 'archivo')) . ' de ' . (int) ($body['total'] ?? 0) . ' parte(s)';
            if ($folios) {
                $exportDetail .= ' | Folios: ' . implode(', ', $folios);
            }
            record_history('EXPORTAR', null, (int) $user['id_usuario'], $exportDetail);
            record_activity('EXPORTACION', (int) $user['id_usuario'], null, $exportDetail);
            out(['success' => true, 'message' => 'Exportación registrada']);
        }

        // Historial por parte: se muestra al abrir un parte en modo consulta.
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

        // Detalle de parte: partes.js lo usa para editar, ver y exportar datos completos.
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
                $folio = clean($body['folio'] ?? null) ?: next_part_folio();
                if (part_folio_exists($folio, $id)) {
                    fail('El folio ' . $folio . ' ya existe en otro parte.', 409);
                }
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
            // Notificaciones: common.js las pinta en el menu superior.
            if ($path === '/api/historial/notificaciones') {
                $rows = db()->query(
                    "SELECT h.accion, h.descripcion, h.fecha, p.folio, u.nombre AS usuario_nombre
                 FROM historial_cambios h
                 LEFT JOIN partes p ON p.id_parte = h.id_parte
                 LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
                 WHERE h.accion IN ('EDITAR','ELIMINAR')
                 ORDER BY h.fecha DESC
                 LIMIT 12"
                )->fetchAll();
                out(['success' => true, 'data' => $rows]);
            }

            // Estadisticas: historial.js las usa para graficas y exportaciones.
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
                foreach ($records as &$record) {
                    $name = $record['usuario_nombre'] ?: 'Sistema';
                    $users[$name] = ($users[$name] ?? 0) + 1;
                    $record['usuario'] = $name;
                    $record['folios'] = activity_folios($record['detalle'] ?? null, $record['folio'] ?? null);
                    $record['usuario_creado'] = activity_created_user($record['detalle'] ?? null);
                    $record['lote'] = activity_batch($record['detalle'] ?? null);
                }
                unset($record);
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

            $historyAction = strtoupper(trim((string) ($apiQuery['accion'] ?? '')));
            $historyQuery = trim((string) ($apiQuery['q'] ?? ''));
            $where = [];
            $params = [];
            if (in_array($historyAction, ['CREAR', 'EDITAR', 'ELIMINAR', 'EXPORTAR'], true)) {
                $where[] = 'h.accion = ?';
                $params[] = $historyAction;
            }
            if ($historyQuery !== '') {
                $where[] = '(h.descripcion LIKE ? OR p.folio LIKE ? OR u.nombre LIKE ?)';
                $like = '%' . $historyQuery . '%';
                array_push($params, $like, $like, $like);
            }
            $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
            $stmt = db()->prepare(
                "SELECT h.*, p.folio, p.fecha AS parte_fecha, mp.nombre AS mp_nombre, u.nombre AS usuario_nombre,
                    u.imagen_perfil AS usuario_foto, enc.nombre AS encargado_nombre, enc.imagen_perfil AS encargado_foto
             FROM historial_cambios h
             LEFT JOIN partes p ON p.id_parte = h.id_parte
             LEFT JOIN ministerios_publicos mp ON mp.id_mp = p.id_mp
             LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
             LEFT JOIN usuarios enc ON enc.id_usuario = p.asignado_a
             {$whereSql}
             ORDER BY h.fecha DESC
             LIMIT 200"
            );
            $stmt->execute($params);
            $rows = $stmt->fetchAll();
            foreach ($rows as &$row) {
                $row['usuario_foto'] = asset_path($row['usuario_foto'] ?? null);
                $row['encargado_foto'] = asset_path($row['encargado_foto'] ?? null);
            }
            out(['success' => true, 'data' => $rows]);
        }

        fail('Ruta no encontrada: ' . $path, 404);
    } catch (Throwable $error) {
        fail($error->getMessage(), 500);
    }
    
