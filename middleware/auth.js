const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "ptarm-local-secret";

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

module.exports = { auth, JWT_SECRET };
