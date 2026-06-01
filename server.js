const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const connection = require("./db");

const app = express();
const PORT = 3000;
const JWT_SECRET = "ptarm-clave-secreta";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  "/vendor/sweetalert2",
  express.static(path.join(__dirname, "node_modules", "sweetalert2", "dist")),
);

function crearHash(texto, tipo) {
  return crypto.createHash(tipo).update(texto).digest("hex");
}

async function validarPassword(password, passwordGuardada) {
  if (!passwordGuardada) return false;

  if (passwordGuardada.startsWith("$2a$") || passwordGuardada.startsWith("$2b$")) {
    return bcrypt.compare(password, passwordGuardada);
  }

  return (
    passwordGuardada === password ||
    passwordGuardada === crearHash(password, "sha256") ||
    passwordGuardada === crearHash(password, "md5")
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado. Inicia sesion." });
  }

  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Sesion expirada. Inicia sesion otra vez." });
  }
}

app.post("/api/login", (req, res) => {
  const correo = req.body.correo ? req.body.correo.trim() : "";
  const password = req.body.password ? req.body.password.trim() : "";

  if (!correo || !password) {
    return res.status(400).json({ error: "Escribe correo y contrasena." });
  }

  const sql = `
    SELECT 
      u.id_usuario,
      u.nombre,
      u.correo,
      u.password_hash,
      u.instituto,
      u.cargo_grado,
      u.imagen_perfil,
      r.nombre AS rol
    FROM usuarios u
    INNER JOIN roles r ON u.id_rol = r.id_rol
    WHERE u.correo = ? AND u.activo = 1
    LIMIT 1
  `;

  connection.query(sql, [correo], async (err, results) => {
    if (err) {
      console.error("Error BD login:", err);
      return res.status(500).json({ error: "Error en el servidor." });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Correo o contrasena incorrectos." });
    }

    const usuario = results[0];
    const passwordCorrecta = await validarPassword(password, usuario.password_hash);

    if (!passwordCorrecta) {
      return res.status(401).json({ error: "Correo o contrasena incorrectos." });
    }

    const foto = usuario.imagen_perfil || "/img/user.png";
    const token = jwt.sign(
      {
        id: usuario.id_usuario,
        usuario: usuario.nombre,
        rol: usuario.rol,
        cargo: usuario.cargo_grado || "",
        foto,
      },
      JWT_SECRET,
      { expiresIn: "4h" },
    );

    res.json({
      token,
      usuario: usuario.nombre,
      rol: usuario.rol,
      cargo: usuario.cargo_grado || "",
      foto,
    });
  });
});

app.get("/api/usuario", auth, (req, res) => {
  res.json({ success: true, usuario: req.user });
});

app.get("/api/resumen", auth, (req, res) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM partes) AS partes,
      (SELECT COUNT(*) FROM vehiculos) AS vehiculos,
      (SELECT COUNT(*) FROM usuarios WHERE activo = 1) AS usuarios,
      (SELECT COUNT(*) FROM historial_cambios) AS movimientos
  `;

  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, error: "Error al cargar resumen." });
    res.json({ success: true, data: results[0] });
  });
});

app.get("/api/partes", auth, (req, res) => {
  const buscar = req.query.buscar ? `%${req.query.buscar.trim()}%` : "%%";

  const sql = `
    SELECT
      p.id_parte,
      p.folio,
      p.fecha,
      p.estado,
      p.gravedad_general,
      mp.nombre AS ministerio_publico,
      resp.nombre AS respondiente,
      GROUP_CONCAT(DISTINCT v.numero_placa ORDER BY v.numero_vehiculo SEPARATOR ', ') AS placas,
      COALESCE(SUM(pi.numero_personas), 0) AS personas
    FROM partes p
    LEFT JOIN ministerios_publicos mp ON p.id_mp = mp.id_mp
    LEFT JOIN respondientes resp ON p.id_respondiente = resp.id_respondiente
    LEFT JOIN vehiculos v ON p.id_parte = v.id_parte
    LEFT JOIN personas_involucradas pi ON p.id_parte = pi.id_parte
    WHERE
      p.folio LIKE ? OR
      p.estado LIKE ? OR
      p.gravedad_general LIKE ? OR
      mp.nombre LIKE ? OR
      resp.nombre LIKE ? OR
      v.numero_placa LIKE ?
    GROUP BY p.id_parte
    ORDER BY p.fecha_creacion DESC
    LIMIT 50
  `;

  connection.query(sql, [buscar, buscar, buscar, buscar, buscar, buscar], (err, results) => {
    if (err) {
      console.error("Error BD partes:", err);
      return res.status(500).json({ success: false, error: "Error al cargar partes." });
    }

    res.json({ success: true, data: results });
  });
});

app.get("/api/catalogos", auth, (req, res) => {
  const catalogos = {};

  connection.query("SELECT id_mp, nombre FROM ministerios_publicos WHERE activo = 1 ORDER BY nombre", (err, mps) => {
    if (err) return res.status(500).json({ success: false, error: "Error al cargar ministerios publicos." });

    catalogos.ministerios = mps;

    connection.query("SELECT id_respondiente, nombre FROM respondientes WHERE activo = 1 ORDER BY nombre", (errResp, respondientes) => {
      if (errResp) return res.status(500).json({ success: false, error: "Error al cargar respondientes." });

      catalogos.respondientes = respondientes;
      res.json({ success: true, data: catalogos });
    });
  });
});

function registrarHistorial(idParte, idUsuario, accion, descripcion, callback) {
  const sql = "INSERT INTO historial_cambios (id_parte, id_usuario, accion, descripcion) VALUES (?, ?, ?, ?)";
  connection.query(sql, [idParte, idUsuario, accion, descripcion], callback);
}

app.post("/api/partes", auth, (req, res) => {
  const { folio, fecha, hora, id_mp, id_respondiente, vehiculos } = req.body;

  if (!folio || !fecha || !hora) {
    return res.status(400).json({ success: false, error: "Folio, fecha y hora son obligatorios." });
  }

  if (!Array.isArray(vehiculos) || vehiculos.length === 0) {
    return res.status(400).json({ success: false, error: "Agrega al menos un carro." });
  }

  connection.beginTransaction((err) => {
    if (err) return res.status(500).json({ success: false, error: "No se pudo iniciar el registro." });

    const sqlParte = `
      INSERT INTO partes (folio, fecha, hora, id_mp, id_respondiente, creado_por, asignado_a)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(
      sqlParte,
      [folio, fecha, hora, id_mp || null, id_respondiente || null, req.user.id, req.user.id],
      (errParte, resultParte) => {
        if (errParte) {
          return connection.rollback(() => {
            res.status(500).json({ success: false, error: "No se pudo crear el parte. Revisa que el folio no exista." });
          });
        }

        const idParte = resultParte.insertId;
        let pendientes = vehiculos.length;
        let terminado = false;

        vehiculos.forEach((vehiculo, index) => {
          const sqlVehiculo = `
            INSERT INTO vehiculos
              (id_parte, numero_vehiculo, marca, modelo, tipo, numero_serie, numero_placa)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

          connection.query(
            sqlVehiculo,
            [
              idParte,
              index + 1,
              vehiculo.marca || null,
              vehiculo.modelo || null,
              vehiculo.tipo || null,
              vehiculo.numero_serie || null,
              vehiculo.numero_placa || null,
            ],
            (errVehiculo, resultVehiculo) => {
              if (terminado) return;

              if (errVehiculo) {
                terminado = true;
                return connection.rollback(() => {
                  res.status(500).json({ success: false, error: "No se pudo guardar un carro." });
                });
              }

              const personas = vehiculo.personas || {};
              const sqlPersonas = `
                INSERT INTO personas_involucradas
                  (id_parte, id_vehiculo, numero_personas, personas_fallecidas, personas_heridas, otros, numero_heridos, gravedad, observaciones)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;

              connection.query(
                sqlPersonas,
                [
                  idParte,
                  resultVehiculo.insertId,
                  personas.numero_personas || null,
                  personas.personas_fallecidas ? 1 : 0,
                  personas.personas_heridas ? 1 : 0,
                  personas.otros ? 1 : 0,
                  personas.numero_heridos || null,
                  personas.gravedad || "Sin clasificar",
                  personas.observaciones || null,
                ],
                (errPersonas) => {
                  if (terminado) return;

                  if (errPersonas) {
                    terminado = true;
                    return connection.rollback(() => {
                      res.status(500).json({ success: false, error: "No se pudieron guardar las personas involucradas." });
                    });
                  }

                  pendientes -= 1;

                  if (pendientes === 0) {
                    registrarHistorial(idParte, req.user.id, "CREAR", `Parte ${folio} creado`, (errHistorial) => {
                      if (errHistorial) {
                        return connection.rollback(() => {
                          res.status(500).json({ success: false, error: "No se pudo guardar el historial." });
                        });
                      }

                      connection.commit((errCommit) => {
                        if (errCommit) {
                          return connection.rollback(() => {
                            res.status(500).json({ success: false, error: "No se pudo terminar el registro." });
                          });
                        }

                        res.json({ success: true, message: "Parte creado correctamente", id_parte: idParte });
                      });
                    });
                  }
                },
              );
            },
          );
        });
      },
    );
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor PTARM funcionando en http://localhost:${PORT}`);
});
