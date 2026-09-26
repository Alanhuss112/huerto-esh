const firebaseConfig = {
  apiKey: "AIzaSyCPr2QN1gvo5Ngekcos86uo2maX_mHrGF0",
  authDomain: "huerto-hidroponico-esh.firebaseapp.com",
  databaseURL: "https://huerto-hidroponico-esh-default-rtdb.firebaseio.com",
  projectId: "huerto-hidroponico-esh",
  storageBucket: "huerto-hidroponico-esh.firebasestorage.app",
  messagingSenderId: "380114491557",
  appId: "1:380114491557:web:bf85a1b207638093abd54c",
  measurementId: "G-DGXDEVKXZ0"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let sensorChart;
const historyData = { ph: [], temperatura: [], ec: [], humedad: [] };
const labelsHora = [];
let userRole = null;
let ultimaVezDatos = Date.now();

const configMap = {
  ph: { label: 'Potencial de Hidrógeno (pH)', color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.15)' },
  temperatura: { label: 'Temperatura (°C)', color: '#ff5d67', bg: 'rgba(255, 93, 103, 0.15)' },
  ec: { label: 'Conductividad (mS/cm)', color: '#ffd166', bg: 'rgba(255, 209, 102, 0.15)' },
  humedad: { label: 'Humedad (%)', color: '#35e58a', bg: 'rgba(53, 229, 138, 0.15)' }
};

document.addEventListener("DOMContentLoaded", () => {
  iniciarReloj();
  inicializarGrafica();
  
  if (localStorage.getItem("hidro_logged_in") === "true") {
    userRole = localStorage.getItem("hidro_role") || "admin";
    mostrarInterfaz();
  }

  escucharFirebase();

  document.getElementById('btn-add-tracker')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (userRole !== 'viewer') addTracker();
  });

  document.getElementById('btn-add-task')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (userRole !== 'viewer') addTask();
  });
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
  const loginCard = document.getElementById("loginCard");
  const errorMsg = document.getElementById("loginErrorMsg");

  if (user === "H.G.D.A." && pass === "Hidroponico26") {
    userRole = "admin";
    if (remember) {
      localStorage.setItem("hidro_logged_in", "true");
      localStorage.setItem("hidro_role", "admin");
    }
    errorMsg.classList.add("hidden");
    mostrarInterfaz();
  } else if (user === "Hidrop26" && pass === "2627") {
    userRole = "viewer";
    if (remember) {
      localStorage.setItem("hidro_logged_in", "true");
      localStorage.setItem("hidro_role", "viewer");
    }
    errorMsg.classList.add("hidden");
    mostrarInterfaz();
  } else {
    loginCard.classList.remove("shake");
    void loginCard.offsetWidth;
    loginCard.classList.add("shake");
    errorMsg.classList.remove("hidden");
  }
}

function mostrarInterfaz() {
  document.getElementById("loginOverlay").classList.add("hidden");
  document.getElementById("appContainer").classList.remove("hidden");
  
  const banner = document.getElementById('systemBanner');
  if (banner) banner.style.display = 'none';

  if (userRole === 'viewer') {
    document.querySelectorAll('.control-item input[type="checkbox"]').forEach(input => {
      input.disabled = true;
      input.parentElement.style.opacity = "0.6";
      input.parentElement.style.cursor = "not-allowed";
    });
    document.querySelector('.tracker-inputs-form').style.display = "none";
    document.querySelector('.input-group-add').style.display = "none";
  }
}

function cerrarSesion() {
  localStorage.removeItem("hidro_logged_in");
  localStorage.removeItem("hidro_role");
  userRole = null;
  document.getElementById("appContainer").classList.add("hidden");
  document.getElementById("loginOverlay").classList.remove("hidden");
}

function iniciarReloj() {
  setInterval(() => {
    document.getElementById("liveClock").innerText = new Date().toLocaleTimeString('es-MX');
  }, 1000);
}

function inicializarGrafica() {
  const ctx = document.getElementById('sensorChart').getContext('2d');
  const selectedKey = document.getElementById('chartSelect').value || 'ph';
  const currentConfig = configMap[selectedKey];
  
  sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labelsHora,
      datasets: [{
        label: currentConfig.label,
        data: historyData[selectedKey],
        borderColor: currentConfig.color,
        backgroundColor: currentConfig.bg,
        borderWidth: 3,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: currentConfig.color,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9db8ae' }, grid: { color: 'rgba(255, 255, 255, 0.035)' } },
        y: { ticks: { color: '#9db8ae' }, grid: { color: 'rgba(255, 255, 255, 0.035)' } }
      }
    }
  });
}

function cambiarMetricaGrafica() {
  const selectedKey = document.getElementById('chartSelect').value;
  const currentConfig = configMap[selectedKey];
  sensorChart.data.datasets[0].label = currentConfig.label;
  sensorChart.data.datasets[0].data = historyData[selectedKey];
  sensorChart.data.datasets[0].borderColor = currentConfig.color;
  sensorChart.data.datasets[0].backgroundColor = currentConfig.bg;
  sensorChart.data.datasets[0].pointBorderColor = currentConfig.color;
  sensorChart.update();
}

function actualizarGrafica(ph, temp, ec, hum) {
  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  labelsHora.push(hora);
  historyData.ph.push(ph);
  historyData.temperatura.push(temp);
  historyData.ec.push(ec);
  historyData.humedad.push(hum);

  if (labelsHora.length > 15) {
    labelsHora.shift();
    historyData.ph.shift();
    historyData.temperatura.shift();
    historyData.ec.shift();
    historyData.humedad.shift();
  }
  sensorChart.update();
}

function escucharFirebase() {
  database.ref('/sensores').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      document.getElementById("statusBadge").className = "status-indicator";
      document.getElementById("statusText").innerText = "ESP32 Conectado";
      
      document.getElementById('phValue').innerText = data.ph ? data.ph.toFixed(1) : '--';
      document.getElementById('phBar').style.width = data.ph ? `${(data.ph / 14) * 100}%` : '0%';

      document.getElementById('ecValue').innerText = data.ec ? data.ec.toFixed(1) : '--';
      document.getElementById('ecBar').style.width = data.ec ? `${(data.ec / 5) * 100}%` : '0%';

      document.getElementById('tempValue').innerText = data.temperatura ? data.temperatura.toFixed(1) : '--';
      document.getElementById('tempBar').style.width = data.temperatura ? `${(data.temperatura / 50) * 100}%` : '0%';

      if (data.humedad === null || data.humedad < 0) {
        document.getElementById('humValue').innerText = '--';
        document.getElementById('humBar').style.width = '0%';
      } else {
        document.getElementById('humValue').innerText = data.humedad.toFixed(0);
        document.getElementById('humBar').style.width = `${data.humedad}%`;
      }
      actualizarGrafica(data.ph, data.temperatura, data.ec, data.humedad >= 0 ? data.humedad : 0);
    }
  });

  database.ref('/actuadores').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      document.getElementById('btn-bomba_principal').checked = data.bomba_principal;
      document.getElementById('statusBombaPrincipal').className = data.bomba_principal ? "actuator-status on" : "actuator-status";
      document.getElementById('statusBombaPrincipal').innerHTML = data.bomba_principal ? '<span class="status-dot"></span> ENCENDIDA' : '<span class="status-dot"></span> APAGADA';

      document.getElementById('btn-bomba_muestreo').checked = data.bomba_muestreo;
      document.getElementById('statusBomba2').className = data.bomba_muestreo ? "actuator-status on" : "actuator-status";
      document.getElementById('statusBomba2').innerHTML = data.bomba_muestreo ? '<span class="status-dot"></span> ENCENDIDA' : '<span class="status-dot"></span> APAGADA';

      document.getElementById('btn-peltier').checked = data.peltier;
      document.getElementById('statusPeltier').className = data.peltier ? "actuator-status on" : "actuator-status";
      document.getElementById('statusPeltier').innerHTML = data.peltier ? '<span class="status-dot"></span> ENCENDIDA' : '<span class="status-dot"></span> APAGADA';
    }
  });
}

function toggleActuador(id, estado) {
  if (userRole === 'viewer') return;
  database.ref('/actuadores/' + id).set(estado);
}

function addTracker() {
  const val = document.getElementById('tracker-input').value;
  if(val) {
    const div = document.createElement('div');
    div.className = 'tracker-item';
    div.innerHTML = `<div class="tracker-header"><span class="tracker-title">${val}</span><button class="tracker-delete" onclick="this.parentElement.parentElement.remove()"><i class="fa-solid fa-trash"></i></button></div><div class="tracker-visual-bar"><div class="fase-agua">Agua</div><div class="fase-nutri">Solución</div></div>`;
    document.getElementById('tracker-container').appendChild(div);
    document.getElementById('tracker-input').value = '';
  }
}

function addTask() {
  const val = document.getElementById('task-input').value;
  if(val) {
    const div = document.createElement('div');
    div.className = 'task-item';
    div.innerHTML = `<div class="task-checkbox" onclick="this.parentElement.classList.toggle('completed')"><i class="fa-solid fa-check"></i></div><span class="task-text">${val}</span><button class="task-delete" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash"></i></button>`;
    document.getElementById('task-container').appendChild(div);
    document.getElementById('task-input').value = '';
  }
}