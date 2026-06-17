import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    databaseURL: "https://huerto-propedeutico-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const nodeRef = ref(db, 'AT_H_V1');

let currentBombaSolicitud = 0;

window.switchTab = (tabId) => {
    document.getElementById('sec-control').classList.toggle('hidden', tabId !== 'control');
    document.getElementById('sec-stats').classList.toggle('hidden', tabId !== 'stats');
    document.getElementById('nav-control').classList.toggle('active', tabId === 'control');
    document.getElementById('nav-stats').classList.toggle('active', tabId === 'stats');
};

const ctx = document.getElementById('historicoChart').getContext('2d');
const historicoChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [], 
        datasets: [
            { label: 'pH', data: [], borderColor: '#7aa2f7', tension: 0.3, yAxisID: 'y' },
            { label: 'Temp °C', data: [], borderColor: '#f7768e', tension: 0.3, yAxisID: 'y1' }
        ]
    },
    options: {
        responsive: true,
        scales: {
            y: { type: 'linear', display: true, position: 'left', grid: { color: '#2f3549' } },
            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } }
        },
        plugins: { legend: { labels: { color: '#c0caf5' } } }
    }
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
        txtEstado.style.color = data.bomba_estado === 1 ? "#9ece6a" : "#565f89";
    } else {
        txtEstado.innerText = "Sincronizando con el huerto... ⏳";
        txtEstado.style.color = "#bb9af3";
    }

    const tiempoActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (historicoChart.data.labels.length > 15) {
        historicoChart.data.labels.shift();
        historicoChart.data.datasets[0].data.shift();
        historicoChart.data.datasets[1].data.shift();
    }

    historicoChart.data.labels.push(tiempoActual);
    historicoChart.data.datasets[0].data.push(data.ph);
    historicoChart.data.datasets[1].data.push(data.temp);
    historicoChart.update('none'); 
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


document.getElementById('btn-bomba').addEventListener('click', () => {
    const nuevoEstado = currentBombaSolicitud === 1 ? 0 : 1;
    
    set(ref(db, 'AT_H_V1/bomba_solicitud'), nuevoEstado);
});