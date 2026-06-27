import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let chartPH, chartTemp, chartEC; 
let currentBombaSolicitud = 0;

const firebaseConfig = {
    databaseURL: "https://huerto-propedeutico-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const nodeRef = ref(db, 'AT_H_V1');

window.switchTab = (tabId) => {
    document.getElementById('sec-control').classList.toggle('hidden', tabId !== 'control');
    document.getElementById('sec-stats').classList.toggle('hidden', tabId !== 'stats');
    document.getElementById('nav-control').classList.toggle('active', tabId === 'control');
    document.getElementById('nav-stats').classList.toggle('active', tabId === 'stats');
    
    if (tabId === 'stats') {
        if (chartPH) chartPH.resize();
        if (chartTemp) chartTemp.resize();
        if (chartEC) chartEC.resize();
    }
};

document.addEventListener("DOMContentLoaded", () => {
    
    const opcionesComunes = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#a6adc8' } },
            y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#a6adc8' } }
        },
        plugins: { legend: { display: false } }
    };
    
    chartPH = new Chart(document.getElementById('chart-ph-canvas').getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#31ded9', backgroundColor: 'rgba(49, 222, 217, 0.05)', tension: 0.3, fill: true }] },
        options: opcionesComunes
    });

    chartTemp = new Chart(document.getElementById('chart-temp-canvas').getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#ff00ff', backgroundColor: 'rgba(255, 0, 255, 0.05)', tension: 0.3, fill: true }] },
        options: opcionesComunes
    });

    chartEC = new Chart(document.getElementById('chart-ec-canvas').getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#31ded9', backgroundColor: 'rgba(49, 222, 217, 0.05)', tension: 0.3, fill: true }] },
        options: opcionesComunes
    });

    onValue(nodeRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        Object.keys(data).forEach(key => {
            const textElement = document.getElementById(key);
            if (textElement && key !== 'estado_peltier') {
                const value = typeof data[key] === 'number' && !Number.isInteger(data[key]) ? data[key].toFixed(2) : data[key];
                textElement.innerText = value;
            }
        });

        checkAlert('card-ph', data.ph, 5.5, 6.8);
        checkAlert('card-temp', data.temp, 18.0, 24.0);
        checkAlert('card-ec', data.ec, 1.0, 2.0);

        currentBombaSolicitud = data.bomba_solicitud || 0;
        const sliderBomba = document.getElementById('toggle-bomba');
        const txtEstadoBomba = document.getElementById('bomba-status-txt');

        sliderBomba.checked = (currentBombaSolicitud === 1);

        if (data.bomba_estado === currentBombaSolicitud) {
            txtEstadoBomba.innerText = data.bomba_estado === 1 ? "Estado Físico: TRABAJANDO ✔" : "Estado Físico: APAGADA 💤";
            txtEstadoBomba.style.color = "#a6e3a1";
        } else {
            txtEstadoBomba.innerText = "Sincronizando con el huerto... ⏳";
            txtEstadoBomba.style.color = "#ff00ff";
        }

        const estadoPeltier = data.estado_peltier || false;
        const panelPeltier = document.getElementById('panel-peltier');
        const sliderPeltier = document.getElementById('slider-peltier');
        const txtStatusPeltier = document.getElementById('peltier-status-txt');

        if (estadoPeltier === true || String(estadoPeltier).toLowerCase() === "true") {
            panelPeltier.classList.add('peltier-activa-visual');
            sliderPeltier.checked = true;
            txtStatusPeltier.innerText = "Estado Potencia: ENFRIANDO (Peltier 12V 10A Activa) ❄️";
        } else {
            panelPeltier.classList.remove('peltier-activa-visual');
            sliderPeltier.checked = false;
            txtStatusPeltier.innerText = "Estado Potencia: SISTEMA EN REPOSO";
        }

        const tiempoActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        [chartPH, chartTemp, chartEC].forEach(chart => {
            if (chart.data.labels.length > 15) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            }
        });

        if(data.ph !== undefined) {
            chartPH.data.labels.push(tiempoActual);
            chartPH.data.datasets[0].data.push(data.ph);
            chartPH.update('none');
        }
        if(data.temp !== undefined) {
            chartTemp.data.labels.push(tiempoActual);
            chartTemp.data.datasets[0].data.push(data.temp);
            chartTemp.update('none');
        }
        if(data.ec !== undefined) {
            chartEC.data.labels.push(tiempoActual);
            chartEC.data.datasets[0].data.push(data.ec);
            chartEC.update('none');
        }
    });

    document.getElementById('toggle-bomba').addEventListener('change', (e) => {
        const nuevoEstado = e.target.checked ? 1 : 0;
        set(ref(db, 'AT_H_V1/bomba_solicitud'), nuevoEstado);
    });
// cambiar a false cuando se conecten los sensores 
    const ACTIVAR_SIMULADOR = true; 

    if (ACTIVAR_SIMULADOR) {
        console.warn("Módulo de simulación V5 activado: Escribiendo en Firebase AT_H_V1...");
        setInterval(() => {
            
            let simTemp = (Math.random() * (26.0 - 22.0) + 22.0);
            
            let simPH = (Math.random() * (6.5 - 5.5) + 5.5);
            let simEC = (Math.random() * (1.8 - 1.2) + 1.2);
            
            set(ref(db, 'AT_H_V1'), {
                ph: simPH,
                ec: simEC,
                temp: simTemp,
                bomba_estado: currentBombaSolicitud, 
                bomba_solicitud: currentBombaSolicitud,
            
                estado_peltier: (simTemp > 24.0) 
            });
        }, 5000); 
    }
});

function checkAlert(cardId, value, min, max) {
    const card = document.getElementById(cardId);
    if (card && value !== undefined) {
        if (value < min || value > max) {
            card.classList.add('danger-alert');
        } else {
            card.classList.remove('danger-alert');
        }
    }
}