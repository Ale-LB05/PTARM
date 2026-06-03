const express = require("express");
const db = require("../db");

const router = express.Router();

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
       u.nombre AS usuario_nombre,
       u.imagen_perfil AS usuario_foto
     FROM historial_cambios h
     LEFT JOIN partes p ON p.id_parte = h.id_parte
     LEFT JOIN ministerios_publicos mp ON mp.id_mp = p.id_mp
     LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY h.fecha DESC, h.id_historial DESC
     LIMIT 250`,
    params,
  );

  res.json({ success: true, data: rows });
});

module.exports = router;
