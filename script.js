let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btnInstall = document.getElementById('btnInstallApp');
  if (btnInstall) {
    btnInstall.classList.remove('hidden');
    btnInstall.addEventListener('click', () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => { deferredPrompt = null; btnInstall.classList.add('hidden'); });
    });
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

const firebaseConfig = {
  apiKey: "AIzaSyCPr2QN1gvo5Ngekcos86uo2maX_mHrGF0",
  authDomain: "huerto-hidroponico-esh.firebaseapp.com",
  databaseURL: "https://huerto-hidroponico-esh-default-rtdb.firebaseio.com",
  projectId: "huerto-hidroponico-esh",
  storageBucket: "huerto-hidroponico-esh.firebasestorage.app",
  messagingSenderId: "380114491557",
  appId: "1:380114491557:web:bf85a1b207638093abd54c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let sensorChart;
const historyData = { ph: [], temperatura: [], ec: [], humedad: [] };
const labelsHora = [];
let userRole = null; 
let huertoActivo = 'nft';
let ultimaVezDatos = Date.now();
let intervaloVerificacion = null;

const configMap = {
  ph: { label: 'pH', color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.15)' },
  temperatura: { label: 'Temperatura (°C)', color: '#ff5d67', bg: 'rgba(255, 93, 103, 0.15)' },
  ec: { label: 'CE (mS/cm)', color: '#ffd166', bg: 'rgba(255, 209, 102, 0.15)' },
  humedad: { label: 'Humedad (%)', color: '#35e58a', bg: 'rgba(53, 229, 138, 0.15)' }
};

document.addEventListener("DOMContentLoaded", () => {
  iniciarReloj();
  inicializarGrafica();
  
  // Cargar tema visual guardado
  const savedTheme = localStorage.getItem("hidro_theme") || "theme-emerald";
  cambiarTemaVisual(savedTheme, false);
  const themeSel = document.getElementById('themeSelector');
  if (themeSel) themeSel.value = savedTheme;

  if (localStorage.getItem("hidro_logged_in") === "true") {
    userRole = localStorage.getItem("hidro_role") || "admin";
    mostrarInterfaz();
  }
  escucharFirebase();
  cargarHistorialFirebase();
  cargarMantenimientoFirebase();
});

// 1. Selector de Temas Visuales
function cambiarTemaVisual(themeName, guardar = true) {
  document.body.className = themeName;
  if (guardar) localStorage.setItem("hidro_theme", themeName);
}

function cambiarHuerto(tipo, btnElement) {
  huertoActivo = tipo;
  document.querySelectorAll('.huerto-tab').forEach(t => t.classList.remove('active'));
  btnElement.classList.add('active');
  document.getElementById('currentHuertoTitle').innerText = tipo === 'nft' ? 'Huerto NFT' : 'Raíces Flotantes';
  escucharFirebase();
}

function toggleMostrarPass() {
  const pass = document.getElementById("passInput");
  const icon = document.getElementById("togglePassword");
  if (!pass) return;
  if (pass.type === "password") { pass.type = "text"; icon.classList.replace("fa-eye", "fa-eye-slash"); }
  else { pass.type = "password"; icon.classList.replace("fa-eye-slash", "fa-eye"); }
}

function seleccionarPerfil(user) {
  document.getElementById('userInput').value = user;
  document.getElementById('selectedUserLabel').innerText = user;
  document.getElementById('hydeMiniAvatarIcon').innerHTML = (user === 'H.A.G.D.R.') ? '<i class="fa-solid fa-user-shield"></i>' : '<i class="fa-solid fa-seedling"></i>';
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
    if (remember) { localStorage.setItem("hidro_logged_in", "true"); localStorage.setItem("hidro_role", userRole); }
    mostrarInterfaz();
  } else {
    document.getElementById('loginCard').classList.add("shake");
    setTimeout(() => document.getElementById('loginCard').classList.remove("shake"), 500);
    document.getElementById("loginErrorMsg").classList.remove("hidden");
  }
}

function mostrarInterfaz() {
  document.getElementById("loginOverlay").style.opacity = "0";
  setTimeout(() => document.getElementById("loginOverlay").classList.add("hidden"), 400);
  document.getElementById("appContainer").classList.remove("hidden");
  if ((userRole || localStorage.getItem("hidro_role")) === 'guest') document.body.classList.add('role-guest');
  setTimeout(cambiarMetricaGrafica, 100);
}

function cerrarSesion() {
  localStorage.removeItem("hidro_logged_in"); localStorage.removeItem("hidro_role");
  location.reload();
}

function iniciarReloj() {
  setInterval(() => {
    const reloj = document.getElementById("liveClock");
    if (reloj) reloj.innerText = new Date().toLocaleTimeString('es-MX');
  }, 1000);
}

function inicializarGrafica() {
  const canvas = document.getElementById('sensorChart');
  if (!canvas) return;
  sensorChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels: labelsHora, datasets: [{ label: 'pH', data: historyData.ph, borderColor: '#00f0ff', borderWidth: 2, tension: 0.3, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
  document.getElementById('chartSelect').addEventListener('change', cambiarMetricaGrafica);
}

function cambiarMetricaGrafica() {
  const metric = document.getElementById('chartSelect').value;
  const cfg = configMap[metric];
  if (sensorChart) sensorChart.destroy();
  sensorChart = new Chart(document.getElementById('sensorChart').getContext('2d'), {
    type: 'line',
    data: { labels: labelsHora, datasets: [{ label: cfg.label, data: historyData[metric], borderColor: cfg.color, backgroundColor: cfg.bg, borderWidth: 3, tension: 0.4, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
  calcularEstadisticasAvanzadas(metric);
}

// 2. Analítica y Estadísticas Avanzadas (Mín, Máx, Promedio)
function calcularEstadisticasAvanzadas(metric) {
  const arr = historyData[metric];
  if (!arr || arr.length === 0) {
    document.getElementById('statMin').innerText = '--';
    document.getElementById('statAvg').innerText = '--';
    document.getElementById('statMax').innerText = '--';
    return;
  }
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;

  document.getElementById('statMin').innerText = min.toFixed(2);
  document.getElementById('statAvg').innerText = avg.toFixed(2);
  document.getElementById('statMax').innerText = max.toFixed(2);
}

function exportarCSV() {
  database.ref('historial').limitToLast(300).once('value', (snap) => {
    const data = snap.val();
    if (!data) return alert("Sin datos.");
    let csv = "data:text/csv;charset=utf-8,Fecha,pH,EC,Temp,Humedad\n";
    Object.keys(data).forEach(k => {
      const r = data[k];
      csv += `"${r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}",${r.ph || 0},${r.ec || 0},${r.temperatura || 0},${r.humedad || 0}\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `Bitacora_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  });
}

function purgarBitacoraFirebase() {
  if (confirm("¿Purgar historial antiguo de Firebase?")) {
    database.ref('historial').remove().then(() => cargarHistorialFirebase());
  }
}

function cargarHistorialFirebase() {
  database.ref('historial').limitToLast(30).once('value', (snap) => {
    const data = snap.val();
    const tbody = document.getElementById('tablaHistorialBody');
    if (!tbody || !data) return;
    labelsHora.length = 0; Object.keys(historyData).forEach(k => historyData[k].length = 0);
    tbody.innerHTML = '';

    Object.keys(data).forEach(k => {
      const r = data[k];
      labelsHora.push(r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '');
      historyData.ph.push(r.ph || 0); historyData.temperatura.push(r.temperatura || 0);
      historyData.ec.push(r.ec || 0); historyData.humedad.push(r.humedad || 0);

      tbody.prepend(`<tr><td>${r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : ''}</td><td>${r.ph?.toFixed(1)}</td><td>${r.ec?.toFixed(1)}</td><td>${r.temperatura?.toFixed(1)}°C</td></tr>`);
    });
    cambiarMetricaGrafica();
  });
}

// 3. Diagnóstico ESP32 (RSSI, Uptime, Heap) y Escucha Firebase
function escucharFirebase() {
  database.ref(huertoActivo === 'nft' ? 'sensores' : 'sensores_raices').on('value', (snap) => {
    const data = snap.val();
    if (data) {
      ultimaVezDatos = Date.now();
      document.getElementById('statusBadge').className = "status-indicator online";
      document.getElementById('statusText').innerText = "ESP32 Conectado";
      
      document.getElementById('phValue').innerText = data.ph !== undefined ? Number(data.ph).toFixed(1) : '--';
      document.getElementById('ecValue').innerText = data.ec !== undefined ? Number(data.ec).toFixed(1) : '--';
      document.getElementById('tempValue').innerText = data.temperatura !== undefined ? Number(data.temperatura).toFixed(1) : '--';
      document.getElementById('humValue').innerText = data.humedad !== undefined ? Math.round(data.humedad) : '--';

      if(document.getElementById('phBar')) document.getElementById('phBar').style.width = Math.min(100, (data.ph / 14) * 100) + '%';
      if(document.getElementById('ecBar')) document.getElementById('ecBar').style.width = Math.min(100, (data.ec / 4) * 100) + '%';
      if(document.getElementById('tempBar')) document.getElementById('tempBar').style.width = Math.min(100, (data.temperatura / 50) * 100) + '%';
      if(document.getElementById('humBar')) document.getElementById('humBar').style.width = (data.humedad || 0) + '%';
    }
  });

  // Escuchar nodo de diagnóstico del ESP32
  database.ref('diagnostico').on('value', (snap) => {
    const diag = snap.val();
    if (diag) {
      document.getElementById('diagRssi').innerText = (diag.rssi || -65) + " dBm";
      document.getElementById('diagUptime').innerText = Math.round((diag.uptime || 0) / 60) + " min";
      document.getElementById('diagHeap').innerText = Math.round((diag.heap || 150000) / 1024) + " KB";
    }
  });

  database.ref(huertoActivo === 'nft' ? 'actuadores' : 'actuadores_raices').on('value', (snap) => {
    const act = snap.val();
    if (act) {
      actualizarBotonUI('bomba_principal', act.bomba_principal);
      actualizarBotonUI('bomba_muestreo', act.bomba_muestreo);
      actualizarBotonUI('peltier', act.peltier);
    }
  });

  database.ref('trackers').on('value', (snap) => {
    const container = document.getElementById('tracker-container');
    if (!container) return; container.innerHTML = '';
    const trackers = snap.val();
    if (trackers) Object.keys(trackers).forEach(k => renderTrackerItem(k, trackers[k]));
  });

  database.ref('tasks').on('value', (snap) => {
    const container = document.getElementById('task-container');
    if (!container) return; container.innerHTML = '';
    const tasks = snap.val();
    if (tasks) Object.keys(tasks).forEach(k => renderTaskItem(k, tasks[k]));
  });
}

function toggleActuador(act, estado) {
  if ((userRole || localStorage.getItem("hidro_role")) === 'guest') return;
  actualizarBotonUI(act, estado);
  database.ref(`${huertoActivo === 'nft' ? 'actuadores' : 'actuadores_raices'}/${act}`).set(estado);
}

function actualizarBotonUI(id, estado) {
  const btn = document.getElementById('btn-' + id);
  if (btn) btn.checked = Boolean(estado);
  const statusEl = document.getElementById(id === 'bomba_principal' ? 'statusBombaPrincipal' : id === 'bomba_muestreo' ? 'statusBomba2' : 'statusPeltier');
  if (statusEl) {
    statusEl.innerHTML = `<span class="status-dot" style="background:${estado ? 'var(--green-bright)' : ''}"></span> ${estado ? 'ENCENDIDA' : 'APAGADA'}`;
  }
}

// 4. Calibración & Registro de Insumos
function registrarCalibracion() {
  const hoy = new Date().toLocaleDateString();
  database.ref('mantenimiento/calibracion').set(hoy);
  alert("Fecha de calibración actualizada con éxito.");
}

function cargarMantenimientoFirebase() {
  database.ref('mantenimiento').on('value', (snap) => {
    const m = snap.val();
    if (m && m.calibracion) document.getElementById('txtCalibDate').innerText = m.calibracion;
  });
}

// 6. Programador de Horarios en la Nube
function guardarProgramacion() {
  const act = document.getElementById('schedActuator').value;
  const on = document.getElementById('schedTimeOn').value;
  const off = document.getElementById('schedTimeOff').value;
  database.ref(`schedules/${act}`).set({ on, off });
  alert("Regla horaria guardada en Firebase.");
}

// 5. Trackers con Notas de Campo
function addTracker() {
  const title = document.getElementById('tracker-input').value.trim();
  if (!title) return;
  database.ref('trackers').push({
    title,
    startDate: document.getElementById('tracker-date-input').value || new Date().toISOString().split('T')[0],
    totalDays: parseInt(document.getElementById('tracker-days-total').value) || 30,
    stages: [{name: "Germinación", completed:false}, {name: "Agua", completed:false}, {name: "Solución", completed:false}],
    notes: []
  });
  document.getElementById('tracker-input').value = '';
}

function guardarNotaTracker(key, noteText) {
  if (!noteText.trim()) return;
  database.ref(`trackers/${key}/notes`).push({ text: noteText, time: new Date().toLocaleTimeString() });
}

function renderTrackerItem(key, item) {
  const container = document.getElementById('tracker-container');
  if (!container) return;
  const isAdmin = (userRole || localStorage.getItem("hidro_role")) === 'admin';
  
  let stagesHTML = '';
  if (item.stages) {
    item.stages.forEach((s, idx) => {
      stagesHTML += `<div class="tracker-stage-box ${s.completed ? 'completed-check' : ''}" onclick="database.ref('trackers/${key}/stages/${idx}/completed').set(!${s.completed})">${s.name}</div>`;
    });
  }

  let notesHTML = '';
  if (item.notes) {
    Object.values(item.notes).forEach(n => { notesHTML += `<div>• [${n.time}] ${n.text}</div>`; });
  }

  const div = document.createElement('div');
  div.className = 'tracker-item';
  div.innerHTML = `
    <div class="tracker-header">
      <span class="tracker-title">${item.title}</span>
      <div class="tracker-actions">
        <span class="tracker-days">${item.totalDays} Días</span>
        ${isAdmin ? `<button class="tracker-delete" onclick="database.ref('trackers/${key}').remove()"><i class="fa-solid fa-xmark"></i></button>` : ''}
      </div>
    </div>
    <div class="tracker-stages-container">${stagesHTML}</div>
    <div class="tracker-notes-section">
      <span>Notas de campo:</span>
      <div class="tracker-notes-list">${notesHTML || 'Sin notas registradas.'}</div>
      ${isAdmin ? `<input type="text" class="tracker-notes-input" placeholder="Añadir nota rápida..." onkeydown="if(event.key==='Enter'){guardarNotaTracker('${key}', this.value); this.value='';}">` : ''}
    </div>
  `;
  container.appendChild(div);
}

function addTask() {
  const text = document.getElementById('task-input').value.trim();
  if (!text) return;
  database.ref('tasks').push({ text, completed: false });
  document.getElementById('task-input').value = '';
}

function renderTaskItem(key, task) {
  const container = document.getElementById('task-container');
  if (!container) return;
  const isAdmin = (userRole || localStorage.getItem("hidro_role")) === 'admin';
  const div = document.createElement('div');
  div.className = `task-item ${task.completed ? 'completed' : ''}`;
  div.innerHTML = `
    <div class="task-checkbox" onclick="database.ref('tasks/${key}/completed').set(!${task.completed})"><i class="fa-solid fa-check"></i></div>
    <span class="task-text">${task.text}</span>
    ${isAdmin ? `<button class="task-delete" onclick="database.ref('tasks/${key}').remove()"><i class="fa-solid fa-xmark"></i></button>` : ''}
  `;
  container.appendChild(div);
}