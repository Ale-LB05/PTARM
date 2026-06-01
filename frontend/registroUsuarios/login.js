const formLogin = document.getElementById("loginForm");
const btnSubmit = document.getElementById("btnSubmit");
const btnVerPassword = document.getElementById("btnVerPassword");
const passwordInput = document.getElementById("password");

btnVerPassword.addEventListener("click", () => {
  const mostrar = passwordInput.type === "password";
  passwordInput.type = mostrar ? "text" : "password";
  btnVerPassword.innerHTML = mostrar ? '<i class="far fa-eye-slash"></i>' : '<i class="far fa-eye"></i>';
});

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();

  const textoOriginal = btnSubmit.textContent;
  btnSubmit.textContent = "Validando...";
  btnSubmit.disabled = true;

  const datos = {
    correo: document.getElementById("correo").value.trim(),
    password: passwordInput.value.trim(),
  };

  try {
    const respuesta = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      Swal.fire({
        icon: "error",
        title: "No se pudo iniciar sesion",
        text: resultado.error || "Revisa tu correo y contrasena.",
        confirmButtonColor: "#030b5d",
      });
      passwordInput.value = "";
      btnSubmit.textContent = textoOriginal;
      btnSubmit.disabled = false;
      return;
    }

    localStorage.setItem("token", resultado.token);
    localStorage.setItem("usuario", resultado.usuario);
    localStorage.setItem("rol", resultado.rol);
    localStorage.setItem("cargo", resultado.cargo || "");
    localStorage.setItem("foto", resultado.foto || "/img/user.png");

    Swal.fire({
      icon: "success",
      title: "Inicio de sesion exitoso",
      text: `Bienvenido, ${resultado.usuario}`,
      timer: 1200,
      showConfirmButton: false,
    });

    setTimeout(() => {
      window.location.href = "/index.html";
    }, 1300);
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Servidor no disponible",
      text: "Verifica que node server.js este funcionando.",
      confirmButtonColor: "#030b5d",
    });
    btnSubmit.textContent = textoOriginal;
    btnSubmit.disabled = false;
  }
});
