const API_BASE = '';

const form = document.getElementById('searchForm');
const qEl = document.getElementById('q');
const resEl = document.getElementById('result');
const titleEl = document.getElementById('title');
const freshnessEl = document.getElementById('freshness');
const coverageEl = document.getElementById('coverage');
const spikesEl = document.getElementById('spikes');
const sourcesEl = document.getElementById('sources');
const yrEl = document.getElementById('yr');
const dlEl = document.getElementById('dlReport');
let chart;

yrEl.textContent = new Date().getFullYear();
dlEl.addEventListener('click', e => { e.preventDefault(); alert('Reports coming soon'); });

form.addEventListener('submit', async e => {
  e.preventDefault();
  const q = qEl.value.trim();
  const geo = document.getElementById('geo').value;
  if (!q) return;

  resEl.classList.remove('hide');
  titleEl.textContent = q;
  freshnessEl.textContent = 'Fetching...';
  coverageEl.textContent = `Region: ${geo}`;
  spikesEl.innerHTML = 'Loading...';
  sourcesEl.innerHTML = '';

  try {
    const r = await fetch(`/api/trend?q=${encodeURIComponent(q)}&geo=${encodeURIComponent(geo)}`);
    if (!r.ok) throw new Error('API error');
    const data = await r.json();
    freshnessEl.textContent = 'Updated just now';
    drawChart(data.timeline);
    renderSpikes(data.spikes);
    renderSources(data.top_sources);
  } catch {
    spikesEl.innerHTML = 'Failed to load';
  }
});


function drawChart(points){
  const ctx = document.getElementById('chart').getContext('2d');
  const labels = points.map(p => p.t.slice(5));
  const values = points.map(p => p.v);
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data: values, fill: false, tension: .25 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#1a1a1a' } } } }
  });
}

function renderSpikes(spikes){
  if (!spikes.length){ spikesEl.innerHTML = 'No spikes found'; return; }
  spikesEl.innerHTML = '';
  spikes.forEach(s => {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `<strong>${s.time}</strong><div class="small">+${s.percent}% vs baseline</div><div class="small">${s.reason}</div>`;
    spikesEl.appendChild(d);
  });
}

function renderSources(list){
  if (!list || !list.length) return;
  sourcesEl.innerHTML = '';
  list.forEach(x => {
    const div = document.createElement('div');
    div.className = 'source';
    div.innerHTML = `<a href="${x.url}" target="_blank" rel="noopener">${x.site} • ${x.title}</a>`;
    sourcesEl.appendChild(div);
  });
}
