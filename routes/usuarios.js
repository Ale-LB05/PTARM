const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireRole } = require("../middleware/auth");
const { recordActivity } = require("../utils/activity");

const router = express.Router();
router.use(requireRole("Administrador"));
let userCurpColumnReady = false;

async function ensureUserCurpColumn() {
  if (userCurpColumnReady) return;
  const [columns] = await db.query("SHOW COLUMNS FROM usuarios");
  if (!columns.some((column) => column.Field === "curp")) {
    await db.query("ALTER TABLE usuarios ADD COLUMN curp varchar(18) DEFAULT NULL AFTER correo");
  }
  userCurpColumnReady = true;
}
const storage = multer.diskStorage({
  // Guarda imagenes de usuarios creadas desde el panel de personal.
  destination: (req, file, cb) => cb(null, "./uploads/perfiles/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage });

/** Devuelve la ruta publica de la foto subida o la imagen por defecto. */
function imagePath(file) {
  return file ? `/uploads/perfiles/${file.filename}` : "/img/usuario.png";
}

// Lista todos los usuarios para el panel de personal.
router.get("/", async (req, res) => {
  await ensureUserCurpColumn();
  const [rows] = await db.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.curp, u.instituto, u.cargo_grado, u.imagen_perfil, r.nombre AS rol, u.id_rol
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
     ORDER BY u.fecha_creacion DESC`,
  );
  res.json({ success: true, data: rows });
});

// Crea un usuario nuevo con rol, contraseña cifrada e imagen opcional.
router.post("/", upload.single("imagen"), async (req, res) => {
  await ensureUserCurpColumn();
  const { nombre, correo, curp, password, instituto, cargo_grado, id_rol } = req.body;
  if (!nombre || !correo || !password) {
    return res.status(400).json({ success: false, error: "Faltan datos obligatorios" });
  }

  const [result] = await db.query(
    `INSERT INTO usuarios (nombre, correo, curp, password_hash, instituto, cargo_grado, imagen_perfil, id_rol)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [nombre, correo, curp ? String(curp).trim().toUpperCase() : null, await bcrypt.hash(password, 10), instituto || null, cargo_grado || null, imagePath(req.file), id_rol || 2],
  );
  await recordActivity("CREACION_USUARIO", { idUsuario: req.user.id, detalle: `Usuario creado: ${correo} (#${result.insertId})` });
  res.json({ success: true, message: "Usuario creado" });
});

// Actualiza datos del usuario y cambia contraseña/foto solo si se enviaron.
router.put("/:id", upload.single("imagen"), async (req, res) => {
  await ensureUserCurpColumn();
  const { nombre, correo, curp, password, instituto, cargo_grado, id_rol } = req.body;
  const fields = ["nombre = ?", "correo = ?", "curp = ?", "instituto = ?", "cargo_grado = ?", "id_rol = ?"];
  const params = [nombre, correo, curp ? String(curp).trim().toUpperCase() : null, instituto || null, cargo_grado || null, id_rol || 2];

  if (password) {
    fields.push("password_hash = ?");
    params.push(await bcrypt.hash(password, 10));
  }
  if (req.file) {
    fields.push("imagen_perfil = ?");
    params.push(imagePath(req.file));
  }

  params.push(req.params.id);
  await db.query(`UPDATE usuarios SET ${fields.join(", ")} WHERE id_usuario = ?`, params);
  res.json({ success: true, message: "Usuario actualizado" });
});

// Elimina un usuario limpiando primero sus referencias en partes e historial.
router.delete("/:id", async (req, res) => {
  await db.query("UPDATE partes SET creado_por = NULL WHERE creado_por = ?", [req.params.id]);
  await db.query("UPDATE partes SET asignado_a = NULL WHERE asignado_a = ?", [req.params.id]);
  await db.query("UPDATE exportaciones SET id_usuario = NULL WHERE id_usuario = ?", [req.params.id]);
  await db.query("UPDATE historial_cambios SET id_usuario = NULL WHERE id_usuario = ?", [req.params.id]);
  await db.query("DELETE FROM usuarios WHERE id_usuario = ?", [req.params.id]);
  res.json({ success: true, message: "Usuario eliminado" });
});

module.exports = router;
