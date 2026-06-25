const express = require("express");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const { createWorker } = require("tesseract.js");
const db = require("../db");
const { canAccess } = require("../middleware/auth");
const { recordActivity, recordExportedParts } = require("../utils/activity");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
let ocrWorkerPromise = null;
let peopleExtraColumnsReady = false;
let peopleDetailTableReady = false;
let partLocationColumnsReady = false;
let vehicleCorralonColumnReady = false;
let corralonesTableReady = false;
let partTypeColumnReady = false;

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

/** Asegura columnas de ubicacion/kilometraje para partes existentes. */
async function ensurePartLocationColumns() {
  if (partLocationColumnsReady) return;
  const [columns] = await db.query("SHOW COLUMNS FROM partes");
  const names = new Set(columns.map((column) => column.Field));
  if (!names.has("ubicacion_kilometro")) {
    await db.query("ALTER TABLE partes ADD COLUMN ubicacion_kilometro varchar(120) DEFAULT NULL AFTER hora");
  }
  if (!names.has("ubicacion_direccion")) {
    await db.query("ALTER TABLE partes ADD COLUMN ubicacion_direccion varchar(255) DEFAULT NULL AFTER ubicacion_kilometro");
  }
  if (!names.has("ubicacion_lat")) {
    await db.query("ALTER TABLE partes ADD COLUMN ubicacion_lat decimal(10,7) DEFAULT NULL AFTER ubicacion_direccion");
  }
  if (!names.has("ubicacion_lng")) {
    await db.query("ALTER TABLE partes ADD COLUMN ubicacion_lng decimal(10,7) DEFAULT NULL AFTER ubicacion_lat");
  }
  if (!names.has("google_place_id")) {
    await db.query("ALTER TABLE partes ADD COLUMN google_place_id varchar(180) DEFAULT NULL AFTER ubicacion_lng");
  }
  partLocationColumnsReady = true;
}

/** Asegura el motivo/tipo general del parte. */
async function ensurePartTypeColumn() {
  if (partTypeColumnReady) return;
  const [columns] = await db.query("SHOW COLUMNS FROM partes");
  if (!columns.some((column) => column.Field === "tipo_parte")) {
    await db.query("ALTER TABLE partes ADD COLUMN tipo_parte varchar(80) DEFAULT NULL AFTER folio");
  }
  partTypeColumnReady = true;
}

/** Asegura el catalogo de corralones. */
async function ensureCorralonesTable() {
  if (corralonesTableReady) return;
  await db.query(
    `CREATE TABLE IF NOT EXISTS corralones (
      id_corralon int(11) NOT NULL AUTO_INCREMENT,
      nombre varchar(180) NOT NULL,
      direccion varchar(255) DEFAULT NULL,
      telefono varchar(40) DEFAULT NULL,
      activo tinyint(1) NOT NULL DEFAULT 1,
      fecha_creacion timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id_corralon),
      UNIQUE KEY uk_corralones_nombre (nombre)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  corralonesTableReady = true;
}

/** Asegura el campo de corralon para cada vehiculo. */
async function ensureVehicleCorralonColumn() {
  if (vehicleCorralonColumnReady) return;
  const [columns] = await db.query("SHOW COLUMNS FROM vehiculos");
  const names = new Set(columns.map((column) => column.Field));
  if (!names.has("tipo_vehiculo")) {
    await db.query("ALTER TABLE vehiculos ADD COLUMN tipo_vehiculo enum('Vehiculo','Moto','Camioneta','Camion','Bicicleta','Otro') NOT NULL DEFAULT 'Vehiculo' AFTER numero_vehiculo");
  }
  if (!names.has("corralon")) {
    await db.query("ALTER TABLE vehiculos ADD COLUMN corralon varchar(180) DEFAULT NULL AFTER numero_placa");
  }
  if (!names.has("id_corralon")) {
    await db.query("ALTER TABLE vehiculos ADD COLUMN id_corralon int(11) DEFAULT NULL AFTER corralon");
  }
  if (!names.has("estatus_vehiculo")) {
    await db.query("ALTER TABLE vehiculos ADD COLUMN estatus_vehiculo varchar(80) DEFAULT NULL AFTER id_corralon");
  }
  if (!names.has("danos_vehiculo")) {
    await db.query("ALTER TABLE vehiculos ADD COLUMN danos_vehiculo text DEFAULT NULL AFTER estatus_vehiculo");
  }
  vehicleCorralonColumnReady = true;
}

/** Busca o crea un corralon del catalogo. */
async function findOrCreateCorralon(nombre) {
  await ensureCorralonesTable();
  const clean = nullable(nombre);
  if (!clean) return null;
  const [rows] = await db.query("SELECT id_corralon AS id FROM corralones WHERE nombre = ? LIMIT 1", [clean]);
  if (rows[0]) return rows[0].id;
  const [result] = await db.query("INSERT INTO corralones (nombre) VALUES (?)", [clean]);
  return result.insertId;
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

function importCleanKey(key = "") {
  return String(key)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function importCell(value) {
  const clean = value === undefined || value === null ? "" : String(value).trim();
  return /^campo vac[ií]o$/i.test(clean) ? "" : clean;
}

function importTruthy(value) {
  return ["1", "si", "sí", "true", "x"].includes(String(value || "").trim().toLowerCase());
}

function importDateValue(value) {
  const clean = importCell(value);
  if (!clean) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (/^\d+(\.\d+)?$/.test(clean)) {
    const date = new Date(Math.round((Number(clean) - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? clean : date.toISOString().slice(0, 10);
  }
  const date = new Date(clean);
  return Number.isNaN(date.getTime()) ? clean : date.toISOString().slice(0, 10);
}

function importHeaderScore(row) {
  const accepted = new Set([
    "folio",
    "motivo",
    "tipo_parte",
    "fecha",
    "hora",
    "respondiente",
    "respondiente_nombre",
    "mp",
    "mp_asignado",
    "mp_nombre",
    "usuario_encargado",
    "encargado_nombre",
    "kilometro_o_referencia",
    "ubicacion_kilometro",
    "direccion",
    "ubicacion_direccion",
    "vehiculos",
  ]);
  return row.reduce((score, cell) => score + (accepted.has(importCleanKey(cell)) ? 1 : 0), 0);
}

function rowsToImportObjects(rows) {
  const matrix = rows.map((row) => Object.values(row || {}).map((cell) => importCell(cell)));
  const headerIndex = matrix.findIndex((row) => importHeaderScore(row) >= 3);
  if (headerIndex < 0) return [];
  const headers = matrix[headerIndex];
  return matrix.slice(headerIndex + 1)
    .filter((row) => row.some(Boolean))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function parseImportCsv(text) {
  const rows = String(text || "").trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  });
  return rowsToImportObjects(rows);
}

function parseImportHtmlTable(html) {
  const rows = [];
  const rowMatches = String(html || "").match(/<tr[\s\S]*?<\/tr>/gi) || [];
  rowMatches.forEach((rowHtml) => {
    const cells = [];
    const cellMatches = rowHtml.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) || [];
    cellMatches.forEach((cellHtml) => {
      cells.push(cellHtml.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim());
    });
    rows.push(cells);
  });
  return rowsToImportObjects(rows);
}

function parseVehicleSummary(value = "") {
  const text = String(value || "").trim();
  if (!text || text.toLowerCase().includes("campo vac")) return [];
  return text.split("|").map((chunk) => {
    const read = (label) => {
      const match = chunk.match(new RegExp(`${label}\\s+([^/|]+)`, "i"));
      return match ? match[1].trim() : "";
    };
    return {
      tipo_vehiculo: read("Clase") || "Vehiculo",
      marca: read("Marca"),
      modelo: read("Modelo"),
      tipo: read("Tipo"),
      numero_serie: read("Serie"),
      numero_placa: read("Placa"),
      corralon: read("Corral[oó]n"),
      estatus_vehiculo: read("Estatus") || "Sin clasificar",
      danos_vehiculo: read("Da[ñn]os"),
    };
  }).filter((vehicle) => Object.values(vehicle).some(Boolean));
}

function normalizeImportRow(row) {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    normalized[importCleanKey(key)] = importCell(value);
  });
  if (!Object.values(normalized).some(Boolean)) return null;
  const vehicles = parseVehicleSummary(normalized.vehiculos);
  return {
    folio: normalized.folio,
    tipo_parte: normalized.tipo_parte || normalized.motivo,
    fecha: importDateValue(normalized.fecha),
    hora: normalized.hora,
    respondiente_nombre: normalized.respondiente_nombre || normalized.respondiente,
    mp_nombre: normalized.mp_nombre || normalized.mp || normalized.mp_asignado,
    estado: normalized.estado || "Activo",
    gravedad_general: normalized.gravedad_general || "Sin clasificar",
    ubicacion_kilometro: normalized.ubicacion_kilometro || normalized.kilometro_o_referencia,
    ubicacion_direccion: normalized.ubicacion_direccion || normalized.direccion,
    numero_personas: normalized.numero_personas || normalized.total_personas,
    personas_fallecidas: importTruthy(normalized.personas_fallecidas || normalized.fallecidas),
    numero_fallecidos: normalized.numero_fallecidos,
    personas_heridas: importTruthy(normalized.personas_heridas || normalized.heridas),
    numero_heridos: normalized.numero_heridos,
    otros: importTruthy(normalized.otros),
    gravedad: normalized.gravedad || normalized.gravedad_personas,
    observacion_fallecidos: normalized.observacion_fallecidos,
    observaciones: normalized.observaciones,
    vehiculos: vehicles.length ? vehicles : [{
      tipo_vehiculo: normalized.tipo_vehiculo || "Vehiculo",
      marca: normalized.marca,
      modelo: normalized.modelo,
      tipo: normalized.tipo,
      numero_serie: normalized.numero_serie,
      numero_placa: normalized.numero_placa,
      corralon: normalized.corralon,
      estatus_vehiculo: normalized.estatus_vehiculo || "Sin clasificar",
      danos_vehiculo: normalized.danos_vehiculo,
    }],
  };
}

function importMissingFields(row) {
  const required = [
    ["folio", "folio"],
    ["tipo_parte", "motivo"],
    ["fecha", "fecha"],
    ["hora", "hora"],
    ["respondiente_nombre", "respondiente"],
  ];
  return required
    .filter(([key]) => !nullable(row[key]))
    .map(([, label]) => label);
}

function importPdfLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function importPdfValue(lines, labels) {
  const normalizedLabels = labels.map(importCleanKey);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const key = importCleanKey(line);
    for (const label of normalizedLabels) {
      if (key === label) return importCell(lines[index + 1]);
      if (!key.startsWith(label)) continue;
      const remainder = line.slice(line.toLowerCase().indexOf(labels[normalizedLabels.indexOf(label)].toLowerCase()) + labels[normalizedLabels.indexOf(label)].length)
        .replace(/^[\s:#-]+/, "");
      if (remainder) return importCell(remainder);
      return importCell(lines[index + 1]);
    }
  }
  return "";
}

function importPdfFirstMatch(text, expression) {
  const match = String(text || "").match(expression);
  return match ? importCell(match[1]) : "";
}

function importRowsFromPdfText(text, { allowMultiple = true } = {}) {
  const chunks = String(text || "").split(/(?=INFORME POLICIAL HOMOLOGADO)/i).filter((chunk) => chunk.trim());
  const sources = allowMultiple && chunks.length ? chunks : [text];
  return sources.map((source) => {
    const lines = importPdfLines(source);
    const facts = String(source).match(/^([^\r\n]+?)[ \t]+(Sin clasificar|Bajo|Medio|Alto|Otro)[ \t]+([^\r\n]+?)(?:[ \t]+\d{1,2}\/\d{1,2}\/\d{2,4}.*)?$/im);
    const row = {
      folio: importPdfValue(lines, ["No. de parte / folio", "No. de parte", "Folio"])
        || importPdfFirstMatch(source, /\b((?:FIG|FOLIO|PARTE)[-\s]?[A-Z0-9-]{4,})\b/i),
      tipo_parte: importPdfValue(lines, ["Motivo del parte", "Motivo", "Tipo de hecho"]) || importCell(facts?.[1]),
      fecha: importPdfValue(lines, ["Fecha"]) || importPdfFirstMatch(source, /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/),
      hora: importPdfValue(lines, ["Hora"]) || importPdfFirstMatch(source, /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/),
      respondiente_nombre: importPdfValue(lines, ["Respondiente", "Policia respondiente"]) || importCell(facts?.[3]),
      mp_nombre: importPdfValue(lines, ["MP asignado", "Ministerio publico", "MP"]),
      estado: importPdfValue(lines, ["Estado"]) || importPdfFirstMatch(source, /\b(Borrador|Activo|Cerrado|Archivado|Cancelado)\b/i),
      gravedad_general: importPdfValue(lines, ["Gravedad general"]) || importCell(facts?.[2]) || importPdfFirstMatch(source, /\b(Sin clasificar|Bajo|Medio|Alto|Otro)\b/i),
      ubicacion_kilometro: importPdfValue(lines, ["Kilometro o referencia", "Kilometro", "Referencia"]),
      ubicacion_direccion: importPdfValue(lines, ["Direccion OpenStreetMap", "Direccion", "Domicilio"]),
      numero_personas: importPdfValue(lines, ["Numero de personas", "Personas involucradas"]),
      numero_fallecidos: importPdfValue(lines, ["Numero de fallecidos", "Fallecidos"]),
      numero_heridos: importPdfValue(lines, ["Numero de heridos", "Heridos"]),
      observaciones: importPdfValue(lines, ["Observaciones", "Observacion"]),
      marca: importPdfValue(lines, ["Marca"]),
      modelo: importPdfValue(lines, ["Modelo"]),
      tipo: importPdfValue(lines, ["Tipo de vehiculo"]),
      numero_serie: importPdfValue(lines, ["No. serie", "Numero de serie", "Serie"]),
      numero_placa: importPdfValue(lines, ["No. placa", "Numero de placa", "Placa"]),
    };
    row.personas_fallecidas = Number(row.numero_fallecidos || 0) > 0 ? "Si" : "";
    row.personas_heridas = Number(row.numero_heridos || 0) > 0 ? "Si" : "";
    const normalized = normalizeImportRow(row);
    if (!normalized) return null;
    if (!normalized.folio && !normalized.tipo_parte && !normalized.respondiente_nombre) return null;
    normalized._missing_fields = importMissingFields(normalized);
    return normalized;
  }).filter(Boolean);
}

function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker("spa+eng");
  }
  return ocrWorkerPromise;
}

async function filterDuplicateImportRows(rows) {
  const folios = rows.map((row) => nullable(row.folio)).filter(Boolean);
  if (!folios.length) return { rows, skipped: [] };
  const [existing] = await db.query("SELECT folio FROM partes WHERE folio IN (?)", [folios]);
  const existingFolios = new Set(existing.map((row) => String(row.folio).trim().toLowerCase()));
  const kept = [];
  const skipped = [];
  rows.forEach((row) => {
    const folio = String(row.folio || "").trim().toLowerCase();
    if (folio && existingFolios.has(folio)) skipped.push(row);
    else kept.push(row);
  });
  return { rows: kept, skipped };
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
  await ensurePartLocationColumns();
  await ensurePartTypeColumn();
  await ensureCorralonesTable();
  await ensureVehicleCorralonColumn();
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
    `SELECT v.id_vehiculo, v.numero_vehiculo, v.tipo_vehiculo, v.marca, v.modelo, v.tipo, v.numero_serie, v.numero_placa,
       COALESCE(c.nombre, v.corralon) AS corralon,
       v.id_corralon,
       v.estatus_vehiculo,
       v.danos_vehiculo
     FROM vehiculos v
     LEFT JOIN corralones c ON c.id_corralon = v.id_corralon
     WHERE v.id_parte = ?
     ORDER BY v.numero_vehiculo, v.id_vehiculo`,
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
    parte.corralon = firstVehicle.corralon;
    parte.estatus_vehiculo = firstVehicle.estatus_vehiculo;
    parte.danos_vehiculo = firstVehicle.danos_vehiculo;
  }
  return parte;
}

// Lista partes resumidos para tablas, tarjetas, inicio y modal de exportacion.
router.get("/", async (req, res) => {
  await ensurePartLocationColumns();
  await ensurePartTypeColumn();
  await ensureVehicleCorralonColumn();
  const advancedFields = {
    folio: "p.folio",
    tipo_parte: "p.tipo_parte",
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
    corralon: "v.corralon",
    estatus_vehiculo: "v.estatus_vehiculo",
    danos_vehiculo: "v.danos_vehiculo",
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
    params = hasSearch ? [q, q, q, q, q, q, q, q, q, q] : [];
    where = hasSearch
    ? `WHERE p.folio LIKE ? OR p.tipo_parte LIKE ? OR mp.nombre LIKE ? OR r.nombre LIKE ? OR u.nombre LIKE ? OR v.numero_placa LIKE ? OR v.numero_serie LIKE ? OR v.corralon LIKE ? OR v.estatus_vehiculo LIKE ? OR v.danos_vehiculo LIKE ?`
    : "";
  }

  const [rows] = await db.query(
    `SELECT
       p.id_parte,
       p.folio,
       p.tipo_parte,
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
       GROUP_CONCAT(DISTINCT v.modelo SEPARATOR ' | ') AS modelos,
       GROUP_CONCAT(DISTINCT v.corralon SEPARATOR ' | ') AS corralones,
       GROUP_CONCAT(DISTINCT v.estatus_vehiculo SEPARATOR ' | ') AS estatus_vehiculos,
       GROUP_CONCAT(DISTINCT v.danos_vehiculo SEPARATOR ' | ') AS danos_vehiculos
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
  await ensureCorralonesTable();
  const [mps] = await db.query("SELECT id_mp, nombre FROM ministerios_publicos WHERE activo = 1 ORDER BY nombre");
  const [respondientes] = await db.query("SELECT id_respondiente, nombre FROM respondientes WHERE activo = 1 ORDER BY nombre");
  const [corralones] = await db.query("SELECT id_corralon, nombre, direccion, telefono FROM corralones WHERE activo = 1 ORDER BY nombre");

  res.json({ success: true, data: { mps, respondientes, corralones } });
});

// Previsualiza importaciones de Excel/CSV/HTML/PDF antes de crear partes en lote.
router.post("/import/preview", requirePartesWrite, upload.single("archivo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "Sube un archivo valido para importar" });
  }
  const type = String(req.body.tipo || "excel").toLowerCase();
  const name = String(req.file.originalname || "").toLowerCase();
  if (type === "image") {
    try {
      const worker = await getOcrWorker();
      const result = await worker.recognize(req.file.buffer);
      const rows = importRowsFromPdfText(result.data.text, { allowMultiple: false });
      if (!rows.length) {
        return res.status(422).json({
          success: false,
          error: "No se reconocieron campos del parte. Usa una foto nitida, de frente y con buena iluminacion.",
        });
      }
      const checked = await filterDuplicateImportRows(rows);
      return res.json({
        success: true,
        data: checked.rows,
        skipped: checked.skipped,
        source: "ocr",
        message: "Imagen leida con OCR",
      });
    } catch (error) {
      ocrWorkerPromise = null;
      return res.status(422).json({
        success: false,
        error: "No se pudo leer la imagen. Intenta con una foto mas clara o en formato PNG/JPG.",
      });
    }
  }
  if (type === "pdf") {
    try {
      const parser = new PDFParse({ data: req.file.buffer });
      const parsed = await parser.getText();
      await parser.destroy();
      const rows = importRowsFromPdfText(parsed.text);
      if (!rows.length) {
        return res.status(422).json({
          success: false,
          error: "No se pudo reconocer texto util en el PDF. Si es un escaneo, sube una version con texto seleccionable.",
        });
      }
      const checked = await filterDuplicateImportRows(rows);
      return res.json({
        success: true,
        data: checked.rows,
        skipped: checked.skipped,
        source: "pdf",
        message: "PDF leido para previsualizacion",
      });
    } catch (error) {
      return res.status(422).json({
        success: false,
        error: "No se pudo leer el PDF. Verifica que el archivo no este protegido o danado.",
      });
    }
  }
  if (type !== "excel") {
    return res.status(400).json({ success: false, error: "Tipo de importacion no soportado" });
  }
  if (name.endsWith(".xlsx")) {
    return res.status(422).json({ success: false, error: "El archivo .xlsx se leera desde el navegador." });
  }

  const text = req.file.buffer.toString("utf8");
  const rawRows = name.endsWith(".csv") ? parseImportCsv(text) : parseImportHtmlTable(text);
  const rows = rawRows.map(normalizeImportRow).filter(Boolean);
  const checked = await filterDuplicateImportRows(rows);
  res.json({
    success: true,
    data: checked.rows,
    skipped: checked.skipped,
    source: name.endsWith(".csv") ? "csv" : "html",
    message: "Plantilla leida correctamente",
  });
});

// Registra en historial que un usuario exporto partes.
router.post("/export", requirePartesExport, async (req, res) => {
  const total = Number(req.body.total || 0);
  const tipo = String(req.body.tipo || "archivo").toUpperCase();
  const partIds = Array.isArray(req.body.partes) ? req.body.partes : [];
  await db.query("INSERT INTO historial_cambios (id_parte, id_usuario, accion, descripcion) VALUES (NULL, ?, 'EXPORTAR', ?)", [
    req.user.id,
    `Exportacion ${tipo} de ${total} parte(s)`,
  ]);
  const activityId = await recordActivity("EXPORTACION", { idUsuario: req.user.id, detalle: `Exportacion ${tipo} de ${total} parte(s)` });
  await recordExportedParts(activityId, partIds);
  res.json({ success: true, message: "Exportacion registrada" });
});

// Devuelve el historial de cambios de un parte especifico.
router.get("/:id/historial", async (req, res) => {
  const [rows] = await db.query(
    `SELECT h.id_historial, h.accion, h.descripcion, h.fecha, u.nombre AS usuario_nombre, u.imagen_perfil AS usuario_foto
     FROM historial_cambios h
     LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
     WHERE h.id_parte = ?
     ORDER BY h.fecha DESC, h.id_historial DESC`,
    [req.params.id],
  );
  res.json({ success: true, data: rows });
});

// Devuelve un parte completo por id para ver o editar.
router.get("/:id", async (req, res) => {
  const parte = await getPartById(req.params.id);
  if (!parte) return res.status(404).json({ success: false, error: "Parte no encontrado" });
  res.json({ success: true, data: parte });
});

// Crea un parte, sus detalles y el registro de historial.
router.post("/", requirePartesWrite, async (req, res) => {
  await ensurePartLocationColumns();
  await ensurePartTypeColumn();
  const data = req.body;
  const folio = nullable(data.folio) || `FIG-${Date.now()}`;
  if (data._import_source && nullable(data.folio)) {
    const [[existing]] = await db.query("SELECT id_parte FROM partes WHERE folio = ? LIMIT 1", [folio]);
    if (existing) {
      return res.status(409).json({ success: false, error: `El folio ${folio} ya existe. No se importara para evitar duplicados.` });
    }
  }
  const idMp = nullable(data.id_mp) || await findOrCreate("ministerios_publicos", "id_mp", data.mp_nombre);
  const idRespondiente = await findOrCreate("respondientes", "id_respondiente", data.respondiente_nombre);

  const [result] = await db.query(
    `INSERT INTO partes
     (folio, tipo_parte, fecha, hora, ubicacion_kilometro, ubicacion_direccion, ubicacion_lat, ubicacion_lng, google_place_id, id_mp, id_respondiente, estado, gravedad_general, creado_por, asignado_a)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      folio,
      nullable(data.tipo_parte),
      nullable(data.fecha),
      nullable(data.hora),
      nullable(data.ubicacion_kilometro),
      nullable(data.ubicacion_direccion),
      nullable(data.ubicacion_lat),
      nullable(data.ubicacion_lng),
      nullable(data.google_place_id),
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
  await ensurePartLocationColumns();
  await ensurePartTypeColumn();
  const data = req.body;
  const idParte = req.params.id;
  const currentParte = await getPartById(idParte);
  const idMp = nullable(data.id_mp) || await findOrCreate("ministerios_publicos", "id_mp", data.mp_nombre);
  const idRespondiente = await findOrCreate("respondientes", "id_respondiente", data.respondiente_nombre);
  const folio = nullable(data.folio) || currentParte?.folio || `FIG-${Date.now()}`;

  await db.query(
    `UPDATE partes
     SET folio = ?, tipo_parte = ?, fecha = ?, hora = ?, ubicacion_kilometro = ?, ubicacion_direccion = ?, ubicacion_lat = ?, ubicacion_lng = ?, google_place_id = ?, id_mp = ?, id_respondiente = ?, estado = ?, gravedad_general = ?, asignado_a = ?
     WHERE id_parte = ?`,
    [
      folio,
      nullable(data.tipo_parte),
      nullable(data.fecha),
      nullable(data.hora),
      nullable(data.ubicacion_kilometro),
      nullable(data.ubicacion_direccion),
      nullable(data.ubicacion_lat),
      nullable(data.ubicacion_lng),
      nullable(data.google_place_id),
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
  await ensureVehicleCorralonColumn();
  await ensureCorralonesTable();
  const vehiculos = normalizeVehicles(data);
  await db.query("DELETE FROM personas_involucradas_detalle WHERE id_parte = ?", [idParte]);
  await db.query("DELETE FROM vehiculos WHERE id_parte = ?", [idParte]);

  let idVehiculo = null;
  const vehicleIdsByNumber = new Map();
  for (const [index, vehiculo] of vehiculos.entries()) {
    const idCorralon = await findOrCreateCorralon(vehiculo.corralon);
    const [result] = await db.query(
      `INSERT INTO vehiculos (id_parte, numero_vehiculo, tipo_vehiculo, marca, modelo, tipo, numero_serie, numero_placa, corralon, id_corralon, estatus_vehiculo, danos_vehiculo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idParte,
        index + 1,
        validVehicleType(vehiculo.tipo_vehiculo),
        nullable(vehiculo.marca),
        nullable(vehiculo.modelo),
        nullable(vehiculo.tipo),
        nullable(vehiculo.numero_serie),
        nullable(vehiculo.numero_placa),
        nullable(vehiculo.corralon),
        idCorralon,
        nullable(vehiculo.estatus_vehiculo) || "Sin clasificar",
        nullable(vehiculo.danos_vehiculo),
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
        tipo_vehiculo: data.tipo_vehiculo,
        marca: data.marca,
        modelo: data.modelo,
        tipo: data.tipo,
        numero_serie: data.numero_serie,
        numero_placa: data.numero_placa,
        corralon: data.corralon,
        estatus_vehiculo: data.estatus_vehiculo,
        danos_vehiculo: data.danos_vehiculo,
      },
    ];
  }

  return vehiculos.filter((vehiculo) =>
    ["tipo_vehiculo", "marca", "modelo", "tipo", "numero_serie", "numero_placa", "corralon", "estatus_vehiculo", "danos_vehiculo"].some((key) => nullable(vehiculo[key])),
  );
}

/** Normaliza la clase general del vehiculo. */
function validVehicleType(value) {
  const clean = nullable(value) || "Vehiculo";
  return ["Vehiculo", "Moto", "Camioneta", "Camion", "Bicicleta", "Otro"].includes(clean) ? clean : "Vehiculo";
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
