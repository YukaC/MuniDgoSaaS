/* --- CONTROL DE SESION DE ACTIVA ---*/

document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("authToken") && localStorage.getItem("activeUser")) {
    window.location.href = "index.html";
  }

  const loginForm = document.getElementById("login-form");

  if (loginForm) {
    /* --- GESTION DEL FORMULARIO DE LOGIN --- */
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const usernameInput = document.getElementById("user").value;
      const passwordInput = document.getElementById("password").value;
      const submitButton = loginForm.querySelector("button");

      submitButton.disabled = true;
      submitButton.innerText = "Verificando...";

      try {
        // autenticacion basica
        const credentials = btoa(usernameInput + ":" + passwordInput);

        // POST /login
        const response = await fetch(API_ROUTES.login, {
          method: "POST",
          headers: {
            Authorization: "Basic " + credentials,
          },
        });

        const data = await response.json();

        if (response.ok) {
          const sessionData = {
            id: data.id,
            nombre: data.nombre, // Este es el nombre de la empresa
            token: data.token,
          };
          localStorage.setItem("activeUser", JSON.stringify(sessionData));
          localStorage.setItem("authToken", data.token);

          window.location.href = "index.html";
        } else {
          alert(data.message || "Credenciales incorrectas");
        }
      } catch (error) {
        console.error("Error Login:", error);
        alert("Error de conexión con el servidor.");
      } finally {
        submitButton.disabled = false;
        submitButton.innerText = "Ingresar";
      }
    });
  }
});
