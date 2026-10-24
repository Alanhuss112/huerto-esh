let sensorChart;
const historyData = { ph: [], temperatura: [], ec: [], humedad: [] };
const labelsHora = [];

const configMap = {
  ph: { label: 'pH del Agua', color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.15)' },
  temperatura: { label: 'Temperatura (°C)', color: '#ff5d67', bg: 'rgba(255, 93, 103, 0.15)' },
  ec: { label: 'CE (mS/cm)', color: '#ffd166', bg: 'rgba(255, 209, 102, 0.15)' },
  humedad: { label: 'Humedad (%)', color: '#35e58a', bg: 'rgba(53, 229, 138, 0.15)' }
};

document.addEventListener("DOMContentLoaded", () => {
  inicializarGraficaDual();
});

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

  window.sensorChart = sensorChart;

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

function exportarGraficaPNG() {
  if (!sensorChart) return alert("La gráfica no está inicializada.");
  const urlImage = sensorChart.toBase64Image();
  const link = document.createElement('a');
  link.href = urlImage;
  link.download = `Analitica_Huerto_ESH_${new Date().toISOString().split('T')[0]}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  if (typeof mostrarToast === 'function') {
    mostrarToast("Exportación Exitosa", "Gráfica descargada en alta resolución PNG", "success");
  } else {
    alert("¡Gráfica exportada a PNG con éxito!");
  }
}