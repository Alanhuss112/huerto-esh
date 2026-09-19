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
      animation: { duration: 400 },
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
  if (actuador === 'bomba1') {
    const statusBox = document.getElementById('statusBomba1');
    statusBox.classList.toggle('on', estado);
    statusBox.innerHTML = `<span class="status-dot"></span> ${estado ? 'ENCENDIDA' : 'APAGADA'}`;
  } else if (actuador === 'bomba_muestreo') {
    const statusBox = document.getElementById('statusBomba2');
    statusBox.classList.toggle('on', estado);
    statusBox.innerHTML = `<span class="status-dot"></span> ${estado ? 'ENCENDIDA' : 'APAGADA'}`;
  } else if (actuador === 'peltier') {
    const statusBox = document.getElementById('statusPeltier');
    statusBox.classList.toggle('on', estado);
    statusBox.innerHTML = `<span class="status-dot"></span> ${estado ? 'ENCENDIDA' : 'APAGADA'}`;
  }
}

function addTracker(title = "", initialDay = null, startDateStr = "") {
  const nameInput = document.getElementById('tracker-input');
  const dateInput = document.getElementById('tracker-date-input');
  const dayInput = document.getElementById('tracker-day-input');

  const name = (typeof title === 'string' && title.length > 0) ? title : nameInput.value.trim();
  if (!name) return;

  let startDate = startDateStr ? new Date(startDateStr) : (dateInput.value ? new Date(dateInput.value) : new Date());
  let startDay = initialDay !== null ? parseInt(initialDay) : (parseInt(dayInput.value) || 1);

  // Calcular días desde fecha de inicio
  const hoy = new Date();
  const diffTime = Math.max(0, hoy - startDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let currentDay = Math.min(30, Math.max(1, startDay + diffDays));
  const percentage = Math.min(100, Math.max(0, (currentDay / 30) * 100));

  const fechaFormateada = startDate.toISOString().split('T')[0];

  const container = document.getElementById('tracker-container');
  const newTracker = document.createElement('div');
  newTracker.className = 'tracker-item';
  newTracker.dataset.startDate = fechaFormateada;
  newTracker.dataset.startDay = startDay;

  newTracker.innerHTML = `
    <div class="tracker-header">
        <span class="tracker-title">${name}</span>
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
        <span>Inicio: ${fechaFormateada}</span>
        <span>Cambio: +15d</span>
        <span>Cosecha: +30d</span>
    </div>
  `;

  newTracker.querySelector('.tracker-delete').addEventListener('click', () => {
    newTracker.remove();
    guardarTrackers();
  });

  container.appendChild(newTracker);

  nameInput.value = '';
  dayInput.value = '';
  dateInput.value = '';
  guardarTrackers();
}

function guardarTrackers() {
  const items = [];
  document.querySelectorAll('.tracker-item').forEach(el => {
    const title = el.querySelector('.tracker-title').innerText;
    const startDate = el.dataset.startDate;
    const startDay = parseInt(el.dataset.startDay) || 1;
    items.push({ title, startDate, startDay });
  });
  localStorage.setItem('hidro_trackers_list', JSON.stringify(items));
}

function addTask(text = "", completed = false) {
  const input = document.getElementById('task-input');
  const taskText = (typeof text === 'string' && text.length > 0) ? text : input.value.trim();
  if (!taskText) return;

  const container = document.getElementById('task-container');
  const newTask = document.createElement('div');
  newTask.className = `task-item ${completed ? 'completed' : ''}`;
  newTask.innerHTML = `
      <div class="task-checkbox"><i class="fa-solid fa-check"></i></div>
      <span class="task-text">${taskText}</span>
      <button class="task-delete"><i class="fa-solid fa-xmark"></i></button>
  `;
  
  newTask.addEventListener('click', function(e) {
      if (!e.target.closest('.task-delete')) {
          this.classList.toggle('completed');
          guardarTasks();
      }
  });

  newTask.querySelector('.task-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      newTask.style.opacity = '0';
      setTimeout(() => {
        newTask.remove();
        guardarTasks();
      }, 300);
  });

  container.appendChild(newTask);
  input.value = '';
  guardarTasks();
}

function guardarTasks() {
  const tasks = [];
  document.querySelectorAll('.task-item').forEach(el => {
    const text = el.querySelector('.task-text').innerText;
    const completed = el.classList.contains('completed');
    tasks.push({ text, completed });
  });
  localStorage.setItem('hidro_tasks_list', JSON.stringify(tasks));
}

function cargarDatosGuardados() {
  const savedTrackers = JSON.parse(localStorage.getItem('hidro_trackers_list'));
  if (savedTrackers && savedTrackers.length > 0) {
    savedTrackers.forEach(item => addTracker(item.title, item.startDay, item.startDate));
  } else {
    addTracker('Germinado de Prueba', 8, new Date().toISOString().split('T')[0]);
  }

  const savedTasks = JSON.parse(localStorage.getItem('hidro_tasks_list'));
  if (savedTasks && savedTasks.length > 0) {
    savedTasks.forEach(task => addTask(task.text, task.completed));
  } else {
    addTask('Revisar nivel del tanque principal', false);
  }
}