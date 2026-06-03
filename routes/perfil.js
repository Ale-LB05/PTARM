const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads/perfiles/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage });

router.get("/", async (req, res) => {
  const [[usuario]] = await db.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.instituto, u.cargo_grado, u.imagen_perfil, r.nombre AS rol
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

router.post("/", upload.single("imagen"), async (req, res) => {
  const { nombre, correo, password, instituto, cargo_grado } = req.body;
  const fields = ["nombre = ?", "correo = ?", "instituto = ?", "cargo_grado = ?"];
  const params = [nombre, correo, instituto || null, cargo_grado || null];

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
    `SELECT u.id_usuario AS id, u.nombre, u.correo, u.instituto, u.cargo_grado AS cargo, u.imagen_perfil AS foto, r.nombre AS rol
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
