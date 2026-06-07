const db = require("../db");

let activityTableReady = false;

/** Crea la tabla de eventos que alimenta estadisticas mensuales. */
async function ensureActivityTable() {
  if (activityTableReady) return;
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
  activityTableReady = true;
}

/** Registra un evento sin interrumpir la accion principal si falla la estadistica. */
async function recordActivity(tipoEvento, { idUsuario = null, idParte = null, detalle = null } = {}) {
  try {
    await ensureActivityTable();
    await db.query(
      "INSERT INTO actividad_sistema (tipo_evento, id_usuario, id_parte, detalle) VALUES (?, ?, ?, ?)",
      [tipoEvento, idUsuario, idParte, detalle],
    );
  } catch (error) {
    console.warn("No se pudo registrar actividad_sistema:", error.message);
  }
}

module.exports = { ensureActivityTable, recordActivity };
