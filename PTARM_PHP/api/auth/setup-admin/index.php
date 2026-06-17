<?php
// Wrapper de compatibilidad: redirige /api/auth/setup-admin al router central.
$_GET['path'] = '/api/auth/setup-admin';
require_once __DIR__ . '/../../index.php';
