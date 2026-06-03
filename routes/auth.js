const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { JWT_SECRET, normalizeRole } = require("../middleware/auth");

const router = express.Router();

/** Devuelve solo los datos publicos del usuario para token y localStorage. */
function publicUser(user) {
  const role = normalizeRole(user.rol_nombre || user.rol || "");
  return {
    id: user.id_usuario,
    nombre: user.nombre,
    correo: user.correo,
    instituto: user.instituto || "",
    cargo: user.cargo_grado || "",
    rol: role === "auxiliar" ? "Auxiliar" : user.rol_nombre || user.rol || "",
    foto: user.imagen_perfil || "/img/usuario.png",
  };
}

/** Convierte hashes $2y$ a $2a$ para que bcryptjs pueda compararlos. */
function normalizeHash(hash) {
  return hash && hash.startsWith("$2y$") ? "$2a$" + hash.slice(4) : hash;
}

// Indica al frontend si debe mostrar login o configuracion inicial.
router.get("/status", async (req, res) => {
  const [[row]] = await db.query("SELECT COUNT(*) AS total FROM usuarios");
  res.json({ success: true, hasUsers: row.total > 0 });
});

// Crea el administrador inicial y los roles base cuando no hay usuarios.
router.post("/setup-admin", async (req, res) => {
  const { nombre, correo, password, instituto, cargo_grado } = req.body;
  const [[row]] = await db.query("SELECT COUNT(*) AS total FROM usuarios");
  if (row.total > 0) {
    return res.status(403).json({ success: false, error: "El administrador inicial ya existe" });
  }

  if (!nombre || !correo || !password) {
    return res.status(400).json({ success: false, error: "Nombre, correo y contrasena son obligatorios" });
  }

  await db.query(
    `INSERT IGNORE INTO roles (id_rol, nombre, descripcion)
     VALUES (1, 'Administrador', 'Control total'), (2, 'Capturista', 'Consulta de partes'), (3, 'Auxiliar', 'Gestion y exportacion de partes')`,
  );

  const hash = await bcrypt.hash(password, 10);
  await db.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, instituto, cargo_grado, imagen_perfil, id_rol)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [nombre, correo, hash, instituto || null, cargo_grado || null, "/img/usuario.png"],
  );

  res.json({ success: true, message: "Administrador creado" });
});

// Valida credenciales, genera el JWT y devuelve la sesion al navegador.
router.post("/login", async (req, res) => {
  const correo = (req.body.correo || "").trim();
  const password = (req.body.password || "").trim();

  const [rows] = await db.query(
    `SELECT u.*, r.nombre AS rol_nombre
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.correo = ? AND u.activo = 1
     LIMIT 1`,
    [correo],
  );

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, normalizeHash(user.password_hash)))) {
    return res.status(401).json({ success: false, error: "Credenciales invalidas" });
  }

  const data = publicUser(user);
  const token = jwt.sign(data, JWT_SECRET, { expiresIn: "8h" });
  res.json({ success: true, token, usuario: data });
});

module.exports = router;
