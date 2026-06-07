-- Base de datos final simplificada para sistema local en PHP
-- Sistema: organizacion, creacion, edicion, consulta y exportacion de partes de transito.
-- Exportaciones contempladas: PDF, Excel y ZIP.

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

CREATE DATABASE IF NOT EXISTS `partesdetransito_local` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `partesdetransito_local`;

-- --------------------------------------------------------
-- Usuarios, roles y perfil
-- --------------------------------------------------------

CREATE TABLE `roles` (
  `id_rol` int(11) NOT NULL,
  `nombre` varchar(80) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `usuarios` (
  `id_usuario` int(11) NOT NULL,
  `nombre` varchar(160) NOT NULL,
  `correo` varchar(180) NOT NULL,
  `curp` varchar(18) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `instituto` varchar(180) DEFAULT NULL,
  `cargo_grado` varchar(180) DEFAULT NULL,
  `imagen_perfil` varchar(255) DEFAULT NULL,
  `id_rol` int(11) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `roles` (`id_rol`, `nombre`, `descripcion`) VALUES
(1, 'Administrador', 'Control total del sistema local'),
(2, 'Capturista', 'Creacion y edicion de partes'),
(3, 'Consulta', 'Consulta y exportacion de partes');

-- --------------------------------------------------------
-- Catalogos simples
-- --------------------------------------------------------

CREATE TABLE `ministerios_publicos` (
  `id_mp` int(11) NOT NULL,
  `nombre` varchar(180) NOT NULL,
  `cargo_grado` varchar(180) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `respondientes` (
  `id_respondiente` int(11) NOT NULL,
  `nombre` varchar(180) NOT NULL,
  `institucion` varchar(180) DEFAULT NULL,
  `cargo_grado` varchar(180) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Parte principal
-- --------------------------------------------------------

CREATE TABLE `partes` (
  `id_parte` bigint(20) NOT NULL,
  `folio` varchar(80) NOT NULL,
  `fecha` date DEFAULT NULL,
  `hora` time DEFAULT NULL,
  `id_mp` int(11) DEFAULT NULL,
  `id_respondiente` int(11) DEFAULT NULL,
  `estado` enum('Borrador','Activo','Cerrado','Archivado','Cancelado') NOT NULL DEFAULT 'Activo',
  `gravedad_general` enum('Sin clasificar','Bajo','Medio','Alto','Otro') NOT NULL DEFAULT 'Sin clasificar',
  `creado_por` int(11) DEFAULT NULL,
  `asignado_a` int(11) DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Vehiculos del parte
-- --------------------------------------------------------

CREATE TABLE `vehiculos` (
  `id_vehiculo` bigint(20) NOT NULL,
  `id_parte` bigint(20) NOT NULL,
  `numero_vehiculo` int(11) NOT NULL DEFAULT 1,
  `tipo_vehiculo` enum('Carro','Moto','Camioneta','Camion','Bicicleta','Otro') NOT NULL DEFAULT 'Carro',
  `marca` varchar(120) DEFAULT NULL,
  `modelo` varchar(120) DEFAULT NULL,
  `tipo` varchar(120) DEFAULT NULL,
  `numero_serie` varchar(120) DEFAULT NULL,
  `numero_placa` varchar(60) DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Resumen de personas involucradas por parte y/o vehiculo
-- --------------------------------------------------------

CREATE TABLE `personas_involucradas` (
  `id_personas_involucradas` bigint(20) NOT NULL,
  `id_parte` bigint(20) NOT NULL,
  `id_vehiculo` bigint(20) DEFAULT NULL,
  `numero_personas` int(11) DEFAULT NULL,
  `personas_fallecidas` tinyint(1) NOT NULL DEFAULT 0,
  `numero_fallecidos` int(11) DEFAULT NULL,
  `observacion_fallecidos` text DEFAULT NULL,
  `personas_heridas` tinyint(1) NOT NULL DEFAULT 0,
  `otros` tinyint(1) NOT NULL DEFAULT 0,
  `numero_heridos` int(11) DEFAULT NULL,
  `gravedad` enum('Sin clasificar','Bajo','Medio','Alto','Otro') NOT NULL DEFAULT 'Sin clasificar',
  `observaciones` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `personas_involucradas_detalle` (
  `id_persona_detalle` bigint(20) NOT NULL,
  `id_parte` bigint(20) NOT NULL,
  `id_vehiculo` bigint(20) DEFAULT NULL,
  `numero_vehiculo` int(11) DEFAULT NULL,
  `numero_persona` int(11) NOT NULL,
  `nombre` varchar(180) DEFAULT NULL,
  `tipo_participacion` enum('Conductor','Pasajero','Civil') NOT NULL DEFAULT 'Civil'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Exportaciones e historial
-- --------------------------------------------------------

CREATE TABLE `exportaciones` (
  `id_exportacion` bigint(20) NOT NULL,
  `id_parte` bigint(20) DEFAULT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  `tipo` enum('PDF','Excel','ZIP') NOT NULL,
  `nombre_archivo` varchar(255) DEFAULT NULL,
  `ruta_archivo` text DEFAULT NULL,
  `fecha_exportacion` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `historial_cambios` (
  `id_historial` bigint(20) NOT NULL,
  `id_parte` bigint(20) DEFAULT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  `accion` enum('CREAR','EDITAR','ELIMINAR','CONSULTAR','EXPORTAR') NOT NULL,
  `descripcion` text DEFAULT NULL,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `actividad_sistema` (
  `id_actividad` bigint(20) NOT NULL,
  `tipo_evento` enum('CREACION_PARTE','EDICION_PARTE','ELIMINACION_PARTE','CREACION_USUARIO','LOGIN','EXPORTACION') NOT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  `id_parte` bigint(20) DEFAULT NULL,
  `detalle` varchar(255) DEFAULT NULL,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `notificaciones_vistas` (
  `id_vista` bigint(20) NOT NULL,
  `id_usuario` int(11) NOT NULL,
  `id_historial` bigint(20) NOT NULL,
  `fecha_visto` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Llaves e indices
-- --------------------------------------------------------

ALTER TABLE `roles`
  ADD PRIMARY KEY (`id_rol`),
  ADD UNIQUE KEY `uk_roles_nombre` (`nombre`);

ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id_usuario`),
  ADD UNIQUE KEY `uk_usuarios_correo` (`correo`),
  ADD UNIQUE KEY `uk_usuarios_curp` (`curp`),
  ADD KEY `idx_usuarios_rol` (`id_rol`);

ALTER TABLE `ministerios_publicos`
  ADD PRIMARY KEY (`id_mp`);

ALTER TABLE `respondientes`
  ADD PRIMARY KEY (`id_respondiente`);

ALTER TABLE `partes`
  ADD PRIMARY KEY (`id_parte`),
  ADD UNIQUE KEY `uk_partes_folio` (`folio`),
  ADD KEY `idx_partes_fecha` (`fecha`),
  ADD KEY `idx_partes_estado` (`estado`),
  ADD KEY `idx_partes_gravedad` (`gravedad_general`),
  ADD KEY `idx_partes_mp` (`id_mp`),
  ADD KEY `idx_partes_respondiente` (`id_respondiente`),
  ADD KEY `idx_partes_creado_por` (`creado_por`),
  ADD KEY `idx_partes_asignado_a` (`asignado_a`);

ALTER TABLE `vehiculos`
  ADD PRIMARY KEY (`id_vehiculo`),
  ADD KEY `idx_vehiculos_parte` (`id_parte`),
  ADD KEY `idx_vehiculos_tipo_vehiculo` (`tipo_vehiculo`),
  ADD KEY `idx_vehiculos_placa` (`numero_placa`),
  ADD KEY `idx_vehiculos_serie` (`numero_serie`);

ALTER TABLE `personas_involucradas`
  ADD PRIMARY KEY (`id_personas_involucradas`),
  ADD KEY `idx_personas_parte` (`id_parte`),
  ADD KEY `idx_personas_vehiculo` (`id_vehiculo`),
  ADD KEY `idx_personas_gravedad` (`gravedad`);

ALTER TABLE `personas_involucradas_detalle`
  ADD PRIMARY KEY (`id_persona_detalle`),
  ADD KEY `idx_personas_detalle_parte` (`id_parte`),
  ADD KEY `idx_personas_detalle_vehiculo` (`id_vehiculo`);

ALTER TABLE `exportaciones`
  ADD PRIMARY KEY (`id_exportacion`),
  ADD KEY `idx_exportaciones_parte` (`id_parte`),
  ADD KEY `idx_exportaciones_usuario` (`id_usuario`),
  ADD KEY `idx_exportaciones_tipo` (`tipo`);

ALTER TABLE `historial_cambios`
  ADD PRIMARY KEY (`id_historial`),
  ADD KEY `idx_historial_parte` (`id_parte`),
  ADD KEY `idx_historial_usuario` (`id_usuario`);

ALTER TABLE `actividad_sistema`
  ADD PRIMARY KEY (`id_actividad`),
  ADD KEY `idx_actividad_tipo_fecha` (`tipo_evento`, `fecha`),
  ADD KEY `idx_actividad_usuario` (`id_usuario`),
  ADD KEY `idx_actividad_parte` (`id_parte`);

ALTER TABLE `notificaciones_vistas`
  ADD PRIMARY KEY (`id_vista`),
  ADD UNIQUE KEY `uk_notificaciones_usuario_historial` (`id_usuario`, `id_historial`),
  ADD KEY `idx_notificaciones_usuario` (`id_usuario`),
  ADD KEY `idx_notificaciones_historial` (`id_historial`);

-- --------------------------------------------------------
-- AUTO_INCREMENT
-- --------------------------------------------------------

ALTER TABLE `roles` MODIFY `id_rol` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
ALTER TABLE `usuarios` MODIFY `id_usuario` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `ministerios_publicos` MODIFY `id_mp` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `respondientes` MODIFY `id_respondiente` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `partes` MODIFY `id_parte` bigint(20) NOT NULL AUTO_INCREMENT;
ALTER TABLE `vehiculos` MODIFY `id_vehiculo` bigint(20) NOT NULL AUTO_INCREMENT;
ALTER TABLE `personas_involucradas` MODIFY `id_personas_involucradas` bigint(20) NOT NULL AUTO_INCREMENT;
ALTER TABLE `personas_involucradas_detalle` MODIFY `id_persona_detalle` bigint(20) NOT NULL AUTO_INCREMENT;
ALTER TABLE `exportaciones` MODIFY `id_exportacion` bigint(20) NOT NULL AUTO_INCREMENT;
ALTER TABLE `historial_cambios` MODIFY `id_historial` bigint(20) NOT NULL AUTO_INCREMENT;
ALTER TABLE `actividad_sistema` MODIFY `id_actividad` bigint(20) NOT NULL AUTO_INCREMENT;
ALTER TABLE `notificaciones_vistas` MODIFY `id_vista` bigint(20) NOT NULL AUTO_INCREMENT;

-- --------------------------------------------------------
-- Relaciones
-- --------------------------------------------------------

ALTER TABLE `usuarios`
  ADD CONSTRAINT `fk_usuarios_roles` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`) ON UPDATE CASCADE;

ALTER TABLE `partes`
  ADD CONSTRAINT `fk_partes_mp` FOREIGN KEY (`id_mp`) REFERENCES `ministerios_publicos` (`id_mp`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_partes_respondiente` FOREIGN KEY (`id_respondiente`) REFERENCES `respondientes` (`id_respondiente`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_partes_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_partes_asignado_a` FOREIGN KEY (`asignado_a`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `vehiculos`
  ADD CONSTRAINT `fk_vehiculos_parte` FOREIGN KEY (`id_parte`) REFERENCES `partes` (`id_parte`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `personas_involucradas`
  ADD CONSTRAINT `fk_personas_parte` FOREIGN KEY (`id_parte`) REFERENCES `partes` (`id_parte`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_personas_vehiculo` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculos` (`id_vehiculo`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `personas_involucradas_detalle`
  ADD CONSTRAINT `fk_personas_detalle_parte` FOREIGN KEY (`id_parte`) REFERENCES `partes` (`id_parte`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_personas_detalle_vehiculo` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculos` (`id_vehiculo`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `exportaciones`
  ADD CONSTRAINT `fk_exportaciones_parte` FOREIGN KEY (`id_parte`) REFERENCES `partes` (`id_parte`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_exportaciones_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `historial_cambios`
  ADD CONSTRAINT `fk_historial_parte` FOREIGN KEY (`id_parte`) REFERENCES `partes` (`id_parte`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_historial_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `notificaciones_vistas`
  ADD CONSTRAINT `fk_notificaciones_vistas_historial` FOREIGN KEY (`id_historial`) REFERENCES `historial_cambios` (`id_historial`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notificaciones_vistas_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
