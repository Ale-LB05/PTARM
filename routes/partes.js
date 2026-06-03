const express = require("express");
const db = require("../db");
const { canAccess } = require("../middleware/auth");

const router = express.Router();

/** Permite modificar partes solo a Administrador y Capturista. */
function requirePartesWrite(req, res, next) {
  if (!canAccess(req.user, ["Administrador", "Capturista"])) {
    return res.status(403).json({ success: false, error: "No tienes permiso para modificar partes" });
  }
  return next();
}

/** Permite registrar exportaciones a roles autorizados para exportar. */
function requirePartesExport(req, res, next) {
  if (!canAccess(req.user, ["Administrador", "Capturista", "Auxiliar"])) {
    return res.status(403).json({ success: false, error: "No tienes permiso para exportar partes" });
  }
  return next();
}

/** Convierte cadenas vacias o valores indefinidos a NULL para la base de datos. */
function nullable(value) {
  const clean = typeof value === "string" ? value.trim() : value;
  return clean === "" || clean === undefined ? null : clean;
}

/** Busca un MP/respondiente por nombre o lo crea si todavia no existe. */
async function findOrCreate(table, idColumn, nombre) {
  const clean = nullable(nombre);
  if (!clean) return null;

  const [rows] = await db.query(`SELECT ${idColumn} AS id FROM ${table} WHERE nombre = ? LIMIT 1`, [clean]);
  if (rows[0]) return rows[0].id;

  const [result] = await db.query(`INSERT INTO ${table} (nombre) VALUES (?)`, [clean]);
  return result.insertId;
}

/** Obtiene un parte completo con MP, respondiente, encargado, personas y vehiculos. */
async function getPartById(id) {
  const [rows] = await db.query(
    `SELECT
       p.*,
       mp.nombre AS mp_nombre,
       r.nombre AS respondiente_nombre,
       u.nombre AS encargado_nombre,
       u.imagen_perfil AS encargado_foto,
       pi.numero_personas,
       pi.personas_fallecidas,
       pi.personas_heridas,
       pi.otros,
       pi.numero_heridos,
       pi.gravedad,
       pi.observaciones
     FROM partes p
     LEFT JOIN ministerios_publicos mp ON mp.id_mp = p.id_mp
     LEFT JOIN respondientes r ON r.id_respondiente = p.id_respondiente
     LEFT JOIN usuarios u ON u.id_usuario = p.asignado_a
     LEFT JOIN personas_involucradas pi ON pi.id_parte = p.id_parte
     WHERE p.id_parte = ?
     LIMIT 1`,
    [id],
  );
  const parte = rows[0] || null;
  if (!parte) return null;

  const [vehiculos] = await db.query(
    `SELECT id_vehiculo, numero_vehiculo, marca, modelo, tipo, numero_serie, numero_placa
     FROM vehiculos
     WHERE id_parte = ?
     ORDER BY numero_vehiculo, id_vehiculo`,
    [id],
  );
  parte.vehiculos = vehiculos;
  const firstVehicle = vehiculos[0];
  if (firstVehicle) {
    parte.id_vehiculo = firstVehicle.id_vehiculo;
    parte.marca = firstVehicle.marca;
    parte.modelo = firstVehicle.modelo;
    parte.tipo = firstVehicle.tipo;
    parte.numero_serie = firstVehicle.numero_serie;
    parte.numero_placa = firstVehicle.numero_placa;
  }
  return parte;
}

// Lista partes resumidos para tablas, tarjetas, inicio y modal de exportacion.
router.get("/", async (req, res) => {
  const q = `%${(req.query.q || "").trim()}%`;
  const hasSearch = q !== "%%";
  const params = hasSearch ? [q, q, q, q, q, q] : [];
  const where = hasSearch
    ? `WHERE p.folio LIKE ? OR mp.nombre LIKE ? OR r.nombre LIKE ? OR u.nombre LIKE ? OR v.numero_placa LIKE ? OR v.numero_serie LIKE ?`
    : "";

  const [rows] = await db.query(
    `SELECT
       p.id_parte,
       p.folio,
       p.fecha,
       p.hora,
       p.estado,
       p.gravedad_general,
       mp.nombre AS mp_nombre,
       r.nombre AS respondiente_nombre,
       u.nombre AS encargado_nombre,
       u.imagen_perfil AS encargado_foto
     FROM partes p
     LEFT JOIN ministerios_publicos mp ON mp.id_mp = p.id_mp
     LEFT JOIN respondientes r ON r.id_respondiente = p.id_respondiente
     LEFT JOIN usuarios u ON u.id_usuario = p.asignado_a
     LEFT JOIN vehiculos v ON v.id_parte = p.id_parte
     ${where}
     GROUP BY p.id_parte
     ORDER BY p.fecha_creacion DESC`,
    params,
  );

  res.json({ success: true, data: rows });
});

// Devuelve MP y respondientes activos para los campos buscables del formulario.
router.get("/catalogos", async (req, res) => {
  const [mps] = await db.query("SELECT id_mp, nombre FROM ministerios_publicos WHERE activo = 1 ORDER BY nombre");
  const [respondientes] = await db.query("SELECT id_respondiente, nombre FROM respondientes WHERE activo = 1 ORDER BY nombre");

  res.json({ success: true, data: { mps, respondientes } });
});

// Registra en historial que un usuario exporto partes.
router.post("/export", requirePartesExport, async (req, res) => {
  const total = Number(req.body.total || 0);
  const tipo = String(req.body.tipo || "archivo").toUpperCase();
  await db.query("INSERT INTO historial_cambios (id_parte, id_usuario, accion, descripcion) VALUES (NULL, ?, 'EXPORTAR', ?)", [
    req.user.id,
    `Exportacion ${tipo} de ${total} parte(s)`,
  ]);
  res.json({ success: true, message: "Exportacion registrada" });
});

// Devuelve un parte completo por id para ver o editar.
router.get("/:id", async (req, res) => {
  const parte = await getPartById(req.params.id);
  if (!parte) return res.status(404).json({ success: false, error: "Parte no encontrado" });
  res.json({ success: true, data: parte });
});

// Crea un parte, sus detalles y el registro de historial.
router.post("/", requirePartesWrite, async (req, res) => {
  const data = req.body;
  const folio = nullable(data.folio) || `FIG-${Date.now()}`;
  const idMp = await findOrCreate("ministerios_publicos", "id_mp", data.mp_nombre);
  const idRespondiente = await findOrCreate("respondientes", "id_respondiente", data.respondiente_nombre);

  const [result] = await db.query(
    `INSERT INTO partes (folio, fecha, hora, id_mp, id_respondiente, estado, gravedad_general, creado_por, asignado_a)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      folio,
      nullable(data.fecha),
      nullable(data.hora),
      idMp,
      idRespondiente,
      nullable(data.estado) || "Activo",
      nullable(data.gravedad_general) || "Sin clasificar",
      req.user.id,
      nullable(data.asignado_a),
    ],
  );

  const idParte = result.insertId;
  await upsertDetails(idParte, data);
  await db.query("INSERT INTO historial_cambios (id_parte, id_usuario, accion, descripcion) VALUES (?, ?, 'CREAR', ?)", [
    idParte,
    req.user.id,
    "Parte creado desde Node",
  ]);

  res.json({ success: true, message: "Parte creado", id: idParte });
});

// Actualiza un parte existente y registra el cambio en historial.
router.put("/:id", requirePartesWrite, async (req, res) => {
  const data = req.body;
  const idParte = req.params.id;
  const idMp = await findOrCreate("ministerios_publicos", "id_mp", data.mp_nombre);
  const idRespondiente = await findOrCreate("respondientes", "id_respondiente", data.respondiente_nombre);

  await db.query(
    `UPDATE partes
     SET folio = ?, fecha = ?, hora = ?, id_mp = ?, id_respondiente = ?, estado = ?, gravedad_general = ?, asignado_a = ?
     WHERE id_parte = ?`,
    [
      nullable(data.folio) || `FIG-${Date.now()}`,
      nullable(data.fecha),
      nullable(data.hora),
      idMp,
      idRespondiente,
      nullable(data.estado) || "Activo",
      nullable(data.gravedad_general) || "Sin clasificar",
      nullable(data.asignado_a),
      idParte,
    ],
  );

  await upsertDetails(idParte, data);
  await db.query("INSERT INTO historial_cambios (id_parte, id_usuario, accion, descripcion) VALUES (?, ?, 'EDITAR', ?)", [
    idParte,
    req.user.id,
    "Parte editado desde Node",
  ]);

  res.json({ success: true, message: "Parte actualizado" });
});

// Elimina un parte despues de guardar el movimiento en historial.
router.delete("/:id", requirePartesWrite, async (req, res) => {
  const parte = await getPartById(req.params.id);
  await db.query("INSERT INTO historial_cambios (id_parte, id_usuario, accion, descripcion) VALUES (?, ?, 'ELIMINAR', ?)", [
    req.params.id,
    req.user.id,
    `Parte ${parte?.folio || req.params.id} eliminado desde Node`,
  ]);
  await db.query("DELETE FROM partes WHERE id_parte = ?", [req.params.id]);
  res.json({ success: true, message: "Parte eliminado" });
});

/** Inserta o actualiza vehiculos y personas involucradas de un parte. */
async function upsertDetails(idParte, data) {
  const vehiculos = normalizeVehicles(data);
  await db.query("DELETE FROM vehiculos WHERE id_parte = ?", [idParte]);

  let idVehiculo = null;
  for (const [index, vehiculo] of vehiculos.entries()) {
    const [result] = await db.query(
      `INSERT INTO vehiculos (id_parte, numero_vehiculo, marca, modelo, tipo, numero_serie, numero_placa)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        idParte,
        index + 1,
        nullable(vehiculo.marca),
        nullable(vehiculo.modelo),
        nullable(vehiculo.tipo),
        nullable(vehiculo.numero_serie),
        nullable(vehiculo.numero_placa),
      ],
    );
    if (!idVehiculo) idVehiculo = result.insertId;
  }

  const [people] = await db.query("SELECT id_personas_involucradas FROM personas_involucradas WHERE id_parte = ? LIMIT 1", [idParte]);
  const payload = [
    idVehiculo,
    nullable(data.numero_personas),
    data.personas_fallecidas ? 1 : 0,
    data.personas_heridas ? 1 : 0,
    data.otros ? 1 : 0,
    nullable(data.numero_heridos),
    nullable(data.gravedad) || "Sin clasificar",
    nullable(data.observaciones),
  ];

  if (people[0]) {
    await db.query(
      `UPDATE personas_involucradas
       SET id_vehiculo = ?, numero_personas = ?, personas_fallecidas = ?, personas_heridas = ?, otros = ?, numero_heridos = ?, gravedad = ?, observaciones = ?
       WHERE id_personas_involucradas = ?`,
      [...payload, people[0].id_personas_involucradas],
    );
  } else {
    await db.query(
      `INSERT INTO personas_involucradas
       (id_parte, id_vehiculo, numero_personas, personas_fallecidas, personas_heridas, otros, numero_heridos, gravedad, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idParte, ...payload],
    );
  }
}

/** Normaliza los vehiculos recibidos desde JSON o desde campos antiguos del formulario. */
function normalizeVehicles(data) {
  let vehiculos = [];
  if (Array.isArray(data.vehiculos)) vehiculos = data.vehiculos;
  else if (typeof data.vehiculos === "string") {
    try {
      vehiculos = JSON.parse(data.vehiculos);
    } catch {
      vehiculos = [];
    }
  }

  if (!vehiculos.length) {
    vehiculos = [
      {
        marca: data.marca,
        modelo: data.modelo,
        tipo: data.tipo,
        numero_serie: data.numero_serie,
        numero_placa: data.numero_placa,
      },
    ];
  }

  return vehiculos.filter((vehiculo) =>
    ["marca", "modelo", "tipo", "numero_serie", "numero_placa"].some((key) => nullable(vehiculo[key])),
  );
}

module.exports = router;
