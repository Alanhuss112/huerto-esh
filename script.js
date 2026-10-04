// REGISTRO DE PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado con éxito.', reg.scope))
      .catch(err => console.log('Error al registrar el Service Worker:', err));
  });
}

// Configuración de Firebase Original
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
let intervaloVerificacion = null;
let ultimaAlertaTiempo = 0; // Control de notificaciones push

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
  cargarHistorialFirebase();

  const btnTracker = document.getElementById('btn-add-tracker');
  if (btnTracker) {
    btnTracker.addEventListener('click', (e) => {
      e.preventDefault();
      if ((userRole || localStorage.getItem("hidro_role")) === 'guest') return;
      addTracker();
    });
  }

  const btnTask = document.getElementById('btn-add-task');
  if (btnTask) {
    btnTask.addEventListener('click', (e) => {
      e.preventDefault();
      if ((userRole || localStorage.getItem("hidro_role")) === 'guest') return;
      addTask();
    });
  }

  const chartSelectEl = document.getElementById('chartSelect');
  if (chartSelectEl) {
    chartSelectEl.addEventListener('change', cambiarMetricaGrafica);
  }
});

function toggleMostrarPass() {
  const passInput = document.getElementById("passInput");
  const toggleIcon = document.getElementById("togglePassword");
  if (!passInput || !toggleIcon) return;
  if (passInput.type === "password") {
    passInput.type = "text";
    toggleIcon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    passInput.type = "password";
    toggleIcon.classList.replace("fa-eye-slash", "fa-eye");
  }
}

function seleccionarPerfil(nombreUsuario) {
  const usersGrid = document.getElementById('hydeUsersGrid');
  const loginForm = document.getElementById('loginForm');
  const userInput = document.getElementById('userInput');
  const selectedUserLabel = document.getElementById('selectedUserLabel');
  const miniAvatar = document.getElementById('hydeMiniAvatarIcon');
  const passInput = document.getElementById('passInput');

  if (userInput) userInput.value = nombreUsuario;
  if (selectedUserLabel) selectedUserLabel.innerText = nombreUsuario;
  if (miniAvatar) {
    miniAvatar.innerHTML = (nombreUsuario === 'H.A.G.D.R.') ? '<i class="fa-solid fa-user-shield"></i>' : '<i class="fa-solid fa-seedling"></i>';
  }

  if (usersGrid) usersGrid.classList.add('hidden');
  if (loginForm) loginForm.classList.remove('hidden');
  if (passInput) passInput.focus();
}

function regresarSeleccionUsuarios() {
  const usersGrid = document.getElementById('hydeUsersGrid');
  const loginForm = document.getElementById('loginForm');
  const passInput = document.getElementById('passInput');
  const errorMsg = document.getElementById('loginErrorMsg');

  if (passInput) passInput.value = '';
  if (errorMsg) errorMsg.classList.add('hidden');
  if (loginForm) loginForm.classList.add('hidden');
  if (usersGrid) usersGrid.classList.remove('hidden');
}

function autenticar() {
  const userInputEl = document.getElementById("userInput");
  const passInputEl = document.getElementById("passInput");
  const rememberEl = document.getElementById("rememberMe");
  const loginCard = document.getElementById("loginCard");
  const errorMsg = document.getElementById("loginErrorMsg");

  if (!userInputEl || !passInputEl) return;
  const user = userInputEl.value;
  const pass = passInputEl.value;
  const remember = rememberEl ? rememberEl.checked : false;

  if (user === "H.A.G.D.R." && pass === "Hidroing26") {
    userRole = "admin";
    if (remember) { localStorage.setItem("hidro_logged_in", "true"); localStorage.setItem("hidro_role", "admin"); }
    if (errorMsg) errorMsg.classList.add("hidden");
    mostrarInterfaz();
  } else if (user === "Hidrouser" && pass === "Erdbeer") {
    userRole = "guest";
    if (remember) { localStorage.setItem("hidro_logged_in", "true"); localStorage.setItem("hidro_role", "guest"); }
    if (errorMsg) errorMsg.classList.add("hidden");
    mostrarInterfaz();
  } else {
    if (loginCard) {
      loginCard.classList.remove("shake");
      void loginCard.offsetWidth; 
      loginCard.classList.add("shake");
    }
    if (errorMsg) errorMsg.classList.remove("hidden");
  }
}

function mostrarInterfaz() {
  const loginOverlay = document.getElementById("loginOverlay");
  const appContainer = document.getElementById("appContainer");

  // Solicitar permiso de notificaciones al entrar
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }

  if (loginOverlay) {
    loginOverlay.style.opacity = "0";
    setTimeout(() => {
      loginOverlay.classList.add("hidden");
    }, 400);
  }
  if (appContainer) {
    appContainer.classList.remove("hidden");
    document.body.style.overflow = "auto";
  }

  ultimaVezDatos = Date.now();
  if ((userRole || localStorage.getItem("hidro_role")) === 'guest') {
    document.body.classList.add('role-guest');
  } else {
    document.body.classList.remove('role-guest');
  }
  setTimeout(cambiarMetricaGrafica, 100);
}

function cerrarSesion() {
  localStorage.removeItem("hidro_logged_in");
  localStorage.removeItem("hidro_role");
  userRole = null;
  document.body.classList.remove('role-guest');
  document.body.style.overflow = "hidden";
  if (intervaloVerificacion) clearInterval(intervaloVerificacion);
  
  const appContainer = document.getElementById("appContainer");
  if (appContainer) appContainer.classList.add("hidden");
  
  regresarSeleccionUsuarios();
  const loginOverlay = document.getElementById("loginOverlay");
  if (loginOverlay) {
    loginOverlay.classList.remove("hidden");
    setTimeout(() => { loginOverlay.style.opacity = "1"; }, 10);
  }
}

function iniciarReloj() {
  setInterval(() => {
    const ahora = new Date();
    const relojEl = document.getElementById("liveClock");
    if (relojEl) relojEl.innerText = ahora.toLocaleTimeString('es-MX');
  }, 1000);
}

function inicializarGrafica() {
  const canvasEl = document.getElementById('sensorChart');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  const chartSelectEl = document.getElementById('chartSelect');
  const selectedKey = chartSelectEl ? chartSelectEl.value : 'ph';
  const currentConfig = configMap[selectedKey] || configMap.ph;
  
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
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: currentConfig.color,
        pointRadius: 4,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8ba89c' }, grid: { color: 'rgba(255, 255, 255, 0.03)' } },
        y: { ticks: { color: '#8ba89c' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
      }
    }
  });
}

function cambiarMetricaGrafica() {
  const chartSelectEl = document.getElementById('chartSelect');
  const metricKey = chartSelectEl ? chartSelectEl.value : 'ph';
  const current = configMap[metricKey] || configMap.ph;
  if (sensorChart) sensorChart.destroy();
  const canvasEl = document.getElementById('sensorChart');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  
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
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: current.color,
        pointRadius: 4,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8ba89c' }, grid: { color: 'rgba(255, 255, 255, 0.03)' } },
        y: { ticks: { color: '#8ba89c' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
      }
    }
  });
}

function exportarCSV() {
  database.ref('historial').limitToLast(200).once('value', (snapshot) => {
    const registros = snapshot.val();
    if (!registros) {
      alert("No hay datos históricos para exportar.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Fecha y Hora,pH,Conductividad (mS/cm),Temperatura (°C),Humedad (%)\n";

    Object.keys(registros).forEach(key => {
      const reg = registros[key];
      const fecha = reg.timestamp ? new Date(reg.timestamp).toLocaleString('es-MX') : "N/A";
      const ph = reg.ph ? reg.ph.toFixed(2) : 0;
      const ec = reg.ec ? reg.ec.toFixed(2) : 0;
      const temp = reg.temperatura ? reg.temperatura.toFixed(2) : 0;
      const hum = reg.humedad ? Math.round(reg.humedad) : 0;
      
      csvContent += `"${fecha}",${ph},${ec},${temp},${hum}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `Bitacora_ESH_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute("download", fileName);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

function cargarHistorialFirebase() {
  database.ref('historial').limitToLast(30).once('value', (snapshot) => {
    const registros = snapshot.val();
    const tbody = document.getElementById('tablaHistorialBody');
    if (!tbody) return;
    
    if (!registros) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 15px;">No hay registros históricos guardados aún.</td></tr>`;
      return;
    }

    labelsHora.length = 0;
    historyData.ph.length = 0;
    historyData.temperatura.length = 0;
    historyData.ec.length = 0;
    historyData.humedad.length = 0;
    tbody.innerHTML = '';

    Object.keys(registros).forEach(key => {
      const reg = registros[key];
      const fechaLegible = reg.timestamp ? new Date(reg.timestamp).toLocaleString('es-MX') : "Registro automático";

      labelsHora.push(reg.timestamp ? new Date(reg.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : "Punto");
      historyData.ph.push(reg.ph || 0);
      historyData.temperatura.push(reg.temperatura || 0);
      historyData.ec.push(reg.ec || 0);
      historyData.humedad.push(reg.humedad || 0);

      const fila = document.createElement('tr');
      fila.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
      fila.innerHTML = `
        <td style="padding: 8px; color: var(--text-main);">${fechaLegible}</td>
        <td style="padding: 8px;">${reg.ph ? reg.ph.toFixed(1) : '--'}</td>
        <td style="padding: 8px;">${reg.ec ? reg.ec.toFixed(1) : '--'}</td>
        <td style="padding: 8px;">${reg.temperatura ? reg.temperatura.toFixed(1) : '--'} °C</td>
        <td style="padding: 8px;">${reg.humedad ? Math.round(reg.humedad) : '--'} %</td>
      `;
      tbody.prepend(fila);
    });

    cambiarMetricaGrafica();
  });
}

function toggleActuador(actuador, estado) {
  const currentRole = userRole || localStorage.getItem("hidro_role");
  if (currentRole === 'guest') return;
  actualizarBotonUI(actuador, estado);
  database.ref('actuadores/' + actuador).set(estado).catch(() => {
    actualizarBotonUI(actuador, !estado);
  });
}

function verificarAlertas(data) {
  const ahora = Date.now();
  if (ahora - ultimaAlertaTiempo < 600000) return; // Limita a 10 mins

  let alertas = [];
  
  if (data.temperatura && data.temperatura > 26) {
    alertas.push(`¡Alerta! Temperatura alta: ${data.temperatura.toFixed(1)}°C.`);
  } else if (data.temperatura && data.temperatura < 18) {
    alertas.push(`¡Alerta! Temperatura baja: ${data.temperatura.toFixed(1)}°C.`);
  }

  if (data.ph && (data.ph < 5.5 || data.ph > 6.5)) {
    alertas.push(`pH fuera de rango: ${data.ph.toFixed(1)}.`);
  }

  if (alertas.length > 0 && Notification.permission === "granted") {
    new Notification("Alerta Huerto ESH", {
      body: alertas.join("\n"),
      icon: "https://cdn-icons-png.flaticon.com/512/1892/1892751.png"
    });
    ultimaAlertaTiempo = ahora;
  }
}

function escucharFirebase() {
  actualizarEstadoUI("connecting", "Intentando conectar...");

  database.ref('sensores').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      ultimaVezDatos = Date.now();
      actualizarEstadoUI("online", "ESP32 Conectado");

      const phVal = document.getElementById('phValue');
      const ecVal = document.getElementById('ecValue');
      const tempVal = document.getElementById('tempValue');
      const humVal = document.getElementById('humValue');

      if (phVal) phVal.innerText = data.ph !== undefined ? Number(data.ph).toFixed(1) : '--';
      if (ecVal) ecVal.innerText = data.ec !== undefined ? Number(data.ec).toFixed(1) : '--';
      if (tempVal) tempVal.innerText = data.temperatura !== undefined ? Number(data.temperatura).toFixed(1) : '--';
      if (humVal) humVal.innerText = data.humedad !== undefined ? Math.round(data.humedad) : '--';

      if (data.ph && document.getElementById('phBar')) document.getElementById('phBar').style.width = Math.min(100, (data.ph / 14) * 100) + '%';
      if (data.ec && document.getElementById('ecBar')) document.getElementById('ecBar').style.width = Math.min(100, (data.ec / 4) * 100) + '%';
      if (data.temperatura && document.getElementById('tempBar')) document.getElementById('tempBar').style.width = Math.min(100, (data.temperatura / 50) * 100) + '%';
      if (data.humedad && document.getElementById('humBar')) document.getElementById('humBar').style.width = data.humedad + '%';

      verificarAlertas(data); // LLAMADA A NOTIFICACIONES

      const horaActual = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      labelsHora.push(horaActual);
      historyData.ph.push(data.ph !== undefined ? Number(data.ph) : 0);
      historyData.temperatura.push(data.temperatura !== undefined ? Number(data.temperatura) : 0);
      historyData.ec.push(data.ec !== undefined ? Number(data.ec) : 0);
      historyData.humedad.push(data.humedad !== undefined ? Number(data.humedad) : 0);

      if (labelsHora.length > 20) {
        labelsHora.shift();
        historyData.ph.shift();
        historyData.temperatura.shift();
        historyData.ec.shift();
        historyData.humedad.shift();
      }

      if (sensorChart) {
        const chartSelectEl = document.getElementById('chartSelect');
        const metricKey = chartSelectEl ? chartSelectEl.value : 'ph';
        sensorChart.data.labels = labelsHora;
        sensorChart.data.datasets[0].data = historyData[metricKey];
        sensorChart.update();
      }
    }
  });

  if (intervaloVerificacion) clearInterval(intervaloVerificacion);
  intervaloVerificacion = setInterval(() => {
    const appContainer = document.getElementById('appContainer');
    if (appContainer && !appContainer.classList.contains('hidden')) {
      const tiempoTranscurrido = Date.now() - ultimaVezDatos;
      if (tiempoTranscurrido > 10000 && tiempoTranscurrido < 30000) {
        actualizarEstadoUI("connecting", "Reconectando...");
      } else if (tiempoTranscurrido >= 30000) {
        marcarEsp32Desconectado();
      }
    }
  }, 3000);

  database.ref('actuadores').on('value', (snapshot) => {
    const act = snapshot.val();
    if (act) {
      actualizarBotonUI('bomba_principal', act.bomba_principal);
      actualizarBotonUI('bomba_muestreo', act.bomba_muestreo);
      actualizarBotonUI('peltier', act.peltier);
    }
  });

  database.ref('trackers').on('value', (snapshot) => {
    const container = document.getElementById('tracker-container');
    if (!container) return;
    container.innerHTML = ''; 
    const trackers = snapshot.val();
    if (trackers) {
      Object.keys(trackers).forEach(key => {
        const item = trackers[key];
        renderTrackerItem(key, item.title, item.startDay, item.startDate, item.startTime);
      });
    }
  });

  database.ref('tasks').on('value', (snapshot) => {
    const container = document.getElementById('task-container');
    if (!container) return;
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

function actualizarEstadoUI(estado, mensaje) {
  const badge = document.getElementById('statusBadge');
  const text = document.getElementById('statusText');
  const banner = document.getElementById('systemBanner');

  if (estado === "online") {
    if (badge) {
      badge.className = "status-indicator online";
      badge.style.background = ""; 
    }
    if (text) text.innerText = mensaje;
    if (banner) {
      banner.className = "status-banner banner-online";
      banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>Enlace exitoso: Sistema funcionando correctamente</span>`;
    }
  } else if (estado === "connecting") {
    if (badge) {
      badge.className = "status-indicator connecting";
      badge.style.background = ""; 
    }
    if (text) text.innerText = mensaje;
    if (banner) {
      banner.className = "status-banner banner-connecting";
      banner.innerHTML = `<i class="fa-solid fa-satellite-dish pulse-icon"></i> <span>Esperando conexión o intentando reconectar...</span>`;
    }
  }
}

function marcarEsp32Desconectado() {
  const badge = document.getElementById('statusBadge');
  const text = document.getElementById('statusText');
  const banner = document.getElementById('systemBanner');
  
  if (badge) {
    badge.className = "status-indicator offline";
    badge.style.background = ""; 
  }
  if (text) text.innerText = "ESP32 Desconectado";
  if (banner) {
    banner.className = "status-banner banner-offline";
    banner.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>Aviso: El ESP32 no está respondiendo (Sin señal)</span>
    `;
  }
}

function actualizarBotonUI(id, estado) {
  const btn = document.getElementById('btn-' + id);
  if (btn) btn.checked = Boolean(estado);

  let itemEl = document.getElementById('item-' + id);
  let statusEl = null;
  if (id === 'bomba_principal') statusEl = document.getElementById('statusBombaPrincipal');
  if (id === 'bomba_muestreo') statusEl = document.getElementById('statusBomba2');
  if (id === 'peltier') statusEl = document.getElementById('statusPeltier');

  if (statusEl) {
    if (estado) {
      statusEl.innerHTML = `<span class="status-dot" style="background: var(--green-bright); box-shadow: 0 0 10px var(--green-bright);"></span> ENCENDIDA`;
      statusEl.style.color = "var(--green-bright)";
      if (itemEl) itemEl.classList.add('active-glow');
    } else {
      statusEl.innerHTML = `<span class="status-dot"></span> APAGADA`;
      statusEl.style.color = "";
      if (itemEl) itemEl.classList.remove('active-glow');
    }
  }
}

function addTracker() {
  const nameInput = document.getElementById('tracker-input');
  const dateInput = document.getElementById('tracker-date-input');
  const timeInput = document.getElementById('tracker-time-input');
  const dayInput = document.getElementById('tracker-day-input');

  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) return;

  const fechaHoy = new Date().toISOString().split('T')[0];

  database.ref('trackers').push({
    title: name,
    startDate: (dateInput && dateInput.value) ? dateInput.value : fechaHoy,
    startTime: (timeInput && timeInput.value) ? timeInput.value : "08:00",
    startDay: parseInt(dayInput && dayInput.value ? dayInput.value : 1) || 1
  });

  nameInput.value = '';
  if (dayInput) dayInput.value = '';
  if (dateInput) dateInput.value = '';
  if (timeInput) timeInput.value = '';
}

function renderTrackerItem(key, title, startDay, startDateStr, startTimeStr) {
  const fechaValida = startDateStr || new Date().toISOString().split('T')[0];
  const horaValida = startTimeStr || "00:00";
  const fechaInicioStr = `${fechaValida}T${horaValida}:00`;
  
  const diffDays = Math.floor(Math.max(0, new Date() - new Date(fechaInicioStr)) / (1000 * 60 * 60 * 24));
  let currentDay = Math.min(30, Math.max(1, (startDay || 1) + diffDays));
  const percentage = Math.min(100, Math.max(0, (currentDay / 30) * 100));

  const container = document.getElementById('tracker-container');
  if (!container) return;
  
  const newTracker = document.createElement('div');
  newTracker.className = 'tracker-item';
  const isAdmin = ((userRole || localStorage.getItem("hidro_role")) === 'admin');

  newTracker.innerHTML = `
    <div class="tracker-header">
        <span class="tracker-title">${title}</span>
        <div class="tracker-actions">
            <span class="tracker-days">Día ${currentDay} / 30</span>
            ${isAdmin ? `<button class="tracker-delete" title="Eliminar"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </div>
    </div>
    <div class="tracker-visual-bar">
        <div class="fase-agua">Fase 1: Agua</div>
        <div class="fase-nutri">Fase 2: Solución 50%</div>
        <div class="tracker-cursor" style="left: ${percentage}%;"></div>
    </div>
    <div class="tracker-dates">
        <span>Inicio: ${fechaValida} (${horaValida})</span>
        <span>Cambio: +15d</span>
        <span>Cosecha: +30d</span>
    </div>
  `;

  if (isAdmin) {
    newTracker.querySelector('.tracker-delete')?.addEventListener('click', () => database.ref('trackers/' + key).remove());
  }
  container.appendChild(newTracker);
}

function addTask() {
  const input = document.getElementById('task-input');
  if (!input || !input.value.trim()) return;
  database.ref('tasks').push({ text: input.value.trim(), completed: false });
  input.value = '';
}

function renderTaskItem(key, text, completed) {
  const container = document.getElementById('task-container');
  if (!container) return;
  const newTask = document.createElement('div');
  newTask.className = `task-item ${completed ? 'completed' : ''}`;
  const isAdmin = ((userRole || localStorage.getItem("hidro_role")) === 'admin');

  newTask.innerHTML = `
      <div class="task-checkbox"><i class="fa-solid fa-check"></i></div>
      <span class="task-text">${text}</span>
      ${isAdmin ? `<button class="task-delete" title="Eliminar"><i class="fa-solid fa-xmark"></i></button>` : ''}
  `;
  
  newTask.addEventListener('click', (e) => {
      if ((userRole || localStorage.getItem("hidro_role")) === 'guest') return;
      if (!e.target.closest('.task-delete')) database.ref('tasks/' + key + '/completed').set(!completed);
  });

  if (isAdmin) {
    newTask.querySelector('.task-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        database.ref('tasks/' + key).remove();
    });
  }
  container.appendChild(newTask);
}