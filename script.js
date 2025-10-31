/* Cloud Governance Simulator for SMEs
   - Generates synthetic SME case data
   - Simulates adoption score, risk profile, productivity gain
   - Visualizes aggregated charts and provides CSV download
*/

// Utilities
function rnd(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// DOM refs and events
const numSMEsEl = document.getElementById('numSMEs');
const sectorEl = document.getElementById('sector');
const govEl = document.getElementById('govMaturity');
const budgetEl = document.getElementById('budget');
const complianceEl = document.getElementById('compliance');

const govVal = document.getElementById('govVal');
const budgetVal = document.getElementById('budgetVal');
const complianceVal = document.getElementById('complianceVal');

const simulateBtn = document.getElementById('simulateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const tableWrap = document.getElementById('tableWrap');

govEl.addEventListener('input', ()=> govVal.textContent = govEl.value);
budgetEl.addEventListener('input', ()=> budgetVal.textContent = budgetEl.value);
complianceEl.addEventListener('input', ()=> complianceVal.textContent = complianceEl.value);

simulateBtn.addEventListener('click', runSimulation);
downloadBtn.addEventListener('click', downloadCSV);

// Charts
let adoptChart=null, riskChart=null, prodChart=null;

// Core synthetic model per SME
function synthSME(index, sector, globalGov, budgetSensitivity, compliancePriority) {
  // base adoption willingness per sector
  const sectorBase = { tech:0.7, manufacturing:0.45, retail:0.5, health:0.4, finance:0.55 }[sector] ?? 0.5;

  // governance influence: better governance -> higher safe adoption
  const govInfluence = globalGov/100;

  // budget: higher sensitivity reduces adoption
  const budgetImpact = 1 - (budgetSensitivity/150); // softer effect

  // compliance priority reduces risky adoption but may slow adoption speed
  const complianceImpact = compliancePriority/100;

  // compute adoption score (0-1)
  const noise = rnd(-0.12, 0.12);
  let adoptionScore = sectorBase * (0.5 + 0.5*govInfluence) * budgetImpact + noise;
  adoptionScore = clamp(adoptionScore, 0, 1);

  // risk profile broken into categories (governance gaps increase risk)
  const governanceGap = 1 - govInfluence;
  const riskData = {
    security: clamp(0.25*governanceGap + rnd(0,0.15), 0, 1),
    compliance: clamp(0.2*governanceGap + rnd(0,0.12), 0, 1),
    vendorLock: clamp(0.15 + rnd(-0.05,0.15), 0, 1),
    operational: clamp(0.15*governanceGap + rnd(0,0.12), 0, 1)
  };
  // normalize risk fractions to sum to 1 (for pie)
  const sumRisk = riskData.security + riskData.compliance + riskData.vendorLock + riskData.operational;
  for (let k in riskData) riskData[k] = riskData[k] / sumRisk;

  // productivity gain estimate (0-100%)
  // better governance can capture higher productivity gains; budget constraints lower it.
  let prodGain = 5 + 60 * adoptionScore * (0.4 + 0.6*govInfluence) * (1 - (budgetSensitivity/200));
  prodGain += rnd(-4, 6); // noise
  prodGain = clamp(prodGain, 0, 100);

  // estimated annual cost delta (positive means costs increase, negative means net saving)
  // simplistic: cloud may increase ops cost but reduce infra capex -> net depends on scale and governance
  let costDelta = rnd(-0.2, 0.4) * (1 - govInfluence) * 10000; // in USD
  costDelta = Math.round(costDelta);

  return {
    id: `SME-${index+1}`,
    sector,
    adoptionScore: +(adoptionScore.toFixed(3)),
    prodGain: +prodGain.toFixed(1),
    costDelta,
    risks: riskData,
    governance: Math.round(globalGov),
    budgetSensitivity: Math.round(budgetSensitivity),
    compliancePriority: Math.round(compliancePriority)
  };
}

// Run simulation and render
function runSimulation(){
  const n = parseInt(numSMEsEl.value,10) || 10;
  const sector = sectorEl.value;
  const gov = parseInt(govEl.value,10);
  const budget = parseInt(budgetEl.value,10);
  const compliance = parseInt(complianceEl.value,10);

  const smes = [];
  for(let i=0;i<n;i++){
    smes.push(synthSME(i, sector, gov + rnd(-8,8), budget + rnd(-10,10), compliance + rnd(-10,10)));
  }

  renderTable(smes);
  updateCharts(smes);
  // store last dataset for download
  window._lastSMEs = smes;
}

// Render table
function renderTable(smes){
  let html = `<table><thead><tr>
    <th>ID</th><th>Sector</th><th>Adoption</th><th>Prod Gain (%)</th><th>Cost Δ (USD)</th><th>Gov Maturity</th><th>Budget Sens</th><th>Compliance</th>
  </tr></thead><tbody>`;
  for(const s of smes){
    html += `<tr>
      <td>${s.id}</td>
      <td>${s.sector}</td>
      <td>${(s.adoptionScore*100).toFixed(1)}%</td>
      <td>${s.prodGain}%</td>
      <td>${s.costDelta}</td>
      <td>${s.governance}%</td>
      <td>${s.budgetSensitivity}%</td>
      <td>${s.compliancePriority}%</td>
    </tr>`;
  }
  html += `</tbody></table>`;
  tableWrap.innerHTML = html;
}

// Chart updates
function updateCharts(smes){
  // aggregate adoption by gov maturity buckets
  const buckets = {low:[], mid:[], high:[]};
  for(const s of smes){
    if(s.governance < 35) buckets.low.push(s.adoptionScore);
    else if(s.governance < 70) buckets.mid.push(s.adoptionScore);
    else buckets.high.push(s.adoptionScore);
  }
  const avg = arr => arr.length? (arr.reduce((a,b)=>a+b,0)/arr.length):0;
  const bucketLabels = ['Gov Low (<35%)','Gov Mid (35-69%)','Gov High (≥70%)'];
  const bucketValues = [avg(buckets.low), avg(buckets.mid), avg(buckets.high)].map(v=>+(v*100).toFixed(1));

  // risk aggregate (average fractions)
  const riskKeys = ['security','compliance','vendorLock','operational'];
  const riskAgg = {security:0,compliance:0,vendorLock:0,operational:0};
  for(const s of smes){
    for(const k of riskKeys) riskAgg[k] += s.risks[k];
  }
  for(const k of riskKeys) riskAgg[k] = +( (riskAgg[k]/smes.length).toFixed(3) );

  // productivity distribution (for histogram-like chart we use average and std)
  const avgProd = +( (smes.reduce((a,b)=>a+b.prodGain,0)/smes.length).toFixed(1) );
  const prodStd = +( Math.sqrt(smes.reduce((a,b)=>a+Math.pow(b.prodGain-avgProd,2),0)/smes.length).toFixed(1) );

  // Draw or update charts with Chart.js
  const adoptCtx = document.getElementById('adoptChart').getContext('2d');
  const riskCtx = document.getElementById('riskChart').getContext('2d');
  const prodCtx = document.getElementById('prodChart').getContext('2d');

  if(adoptChart) adoptChart.destroy();
  adoptChart = new Chart(adoptCtx, {
    type: 'bar',
    data: { labels: bucketLabels, datasets: [{label:'Avg Adoption (%)', data:bucketValues, backgroundColor:['#e76f51','#f4a261','#2a9d8f']}] },
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, max:100}} }
  });

  if(riskChart) riskChart.destroy();
  riskChart = new Chart(riskCtx, {
    type:'doughnut',
    data:{ labels:['Security','Compliance','Vendor lock','Operational'], datasets:[{data:[riskAgg.security, riskAgg.compliance, riskAgg.vendorLock, riskAgg.operational], backgroundColor:['#ef476f','#ffd166','#06d6a0','#118ab2']}] },
    options:{responsive:true, plugins:{legend:{position:'bottom'}}}
  });

  if(prodChart) prodChart.destroy();
  prodChart = new Chart(prodCtx, {
    type:'bar',
    data:{ labels:['Avg Prod Gain','Std Dev'], datasets:[{label:'%', data:[avgProd, prodStd], backgroundColor:['#2a9d8f','#9ad3bc']}] },
    options:{responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, max:100}}}
  });
}

// CSV download
function downloadCSV(){
  const arr = window._lastSMEs || [];
  if(arr.length === 0){ alert('Run a simulation first.'); return; }
  const header = ['id','sector','adoptionScore','prodGain','costDelta','governance','budgetSensitivity','compliancePriority'];
  const rows = arr.map(s => header.map(h => s[h]).join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sme_cloud_simulation.csv'; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
}

// initial run
runSimulation();
