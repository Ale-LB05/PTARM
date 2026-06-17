<?php
// Wrapper de compatibilidad: redirige /api/auth/status al router central.
$_GET['path'] = '/api/auth/status';
require_once __DIR__ . '/../../index.php';
