let userRole = null;

document.addEventListener("DOMContentLoaded", () => {
  iniciarReloj();
  
  const savedTheme = localStorage.getItem("hidro_theme") || "theme-emerald";
  cambiarTemaVisual(savedTheme, false);
  const themeSel = document.getElementById('themeSelector');
  if (themeSel) themeSel.value = savedTheme;

  if (localStorage.getItem("hidro_logged_in") === "true") {
    userRole = localStorage.getItem("hidro_role") || "admin";
    mostrarInterfaz();
  }
});

function cambiarTemaVisual(themeName, guardar = true) {
  document.body.className = themeName;
  if (guardar) localStorage.setItem("hidro_theme", themeName);
}

function toggleMostrarPass() {
  const pass = document.getElementById("passInput");
  const icon = document.getElementById("togglePassword");
  if (!pass) return;
  if (pass.type === "password") { 
    pass.type = "text"; 
    icon.classList.replace("fa-eye", "fa-eye-slash"); 
  } else { 
    pass.type = "password"; 
    icon.classList.replace("fa-eye-slash", "fa-eye"); 
  }
}

function seleccionarPerfil(user) {
  document.getElementById('userInput').value = user;
  document.getElementById('selectedUserLabel').innerText = user === 'H.A.G.D.R.' ? 'H.A.G.D.R. (Administrador)' : 'Hidrouser (Monitor)';
  document.getElementById('hydeUsersGrid').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('passInput').focus();
}

function regresarSeleccionUsuarios() {
  document.getElementById('passInput').value = '';
  document.getElementById('loginErrorMsg').classList.add('hidden');
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('hydeUsersGrid').classList.remove('hidden');
}

function autenticar() {
  const user = document.getElementById("userInput").value;
  const pass = document.getElementById("passInput").value;
  const remember = document.getElementById("rememberMe").checked;

  if ((user === "H.A.G.D.R." && pass === "Hidroing26") || (user === "Hidrouser" && pass === "Erdbeer")) {
    userRole = (user === "H.A.G.D.R.") ? "admin" : "guest";
    if (remember) { 
      localStorage.setItem("hidro_logged_in", "true"); 
      localStorage.setItem("hidro_role", userRole); 
    }
    mostrarInterfaz();
  } else {
    document.getElementById('loginCard').classList.add("shake");
    setTimeout(() => document.getElementById('loginCard').classList.remove("shake"), 500);
    document.getElementById("loginErrorMsg").classList.remove("hidden");
  }
}

function mostrarInterfaz() {
  const overlay = document.getElementById("loginOverlay");
  overlay.style.transition = "opacity 0.5s ease, transform 0.5s ease";
  overlay.style.opacity = "0";
  overlay.style.transform = "scale(1.05)";
  
  setTimeout(() => {
    overlay.classList.add("hidden");
    const app = document.getElementById("appContainer");
    app.classList.remove("hidden");
  }, 500);

  const roleText = (userRole || localStorage.getItem("hidro_role")) === 'admin' ? 'Administrador General' : 'Monitor de Campo';
  document.getElementById('lblUserRole').innerText = roleText;

  if ((userRole || localStorage.getItem("hidro_role")) === 'guest') {
    document.body.classList.add('role-guest');
  } else {
    document.body.classList.remove('role-guest');
  }
}

function cerrarSesion() {
  localStorage.removeItem("hidro_logged_in"); 
  localStorage.removeItem("hidro_role");
  location.reload();
}

function iniciarReloj() {
  setInterval(() => {
    const reloj = document.getElementById("liveClock");
    if (reloj) reloj.innerText = new Date().toLocaleTimeString('es-MX');
  }, 1000);
}

// --- MODO KIOSCO / PANTALLA DE CAMPO ---
function toggleModoKiosco() {
  document.body.classList.toggle('modo-kiosco');
  const activo = document.body.classList.contains('modo-kiosco');
  if (typeof mostrarToast === 'function') {
    mostrarToast("Modo Kiosco", activo ? "Activado para pantalla de campo" : "Desactivado", "warning");
  } else {
    alert(activo ? "Modo Kiosco Activado" : "Modo Kiosco Desactivado");
  }
}