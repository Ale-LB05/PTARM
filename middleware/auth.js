const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "ptarm-local-secret";

/** Valida el token Bearer y deja los datos del usuario en req.user. */
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "No autorizado" });
  }

  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Sesion expirada" });
  }
}

/** Unifica nombres de rol para comparar permisos sin depender del texto exacto. */
function normalizeRole(role = "") {
  const clean = String(role).trim().toLowerCase();
  if (clean === "admin") return "administrador";
  if (clean === "consulta") return "auxiliar";
  return clean;
}

/** Indica si el usuario pertenece a alguno de los roles permitidos. */
function canAccess(user, allowedRoles) {
  return allowedRoles.map(normalizeRole).includes(normalizeRole(user?.rol));
}

/** Middleware reutilizable para proteger rutas por rol. */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!canAccess(req.user, allowedRoles)) {
      return res.status(403).json({ success: false, error: "No tienes permiso para realizar esta accion" });
    }
    return next();
  };
}

module.exports = { auth, JWT_SECRET, normalizeRole, canAccess, requireRole };
