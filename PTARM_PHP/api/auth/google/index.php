<?php
// Wrapper de compatibilidad: redirige /api/auth/google al router central.
$_GET['path'] = '/api/auth/google';
require_once __DIR__ . '/../../index.php';
