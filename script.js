const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  databaseURL: "https://tu-proyecto-rtbd.firebaseio.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let sensorChart;
const historyData = { ph: [], temperatura: [], ec: [], humedad: [] };
const labelsHora = [];

const configMap = {
  ph: { label: 'Potencial de Hidrógeno (pH)', color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.15)' },
  temperatura: { label: 'Temperatura (°C)', color: '#ff5d67', bg: 'rgba(255, 93, 103, 0.15)' },
  ec: { label: 'Conductividad (mS/cm)', color: '#ffd166', bg: 'rgba(255, 209, 102, 0.15)' },
  humedad: { label: 'Humedad (%)', color: '#35e58a', bg: 'rgba(53, 229, 138, 0.15)' }
};

document.addEventListener("DOMContentLoaded", () => {
  iniciarReloj();
  inicializarGrafica();
  escucharFirebase();
  
  if (localStorage.getItem("hidro_logged_in") === "true") {
    mostrarInterfaz();
  }

  document.getElementById('btn-add-tracker').addEventListener('click', () => addTracker());
  document.getElementById('tracker-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') addTracker(); });

  document.getElementById('btn-add-task').addEventListener('click', () => addTask());
  document.getElementById('task-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });
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

  if (user === "Hidroponico2026" && pass === "Programav1") {
    if (remember) {
      localStorage.setItem("hidro_logged_in", "true");
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
  setTimeout(cambiarMetricaGrafica, 50);
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
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9db8ae' }, grid: { color: 'rgba(255, 255, 255, 0.035)' } },
        y: { ticks: { color: '#9db8ae' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
      }
    }
  });
}

function cambiarMetricaGrafica() {
  const metricKey = document.getElementById('chartSelect').value;
  const current = configMap[metricKey] || configMap.ph;

  if (sensorChart) {
    sensorChart.destroy();
  }

  const ctx = document.getElementById('sensorChart').getContext('2d');
  sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labelsHora,
      datasets: [{
        label: current.label,
        data: historyData[metricKey],
        borderColor: current.color,
        backgroundColor: current.bg,
        borderWidth: 3,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: current.color,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9db8ae' }, grid: { color: 'rgba(255, 255, 255, 0.035)' } },
        y: { ticks: { color: '#9db8ae' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
      }
    }
  });
}

function toggleActuador(actuador, estado) {
  database.ref('actuadores/' + actuador).set(estado);
}

function escucharFirebase() {
  database.ref('sensores').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      document.getElementById('statusBadge').className = "status-indicator online";
      document.getElementById('statusText').innerText = "ESP32 Conectado";
      document.getElementById('systemBanner').innerHTML = `
        <i class="fa-solid fa-circle-check" style="color: var(--green-bright);"></i>
        <span>Sistema funcionando correctamente</span>
      `;

      document.getElementById('phValue').innerText = data.ph ? data.ph.toFixed(1) : '--';
      document.getElementById('ecValue').innerText = data.ec ? data.ec.toFixed(1) : '--';
      document.getElementById('tempValue').innerText = data.temperatura ? data.temperatura.toFixed(1) : '--';
      document.getElementById('humValue').innerText = data.humedad ? Math.round(data.humedad) : '--';

      if (data.ph) document.getElementById('phBar').style.width = Math.min(100, (data.ph / 14) * 100) + '%';
      if (data.ec) document.getElementById('ecBar').style.width = Math.min(100, (data.ec / 4) * 100) + '%';
      if (data.temperatura) document.getElementById('tempBar').style.width = Math.min(100, (data.temperatura / 50) * 100) + '%';
      if (data.humedad) document.getElementById('humBar').style.width = data.humedad + '%';

      const horaActual = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      labelsHora.push(horaActual);
      historyData.ph.push(data.ph);
      historyData.temperatura.push(data.temperatura);
      historyData.ec.push(data.ec);
      historyData.humedad.push(data.humedad);

      if (labelsHora.length > 10) {
        labelsHora.shift();
        historyData.ph.shift();
        historyData.temperatura.shift();
        historyData.ec.shift();
        historyData.humedad.shift();
      }

      cambiarMetricaGrafica();
    }
  });

 
  database.ref('trackers').on('value', (snapshot) => {
    const container = document.getElementById('tracker-container');
    container.innerHTML = '';
    const trackers = snapshot.val();

    if (trackers) {
      Object.keys(trackers).forEach(key => {
        const item = trackers[key];
        renderTrackerItem(key, item.title, item.startDay, item.startDate);
      });
    }
  });

 
  database.ref('tasks').on('value', (snapshot) => {
    const container = document.getElementById('task-container');
    container.innerHTML = '';
    const tasks = snapshot.val();

    if (tasks) {
      Object.keys(tasks).forEach(key => {
        const task = tasks[key];
        renderTaskItem(key, task.text, task.completed);
      });
    }
  });
}

function addTracker() {
  const nameInput = document.getElementById('tracker-input');
  const dateInput = document.getElementById('tracker-date-input');
  const dayInput = document.getElementById('tracker-day-input');

  const name = nameInput.value.trim();
  if (!name) return;

  const startDate = dateInput.value || new Date().toISOString().split('T')[0];
  const startDay = parseInt(dayInput.value) || 1;

  database.ref('trackers').push({
    title: name,
    startDate: startDate,
    startDay: startDay
  });

  nameInput.value = '';
  dayInput.value = '';
  dateInput.value = '';
}

function renderTrackerItem(key, title, startDay, startDateStr) {
  const startDate = new Date(startDateStr);
  const hoy = new Date();
  const diffTime = Math.max(0, hoy - startDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let currentDay = Math.min(30, Math.max(1, startDay + diffDays));
  const percentage = Math.min(100, Math.max(0, (currentDay / 30) * 100));

  const container = document.getElementById('tracker-container');
  const newTracker = document.createElement('div');
  newTracker.className = 'tracker-item';

  newTracker.innerHTML = `
    <div class="tracker-header">
        <span class="tracker-title">${title}</span>
        <div class="tracker-actions">
            <span class="tracker-days">Día ${currentDay} / 30</span>
            <button class="tracker-delete"><i class="fa-solid fa-xmark"></i></button>
        </div>
    </div>
    <div class="tracker-visual-bar">
        <div class="fase-agua">Fase 1: Agua</div>
        <div class="fase-nutri">Fase 2: Solución 50%</div>
        <div class="tracker-cursor" style="left: ${percentage}%;"></div>
    </div>
    <div class="tracker-dates">
        <span>Inicio: ${startDateStr}</span>
        <span>Cambio: +15d</span>
        <span>Cosecha: +30d</span>
    </div>
  `;

  newTracker.querySelector('.tracker-delete').addEventListener('click', () => {
    database.ref('trackers/' + key).remove();
  });

  container.appendChild(newTracker);
}

function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) return;

  database.ref('tasks').push({
    text: text,
    completed: false
  });

  input.value = '';
}

function renderTaskItem(key, text, completed) {
  const container = document.getElementById('task-container');
  const newTask = document.createElement('div');
  newTask.className = `task-item ${completed ? 'completed' : ''}`;
  newTask.innerHTML = `
      <div class="task-checkbox"><i class="fa-solid fa-check"></i></div>
      <span class="task-text">${text}</span>
      <button class="task-delete"><i class="fa-solid fa-xmark"></i></button>
  `;
  
  newTask.addEventListener('click', function(e) {
      if (!e.target.closest('.task-delete')) {
          database.ref('tasks/' + key + '/completed').set(!completed);
      }
  });

  newTask.querySelector('.task-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      database.ref('tasks/' + key).remove();
  });

  container.appendChild(newTask);
}