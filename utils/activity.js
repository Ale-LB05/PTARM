const db = require("../db");

let activityTableReady = false;
let exportedPartsTableReady = false;

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

/** Conserva los folios que formaron parte de cada exportacion. */
async function ensureExportedPartsTable() {
  if (exportedPartsTableReady) return;
  await db.query(
    `CREATE TABLE IF NOT EXISTS actividad_exportaciones_partes (
      id_actividad bigint(20) NOT NULL,
      id_parte bigint(20) NOT NULL,
      folio varchar(100) DEFAULT NULL,
      PRIMARY KEY (id_actividad, id_parte),
      KEY idx_exportacion_parte (id_parte)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  exportedPartsTableReady = true;
}

/** Registra un evento sin interrumpir la accion principal si falla la estadistica. */
async function recordActivity(tipoEvento, { idUsuario = null, idParte = null, detalle = null } = {}) {
  try {
    await ensureActivityTable();
    const [result] = await db.query(
      "INSERT INTO actividad_sistema (tipo_evento, id_usuario, id_parte, detalle) VALUES (?, ?, ?, ?)",
      [tipoEvento, idUsuario, idParte, detalle],
    );
    return result.insertId;
  } catch (error) {
    console.warn("No se pudo registrar actividad_sistema:", error.message);
    return null;
  }
}

async function recordExportedParts(idActividad, partIds = []) {
  if (!idActividad) return;
  const ids = [...new Set(partIds.map(Number).filter(Number.isInteger))];
  if (!ids.length) return;
  await ensureExportedPartsTable();
  const [parts] = await db.query("SELECT id_parte, folio FROM partes WHERE id_parte IN (?)", [ids]);
  if (parts.length) {
    await db.query(
      "INSERT IGNORE INTO actividad_exportaciones_partes (id_actividad, id_parte, folio) VALUES ?",
      [parts.map((part) => [idActividad, part.id_parte, part.folio])],
    );
  }
}

module.exports = { ensureActivityTable, ensureExportedPartsTable, recordActivity, recordExportedParts };
