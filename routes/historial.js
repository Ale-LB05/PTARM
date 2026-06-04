const express = require("express");
const db = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireRole("Administrador", "Capturista", "Auxiliar"));

let notificationSeenTableReady = false;

/** Crea la tabla de vistos una sola vez para no borrar movimientos del historial. */
async function ensureNotificationSeenTable() {
  if (notificationSeenTableReady) return;
  await db.query(
    `CREATE TABLE IF NOT EXISTS notificaciones_vistas (
       id_vista bigint(20) NOT NULL AUTO_INCREMENT,
       id_usuario int(11) NOT NULL,
       id_historial bigint(20) NOT NULL,
       fecha_visto timestamp NOT NULL DEFAULT current_timestamp(),
       PRIMARY KEY (id_vista),
       UNIQUE KEY uk_notificaciones_usuario_historial (id_usuario, id_historial),
       KEY idx_notificaciones_usuario (id_usuario),
       KEY idx_notificaciones_historial (id_historial)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  notificationSeenTableReady = true;
}

// Notificaciones para partes creados por el usuario actual que otros editaron o eliminaron.
router.get("/notificaciones", async (req, res) => {
  try {
    await ensureNotificationSeenTable();
    const creatorMarker = `%creado_por:${req.user.id}%`;
    const [rows] = await db.query(
      `SELECT
         h.id_historial,
         h.id_parte,
         h.accion,
         h.descripcion,
         h.fecha,
         p.folio,
         u.nombre AS usuario_nombre,
         u.imagen_perfil AS usuario_foto
       FROM historial_cambios h
       LEFT JOIN partes p ON p.id_parte = h.id_parte
       LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
       WHERE h.accion IN ('EDITAR', 'ELIMINAR')
         AND h.id_usuario <> ?
         AND (p.creado_por = ? OR h.descripcion LIKE ?)
         AND NOT EXISTS (
           SELECT 1
           FROM notificaciones_vistas nv
           WHERE nv.id_usuario = ?
             AND nv.id_historial = h.id_historial
         )
       ORDER BY h.fecha DESC, h.id_historial DESC
       LIMIT 2`,
      [req.user.id, req.user.id, creatorMarker, req.user.id],
    );

    if (rows.length) {
      const seenRows = rows.map((row) => [req.user.id, row.id_historial]);
      await db.query("INSERT IGNORE INTO notificaciones_vistas (id_usuario, id_historial) VALUES ?", [seenRows]);
    }

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error al cargar notificaciones", error);
    return res.status(500).json({ success: false, error: "No se pudieron cargar las notificaciones" });
  }
});

// Lista movimientos del historial con filtros por accion, folio, usuario, MP o fecha.
router.get("/", async (req, res) => {
  const accion = (req.query.accion || "").trim().toUpperCase();
  const q = `%${(req.query.q || "").trim()}%`;
  const params = [];
  const where = [];

  if (["CREAR", "EDITAR", "ELIMINAR", "EXPORTAR"].includes(accion)) {
    where.push("h.accion = ?");
    params.push(accion);
  }

  if (q !== "%%") {
    where.push(
      `(p.folio LIKE ? OR u.nombre LIKE ? OR mp.nombre LIKE ? OR h.descripcion LIKE ? OR DATE_FORMAT(h.fecha, '%d/%m/%Y') LIKE ?)`,
    );
    params.push(q, q, q, q, q);
  }

  const [rows] = await db.query(
    `SELECT
       h.id_historial,
       h.id_parte,
       h.accion,
       h.descripcion,
       h.fecha,
       p.folio,
       p.hora AS parte_hora,
       mp.nombre AS mp_nombre,
       encargado.nombre AS encargado_nombre,
       encargado.imagen_perfil AS encargado_foto,
       u.nombre AS usuario_nombre,
       u.imagen_perfil AS usuario_foto
     FROM historial_cambios h
     LEFT JOIN partes p ON p.id_parte = h.id_parte
     LEFT JOIN ministerios_publicos mp ON mp.id_mp = p.id_mp
     LEFT JOIN usuarios encargado ON encargado.id_usuario = p.asignado_a
     LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY h.fecha DESC, h.id_historial DESC
     LIMIT 250`,
    params,
  );

  res.json({ success: true, data: rows });
});

module.exports = router;
