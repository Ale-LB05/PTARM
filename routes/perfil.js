const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
const storage = multer.diskStorage({
  // Guarda las fotos de perfil nuevas dentro de uploads/perfiles.
  destination: (req, file, cb) => cb(null, "./uploads/perfiles/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage });
let userCurpColumnReady = false;

async function ensureUserCurpColumn() {
  if (userCurpColumnReady) return;
  const [columns] = await db.query("SHOW COLUMNS FROM usuarios");
  if (!columns.some((column) => column.Field === "curp")) {
    await db.query("ALTER TABLE usuarios ADD COLUMN curp varchar(18) DEFAULT NULL AFTER correo");
  }
  userCurpColumnReady = true;
}

// Devuelve los datos del usuario actual y sus ultimos partes creados/asignados.
router.get("/", async (req, res) => {
  await ensureUserCurpColumn();
  const [[usuario]] = await db.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.curp, u.instituto, u.cargo_grado, u.imagen_perfil, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = ?`,
    [req.user.id],
  );

  const [partes] = await db.query(
    `SELECT p.folio, p.fecha, p.gravedad_general, p.estado, mp.nombre AS mp_nombre, r.nombre AS respondiente_nombre
     FROM partes p
     LEFT JOIN ministerios_publicos mp ON mp.id_mp = p.id_mp
     LEFT JOIN respondientes r ON r.id_respondiente = p.id_respondiente
     WHERE p.creado_por = ? OR p.asignado_a = ?
     ORDER BY p.fecha_creacion DESC
     LIMIT 8`,
    [req.user.id, req.user.id],
  );

  res.json({ success: true, data: { usuario, partes } });
});

// Actualiza solo el correo desde el modal de perfil.
router.patch("/correo", requireRole("Administrador"), async (req, res) => {
  await ensureUserCurpColumn();
  const correo = String(req.body.correo || "").trim();
  if (!correo) return res.status(400).json({ success: false, error: "Ingresa un correo valido" });

  await db.query("UPDATE usuarios SET correo = ? WHERE id_usuario = ?", [correo, req.user.id]);

  res.json({
    success: true,
    message: "Correo actualizado",
    usuario: { correo },
  });
});

// Actualiza solo la CURP desde el modal de perfil.
router.patch("/curp", requireRole("Administrador"), async (req, res) => {
  await ensureUserCurpColumn();
  const curp = String(req.body.curp || "").trim().toUpperCase();
  await db.query("UPDATE usuarios SET curp = ? WHERE id_usuario = ?", [curp || null, req.user.id]);

  res.json({
    success: true,
    message: "CURP actualizada",
    usuario: { curp },
  });
});

// Cambia solo la contrasena validando clave actual, longitud y confirmacion.
router.patch("/password", requireRole("Administrador"), async (req, res) => {
  const currentPassword = String(req.body.current_password || "");
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirm_password || "");
  if (!currentPassword) return res.status(400).json({ success: false, error: "Ingresa tu contraseña actual" });
  if (password.length < 6) return res.status(400).json({ success: false, error: "La contraseña debe tener al menos 6 caracteres" });
  if (password !== confirmPassword) return res.status(400).json({ success: false, error: "La confirmación no coincide" });

  const [[user]] = await db.query("SELECT password_hash FROM usuarios WHERE id_usuario = ? LIMIT 1", [req.user.id]);
  const isValid = user && await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) return res.status(400).json({ success: false, error: "La contraseña actual no es correcta" });

  await db.query("UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?", [await bcrypt.hash(password, 10), req.user.id]);

  res.json({ success: true, message: "Contraseña actualizada" });
});

// Ruta anterior para actualizar varios datos del perfil, conservada por compatibilidad.
router.post("/", requireRole("Administrador"), upload.single("imagen"), async (req, res) => {
  await ensureUserCurpColumn();
  const { nombre, correo, curp, password, instituto, cargo_grado } = req.body;
  const fields = ["nombre = ?", "correo = ?", "curp = ?", "instituto = ?", "cargo_grado = ?"];
  const params = [nombre, correo, curp ? String(curp).trim().toUpperCase() : null, instituto || null, cargo_grado || null];

  if (password) {
    fields.push("password_hash = ?");
    params.push(await bcrypt.hash(password, 10));
  }
  if (req.file) {
    fields.push("imagen_perfil = ?");
    params.push(`/uploads/perfiles/${req.file.filename}`);
  }

  params.push(req.user.id);
  await db.query(`UPDATE usuarios SET ${fields.join(", ")} WHERE id_usuario = ?`, params);

  const [[usuario]] = await db.query(
    `SELECT u.id_usuario AS id, u.nombre, u.correo, u.curp, u.instituto, u.cargo_grado AS cargo, u.imagen_perfil AS foto, r.nombre AS rol
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = ?`,
    [req.user.id],
  );

  res.json({
    success: true,
    message: "Perfil actualizado",
    usuario: {
      ...usuario,
      foto: usuario.foto || "/img/usuario.png",
    },
  });
});

module.exports = router;
