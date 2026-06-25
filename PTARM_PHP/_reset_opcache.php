<?php
// Utilidad local para limpiar OPcache cuando XAMPP conserva codigo PHP antiguo.
if (function_exists('opcache_reset')) {
    opcache_reset();
}
echo 'ok';
