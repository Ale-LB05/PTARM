<?php
require_once __DIR__ . '/../config/db.php';

session_destroy();
redirect_to('index.php');
