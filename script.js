
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";


let chartPH, chartEC, chartTemp;
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
        if (chartEC) chartEC.resize();
        if (chartTemp) chartTemp.resize();
    }
};


document.addEventListener("DOMContentLoaded", () => {
    
    const opcionesComunes = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { grid: { color: '#313244' }, ticks: { color: '#a6adc8' } },
            y: { grid: { color: '#313244' }, ticks: { color: '#a6adc8' } }
        },
        plugins: { legend: { display: false } }
    };

    
    chartPH = new Chart(document.getElementById('chart-ph-canvas').getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#89dceb', backgroundColor: 'rgba(137, 220, 235, 0.05)', tension: 0.3, fill: true }] },
        options: opcionesComunes
    });

    chartEC = new Chart(document.getElementById('chart-ec-canvas').getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#a6e3a1', backgroundColor: 'rgba(166, 227, 161, 0.05)', tension: 0.3, fill: true }] },
        options: opcionesComunes
    });

    
    chartTemp = new Chart(document.getElementById('chart-temp-canvas').getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#f9e2af', backgroundColor: 'rgba(249, 226, 175, 0.05)', tension: 0.3, fill: true }] },
        options: opcionesComunes
    });

   
    onValue(nodeRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

       
        Object.keys(data).forEach(key => {
            const textElement = document.getElementById(key);
            if (textElement) {
                const value = typeof data[key] === 'number' && !Number.isInteger(data[key]) ? data[key].toFixed(2) : data[key];
                textElement.innerText = value;
            }
        });

        checkAlert('card-ph', data.ph, 5.5, 6.8);
        checkAlert('card-ec', data.ec, 1.0, 2.0);
        checkAlert('card-temp', data.temp, 18.0, 28.0);
        checkAlert('card-humedad', data.humedad, 50.0, 80.0);

        currentBombaSolicitud = data.bomba_solicitud || 0;
        const btnBomba = document.getElementById('btn-bomba');
        const txtEstado = document.getElementById('bomba-estado-txt');

        if (currentBombaSolicitud === 1) {
            btnBomba.innerText = "APAGAR BOMBA";
            btnBomba.className = "btn-action btn-off";
        } else {
            btnBomba.innerText = "ENCENDER BOMBA";
            btnBomba.className = "btn-action btn-on";
        }

        if (data.bomba_estado === currentBombaSolicitud) {
            txtEstado.innerText = data.bomba_estado === 1 ? "Estado Físico: TRABAJANDO ✔" : "Estado Físico: APAGADA 💤";
            txtEstado.style.color = "#a6e3a1";
        } else {
            txtEstado.innerText = "Sincronizando con el huerto... ⏳";
            txtEstado.style.color = "#f9e2af";
        }

        const tiempoActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        [chartPH, chartEC, chartTemp].forEach(chart => {
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
        if(data.ec !== undefined) {
            chartEC.data.labels.push(tiempoActual);
            chartEC.data.datasets[0].data.push(data.ec);
            chartEC.update('none');
        }
        if(data.temp !== undefined) {
            chartTemp.data.labels.push(tiempoActual);
            chartTemp.data.datasets[0].data.push(data.temp);
            chartTemp.update('none');
        }
    });

    
    document.getElementById('btn-bomba').addEventListener('click', () => {
        const nuevoEstado = currentBombaSolicitud === 1 ? 0 : 1;
        set(ref(db, 'AT_H_V1/bomba_solicitud'), nuevoEstado);
    });
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