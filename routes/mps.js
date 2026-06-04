const express = require("express");
const db = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireRole("Administrador"));

/** Limpia texto de formularios para guardar NULL cuando el campo viene vacio. */
function nullable(value) {
  const clean = typeof value === "string" ? value.trim() : value;
  return clean === "" || clean === undefined ? null : clean;
}

/** Lista los MP activos que se administran desde el panel de Personal. */
router.get("/", async (req, res) => {
  const [rows] = await db.query(
    `SELECT id_mp, nombre, cargo_grado, activo
     FROM ministerios_publicos
     WHERE activo = 1
     ORDER BY nombre`,
  );
  res.json({ success: true, data: rows });
});

/** Crea un MP nuevo para que aparezca en el formulario de partes. */
router.post("/", async (req, res) => {
  const nombre = nullable(req.body.nombre);
  const cargoGrado = nullable(req.body.cargo_grado);

  if (!nombre) {
    return res.status(400).json({ success: false, error: "El nombre del MP es obligatorio" });
  }

  await db.query("INSERT INTO ministerios_publicos (nombre, cargo_grado, activo) VALUES (?, ?, 1)", [nombre, cargoGrado]);
  res.json({ success: true, message: "MP creado" });
});

/** Actualiza los datos visibles de un MP ya registrado. */
router.put("/:id", async (req, res) => {
  const nombre = nullable(req.body.nombre);
  const cargoGrado = nullable(req.body.cargo_grado);

  if (!nombre) {
    return res.status(400).json({ success: false, error: "El nombre del MP es obligatorio" });
  }

  await db.query("UPDATE ministerios_publicos SET nombre = ?, cargo_grado = ? WHERE id_mp = ?", [nombre, cargoGrado, req.params.id]);
  res.json({ success: true, message: "MP actualizado" });
});

/** Da de baja un MP sin borrar referencias historicas de partes ya capturados. */
router.delete("/:id", async (req, res) => {
  await db.query("UPDATE ministerios_publicos SET activo = 0 WHERE id_mp = ?", [req.params.id]);
  res.json({ success: true, message: "MP dado de baja" });
});

module.exports = router;
