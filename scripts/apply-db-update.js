const db = require("../db");

async function hasColumn(table, column) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\``);
  return rows.some((row) => row.Field === column);
}

async function hasIndex(table, index) {
  const [rows] = await db.query(`SHOW INDEX FROM \`${table}\``);
  return rows.some((row) => row.Key_name === index);
}

async function addColumnIfMissing(table, column, definition) {
  if (!(await hasColumn(table, column))) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
    console.log(`Columna agregada: ${table}.${column}`);
  }
}

async function addIndexIfMissing(table, index, definition) {
  if (!(await hasIndex(table, index))) {
    await db.query(`ALTER TABLE \`${table}\` ADD ${definition}`);
    console.log(`Indice agregado: ${table}.${index}`);
  }
}

async function main() {
  await addColumnIfMissing("usuarios", "curp", "`curp` varchar(18) DEFAULT NULL AFTER `correo`");
  await addIndexIfMissing("usuarios", "uk_usuarios_curp", "UNIQUE KEY `uk_usuarios_curp` (`curp`)");

  await addColumnIfMissing(
    "vehiculos",
    "tipo_vehiculo",
    "`tipo_vehiculo` enum('Carro','Moto','Camioneta','Camion','Bicicleta','Otro') NOT NULL DEFAULT 'Carro' AFTER `numero_vehiculo`",
  );
  await addIndexIfMissing("vehiculos", "idx_vehiculos_tipo_vehiculo", "KEY `idx_vehiculos_tipo_vehiculo` (`tipo_vehiculo`)");

  await db.query(
    `CREATE TABLE IF NOT EXISTS personas_involucradas_detalle (
      id_persona_detalle bigint(20) NOT NULL AUTO_INCREMENT,
      id_parte bigint(20) NOT NULL,
      id_vehiculo bigint(20) DEFAULT NULL,
      numero_vehiculo int(11) DEFAULT NULL,
      numero_persona int(11) NOT NULL,
      nombre varchar(180) DEFAULT NULL,
      tipo_participacion enum('Conductor','Pasajero','Civil') NOT NULL DEFAULT 'Civil',
      PRIMARY KEY (id_persona_detalle),
      KEY idx_personas_detalle_parte (id_parte),
      KEY idx_personas_detalle_vehiculo (id_vehiculo),
      CONSTRAINT fk_personas_detalle_parte FOREIGN KEY (id_parte) REFERENCES partes (id_parte) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_personas_detalle_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos (id_vehiculo) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  await addColumnIfMissing("personas_involucradas_detalle", "numero_vehiculo", "`numero_vehiculo` int(11) DEFAULT NULL AFTER `id_vehiculo`");
  console.log("Tabla lista: personas_involucradas_detalle");

  await db.query(
    `CREATE TABLE IF NOT EXISTS actividad_sistema (
      id_actividad bigint(20) NOT NULL AUTO_INCREMENT,
      tipo_evento enum('CREACION_PARTE','EDICION_PARTE','ELIMINACION_PARTE','CREACION_USUARIO','LOGIN','EXPORTACION') NOT NULL,
      id_usuario int(11) DEFAULT NULL,
      id_parte bigint(20) DEFAULT NULL,
      detalle varchar(255) DEFAULT NULL,
      fecha timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id_actividad),
      KEY idx_actividad_tipo_fecha (tipo_evento, fecha),
      KEY idx_actividad_usuario (id_usuario),
      KEY idx_actividad_parte (id_parte)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  console.log("Tabla lista: actividad_sistema");
}

main()
  .then(async () => {
    console.log("Actualizacion de base de datos completada.");
    await db.end();
  })
  .catch(async (error) => {
    console.error("No se pudo aplicar la actualizacion:", error.message);
    await db.end();
    process.exit(1);
  });
