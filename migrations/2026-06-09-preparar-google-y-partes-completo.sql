USE `partesdetransito_local`;

-- Actualizacion final para dejar PTARM listo:
-- - Login con correo, CURP o Google OAuth.
-- - Leaflet/OpenStreetMap por kilometro/ubicacion en partes.
-- - Vehiculos con clase formal, corralon, estatus y danos.
-- - Personas involucradas individuales.
-- - Estadisticas mensuales.
--
-- Despues de correr este SQL, solo falta colocar las llaves de Google OAuth en .env:
-- GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.

DELIMITER //

DROP PROCEDURE IF EXISTS ptarm_add_column_if_missing//
CREATE PROCEDURE ptarm_add_column_if_missing(
  IN table_name_value varchar(64),
  IN column_name_value varchar(64),
  IN column_definition text
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND COLUMN_NAME = column_name_value
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', table_name_value, '` ADD COLUMN ', column_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DROP PROCEDURE IF EXISTS ptarm_add_index_if_missing//
CREATE PROCEDURE ptarm_add_index_if_missing(
  IN table_name_value varchar(64),
  IN index_name_value varchar(64),
  IN index_definition text
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND INDEX_NAME = index_name_value
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', table_name_value, '` ADD ', index_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DROP PROCEDURE IF EXISTS ptarm_add_fk_if_missing//
CREATE PROCEDURE ptarm_add_fk_if_missing(
  IN table_name_value varchar(64),
  IN constraint_name_value varchar(64),
  IN constraint_definition text
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND CONSTRAINT_NAME = constraint_name_value
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', table_name_value, '` ADD CONSTRAINT `', constraint_name_value, '` ', constraint_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DELIMITER ;

-- Usuarios: CURP y vinculacion Google OAuth.
CALL ptarm_add_column_if_missing('usuarios', 'curp', '`curp` varchar(18) DEFAULT NULL AFTER `correo`');
CALL ptarm_add_column_if_missing('usuarios', 'google_id', '`google_id` varchar(128) DEFAULT NULL AFTER `curp`');
CALL ptarm_add_column_if_missing('usuarios', 'auth_provider', '`auth_provider` varchar(30) NOT NULL DEFAULT ''local'' AFTER `google_id`');
UPDATE `usuarios` SET `auth_provider` = 'local' WHERE `auth_provider` IS NULL OR `auth_provider` = '';
CALL ptarm_add_index_if_missing('usuarios', 'uk_usuarios_curp', 'UNIQUE KEY `uk_usuarios_curp` (`curp`)');
CALL ptarm_add_index_if_missing('usuarios', 'uk_usuarios_google_id', 'UNIQUE KEY `uk_usuarios_google_id` (`google_id`)');

-- Partes: motivo y ubicacion OpenStreetMap/Leaflet.
CALL ptarm_add_column_if_missing('partes', 'tipo_parte', '`tipo_parte` varchar(80) DEFAULT NULL AFTER `folio`');
CALL ptarm_add_column_if_missing('partes', 'ubicacion_kilometro', '`ubicacion_kilometro` varchar(120) DEFAULT NULL AFTER `hora`');
CALL ptarm_add_column_if_missing('partes', 'ubicacion_direccion', '`ubicacion_direccion` varchar(255) DEFAULT NULL AFTER `ubicacion_kilometro`');
CALL ptarm_add_column_if_missing('partes', 'ubicacion_lat', '`ubicacion_lat` decimal(10,7) DEFAULT NULL AFTER `ubicacion_direccion`');
CALL ptarm_add_column_if_missing('partes', 'ubicacion_lng', '`ubicacion_lng` decimal(10,7) DEFAULT NULL AFTER `ubicacion_lat`');
CALL ptarm_add_column_if_missing('partes', 'google_place_id', '`google_place_id` varchar(180) DEFAULT NULL AFTER `ubicacion_lng`');
CALL ptarm_add_index_if_missing('partes', 'idx_partes_ubicacion', 'KEY `idx_partes_ubicacion` (`ubicacion_lat`, `ubicacion_lng`)');

-- Catalogo de corralones.
CREATE TABLE IF NOT EXISTS `corralones` (
  `id_corralon` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `telefono` varchar(40) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_corralon`),
  UNIQUE KEY `uk_corralones_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vehiculos: clase, corralon, estatus y danos.
CALL ptarm_add_column_if_missing('vehiculos', 'tipo_vehiculo', '`tipo_vehiculo` enum(''Vehiculo'',''Moto'',''Camioneta'',''Camion'',''Bicicleta'',''Otro'') NOT NULL DEFAULT ''Vehiculo'' AFTER `numero_vehiculo`');
ALTER TABLE `vehiculos` MODIFY COLUMN `tipo_vehiculo` enum('Carro','Vehiculo','Moto','Camioneta','Camion','Bicicleta','Otro') NOT NULL DEFAULT 'Vehiculo';
UPDATE `vehiculos` SET `tipo_vehiculo` = 'Vehiculo' WHERE `tipo_vehiculo` = 'Carro' OR `tipo_vehiculo` IS NULL OR `tipo_vehiculo` = '';
ALTER TABLE `vehiculos` MODIFY COLUMN `tipo_vehiculo` enum('Vehiculo','Moto','Camioneta','Camion','Bicicleta','Otro') NOT NULL DEFAULT 'Vehiculo';

CALL ptarm_add_column_if_missing('vehiculos', 'corralon', '`corralon` varchar(180) DEFAULT NULL AFTER `numero_placa`');
CALL ptarm_add_column_if_missing('vehiculos', 'id_corralon', '`id_corralon` int(11) DEFAULT NULL AFTER `corralon`');
CALL ptarm_add_column_if_missing('vehiculos', 'estatus_vehiculo', '`estatus_vehiculo` varchar(80) DEFAULT NULL AFTER `id_corralon`');
CALL ptarm_add_column_if_missing('vehiculos', 'danos_vehiculo', '`danos_vehiculo` text DEFAULT NULL AFTER `estatus_vehiculo`');
CALL ptarm_add_index_if_missing('vehiculos', 'idx_vehiculos_tipo_vehiculo', 'KEY `idx_vehiculos_tipo_vehiculo` (`tipo_vehiculo`)');
CALL ptarm_add_index_if_missing('vehiculos', 'idx_vehiculos_corralon', 'KEY `idx_vehiculos_corralon` (`id_corralon`)');
UPDATE `vehiculos` v
LEFT JOIN `corralones` c ON c.`id_corralon` = v.`id_corralon`
SET v.`id_corralon` = NULL
WHERE v.`id_corralon` IS NOT NULL AND c.`id_corralon` IS NULL;
CALL ptarm_add_fk_if_missing('vehiculos', 'fk_vehiculos_corralon', 'FOREIGN KEY (`id_corralon`) REFERENCES `corralones` (`id_corralon`) ON DELETE SET NULL ON UPDATE CASCADE');

-- Personas involucradas generales e individuales.
CALL ptarm_add_column_if_missing('personas_involucradas', 'numero_fallecidos', '`numero_fallecidos` int(11) DEFAULT NULL AFTER `personas_fallecidas`');
CALL ptarm_add_column_if_missing('personas_involucradas', 'observacion_fallecidos', '`observacion_fallecidos` text DEFAULT NULL AFTER `numero_fallecidos`');

CREATE TABLE IF NOT EXISTS `personas_involucradas_detalle` (
  `id_persona_detalle` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_parte` bigint(20) NOT NULL,
  `id_vehiculo` bigint(20) DEFAULT NULL,
  `numero_vehiculo` int(11) DEFAULT NULL,
  `numero_persona` int(11) NOT NULL,
  `nombre` varchar(180) DEFAULT NULL,
  `tipo_participacion` enum('Conductor','Pasajero','Civil') NOT NULL DEFAULT 'Civil',
  PRIMARY KEY (`id_persona_detalle`),
  KEY `idx_personas_detalle_parte` (`id_parte`),
  KEY `idx_personas_detalle_vehiculo` (`id_vehiculo`),
  CONSTRAINT `fk_personas_detalle_parte` FOREIGN KEY (`id_parte`) REFERENCES `partes` (`id_parte`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_personas_detalle_vehiculo` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculos` (`id_vehiculo`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CALL ptarm_add_column_if_missing('personas_involucradas_detalle', 'numero_vehiculo', '`numero_vehiculo` int(11) DEFAULT NULL AFTER `id_vehiculo`');

-- Estadisticas mensuales.
CREATE TABLE IF NOT EXISTS `actividad_sistema` (
  `id_actividad` bigint(20) NOT NULL AUTO_INCREMENT,
  `tipo_evento` enum('CREACION_PARTE','EDICION_PARTE','ELIMINACION_PARTE','CREACION_USUARIO','LOGIN','EXPORTACION') NOT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  `id_parte` bigint(20) DEFAULT NULL,
  `detalle` varchar(255) DEFAULT NULL,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_actividad`),
  KEY `idx_actividad_tipo_fecha` (`tipo_evento`, `fecha`),
  KEY `idx_actividad_usuario` (`id_usuario`),
  KEY `idx_actividad_parte` (`id_parte`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS ptarm_add_column_if_missing;
DROP PROCEDURE IF EXISTS ptarm_add_index_if_missing;
DROP PROCEDURE IF EXISTS ptarm_add_fk_if_missing;
