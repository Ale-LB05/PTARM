<?php
// Wrapper de compatibilidad: redirige /api/auth/login al router central.
$_GET['path'] = '/api/auth/login';
require_once __DIR__ . '/../../index.php';
