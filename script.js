let sensorChart;

const historyData = {
  temperatura: [21.5, 22.0, 23.8, 25.4, 26.0, 24.8, 22.5],
  ph: [6.1, 6.2, 6.4, 6.5, 6.3, 6.2, 6.2],
  ec: [2.0, 2.1, 2.3, 2.5, 2.4, 2.2, 2.2],
  humedad: [72, 70, 68, 65, 66, 67, 68]
};

const labelsHora = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', 'Ahora'];

document.addEventListener("DOMContentLoaded", () => {
  iniciarReloj();
  cargarDatosGuardados();
  inicializarGrafica();
  
  if (localStorage.getItem("hidro_logged_in") === "true") {
    mostrarInterfaz();
  }
});

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
  cambiarMetricaGrafica();
}

function cerrarSesion() {
  localStorage.removeItem("hidro_logged_in");
  document.getElementById("appContainer").classList.add("hidden");
  document.getElementById("loginOverlay").classList.remove("hidden");
}

function iniciarReloj() {
  setInterval(() => {
    const ahora = new Date();
    document.getElementById("liveClock").innerText = ahora.toLocaleTimeString('es-MX');
  }, 1000);
}

function inicializarGrafica() {
  const ctx = document.getElementById('sensorChart').getContext('2d');
  
  sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labelsHora,
      datasets: [{
        label: 'Temperatura (°C)',
        data: historyData.temperatura,
        borderColor: '#35e58a',
        backgroundColor: 'rgba(53, 229, 138, 0.1)',
        borderWidth: 3,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#35e58a',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9db8ae' }, grid: { color: 'rgba(255, 255, 255, 0.035)' } },
        y: { ticks: { color: '#9db8ae' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
      }
    }
  });
}

function cambiarMetricaGrafica() {
  const metric = document.getElementById('chartSelect').value;
  const configMap = {
    temperatura: { label: 'Temperatura (°C)', name: 'Temperatura', color: '#35e58a', bg: 'rgba(53, 229, 138, 0.12)' },
    ph: { label: 'pH del Agua', name: 'pH', color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.12)' },
    ec: { label: 'Conductividad (mS/cm)', name: 'Conductividad Eléctrica', color: '#ffd166', bg: 'rgba(255, 209, 98, 0.12)' },
    humedad: { label: 'Humedad (%)', name: 'Humedad Relativa', color: '#35e58a', bg: 'rgba(53, 229, 138, 0.12)' }
  };

  const current = configMap[metric];
  document.getElementById('selectedMetricName').innerText = current.name;

  sensorChart.data.datasets[0].label = current.label;
  sensorChart.data.datasets[0].data = historyData[metric];
  sensorChart.data.datasets[0].borderColor = current.color;
  sensorChart.data.datasets[0].backgroundColor = current.bg;
  sensorChart.data.datasets[0].pointBorderColor = current.color;
  sensorChart.update();
}

function toggleActuador(actuador, estado) {
  if (actuador === 'bomba_muestreo') {
    const statusBox = document.getElementById('statusBomba2');
    statusBox.classList.toggle('on', estado);
    statusBox.innerHTML = `<span class="status-dot"></span> ${estado ? 'ENCENDIDA' : 'APAGADA'}`;
  } else if (actuador === 'peltier') {
    const statusBox = document.getElementById('statusPeltier');
    statusBox.classList.toggle('on', estado);
    statusBox.innerHTML = `<span class="status-dot"></span> ${estado ? 'ENCENDIDA' : 'APAGADA'}`;
  }
}

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
    plantDate: document.getElementById("plantDate").value,
    manualDays: document.getElementById("manualDays").value
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
    document.getElementById("manualDays").value = savedTracker.manualDays || "";
    calcularDiasTranscurridos();
  }
}

function calcularDiasTranscurridos() {
  const dateVal = document.getElementById("plantDate").value;
  const manualOffset = parseInt(document.getElementById("manualDays").value) || 0;
  
  let totalDays = manualOffset;

  if (dateVal) {
    const inicio = new Date(dateVal);
    const hoy = new Date();
    const diffDays = Math.max(0, Math.ceil((hoy - inicio) / (1000 * 60 * 60 * 24)) - 1);
    totalDays += diffDays;
  }

  document.getElementById("daysElapsed").innerText = totalDays;

  if (totalDays <= 15) {
    document.getElementById("growthStage").innerText = "Estado: Fase 1 - Agua Pura (Días 1-15)";
  } else {
    document.getElementById("growthStage").innerText = "Estado: Fase 2 - Solución 50% (Días 16-30)";
  }
}