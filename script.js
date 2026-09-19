
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPr2QN1gvo5Ngekcos86uo2maX_mHRGF0",
  authDomain: "huerto-hidroponico-esh.firebaseapp.com",
  databaseURL: "https://huerto-hidroponico-esh-default-rtdb.firebaseio.com",
  projectId: "huerto-hidroponico-esh",
  storageBucket: "huerto-hidroponico-esh.firebasestorage.app",
  messagingSenderId: "380114491557",
  appId: "1:380114491557:web:bf85a1b207638093abd54c",
  measurementId: "G-DGXDEVKXZ0"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const btnLogin = document.getElementById('btn-login');
const passInput = document.getElementById('password');

function checkLogin() {
    const user = document.getElementById('username').value;
    const pass = passInput.value;
    
    if (user === 'Hidroponico2026' && pass === 'Programav1') {
        document.getElementById('login-overlay').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            initChart();
            initFirebaseListeners(); 
        }, 300);
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

btnLogin.addEventListener('click', checkLogin);
passInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkLogin(); });

function initFirebaseListeners() {
    const sensoresRef = ref(db, 'sensores');
    onValue(sensoresRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            if (data.ph !== undefined) {
                document.getElementById('val-ph').innerText = data.ph;
                document.getElementById('bar-ph').style.width = Math.min(100, (data.ph / 14) * 100) + '%';
            }
            if (data.ce !== undefined) {
                document.getElementById('val-ce').innerText = data.ce;
                document.getElementById('bar-ce').style.width = Math.min(100, (data.ce / 3.0) * 100) + '%';
            }
            if (data.temp !== undefined) {
                document.getElementById('val-temp').innerText = data.temp;
                document.getElementById('bar-temp').style.width = Math.min(100, (data.temp / 40) * 100) + '%';
            }
            if (data.humedad !== undefined) {
                document.getElementById('val-hum').innerText = data.humedad;
                document.getElementById('bar-hum').style.width = data.humedad + '%';
            }
        }
    });

    setupActuator('sw-bomba1', 'actuadores/bomba1');
    setupActuator('sw-bomba2', 'actuadores/bomba2');
    setupActuator('sw-peltier', 'actuadores/peltier');
}

function setupActuator(elementId, dbPath) {
    const el = document.getElementById(elementId);

    onValue(ref(db, dbPath), (snapshot) => {
        const val = snapshot.val();
        if (val !== null) el.checked = val;
    });

    el.addEventListener('change', () => {
        set(ref(db, dbPath), el.checked);
    });
}

let myChart;
const chartData = {
    ph: { data: [6.1, 6.2, 6.4, 6.5, 6.3, 6.2, 6.2], color: '#00f0ff' },
    temperatura: { data: [22.5, 23.0, 24.5, 26.1, 25.0, 24.5, 24.5], color: '#b026ff' },
    ec: { data: [2.0, 2.1, 2.3, 2.4, 2.3, 2.2, 2.2], color: '#39ff14' }
};
const labels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', 'Ahora'];

function initChart() {
    const ctx = document.getElementById('sensorChart').getContext('2d');
    Chart.defaults.color = '#8b949e';
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Historial',
                data: chartData.ph.data,
                borderColor: chartData.ph.color,
                backgroundColor: chartData.ph.color + '22',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#0d1117',
                pointBorderColor: chartData.ph.color,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

document.getElementById('chartSelector').addEventListener('change', (e) => {
    const selectedData = chartData[e.target.value];
    myChart.data.datasets[0].data = selectedData.data;
    myChart.data.datasets[0].borderColor = selectedData.color;
    myChart.data.datasets[0].backgroundColor = selectedData.color + '22';
    myChart.data.datasets[0].pointBorderColor = selectedData.color;
    myChart.update();
});

document.getElementById('btn-add-tracker').addEventListener('click', addTracker);
document.getElementById('tracker-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') addTracker(); });

function addTracker() {
    const input = document.getElementById('tracker-input');
    const name = input.value.trim();
    if (!name) return;

    const container = document.getElementById('tracker-container');
    const newTracker = document.createElement('div');
    newTracker.className = 'tracker-item';
    newTracker.innerHTML = `
        <div class="tracker-top">
            <span class="tracker-title">${name}</span>
            <span class="tracker-days">Día 1 / 30</span>
        </div>
        <div class="tracker-visual-bar">
            <div class="fase-agua">Fase 1: Agua</div>
            <div class="fase-nutri">Fase 2: Solución 50%</div>
            <div class="tracker-cursor" style="left: 3.33%;"></div>
        </div>
        <div class="tracker-dates">
            <span>Inicio: Hoy</span>
            <span>Cambio: +15d</span>
            <span>Cosecha: +30d</span>
        </div>
    `;
    container.appendChild(newTracker);
    input.value = '';
}

document.getElementById('btn-add-task').addEventListener('click', addTask);
document.getElementById('task-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

function addTask() {
    const input = document.getElementById('task-input');
    const task = input.value.trim();
    if (!task) return;

    const container = document.getElementById('task-container');
    const newTask = document.createElement('div');
    newTask.className = 'task-item';
    newTask.innerHTML = `
        <div class="task-checkbox"><i class="fa-solid fa-check"></i></div>
        <span class="task-text">${task}</span>
        <button class="task-delete"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    newTask.addEventListener('click', function(e) {
        if (!e.target.closest('.task-delete')) {
            this.classList.toggle('completed');
        }
    });

    newTask.querySelector('.task-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        newTask.style.opacity = '0';
        setTimeout(() => newTask.remove(), 300);
    });

    container.appendChild(newTask);
    input.value = '';
}