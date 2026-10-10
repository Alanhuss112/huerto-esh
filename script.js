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
const messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;

let sensorChart;
const historyData = { ph: [], temperatura: [], ec: [], humedad: [] };
const labelsHora = [];
let userRole = null; 
let huertoActivo = 'nft';
let ultimaVezDatos = 0;
let intervaloVerificacion = null;
let refSensoresActual = null;
let refActuadoresActual = null;

const configMap = {
  ph: { label: 'pH', color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.15)' },
  temperatura: { label: 'Temperatura (°C)', color: '#ff5d67', bg: 'rgba(255, 93, 103, 0.15)' },
  ec: { label: 'CE (mS/cm)', color: '#ffd166', bg: 'rgba(255, 209, 102, 0.15)' },
  humedad: { label: 'Humedad (%)', color: '#35e58a', bg: 'rgba(53, 229, 138, 0.15)' }
};

document.addEventListener("DOMContentLoaded", () => {
  iniciarReloj();
  inicializarGrafica();
  
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

function cambiarTemaVisual(themeName, guardar = true) {
  document.body.className = themeName;
  if (guardar) localStorage.setItem("hidro_theme", themeName);
}

function cambiarHuerto(tipo) {
  if (huertoActivo === tipo) return;
  huertoActivo = tipo;

  document.getElementById('tab-nft').classList.toggle('active', tipo === 'nft');
  document.getElementById('tab-raices').classList.toggle('active', tipo === 'raices');

  const titleEl = document.getElementById('currentHuertoTitle');
  const panelTitle = document.getElementById('panelActuadoresTitle');
  const gridNft = document.getElementById('gridActuadoresNft');
  const gridRaices = document.getElementById('gridActuadoresRaices');

  if (tipo === 'nft') {
    titleEl.innerText = "Huerto NFT Principal";
    panelTitle.innerText = "Huerto NFT";
    gridNft.classList.remove('hidden');
    gridRaices.classList.add('hidden');
  } else {
    titleEl.innerText = "Huerto Raíces Flotantes";
    panelTitle.innerText = "Raíces Flotantes";
    gridNft.classList.add('hidden');
    gridRaices.classList.remove('hidden');
  }

  marcarDesconectado();
  escucharFirebase();
}

function marcarDesconectado() {
  ultimaVezDatos = 0;
  document.getElementById('statusBadge').className = "status-indicator offline";
  document.getElementById('statusText').innerText = "ESP32 Desconectado";
  document.getElementById('phValue').innerText = '--';
  document.getElementById('ecValue').innerText = '--';
  document.getElementById('tempValue').innerText = '--';
  document.getElementById('humValue').innerText = '--';
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
  document.getElementById('hexAvatarIcon').innerHTML = (user === 'H.A.G.D.R.') ? '<i class="fa-solid fa-user-shield"></i>' : '<i class="fa-solid fa-binoculars"></i>';
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
  const overlay = document.getElementById("loginOverlay");
  overlay.style.transition = "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
  overlay.style.opacity = "0";
  overlay.style.transform = "scale(1.04)";
  
  setTimeout(() => {
    overlay.classList.add("hidden");
    const app = document.getElementById("appContainer");
    app.classList.remove("hidden");
    app.style.opacity = "0";
    app.style.transition = "opacity 0.8s ease";
    setTimeout(() => {
      app.style.opacity = "1";
    }, 50);
  }, 600);

  if ((userRole || localStorage.getItem("hidro_role")) === 'guest') {
    document.body.classList.add('role-guest');
  }
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
    if (!tbody) return;
    if (!data) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 10px;">Sin registros.</td></tr>`; return; }

    labelsHora.length = 0; Object.keys(historyData).forEach(k => historyData[k].length = 0);
    tbody.innerHTML = '';

    Object.keys(data).forEach(k => {
      const r = data[k];
      const fechaLegible = r.timestamp ? new Date(r.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : "Auto";
      labelsHora.push(fechaLegible);
      historyData.ph.push(r.ph || 0); historyData.temperatura.push(r.temperatura || 0);
      historyData.ec.push(r.ec || 0); historyData.humedad.push(r.humedad || 0);

      const fila = document.createElement('tr');
      fila.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
      fila.innerHTML = `
        <td style="padding: 8px;">${fechaLegible}</td>
        <td style="padding: 8px;">${r.ph !== undefined ? r.ph.toFixed(1) : '--'}</td>
        <td style="padding: 8px;">${r.ec !== undefined ? r.ec.toFixed(1) : '--'}</td>
        <td style="padding: 8px;">${r.temperatura !== undefined ? r.temperatura.toFixed(1) : '--'} °C</td>
        <td style="padding: 8px;">${r.humedad !== undefined ? Math.round(r.humedad) : '--'} %</td>
      `;
      tbody.prepend(fila);
    });
    cambiarMetricaGrafica();
  });
}

function escucharFirebase() {
  if (refSensoresActual) refSensoresActual.off();
  if (refActuadoresActual) refActuadoresActual.off();

  const nodoSensores = huertoActivo === 'nft' ? 'sensores' : 'sensores_raices';
  refSensoresActual = database.ref(nodoSensores);

  refSensoresActual.on('value', (snap) => {
    const data = snap.val();
    if (data && data.timestamp && (Date.now() - data.timestamp < 15000)) {
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

      evaluarAlertas(data);
    } else {
      marcarDesconectado();
    }
  });

  if (intervaloVerificacion) clearInterval(intervaloVerificacion);
  intervaloVerificacion = setInterval(() => {
    if (Date.now() - ultimaVezDatos > 15000) marcarDesconectado();
  }, 4000);

  const nodoActuadores = huertoActivo === 'nft' ? 'actuadores' : 'actuadores_raices';
  refActuadoresActual = database.ref(nodoActuadores);

  refActuadoresActual.on('value', (snap) => {
    const act = snap.val();
    if (act) {
      if (huertoActivo === 'nft') {
        actualizarBotonUI('bomba_principal', act.bomba_principal);
        actualizarBotonUI('bomba_muestreo', act.bomba_muestreo);
        actualizarBotonUI('peltier', act.peltier);
      } else {
        actualizarBotonUI('raices_peltier', act.peltier);
        actualizarBotonUI('bomba_aire', act.bomba_aire);
      }
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
  if (huertoActivo === 'nft') {
    database.ref(`actuadores/${act}`).set(estado);
  } else {
    let key = act === 'raices_peltier' ? 'peltier' : 'bomba_aire';
    database.ref(`actuadores_raices/${key}`).set(estado);
  }
}

function actualizarBotonUI(id, estado) {
  const btn = document.getElementById('btn-' + id);
  if (btn) btn.checked = Boolean(estado);
  const statusEl = document.getElementById(
    id === 'bomba_principal' ? 'statusBombaPrincipal' : 
    id === 'bomba_muestreo' ? 'statusBomba2' : 
    id === 'peltier' || id === 'raices_peltier' ? (id === 'raices_peltier' ? 'statusRaicesPeltier' : 'statusPeltier') : 'statusBombaAire'
  );
  if (statusEl) {
    statusEl.innerHTML = `<span class="status-dot" style="background:${estado ? 'var(--green-bright)' : ''}"></span> ${estado ? 'ENCENDIDA' : 'APAGADA'}`;
  }
}

function registrarCalibracion() {
  const hoy = new Date().toLocaleDateString();
  database.ref('mantenimiento/calibracion').set(hoy);
  alert("Fecha de calibración registrada.");
}

function cargarMantenimientoFirebase() {
  database.ref('mantenimiento').on('value', (snap) => {
    const m = snap.val();
    if (m && m.calibracion) document.getElementById('txtCalibDate').innerText = m.calibracion;
  });
}

function guardarProgramacion() {
  const act = document.getElementById('schedActuator').value;
  const on = document.getElementById('schedTimeOn').value;
  const off = document.getElementById('schedTimeOff').value;
  database.ref(`schedules/${act}`).set({ on, off });
  alert("Regla guardada.");
}

function solicitarNotificaciones() {
  if (!messaging) {
    alert("Tu navegador no soporta notificaciones push nativas.");
    return;
  }

  Notification.requestPermission().then((permission) => {
    if (permission === 'granted') {
      console.log('Permiso de notificaciones concedido.');
      navigator.serviceWorker.register('./firebase-messaging-sw.js').then((registration) => {
        messaging.getToken({ 
          serviceWorkerRegistration: registration,
          vapidKey: 'BJBLJ1psCydMWxnpj3LX5TbH6ev9Br8EjHgoBUdniqs2DHwm-5o2m20UW-TRyIUGT5ZFPQaoRgJSEKX1VCE2-M4' 
        }).then((currentToken) => {
          if (currentToken) {
            const tokenKey = currentToken.substring(0, 15);
            database.ref('fcm_tokens/' + tokenKey).set({
              token: currentToken,
              dispositivo: navigator.userAgent,
              actualizado: Date.now()
            });
            alert("¡Notificaciones Push Nativas activadas y sincronizadas con éxito!");
          } else {
            console.log('No se encontró token de registro.');
          }
        }).catch((err) => {
          console.error('Error al recuperar el token de FCM:', err);
        });
      });
    } else {
      alert("Permiso de notificaciones denegado.");
    }
  }).catch((err) => {
    console.error('Error al solicitar permisos:', err);
  });
}

function evaluarAlertas(d) {
  if (Notification.permission === 'granted' && d.ph < 5.0 || (d && d.ph > 7.0)) {
    // Las alertas en segundo plano ahora se manejan mediante FCM en el servidor o Cloud Functions
  }
}

function addTracker() {
  const title = document.getElementById('tracker-input').value.trim();
  const totalDays = parseInt(document.getElementById('tracker-days-total').value) || 30;
  const dateInput = document.getElementById('tracker-date-input').value;

  if (!title) return;
  const fechaHoy = new Date().toISOString().split('T')[0];

  database.ref('trackers').push({
    title: title,
    totalDays: totalDays,
    startDate: dateInput ? dateInput : fechaHoy
  });

  document.getElementById('tracker-input').value = '';
  document.getElementById('tracker-date-input').value = '';
}

function renderTrackerItem(key, item) {
  const container = document.getElementById('tracker-container');
  if (!container) return;
  const isAdmin = (userRole || localStorage.getItem("hidro_role")) === 'admin';
  
  const totalDays = item.totalDays || 30;
  const fechaValida = item.startDate || new Date().toISOString().split('T')[0];
  const diffDays = Math.floor(Math.max(0, new Date() - new Date(fechaValida)) / (1000 * 60 * 60 * 24));
  let currentDay = Math.min(totalDays, Math.max(1, 1 + diffDays));
  const percentage = Math.min(100, Math.max(0, (currentDay / totalDays) * 100));

  const diasAgua = Math.min(7, totalDays);
  const dias50 = Math.min(7, Math.max(0, totalDays - 7));
  const dias100 = Math.max(0, totalDays - 14);

  const wAgua = ((diasAgua / totalDays) * 100).toFixed(2);
  const w50 = ((dias50 / totalDays) * 100).toFixed(2);
  const w100 = ((dias100 / totalDays) * 100).toFixed(2);

  let stagesHTML = `
    <div class="tracker-stage-segment stage-agua" style="width: ${wAgua}%;" title="Agua: 7 días">Agua (7d)</div>
    <div class="tracker-stage-segment stage-sol50" style="width: ${w50}%;" title="Solución 50%: 7 días">Sol. 50% (7d)</div>
    <div class="tracker-stage-segment stage-sol100" style="width: ${w100}%;" title="Solución 100%: Resto">Sol. 100% (${dias100}d)</div>
  `;

  const div = document.createElement('div');
  div.className = 'tracker-item';
  div.innerHTML = `
    <div class="tracker-header">
      <span class="tracker-title">${item.title}</span>
      <div class="tracker-actions">
        <span class="tracker-days">Día ${currentDay} / ${totalDays}</span>
        ${isAdmin ? `<button class="tracker-delete" onclick="database.ref('trackers/${key}').remove()"><i class="fa-solid fa-xmark"></i></button>` : ''}
      </div>
    </div>
    <div class="tracker-visual-bar">
      ${stagesHTML}
      <div class="tracker-cursor" style="left: ${percentage}%;"></div>
    </div>
    <div class="tracker-dates">
      <span>Inicio: ${fechaValida}</span>
      <span>Cosecha: +${totalDays}d</span>
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