const mysql = require("mysql2");

// Pool reutilizable de conexiones MySQL configurado por variables de entorno.
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "partesdetransito_local",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

module.exports = pool.promise();
