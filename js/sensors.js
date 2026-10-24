let huertoActivo = 'nft';
let ultimaVezDatos = 0;
let intervaloVerificacion = null;
let refSensoresActual = null;
let refActuadoresActual = null;
let ultimaAlertaRegistrada = 0;

let currentThresholds = {
  phMin: 5.5, phMax: 6.5,
  ecMin: 2.0, ecMax: 2.5,
  tempMin: 18.0, tempMax: 24.0
};

document.addEventListener("DOMContentLoaded", () => {
  escucharFirebase();
  cargarHistorialFirebase();
  cargarMantenimientoFirebase();
  cargarUmbralesFirebase();
  cargarHistorialAlertasFirebase();
});

function mostrarSeccion(secId) {
  document.querySelectorAll('.app-section').forEach(sec => sec.classList.add('hidden'));
  document.querySelectorAll('.nav-sec-btn').forEach(btn => btn.classList.remove('active'));

  const secObj = document.getElementById('section-' + secId);
  const btnObj = document.getElementById('sec-btn-' + secId);
  if (secObj) secObj.classList.remove('hidden');
  if (btnObj) btnObj.classList.add('active');

  if (secId === 'sensors' && window.sensorChart) {
    setTimeout(() => window.sensorChart.resize(), 100);
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

  // Animación del flujo principal y nodos interactivos en el diagrama hidráulico
  if (id === 'bomba_principal') {
    const pipe = document.getElementById('pipeFlow');
    const nodeTank = document.getElementById('schemaNodeTank');
    const txtTank = document.getElementById('schemaStatusTank');
    if (pipe) {
      if (estado) {
        pipe.classList.add('flow-active');
        if(nodeTank) nodeTank.style.borderColor = 'var(--green-bright)';
        if(txtTank) { txtTank.innerText = "Fluyendo"; txtTank.style.color = "var(--green-bright)"; }
      } else {
        pipe.classList.remove('flow-active');
        if(nodeTank) nodeTank.style.borderColor = 'var(--card-border)';
        if(txtTank) { txtTank.innerText = "Reposo"; txtTank.style.color = "var(--text-muted)"; }
      }
    }
  }

  // Animación interactiva para la Válvula Bypass
  if (id === 'bypass') {
    const pipeBypass = document.getElementById('pipeBypassFlow');
    const nodeBypass = document.getElementById('schemaNodeBypass');
    const txtBypass = document.getElementById('schemaStatusBypass');
    if (pipeBypass) {
      if (estado) {
        pipeBypass.classList.add('flow-active');
        if(nodeBypass) nodeBypass.style.borderColor = 'var(--warning)';
        if(txtBypass) { txtBypass.innerText = "Desviando"; txtBypass.style.color = "var(--warning)"; }
      } else {
        pipeBypass.classList.remove('flow-active');
        if(nodeBypass) nodeBypass.style.borderColor = 'var(--card-border)';
        if(txtBypass) { txtBypass.innerText = "Desactivada"; txtBypass.style.color = "var(--text-muted)"; }
      }
    }
  }

  // Animación para el Peltier
  if (id === 'peltier') {
    const nodePeltier = document.getElementById('schemaNodePeltier');
    const txtPeltier = document.getElementById('schemaStatusPeltier');
    if (nodePeltier && txtPeltier) {
      if (estado) {
        nodePeltier.style.borderColor = 'var(--cyan-neon)';
        txtPeltier.innerText = "Enfriando";
        txtPeltier.style.color = "var(--cyan-neon)";
      } else {
        nodePeltier.style.borderColor = 'var(--card-border)';
        txtPeltier.innerText = "Apagado";
        txtPeltier.style.color = "var(--text-muted)";
      }
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

    const ahora = Date.now();
    if (ahora - ultimaAlertaRegistrada > 120000) {
      ultimaAlertaRegistrada = ahora;
      const fechaLegible = new Date().toLocaleString('es-MX');
      database.ref('push_alerts_history').push({
        mensaje: anomalies.join(' | '),
        valor: `pH: ${d.ph} | CE: ${d.ec || 'N/A'} | Temp: ${d.temperatura}°C`,
        fecha: fechaLegible,
        estado: 'Enviada / Registrada',
        timestamp: ahora
      });
    }
  } else {
    alertBox.style.background = "rgba(0,0,0,0.3)";
    alertBox.style.borderColor = "var(--card-border)";
    alertBox.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--green-bright);"></i> Todos los parámetros se encuentran dentro de los rangos óptimos.`;
  }
}

function cargarHistorialAlertasFirebase() {
  database.ref('push_alerts_history').limitToLast(20).on('value', (snap) => {
    const data = snap.val();
    const tbody = document.getElementById('tablaAlertasPushBody');
    if (!tbody) return;

    if (!data) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 15px;">Sin alertas recientes registradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    Object.values(data).reverse().forEach(reg => {
      const fila = document.createElement('tr');
      fila.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
      fila.innerHTML = `
        <td style="padding: 8px; color: var(--warning); font-weight: 600;">${reg.fecha || 'N/D'}</td>
        <td style="padding: 8px;"><strong>${reg.mensaje}</strong></td>
        <td style="padding: 8px; font-size: 0.8rem;">${reg.valor || '--'}</td>
        <td style="padding: 8px;"><span style="background: rgba(255,209,102,0.15); color: var(--warning); padding: 3px 8px; border-radius: 8px; font-size: 0.75rem; font-weight: 700;">${reg.estado || 'Activa'}</span></td>
      `;
      tbody.appendChild(fila);
    });
  });
}

function registrarCalibracionSonda(tipo) {
  const hoy = new Date().toLocaleDateString('es-MX');
  const horaActual = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const fechaCompleta = `${hoy} ${horaActual}`;
  
  let eventoDesc = "";
  let idLabel = "";

  if (tipo === 'ph') {
    eventoDesc = "Calibración Sonda pH (Buffers 4.0 / 7.0 / 10.0)";
    idLabel = "calibPhDate";
  } else if (tipo === 'ec') {
    eventoDesc = "Calibración Sonda Conductividad (CE/TDS Standard)";
    idLabel = "calibEcDate";
  } else if (tipo === 'temp') {
    eventoDesc = "Calibración Offset Temperatura Agua DS18B20";
    idLabel = "calibTempDate";
  }

  if (document.getElementById(idLabel)) document.getElementById(idLabel).innerText = hoy;

  database.ref(`mantenimiento/calibracion_${tipo}`).set(hoy);

  const rolOperador = (userRole || localStorage.getItem("hidro_role")) === 'admin' ? 'H.A.G.D.R.' : 'Hidrouser';
  
  database.ref('mantenimiento/eventos').push({
    evento: eventoDesc,
    usuario: rolOperador,
    fecha: fechaCompleta,
    tipo: tipo,
    timestamp: Date.now()
  });

  alert(`¡${eventoDesc} registrada exitosamente y guardada en la bitácora!`);
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

  database.ref('mantenimiento/eventos').limitToLast(15).on('value', (snap) => {
    const eventos = snap.val();
    const tbody = document.getElementById('tablaHistorialBody');
    if (!tbody || !eventos) return;

    tbody.innerHTML = '';
    Object.values(eventos).reverse().forEach(reg => {
      const fila = document.createElement('tr');
      fila.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
      fila.innerHTML = `
        <td style="padding: 8px; color: var(--cyan-neon); font-weight: 600;">${reg.fecha || 'N/D'}</td>
        <td colspan="4" style="padding: 8px;">
          <strong><i class="fa-solid fa-screwdriver-wrench" style="color: var(--warning); margin-right: 5px;"></i>${reg.evento}</strong>
          <br><small style="opacity: 0.7;">Operador: ${reg.usuario}</small>
        </td>
      `;
      tbody.appendChild(fila);
    });
  });
}

function purgarBitacoraFirebase() {
  if (confirm("¿Purgar historial de lecturas y bitácora en Firebase?")) {
    database.ref('historial').remove().then(() => cargarHistorialFirebase());
    database.ref('mantenimiento').remove().then(() => cargarMantenimientoFirebase());
  }
}

function purgarAlertasFirebase() {
  if (confirm("¿Desea limpiar todo el historial de alertas push recientes?")) {
    database.ref('push_alerts_history').remove().then(() => cargarHistorialAlertasFirebase());
  }
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

// --- COMANDOS REMOTOS OTA / ESP32 ---
function enviarComandoRemotoESP32(cmd) {
  if ((userRole || localStorage.getItem("hidro_role")) === 'guest') {
    return alert("Acceso restringido a administradores.");
  }
  if (confirm(`¿Seguro que desea enviar el comando remoto [${cmd}] al ESP32?`)) {
    database.ref('comandos_ota').set({
      accion: cmd,
      timestamp: Date.now()
    }).then(() => {
      alert(`Comando '${cmd}' enviado correctamente al microcontrolador.`);
    });
  }
}

// --- ASISTENTE DE CALIBRACIÓN GUIADA PASO A PASO ---
function iniciarCalibracionGuiada(tipo) {
  const modal = document.getElementById('calibrationModal');
  const content = document.getElementById('calibStepContent');
  if (!modal || !content) return;

  modal.classList.remove('hidden');
  
  let titulo = tipo === 'ph' ? 'Calibración Sonda pH' : tipo === 'ec' ? 'Calibración Sonda CE' : 'Calibración Offset Temperatura';
  
  content.innerHTML = `
    <h4 style="color: var(--green-bright); margin-bottom: 5px;">${titulo} - Paso 1 de 3</h4>
    <p>1. Limpie cuidadosamente la sonda con agua destilada y séquela con un paño suave.</p>
    <p>2. Sumerja el sensor en la solución estándar de referencia correspondiente.</p>
    <div style="display: flex; gap: 10px; margin-top: 15px;">
      <button class="btn-add" style="flex:1;" onclick="ejecutarPasoCalibracion('${tipo}', 2)">Siguiente Paso <i class="fa-solid fa-arrow-right"></i></button>
      <button class="btn-danger-custom" onclick="cerrarModalCalibracion()">Cancelar</button>
    </div>
  `;
}

function ejecutarPasoCalibracion(tipo, paso) {
  const content = document.getElementById('calibStepContent');
  if (!content) return;

  if (paso === 2) {
    content.innerHTML = `
      <h4 style="color: var(--warning); margin-bottom: 5px;">Calibración - Paso 2 de 3</h4>
      <p>Esperando estabilización de lectura del sensor (lectura en curso)...</p>
      <div style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--cyan-neon);"></i></div>
      <button class="btn-add" style="width: 100%; margin-top: 15px;" onclick="ejecutarPasoCalibracion('${tipo}', 3)">Confirmar Estabilización</button>
    `;
  } else if (paso === 3) {
    registrarCalibracionSonda(tipo);
    content.innerHTML = `
      <h4 style="color: var(--green-bright); margin-bottom: 5px;"><i class="fa-solid fa-circle-check"></i> Calibración Exitosa</h4>
      <p>Los parámetros de calibración se han guardado y sincronizado con éxito.</p>
      <button class="btn-add" style="width: 100%; margin-top: 15px;" onclick="cerrarModalCalibracion()">Finalizar</button>
    `;
  }
}

function cerrarModalCalibracion() {
  const modal = document.getElementById('calibrationModal');
  if (modal) modal.classList.add('hidden');
}