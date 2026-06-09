const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { JWT_SECRET, normalizeRole } = require("../middleware/auth");
const { recordActivity } = require("../utils/activity");

const router = express.Router();
let userCurpColumnReady = false;
let googleAuthColumnsReady = false;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/auth/google/callback";

/** Asegura columna CURP para bases existentes. */
async function ensureUserCurpColumn() {
  if (userCurpColumnReady) return;
  const [columns] = await db.query("SHOW COLUMNS FROM usuarios");
  if (!columns.some((column) => column.Field === "curp")) {
    await db.query("ALTER TABLE usuarios ADD COLUMN curp varchar(18) DEFAULT NULL AFTER correo");
  }
  userCurpColumnReady = true;
}

/** Asegura columnas para vincular usuarios locales con Google OAuth. */
async function ensureGoogleAuthColumns() {
  if (googleAuthColumnsReady) return;
  const [columns] = await db.query("SHOW COLUMNS FROM usuarios");
  const names = new Set(columns.map((column) => column.Field));
  if (!names.has("google_id")) {
    await db.query("ALTER TABLE usuarios ADD COLUMN google_id varchar(128) DEFAULT NULL AFTER curp");
  }
  if (!names.has("auth_provider")) {
    await db.query("ALTER TABLE usuarios ADD COLUMN auth_provider varchar(30) NOT NULL DEFAULT 'local' AFTER google_id");
  }
  googleAuthColumnsReady = true;
}

/** Devuelve solo los datos publicos del usuario para token y localStorage. */
function publicUser(user) {
  const role = normalizeRole(user.rol_nombre || user.rol || "");
  return {
    id: user.id_usuario,
    nombre: user.nombre,
    correo: user.correo,
    curp: user.curp || "",
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
  await ensureUserCurpColumn();
  const [[row]] = await db.query("SELECT COUNT(*) AS total FROM usuarios");
  res.json({ success: true, hasUsers: row.total > 0 });
});

// Crea el administrador inicial y los roles base cuando no hay usuarios.
router.post("/setup-admin", async (req, res) => {
  await ensureUserCurpColumn();
  const { nombre, correo, curp, password, instituto, cargo_grado } = req.body;
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
    `INSERT INTO usuarios (nombre, correo, curp, password_hash, instituto, cargo_grado, imagen_perfil, id_rol)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [nombre, correo, curp ? String(curp).trim().toUpperCase() : null, hash, instituto || null, cargo_grado || null, "/img/usuario.png"],
  );
  await recordActivity("CREACION_USUARIO", { detalle: `Administrador inicial: ${correo}` });

  res.json({ success: true, message: "Administrador creado" });
});

// Inicia el flujo OAuth de Google. Requiere configurar GOOGLE_CLIENT_ID y callback en Google Cloud.
router.get("/google", async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).send("Google OAuth no esta configurado. Agrega GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.");
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Recibe el codigo de Google, valida el correo contra usuarios locales y genera la sesion PTARM.
router.get("/google/callback", async (req, res) => {
  await ensureUserCurpColumn();
  await ensureGoogleAuthColumns();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect("/?googleError=missing_config");
  }
  const code = String(req.query.code || "");
  if (!code) return res.redirect("/?googleError=no_code");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) return res.redirect("/?googleError=token");

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const email = String(profile.email || "").trim().toLowerCase();
    const googleId = String(profile.sub || "");
    if (!profileRes.ok || !email || !googleId) return res.redirect("/?googleError=profile");

    const [rows] = await db.query(
      `SELECT u.*, r.nombre AS rol_nombre
       FROM usuarios u
       INNER JOIN roles r ON r.id_rol = u.id_rol
       WHERE (LOWER(u.correo) = ? OR u.google_id = ?) AND u.activo = 1
       LIMIT 1`,
      [email, googleId],
    );
    const user = rows[0];
    if (!user) return res.redirect("/?googleError=user_not_allowed");

    if (!user.google_id || user.auth_provider !== "google") {
      await db.query("UPDATE usuarios SET google_id = ?, auth_provider = 'google' WHERE id_usuario = ?", [googleId, user.id_usuario]);
      user.google_id = googleId;
      user.auth_provider = "google";
    }

    const data = publicUser(user);
    const token = jwt.sign(data, JWT_SECRET, { expiresIn: "8h" });
    await recordActivity("LOGIN", { idUsuario: user.id_usuario, detalle: `Inicio de sesion con Google: ${user.correo}` });
    return res.send(`<!doctype html><html><body><script>
      localStorage.setItem("token", ${JSON.stringify(token)});
      localStorage.setItem("usuario", ${JSON.stringify(JSON.stringify(data))});
      location.href = "/inicio.html";
    </script></body></html>`);
  } catch (error) {
    console.error("Error en Google OAuth", error);
    return res.redirect("/?googleError=server");
  }
});

// Valida credenciales, genera el JWT y devuelve la sesion al navegador.
router.post("/login", async (req, res) => {
  await ensureUserCurpColumn();
  const usuario = (req.body.usuario || req.body.correo || "").trim();
  const password = (req.body.password || "").trim();

  const [rows] = await db.query(
    `SELECT u.*, r.nombre AS rol_nombre
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
     WHERE (u.correo = ? OR u.curp = ?) AND u.activo = 1
     LIMIT 1`,
    [usuario, usuario.toUpperCase()],
  );

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, normalizeHash(user.password_hash)))) {
    return res.status(401).json({ success: false, error: "Credenciales invalidas" });
  }

  const data = publicUser(user);
  const token = jwt.sign(data, JWT_SECRET, { expiresIn: "8h" });
  await recordActivity("LOGIN", { idUsuario: user.id_usuario, detalle: `Inicio de sesion: ${user.correo}` });
  res.json({ success: true, token, usuario: data });
});

module.exports = router;
