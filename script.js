let mainChart;

document.addEventListener("DOMContentLoaded", () => {
  iniciarReloj();
  cargarDatosGuardados();
  inicializarGrafica();
  
  if (localStorage.getItem("hidro_logged_in") === "true") {
    mostrarInterfaz();
  }
});

// ================= AUTENTICACIÓN =================
function toggleMostrarPass() {
  const passInput = document.getElementById("passInput");
  const toggleIcon = document.getElementById("togglePassword");
  
  if (passInput.type === "password") {
    passInput.type = "text";
    toggleIcon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    passInput.type = "password";
    toggleIcon.classList.replace("fa-eye-slash", "fa-eye");
  }
}

function autenticar() {
  const user = document.getElementById("userInput").value;
  const pass = document.getElementById("passInput").value;
  const remember = document.getElementById("rememberMe").checked;

  if (user === "Hidroponico2026" && pass === "Programav1") {
    if (remember) {
      localStorage.setItem("hidro_logged_in", "true");
    }
    mostrarInterfaz();
  } else {
    alert("Usuario o contraseña incorrectos");
  }
}

function mostrarInterfaz() {
  document.getElementById("loginOverlay").classList.add("hidden");
  document.getElementById("appContainer").classList.remove("hidden");
}

function cerrarSesion() {
  localStorage.removeItem("hidro_logged_in");
  document.getElementById("appContainer").classList.add("hidden");
  document.getElementById("loginOverlay").classList.remove("hidden");
}

// ================= RELOJ Y ESTADO =================
function iniciarReloj() {
  setInterval(() => {
    const ahora = new Date();
    document.getElementById("liveClock").innerText = ahora.toLocaleTimeString('es-MX');
  }, 1000);
}

// ================= PERSISTENCIA DE DATOS =================
function guardarChecklist() {
  const checklistState = {
    chk1: document.getElementById("chk1").checked,
    chk2: document.getElementById("chk2").checked,
    chk3: document.getElementById("chk3").checked,
    chk4: document.getElementById("chk4").checked
  };
  localStorage.setItem("hidro_checklist", JSON.stringify(checklistState));
}

function guardarTracker() {
  const trackerState = {
    cropName: document.getElementById("cropName").value,
    plantDate: document.getElementById("plantDate").value
  };
  localStorage.setItem("hidro_tracker", JSON.stringify(trackerState));
  calcularDiasTranscurridos();
}

function cargarDatosGuardados() {
  const savedChecklist = JSON.parse(localStorage.getItem("hidro_checklist"));
  if (savedChecklist) {
    document.getElementById("chk1").checked = savedChecklist.chk1 || false;
    document.getElementById("chk2").checked = savedChecklist.chk2 || false;
    document.getElementById("chk3").checked = savedChecklist.chk3 || false;
    document.getElementById("chk4").checked = savedChecklist.chk4 || false;
  }

  const savedTracker = JSON.parse(localStorage.getItem("hidro_tracker"));
  if (savedTracker) {
    document.getElementById("cropName").value = savedTracker.cropName || "";
    document.getElementById("plantDate").value = savedTracker.plantDate || "";
    calcularDiasTranscurridos();
  }
}

function calcularDiasTranscurridos() {
  const dateVal = document.getElementById("plantDate").value;
  if (dateVal) {
    const inicio = new Date(dateVal);
    const hoy = new Date();
    const diffTime = Math.abs(hoy - inicio);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;
    const dias = diffDays >= 0 ? diffDays : 0;
    document.getElementById("daysElapsed").innerText = dias;

    if (dias <= 15) {
      document.getElementById("growthStage").innerText = "Fase 1: Agua Pura (Días 1-15)";
    } else {
      document.getElementById("growthStage").innerText = "Fase 2: Solución al 50% (Días 16-30)";
    }
  }
}

// ================= CONTROL DE ACTUADORES =================
function toggleActuador(actuador, estado) {
  console.log(`Actuador ${actuador} cambiado a: ${estado}`);
  // Sincronización con Firebase Realtime Database
}

// ================= GRÁFICA DE MONITOREO =================
function inicializarGrafica() {
  const ctx = document.getElementById('realtimeChart').getContext('2d');
  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'],
      datasets: [
        {
          label: 'pH (Agua)',
          data: [6.1, 6.2, 6.4, 6.5, 6.3, 6.2],
          borderColor: '#00f0ff',
          tension: 0.4
        },
        {
          label: 'Conductividad CE (mS/cm)',
          data: [2.0, 2.1, 2.3, 2.4, 2.3, 2.2],
          borderColor: '#35e58a',
          tension: 0.4
        },
        {
          label: 'Temp Agua (°C)',
          data: [21.5, 22.0, 23.5, 24.5, 23.0, 22.5],
          borderColor: '#18b86a',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#f8fafc' } }
      },
      scales: {
        x: { ticks: { color: '#9db8ae' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#9db8ae' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}