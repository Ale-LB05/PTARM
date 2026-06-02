const express = require("express");
const cors = require("cors");
const path = require("path");
const { auth } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/partes", auth, require("./routes/partes"));
app.use("/api/historial", auth, require("./routes/historial"));
app.use("/api/usuarios", auth, require("./routes/usuarios"));
app.use("/api/perfil", auth, require("./routes/perfil"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

app.listen(PORT, () => {
  console.log(`PTARM corriendo en http://localhost:${PORT}`);
});
