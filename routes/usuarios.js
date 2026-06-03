const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireRole("Administrador"));
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
  const [rows] = await db.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.instituto, u.cargo_grado, u.imagen_perfil, r.nombre AS rol, u.id_rol
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
     ORDER BY u.fecha_creacion DESC`,
  );
  res.json({ success: true, data: rows });
});

// Crea un usuario nuevo con rol, contraseña cifrada e imagen opcional.
router.post("/", upload.single("imagen"), async (req, res) => {
  const { nombre, correo, password, instituto, cargo_grado, id_rol } = req.body;
  if (!nombre || !correo || !password) {
    return res.status(400).json({ success: false, error: "Faltan datos obligatorios" });
  }

  await db.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, instituto, cargo_grado, imagen_perfil, id_rol)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nombre, correo, await bcrypt.hash(password, 10), instituto || null, cargo_grado || null, imagePath(req.file), id_rol || 2],
  );
  res.json({ success: true, message: "Usuario creado" });
});

// Actualiza datos del usuario y cambia contraseña/foto solo si se enviaron.
router.put("/:id", upload.single("imagen"), async (req, res) => {
  const { nombre, correo, password, instituto, cargo_grado, id_rol } = req.body;
  const fields = ["nombre = ?", "correo = ?", "instituto = ?", "cargo_grado = ?", "id_rol = ?"];
  const params = [nombre, correo, instituto || null, cargo_grado || null, id_rol || 2];

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
