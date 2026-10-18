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

let currentThresholds = {
  phMin: 5.5, phMax: 6.5,
  ecMin: 2.0, ecMax: 2.5,
  tempMin: 18.0, tempMax: 24.0
};

const configMap = {
  ph: { label: 'pH del Agua', color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.15)' },
  temperatura: { label: 'Temperatura (°C)', color: '#ff5d67', bg: 'rgba(255, 93, 103, 0.15)' },
  ec: { label: 'CE (mS/cm)', color: '#ffd166', bg: 'rgba(255, 209, 102, 0.15)' },
  humedad: { label: 'Humedad (%)', color: '#35e58a', bg: 'rgba(53, 229, 138, 0.15)' }
};

document.addEventListener("DOMContentLoaded", () => {
  iniciarReloj();
  inicializarGraficaDual();
  
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
  cargarUmbralesFirebase();
});

function cambiarTemaVisual(themeName, guardar = true) {
  document.body.className = themeName;
  if (guardar) localStorage.setItem("hidro_theme", themeName);
}

function mostrarSeccion(secId) {
  document.querySelectorAll('.app-section').forEach(sec => sec.classList.add('hidden'));
  document.querySelectorAll('.nav-sec-btn').forEach(btn => btn.classList.remove('active'));

  const secObj = document.getElementById('section-' + secId);
  const btnObj = document.getElementById('sec-btn-' + secId);
  if (secObj) secObj.classList.remove('hidden');
  if (btnObj) btnObj.classList.add('active');

  if (secId === 'sensors' && sensorChart) {
    setTimeout(() => sensorChart.resize(), 100);
  }
}

function cambiarHuerto(tipo) {
  if (huertoActivo === tipo) return;
  huertoActivo = tipo;

  document.getElementById('tab-nft').classList.toggle('active', tipo === 'nft');
  document.getElementById('tab-raices').classList.toggle('active', tipo === 'raices');

  const titleEl = document.getElementById('currentHuertoTitle');
  const cardCe = document.getElementById('cardCeWrapper');
  const gridNft = document.getElementById('gridActuadoresNft');
  const gridRaices = document.getElementById('gridActuadoresRaices');

  if (tipo === 'nft') {
    titleEl.innerText = "Huerto NFT Principal";
    if (cardCe) cardCe.classList.remove('hidden');
    gridNft.classList.remove('hidden');
    gridRaices.classList.add('hidden');
  } else {
    titleEl.innerText = "Huerto Raíces Flotantes";
    if (cardCe) cardCe.classList.add('hidden');
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

  const banner = document.getElementById('systemBanner');
  if (banner) {
    banner.style.background = "rgba(255, 93, 103, 0.12)";
    banner.style.borderColor = "rgba(255, 93, 103, 0.4)";
    banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i> <span>ESP32 Fuera de Línea · Sin transmisión de datos</span>`;
  }
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
  setTimeout(actualizarGraficaDual, 100);
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

function inicializarGraficaDual() {
  const canvas = document.getElementById('sensorChart');
  if (!canvas) return;

  sensorChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: labelsHora,
      datasets: [
        {
          label: 'pH',
          data: historyData.ph,
          borderColor: '#00f0ff',
          backgroundColor: 'rgba(0, 240, 255, 0.1)',
          yAxisID: 'y1',
          tension: 0.3, fill: true
        },
        {
          label: 'CE',
          data: historyData.ec,
          borderColor: '#ffd166',
          backgroundColor: 'rgba(255, 209, 102, 0.1)',
          yAxisID: 'y2',
          tension: 0.3, fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y1: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.05)' } },
        y2: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } }
      }
    }
  });

  document.getElementById('chartSelectY1').addEventListener('change', actualizarGraficaDual);
  document.getElementById('chartSelectY2').addEventListener('change', actualizarGraficaDual);
}

function actualizarGraficaDual() {
  const m1 = document.getElementById('chartSelectY1').value;
  const m2 = document.getElementById('chartSelectY2').value;
  const cfg1 = configMap[m1];
  const cfg2 = configMap[m2];

  if (!sensorChart) return;
  sensorChart.data.datasets[0].label = cfg1.label;
  sensorChart.data.datasets[0].data = historyData[m1];
  sensorChart.data.datasets[0].borderColor = cfg1.color;
  sensorChart.data.datasets[0].backgroundColor = cfg1.bg;

  sensorChart.data.datasets[1].label = cfg2.label;
  sensorChart.data.datasets[1].data = historyData[m2];
  sensorChart.data.datasets[1].borderColor = cfg2.color;
  sensorChart.data.datasets[1].backgroundColor = cfg2.bg;

  sensorChart.update();
  calcularEstadisticasY1(m1);
}

function calcularEstadisticasY1(metric) {
  const arr = historyData[metric];
  if (!arr || arr.length === 0) return;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  document.getElementById('statMin').innerText = min.toFixed(1);
  document.getElementById('statAvg').innerText = avg.toFixed(1);
  document.getElementById('statMax').innerText = max.toFixed(1);
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
  if (confirm("¿Purgar historial en Firebase?")) {
    database.ref('historial').remove().then(() => cargarHistorialFirebase());
  }
}

function cargarHistorialFirebase() {
  database.ref('historial').limitToLast(30).once('value', (snap) => {
    const data = snap.val();
    const tbody = document.getElementById('tablaHistorialBody');
    if (!tbody) return;
    if (!data) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 15px;">Sin registros.</td></tr>`; return; }

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
    actualizarGraficaDual();
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

      const banner = document.getElementById('systemBanner');
      if (banner) {
        banner.style.background = "rgba(53, 229, 138, 0.12)";
        banner.style.borderColor = "rgba(53, 229, 138, 0.4)";
        banner.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--green-bright);"></i> <span>Sistema Online · Datos en vivo</span>`;
      }

      document.getElementById('phValue').innerText = data.ph !== undefined ? Number(data.ph).toFixed(1) : '--';
      document.getElementById('ecValue').innerText = data.ec !== undefined ? Number(data.ec).toFixed(1) : '--';
      document.getElementById('tempValue').innerText = data.temperatura !== undefined ? Number(data.temperatura).toFixed(1) : '--';
      document.getElementById('humValue').innerText = data.humedad !== undefined ? Math.round(data.humedad) : '--';

      if(document.getElementById('phBar')) document.getElementById('phBar').style.width = Math.min(100, (data.ph / 14) * 100) + '%';
      if(document.getElementById('ecBar')) document.getElementById('ecBar').style.width = Math.min(100, (data.ec / 4) * 100) + '%';
      if(document.getElementById('tempBar')) document.getElementById('tempBar').style.width = Math.min(100, (data.temperatura / 50) * 100) + '%';
      if(document.getElementById('humBar')) document.getElementById('humBar').style.width = (data.humedad || 0) + '%';
// Validación de estado de sensores en tiempo real
      const tempBadge = document.getElementById('status-temp');
      if (tempBadge) {
        if (data.temperatura === undefined || data.temperatura === null || data.temperatura <= -127) {
          tempBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i> Error`;
          tempBadge.style.color = "var(--danger)";
        } else {
          tempBadge.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--green-bright);"></i> OK`;
          tempBadge.style.color = "var(--green-bright)";
        }
      }
      const phBadge = document.getElementById('status-ph');
      if (phBadge) {
        if (data.ph === undefined || data.ph === null || data.ph < 0 || data.ph > 14) {
          phBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i> Error`;
          phBadge.style.color = "var(--danger)";
        } else {
          phBadge.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--green-bright);"></i> OK`;
          phBadge.style.color = "var(--green-bright)";
        }
      }
      evaluarAlertasAnomalias(data);
    } else {
      marcarDesconectado();
    }
  });

  database.ref('diagnostico').on('value', (snap) => {
    const diag = snap.val();
    if (diag) {
      if (document.getElementById('diagRssi')) document.getElementById('diagRssi').innerText = (diag.rssi || '--') + ' dBm';
      if (document.getElementById('diagUptime')) document.getElementById('diagUptime').innerText = (diag.uptime || '--') + ' min';
      if (document.getElementById('diagHeap')) document.getElementById('diagHeap').innerText = (diag.heap || '--') + ' KB';
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
        actualizarBotonUI('bypass', act.bypass);
        actualizarBotonUI('inyeccion', act.inyeccion);
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
    id === 'peltier' || id === 'raices_peltier' ? (id === 'raices_peltier' ? 'statusRaicesPeltier' : 'statusPeltier') : 
    id === 'bypass' ? 'statusBypass' : 
    id === 'inyeccion' ? 'statusInyeccion' : 'statusBombaAire'
  );
  if (statusEl) {
    statusEl.innerHTML = `<span class="status-dot" style="background:${estado ? 'var(--green-bright)' : 'var(--danger)'}"></span> ${estado ? 'ENCENDIDO' : 'APAGADO'}`;
  }

  if (id === 'bomba_principal' || id === 'bypass') {
    const pipe = document.getElementById('pipeFlow');
    if (pipe) {
      if (estado) pipe.classList.add('flow-active');
      else pipe.classList.remove('flow-active');
    }
  }
}

function guardarUmbrales() {
  currentThresholds.phMin = parseFloat(document.getElementById('threshPhMin').value);
  currentThresholds.phMax = parseFloat(document.getElementById('threshPhMax').value);
  currentThresholds.ecMin = parseFloat(document.getElementById('threshEcMin').value);
  currentThresholds.ecMax = parseFloat(document.getElementById('threshEcMax').value);
  currentThresholds.tempMin = parseFloat(document.getElementById('threshTempMin').value);
  currentThresholds.tempMax = parseFloat(document.getElementById('threshTempMax').value);

  database.ref('umbrales').set(currentThresholds).then(() => {
    alert("¡Umbrales actualizados con éxito en Firebase!");
  });
}

function cargarUmbralesFirebase() {
  database.ref('umbrales').on('value', (snap) => {
    const u = snap.val();
    if (u) {
      currentThresholds = u;
      if (document.getElementById('threshPhMin')) document.getElementById('threshPhMin').value = u.phMin;
      if (document.getElementById('threshPhMax')) document.getElementById('threshPhMax').value = u.phMax;
      if (document.getElementById('threshEcMin')) document.getElementById('threshEcMin').value = u.ecMin;
      if (document.getElementById('threshEcMax')) document.getElementById('threshEcMax').value = u.ecMax;
      if (document.getElementById('threshTempMin')) document.getElementById('threshTempMin').value = u.tempMin;
      if (document.getElementById('threshTempMax')) document.getElementById('threshTempMax').value = u.tempMax;

      if (document.getElementById('phRangeLabel')) document.getElementById('phRangeLabel').innerText = `${u.phMin} - ${u.phMax}`;
      if (document.getElementById('ecRangeLabel')) document.getElementById('ecRangeLabel').innerText = `${u.ecMin} - ${u.ecMax}`;
      if (document.getElementById('tempRangeLabel')) document.getElementById('tempRangeLabel').innerText = `${u.tempMin}°C - ${u.tempMax}°C`;
    }
  });
}

function evaluarAlertasAnomalias(d) {
  const alertBox = document.getElementById('alertStatusBox');
  if (!alertBox) return;

  let anomalies = [];
  if (d.ph < currentThresholds.phMin || d.ph > currentThresholds.phMax) anomalies.push(`pH fuera de rango (${d.ph})`);
  if (huertoActivo === 'nft' && (d.ec < currentThresholds.ecMin || d.ec > currentThresholds.ecMax)) anomalies.push(`CE fuera de rango (${d.ec})`);
  if (d.temperatura < currentThresholds.tempMin || d.temperatura > currentThresholds.tempMax) anomalies.push(`Temperatura crítica (${d.temperatura}°C)`);

  if (anomalies.length > 0) {
    alertBox.style.background = "rgba(255, 93, 103, 0.15)";
    alertBox.style.borderColor = "var(--danger)";
    alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i> <strong>ALERTA CRÍTICA:</strong> ${anomalies.join(', ')}`;
  } else {
    alertBox.style.background = "rgba(0,0,0,0.3)";
    alertBox.style.borderColor = "var(--card-border)";
    alertBox.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--green-bright);"></i> Todos los parámetros se encuentran dentro de los rangos óptimos.`;
  }
}

function registrarCalibracionSonda(tipo) {
  const hoy = new Date().toLocaleDateString('es-MX');
  database.ref(`mantenimiento/calibracion_${tipo}`).set(hoy);
  alert(`¡Calibración de la sonda de ${tipo.toUpperCase()} guardada!`);
}

function cargarMantenimientoFirebase() {
  database.ref('mantenimiento').on('value', (snap) => {
    const m = snap.val();
    if (m) {
      if (m.calibracion_ph && document.getElementById('calibPhDate')) document.getElementById('calibPhDate').innerText = m.calibracion_ph;
      if (m.calibracion_ec && document.getElementById('calibEcDate')) document.getElementById('calibEcDate').innerText = m.calibracion_ec;
      if (m.calibracion_temp && document.getElementById('calibTempDate')) document.getElementById('calibTempDate').innerText = m.calibracion_temp;
    }
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
  if (!messaging) return alert("Tu navegador no soporta notificaciones Web Push.");
  
  Notification.requestPermission().then((permission) => {
    if (permission === 'granted') {
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
            alert("¡Notificaciones Push Nativas activadas con éxito!");
          }
        });
      });
    } else {
      alert("Permiso de notificaciones denegado.");
    }
  });
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
    <div class="tracker-stage-segment stage-agua" style="width: ${wAgua}%;">Agua (7d)</div>
    <div class="tracker-stage-segment stage-sol50" style="width: ${w50}%;">Sol. 50% (7d)</div>
    <div class="tracker-stage-segment stage-sol100" style="width: ${w100}%;">Sol. 100% (${dias100}d)</div>
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
      <span>Cosecha estimada: +${totalDays}d</span>
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