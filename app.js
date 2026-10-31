/* Smart Solar Control Simulation
   Educational averaged model; all calculations run locally in the browser. */
const $ = (id) => document.getElementById(id);
const defaults = {duration:30,irradiance:1000,sunStart:10,sunEnd:80,cloudTime:12,cloudDrop:35,vref:12,loadBefore:3,loadAfter:2,loadTime:20,kp:.18,ki:1.2};
let charts = {}, simulationRows = [], animationTimer = null, running = false;
const chartColors = {green:'#168268',blue:'#4b8eb8',orange:'#e7a34a',red:'#d66c5c',purple:'#8974b8',gray:'#a6b5ad'};
const chartOptions = {responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{boxWidth:9,usePointStyle:true,pointStyle:'circle',font:{family:'DM Sans',size:10},color:'#6f817a'}},tooltip:{backgroundColor:'#183d38',titleFont:{family:'DM Sans'},bodyFont:{family:'DM Sans'},padding:10}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:7,color:'#91a099',font:{size:9}},title:{display:true,text:'Time (s)',color:'#91a099',font:{size:9}}},y:{grid:{color:'#edf1ee'},ticks:{color:'#91a099',font:{size:9}}}}};
function makeChart(id, datasets, yTitle='') {const ctx=$(id); if(charts[id]) charts[id].destroy(); charts[id]=new Chart(ctx,{type:'line',data:{labels:[],datasets:datasets.map(d=>({label:d.label,data:[],borderColor:d.color,backgroundColor:d.color+'18',borderWidth:2,pointRadius:0,tension:.18,fill:d.fill||false}))},options:{...chartOptions,scales:{...chartOptions.scales,y:{...chartOptions.scales.y,title:{display:!!yTitle,text:yTitle,color:'#91a099',font:{size:9}}}}}});}
function initCharts(){makeChart('trackingChart',[{label:'Sun reference angle',color:chartColors.orange},{label:'Panel angle',color:chartColors.green}],'Angle (°)');makeChart('errorChart',[{label:'Tracking error',color:chartColors.purple}],'Error (°)');makeChart('irradianceChart',[{label:'Effective irradiance',color:chartColors.orange,fill:true}],'Irradiance (W/m²)');makeChart('powerChart',[{label:'Gross PV power',color:chartColors.green},{label:'Load power',color:chartColors.red}],'Power (W)');makeChart('voltageChart',[{label:'Output voltage',color:chartColors.blue},{label:'Voltage reference',color:chartColors.orange}],'Voltage (V)');makeChart('dutyChart',[{label:'Buck duty cycle',color:chartColors.purple}],'Duty ratio');}
function readParams(){const p={};for(const k of Object.keys(defaults))p[k]=Number($(k).value);p.duration=Math.max(1,p.duration);p.irradiance=Math.max(0,p.irradiance);p.sunStart=clamp(p.sunStart,0,90);p.sunEnd=clamp(p.sunEnd,0,90);p.cloudDrop=clamp(p.cloudDrop,0,95);p.vref=clamp(p.vref,1,17.5);p.loadBefore=Math.max(.2,p.loadBefore);p.loadAfter=Math.max(.2,p.loadAfter);p.kp=Math.max(0,p.kp);p.ki=Math.max(0,p.ki);return p;}
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function updateLabels(){const labels={duration:v=>v+' s',irradiance:v=>v+' W/m²',cloudTime:v=>v+' s',cloudDrop:v=>v+'%',vref:v=>v+' V',loadTime:v=>v+' s'};for(const [id,fn] of Object.entries(labels))$(id+'Val').textContent=fn($(id).value);}
function setInputs(p){for(const [k,v] of Object.entries(p))if($(k))$(k).value=v;updateLabels();}
async function simulate(p){
 const dt=.005,n=Math.floor(p.duration/dt)+1;const L=.01,C=.001,rL=.15,VpvNom=18,PpvRated=100,motorPower=2,eff=.90;
 let theta=p.sunStart,thetaDot=0,iL=0,vout=0,integral=0;const kp=p.kp,ki=p.ki;const rows=[];
 for(let k=0;k<n;k++){
  if(!running)return rows;
  const t=k*dt,thetaRef=p.sunStart+(p.sunEnd-p.sunStart)*(t/p.duration),trackError=thetaRef-theta;
  const motorCmd=clamp(1.8*trackError,-35,35);thetaDot=clamp(motorCmd,-35,35);theta=clamp(theta+thetaDot*dt,0,90);
  const angleDiff=(thetaRef-theta)*Math.PI/180;const cloudFactor=t>=p.cloudTime?1-p.cloudDrop/100:1;const G=p.irradiance*cloudFactor;const gEff=G*Math.max(Math.cos(angleDiff),0);const pvGross=PpvRated*gEff/1000;const pMotor=Math.abs(thetaDot)>.15?motorPower:0;const pvNet=Math.max(0,pvGross-pMotor);
  const R=t>=p.loadTime?p.loadAfter:p.loadBefore;const loadPower=vout*vout/R;const target= t<1 ? p.vref*t : p.vref;
  const err=target-vout;const ff=target/VpvNom;let raw=ff+kp*err+ki*integral;let duty=clamp(raw,.05,.95);
  const requestedInputPower=Math.max(0,(duty*VpvNom)*Math.max(iL,0));const maxInputPower=pvNet;
  let sourceScale=1;if(requestedInputPower>maxInputPower&&requestedInputPower>0)sourceScale=clamp(maxInputPower/requestedInputPower,0,1);
  const vsrc=VpvNom*sourceScale;
  const di=(duty*vsrc-vout-rL*iL)/L;const dv=(iL-vout/R)/C;
  iL=Math.max(0,iL+di*dt);vout=clamp(vout+dv*dt,0,30);
  // Conditional integration anti-windup: do not integrate farther into saturation.
  const saturated=(raw!==duty);if(!saturated||((raw>0.95&&err<0)||(raw<0.05&&err>0)))integral=clamp(integral+err*dt,-20,20);
  const actualLoadPower=vout*vout/R;const pvOutCapacity=pvNet*eff;
  const requiredLoadPower=p.vref*p.vref/R;
  if(k%10===0||k===n-1)rows.push({time:+t.toFixed(3),sunRef:thetaRef,panelAngle:theta,trackError:thetaRef-theta,irradiance:gEff,pvPower:pvGross,pvNet,pMotor,loadPower:actualLoadPower,vout,vref:p.vref,duty,loadR:R,pvOutCapacity,shortage:pvOutCapacity<requiredLoadPower});
  if(k%500===499)await new Promise(resolve=>setTimeout(resolve,0));
 }
 return rows;
}
function drawResults(rows,p){const labels=rows.map(r=>r.time.toFixed(1));const put=(id,keys)=>{charts[id].data.labels=labels;keys.forEach((key,i)=>charts[id].data.datasets[i].data=rows.map(r=>r[key]));charts[id].update('none');};put('trackingChart',['sunRef','panelAngle']);put('errorChart',['trackError']);put('irradianceChart',['irradiance']);put('powerChart',['pvPower','loadPower']);put('voltageChart',['vout','vref']);put('dutyChart',['duty']);
 const last=rows[rows.length-1],tail=rows.slice(Math.floor(rows.length*.8));const mae=tail.reduce((s,r)=>s+Math.abs(r.vref-r.vout),0)/tail.length;const mean=(arr,key)=>arr.reduce((s,r)=>s+r[key],0)/arr.length;
 $('metricVoltage').innerHTML=last.vout.toFixed(2)+'<small>V</small>';$('metricError').innerHTML=mae.toFixed(2)+'<small>V</small>';$('metricPv').innerHTML=last.pvPower.toFixed(1)+'<small>W</small>';$('metricLoad').innerHTML=last.loadPower.toFixed(1)+'<small>W</small>';
 $('runDuration').textContent=p.duration+' seconds · '+rows.length.toLocaleString()+' plotted samples';$('statusText').textContent=last.shortage?'Completed · PV power limit reached at final sample':'Simulation completed';$('statusDot').className='status-dot done';$('csvBtn').disabled=false;
}
async function runSimulation(){if(running)return;running=true;$('runBtn').disabled=true;$('stopBtn').disabled=false;$('statusText').textContent='Calculating system response…';$('statusDot').className='status-dot running';$('csvBtn').disabled=true;try{const p=readParams();const rows=await simulate(p);if(!running)return;simulationRows=rows;drawResults(simulationRows,p);}catch(e){console.error(e);$('statusText').textContent='Simulation error — check parameter values';$('statusDot').className='status-dot';}finally{running=false;$('runBtn').disabled=false;$('stopBtn').disabled=true;}}
function resetCharts(){Object.values(charts).forEach(c=>{c.data.labels=[];c.data.datasets.forEach(d=>d.data=[]);c.update('none');});simulationRows=[];['metricVoltage','metricError','metricPv','metricLoad'].forEach(id=>$(id).innerHTML='—');$('statusText').textContent='Waiting for simulation';$('statusDot').className='status-dot';$('runDuration').textContent='—';$('csvBtn').disabled=true;}
function stopSimulation(){if(running){running=false;$('runBtn').disabled=false;$('stopBtn').disabled=true;$('statusText').textContent='Simulation stopped';$('statusDot').className='status-dot';}}
function exportCSV(){if(!simulationRows.length)return;const keys=Object.keys(simulationRows[0]);const csv=[keys.join(','),...simulationRows.map(r=>keys.map(k=>typeof r[k]==='number'?r[k].toFixed(5):r[k]).join(','))].join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='smart_solar_simulation_results.csv';a.click();URL.revokeObjectURL(url);}
const presets={tracking:{duration:30,irradiance:1000,sunStart:10,sunEnd:80,cloudTime:60,cloudDrop:0,vref:12,loadBefore:3,loadAfter:3,loadTime:60,kp:.18,ki:1.2},cloud:{duration:30,irradiance:1000,sunStart:35,sunEnd:35,cloudTime:12,cloudDrop:60,vref:12,loadBefore:3,loadAfter:3,loadTime:60,kp:.18,ki:1.2},load:{duration:30,irradiance:1000,sunStart:35,sunEnd:35,cloudTime:60,cloudDrop:0,vref:12,loadBefore:3,loadAfter:2,loadTime:15,kp:.18,ki:1.2},integrated:{...defaults}};
function loadPreset(name){setInputs(presets[name]);resetCharts();$('statusText').textContent='Scenario loaded · ready to run';document.querySelectorAll('.preset-card').forEach(c=>c.classList.toggle('selected',c.dataset.preset===name));document.querySelector('#controls').scrollIntoView({behavior:'smooth',block:'start'});}
function init(){initCharts();updateLabels();Object.keys(defaults).forEach(id=>{const el=$(id);el.addEventListener('input',updateLabels);});$('runBtn').addEventListener('click',runSimulation);$('heroRun').addEventListener('click',()=>{setInputs(defaults);runSimulation();document.querySelector('#results').scrollIntoView({behavior:'smooth'});});$('stopBtn').addEventListener('click',stopSimulation);$('resetBtn').addEventListener('click',()=>{resetCharts();});$('resetDefaults').addEventListener('click',()=>{setInputs(defaults);resetCharts();});$('csvBtn').addEventListener('click',exportCSV);document.querySelectorAll('.preset-card').forEach(c=>c.addEventListener('click',()=>loadPreset(c.dataset.preset)));}
document.addEventListener('DOMContentLoaded',init);
