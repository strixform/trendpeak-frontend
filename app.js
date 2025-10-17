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
dlEl.addEventListener('click', (e)=>{e.preventDefault(); alert('Reports coming soon');});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = qEl.value.trim();
  if (!q) return;
  resEl.classList.remove('hide');
  titleEl.textContent = q;
  freshnessEl.textContent = 'Updated just now';
  coverageEl.textContent = 'Sources: Trends + News (mock)';
  spikesEl.innerHTML = 'Loading...';
  sourcesEl.innerHTML = '';
  const data = mockQuery(q);
  drawChart(data.timeline);
  renderSpikes(data.spikes);
  renderSources(data.top_sources);
});

function drawChart(points){
  const ctx = document.getElementById('chart').getContext('2d');
  const labels = points.map(p => p.t.slice(5));
  const values = points.map(p => p.v);
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type:'line',
    data:{labels, datasets:[{data:values, fill:false, tension:.25}]},
    options:{plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{grid:{color:'#1a1a1a'}}}}
  });
}

function renderSpikes(spikes){
  if (!spikes.length){spikesEl.innerHTML='No spikes found';return;}
  spikesEl.innerHTML='';
  spikes.forEach(s=>{
    const d=document.createElement('div');
    d.className='card';
    d.innerHTML=`<strong>${s.time}</strong><div class="small">+${s.percent}% vs baseline</div><div class="small">${s.reason}</div>`;
    spikesEl.appendChild(d);
  });
}

function renderSources(list){
  if (!list || !list.length) return;
  sourcesEl.innerHTML='';
  list.forEach(x=>{
    const div=document.createElement('div');
    div.className='source';
    div.innerHTML=`<a href="${x.url}" target="_blank" rel="noopener">${x.site} • ${x.title}</a>`;
    sourcesEl.appendChild(div);
  });
}

// Mock data. Replace with API later.
function mockQuery(q){
  const timeline = mockTimeline();
  const spikes = detectSpikes(timeline);
  const top_sources = [
    {site:'news.sample', title:`${q} got media pickup`, url:'https://example.com/a'},
    {site:'reddit', title:`Hot thread about ${q}`, url:'https://example.com/b'}
  ];
  return {timeline, spikes, top_sources};
}

function mockTimeline(){
  const arr=[];
  const today=new Date();
  for(let i=29;i>=0;i--){
    const d=new Date(today); d.setDate(today.getDate()-i);
    const val=40+10*Math.sin((30-i)/3)+randInt(-3,3);
    arr.push({t:d.toISOString().slice(0,10), v:Math.max(0, Math.round(val))});
  }
  const k=randInt(10,26);
  arr[k].v += randInt(30,80);
  return arr;
}

function detectSpikes(tl){
  const vals=tl.map(p=>p.v);
  const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
  const std=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)*(v-mean),0)/vals.length);
  const out=[];
  tl.forEach(p=>{
    if(p.v>mean+2*std){
      const pct=Math.round(100*(p.v-mean)/Math.max(1,mean));
      out.push({time:p.t, percent:pct, reason:'Likely news or viral post'});
    }
  });
  return out;
}

function randInt(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
