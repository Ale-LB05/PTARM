const fs = require("fs");
const path = require("path");

/** Carga variables desde .env local sin depender de paquetes externos. */
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const clean = line.trim();
    if (!clean || clean.startsWith("#") || !clean.includes("=")) return;
    const index = clean.indexOf("=");
    const key = clean.slice(0, index).trim();
    const value = clean.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

module.exports = { loadEnv };
