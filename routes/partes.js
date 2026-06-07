const express = require("express");
const db = require("../db");
const { canAccess } = require("../middleware/auth");
const { recordActivity } = require("../utils/activity");

const router = express.Router();
let peopleExtraColumnsReady = false;
let peopleDetailTableReady = false;

/** Asegura columnas para guardar datos especificos de fallecidos en bases existentes. */
async function ensurePeopleExtraColumns() {
  if (peopleExtraColumnsReady) return;
  const [columns] = await db.query("SHOW COLUMNS FROM personas_involucradas");
  const names = new Set(columns.map((column) => column.Field));
  if (!names.has("numero_fallecidos")) {
    await db.query("ALTER TABLE personas_involucradas ADD COLUMN numero_fallecidos int(11) DEFAULT NULL AFTER personas_fallecidas");
  }
  if (!names.has("observacion_fallecidos")) {
    await db.query("ALTER TABLE personas_involucradas ADD COLUMN observacion_fallecidos text DEFAULT NULL AFTER numero_fallecidos");
  }
  peopleExtraColumnsReady = true;
}

/** Asegura tabla para guardar cada persona involucrada de forma individual. */
async function ensurePeopleDetailTable() {
  if (peopleDetailTableReady) return;
  await db.query(
    `CREATE TABLE IF NOT EXISTS personas_involucradas_detalle (
      id_persona_detalle bigint(20) NOT NULL AUTO_INCREMENT,
      id_parte bigint(20) NOT NULL,
      id_vehiculo bigint(20) DEFAULT NULL,
      numero_vehiculo int(11) DEFAULT NULL,
      numero_persona int(11) NOT NULL,
      nombre varchar(180) DEFAULT NULL,
      tipo_participacion enum('Conductor','Pasajero','Civil') NOT NULL DEFAULT 'Civil',
      PRIMARY KEY (id_persona_detalle),
      KEY idx_personas_detalle_parte (id_parte),
      KEY idx_personas_detalle_vehiculo (id_vehiculo),
      CONSTRAINT fk_personas_detalle_parte FOREIGN KEY (id_parte) REFERENCES partes (id_parte) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_personas_detalle_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos (id_vehiculo) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  const [columns] = await db.query("SHOW COLUMNS FROM personas_involucradas_detalle");
  if (!columns.some((column) => column.Field === "numero_vehiculo")) {
    await db.query("ALTER TABLE personas_involucradas_detalle ADD COLUMN numero_vehiculo int(11) DEFAULT NULL AFTER id_vehiculo");
  }
  peopleDetailTableReady = true;
}

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
  await ensurePeopleExtraColumns();
  await ensurePeopleDetailTable();
  const [rows] = await db.query(
    `SELECT
       p.*,
       mp.nombre AS mp_nombre,
       r.nombre AS respondiente_nombre,
       u.nombre AS encargado_nombre,
       u.imagen_perfil AS encargado_foto,
       pi.numero_personas,
       pi.personas_fallecidas,
       pi.numero_fallecidos,
       pi.observacion_fallecidos,
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
  const [personasDetalle] = await db.query(
    `SELECT
       pd.id_persona_detalle,
       pd.numero_persona,
       pd.nombre,
       pd.tipo_participacion,
       pd.id_vehiculo,
       COALESCE(v.numero_vehiculo, pd.numero_vehiculo) AS numero_vehiculo,
       CONCAT(
         'Vehículo #', COALESCE(v.numero_vehiculo, pd.numero_vehiculo),
         CASE
           WHEN v.marca IS NULL AND v.modelo IS NULL AND v.tipo IS NULL AND v.numero_placa IS NULL THEN ''
           ELSE CONCAT(' - ', TRIM(CONCAT_WS(' / ', v.marca, v.modelo, v.tipo, IF(v.numero_placa IS NULL OR v.numero_placa = '', NULL, CONCAT('Placa ', v.numero_placa)))))
         END
       ) AS vehiculo_label
     FROM personas_involucradas_detalle pd
     LEFT JOIN vehiculos v ON v.id_vehiculo = pd.id_vehiculo
     WHERE pd.id_parte = ?
     ORDER BY pd.numero_persona, pd.id_persona_detalle`,
    [id],
  );
  parte.personas_detalle = personasDetalle.map((person) => ({
    ...person,
    numero_vehiculo: person.numero_vehiculo,
    vehiculo_label: person.id_vehiculo ? person.vehiculo_label : "Sin vehículo",
  }));
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
  const advancedFields = {
    folio: "p.folio",
    fecha: "p.fecha",
    hora: "p.hora",
    estado: "p.estado",
    gravedad: "p.gravedad_general",
    mp: "mp.nombre",
    respondiente: "r.nombre",
    encargado: "u.nombre",
    placa: "v.numero_placa",
    serie: "v.numero_serie",
    marca: "v.marca",
    modelo: "v.modelo",
  };
  const advancedField = String(req.query.advancedField || "").trim();
  const advancedValue = String(req.query.advancedValue || "").trim();

  let where = "";
  let params = [];
  if (advancedFields[advancedField] && advancedValue) {
    if (advancedField === "fecha") {
      where = `WHERE ${advancedFields[advancedField]} = ?`;
      params = [advancedValue];
    } else {
      where = `WHERE ${advancedFields[advancedField]} LIKE ?`;
      params = [`%${advancedValue}%`];
    }
  } else {
    const q = `%${(req.query.q || "").trim()}%`;
    const hasSearch = q !== "%%";
    params = hasSearch ? [q, q, q, q, q, q] : [];
    where = hasSearch
    ? `WHERE p.folio LIKE ? OR mp.nombre LIKE ? OR r.nombre LIKE ? OR u.nombre LIKE ? OR v.numero_placa LIKE ? OR v.numero_serie LIKE ?`
    : "";
  }

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
       u.imagen_perfil AS encargado_foto,
       GROUP_CONCAT(DISTINCT v.numero_placa SEPARATOR ' | ') AS placas,
       GROUP_CONCAT(DISTINCT v.numero_serie SEPARATOR ' | ') AS series,
       GROUP_CONCAT(DISTINCT v.marca SEPARATOR ' | ') AS marcas,
       GROUP_CONCAT(DISTINCT v.modelo SEPARATOR ' | ') AS modelos
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
  await recordActivity("EXPORTACION", { idUsuario: req.user.id, detalle: `Exportacion ${tipo} de ${total} parte(s)` });
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
  const idMp = nullable(data.id_mp) || await findOrCreate("ministerios_publicos", "id_mp", data.mp_nombre);
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
  await recordActivity("CREACION_PARTE", { idUsuario: req.user.id, idParte, detalle: `Parte ${folio} creado` });

  res.json({ success: true, message: "Parte creado", id: idParte });
});

// Actualiza un parte existente y registra el cambio en historial.
router.put("/:id", requirePartesWrite, async (req, res) => {
  const data = req.body;
  const idParte = req.params.id;
  const currentParte = await getPartById(idParte);
  const idMp = nullable(data.id_mp) || await findOrCreate("ministerios_publicos", "id_mp", data.mp_nombre);
  const idRespondiente = await findOrCreate("respondientes", "id_respondiente", data.respondiente_nombre);
  const folio = nullable(data.folio) || currentParte?.folio || `FIG-${Date.now()}`;

  await db.query(
    `UPDATE partes
     SET folio = ?, fecha = ?, hora = ?, id_mp = ?, id_respondiente = ?, estado = ?, gravedad_general = ?, asignado_a = ?
     WHERE id_parte = ?`,
    [
      folio,
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
    `Parte ${folio} editado desde Node | creado_por:${currentParte?.creado_por || ""}`,
  ]);
  await recordActivity("EDICION_PARTE", { idUsuario: req.user.id, idParte, detalle: `Parte ${folio} editado` });

  res.json({ success: true, message: "Parte actualizado" });
});

// Elimina un parte despues de guardar el movimiento en historial.
router.delete("/:id", requirePartesWrite, async (req, res) => {
  const parte = await getPartById(req.params.id);
  await db.query("INSERT INTO historial_cambios (id_parte, id_usuario, accion, descripcion) VALUES (?, ?, 'ELIMINAR', ?)", [
    req.params.id,
    req.user.id,
    `Parte ${parte?.folio || req.params.id} eliminado desde Node | creado_por:${parte?.creado_por || ""}`,
  ]);
  await db.query("DELETE FROM partes WHERE id_parte = ?", [req.params.id]);
  await recordActivity("ELIMINACION_PARTE", { idUsuario: req.user.id, detalle: `Parte ${parte?.folio || req.params.id} eliminado` });
  res.json({ success: true, message: "Parte eliminado" });
});

/** Inserta o actualiza vehiculos y personas involucradas de un parte. */
async function upsertDetails(idParte, data) {
  await ensurePeopleExtraColumns();
  await ensurePeopleDetailTable();
  const vehiculos = normalizeVehicles(data);
  await db.query("DELETE FROM personas_involucradas_detalle WHERE id_parte = ?", [idParte]);
  await db.query("DELETE FROM vehiculos WHERE id_parte = ?", [idParte]);

  let idVehiculo = null;
  const vehicleIdsByNumber = new Map();
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
    vehicleIdsByNumber.set(index + 1, result.insertId);
  }

  const personasDetalle = normalizePeopleDetails(data);
  for (const [index, persona] of personasDetalle.entries()) {
    const numeroVehiculo = Number(persona.numero_vehiculo);
    await db.query(
      `INSERT INTO personas_involucradas_detalle
       (id_parte, id_vehiculo, numero_vehiculo, numero_persona, nombre, tipo_participacion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        idParte,
        vehicleIdsByNumber.get(numeroVehiculo) || null,
        numeroVehiculo || null,
        Number(persona.numero_persona) || index + 1,
        nullable(persona.nombre),
        ["Conductor", "Pasajero", "Civil"].includes(persona.tipo_participacion) ? persona.tipo_participacion : "Civil",
      ],
    );
  }

  const [people] = await db.query("SELECT id_personas_involucradas FROM personas_involucradas WHERE id_parte = ? LIMIT 1", [idParte]);
  const payload = [
    idVehiculo,
    nullable(data.numero_personas),
    data.personas_fallecidas ? 1 : 0,
    nullable(data.numero_fallecidos),
    nullable(data.observacion_fallecidos),
    data.personas_heridas ? 1 : 0,
    data.otros ? 1 : 0,
    nullable(data.numero_heridos),
    nullable(data.gravedad) || "Sin clasificar",
    nullable(data.observaciones),
  ];

  if (people[0]) {
    await db.query(
      `UPDATE personas_involucradas
       SET id_vehiculo = ?, numero_personas = ?, personas_fallecidas = ?, numero_fallecidos = ?, observacion_fallecidos = ?, personas_heridas = ?, otros = ?, numero_heridos = ?, gravedad = ?, observaciones = ?
       WHERE id_personas_involucradas = ?`,
      [...payload, people[0].id_personas_involucradas],
    );
  } else {
    await db.query(
      `INSERT INTO personas_involucradas
       (id_parte, id_vehiculo, numero_personas, personas_fallecidas, numero_fallecidos, observacion_fallecidos, personas_heridas, otros, numero_heridos, gravedad, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

/** Normaliza el listado individual de personas involucradas. */
function normalizePeopleDetails(data) {
  let personas = [];
  if (Array.isArray(data.personas_detalle)) personas = data.personas_detalle;
  else if (typeof data.personas_detalle === "string") {
    try {
      personas = JSON.parse(data.personas_detalle);
    } catch {
      personas = [];
    }
  }

  return personas
    .map((persona, index) => ({
      numero_persona: Number(persona.numero_persona) || index + 1,
      nombre: nullable(persona.nombre),
      numero_vehiculo: Number(persona.numero_vehiculo) || null,
      tipo_participacion: nullable(persona.tipo_participacion) || "Civil",
    }))
    .filter((persona) => persona.nombre || persona.numero_vehiculo || persona.tipo_participacion);
}

module.exports = router;
