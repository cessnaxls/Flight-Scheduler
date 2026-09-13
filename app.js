(() => {
'use strict';

const DEFAULTS = {
  airportsUrl: 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat',
  airlinesUrl: 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat',
  airportSizesUrl: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
  airportCountry: 'United States', tailCountry: 'US', tailSource: 'auto', tailAircraft: '',
  theme: 'light', opType: 'part135', paxWeight: 220, dutyBefore: 60, dutyAfter: 30,
  holding: [], scheduled: [], recentAirports: [],
  aircraftProfiles: [
    {icao:'H25B',simbrief:'H25B',maxPax:8,fallback:'CL30'},
    {icao:'B738',simbrief:'B738',maxPax:189,fallback:'B738'},
    {icao:'B737',simbrief:'B737',maxPax:149,fallback:'B738'},
    {icao:'B739',simbrief:'B739',maxPax:220,fallback:'B738'},
    {icao:'B38M',simbrief:'B38M',maxPax:189,fallback:'B738'},
    {icao:'B39M',simbrief:'B39M',maxPax:220,fallback:'B738'},
    {icao:'B752',simbrief:'B752',maxPax:239,fallback:'B738'},
    {icao:'B753',simbrief:'B753',maxPax:295,fallback:'B752'},
    {icao:'B763',simbrief:'B763',maxPax:269,fallback:'B752'},
    {icao:'B748',simbrief:'B748',maxPax:410,fallback:'B744'},
    {icao:'B772',simbrief:'B772',maxPax:317,fallback:'B77W'},
    {icao:'B77L',simbrief:'B77L',maxPax:317,fallback:'B772'},
    {icao:'B77W',simbrief:'B77W',maxPax:396,fallback:'B772'},
    {icao:'B788',simbrief:'B788',maxPax:248,fallback:'B789'},
    {icao:'B789',simbrief:'B789',maxPax:296,fallback:'B788'},
    {icao:'B78X',simbrief:'B78X',maxPax:336,fallback:'B789'},
    {icao:'A319',simbrief:'A319',maxPax:156,fallback:'A320'},
    {icao:'A320',simbrief:'A320',maxPax:180,fallback:'A320'},
    {icao:'A20N',simbrief:'A20N',maxPax:194,fallback:'A320'},
    {icao:'A321',simbrief:'A321',maxPax:220,fallback:'A320'},
    {icao:'A21N',simbrief:'A21N',maxPax:244,fallback:'A321'},
    {icao:'A339',simbrief:'A339',maxPax:287,fallback:'A333'},
    {icao:'A359',simbrief:'A359',maxPax:350,fallback:'A333'},
    {icao:'A35K',simbrief:'A35K',maxPax:410,fallback:'A359'},
    {icao:'A388',simbrief:'A388',maxPax:520,fallback:'A388'},
    {icao:'E75L',simbrief:'E75L',maxPax:76,fallback:'E170'},
    {icao:'E295',simbrief:'E295',maxPax:146,fallback:'E190'},
    {icao:'CRJ7',simbrief:'CRJ7',maxPax:78,fallback:'CRJ9'},
    {icao:'E545',simbrief:'E545',maxPax:9,fallback:'C25C'},
    {icao:'GLF6',simbrief:'G650',maxPax:19,fallback:'GLF5'},
    {icao:'GL7T',simbrief:'GL7T',maxPax:19,fallback:'GLF5'},
    {icao:'C750',simbrief:'C750',maxPax:12,fallback:'C25C'},
    {icao:'CL60',simbrief:'CL60',maxPax:12,fallback:'CL30'},
    {icao:'CL30',simbrief:'CL30',maxPax:10,fallback:'C25C'},
    {icao:'C25C',simbrief:'C25C',maxPax:10,fallback:'C25C'},
    {icao:'PC24',simbrief:'PC24',maxPax:10,fallback:'C25C'},
    {icao:'E145',simbrief:'E145',maxPax:50,fallback:'CRJ2'},
    {icao:'ER4',simbrief:'E145',maxPax:50,fallback:'CRJ2'},
    {icao:'CRJ2',simbrief:'CRJ2',maxPax:50,fallback:'CRJ2'},
    {icao:'FA50',simbrief:'FA50',maxPax:9,fallback:'C25C'},
    {icao:'C550',simbrief:'C550',maxPax:8,fallback:'C25C'},
    {icao:'PA31',simbrief:'PA31',maxPax:8,fallback:'B350'},
    {icao:'B350',simbrief:'B350',maxPax:11,fallback:'B350'}
  ]
};

const fallbackAirports = [
  {id:3585,name:'Indianapolis International Airport',city:'Indianapolis',country:'United States',iata:'IND',icao:'KIND',lat:39.7173,lon:-86.2944,tz:'America/Indiana/Indianapolis',size:'large'},
  {id:3573,name:'Miami Opa Locka Executive Airport',city:'Miami',country:'United States',iata:'OPF',icao:'KOPF',lat:25.907,lon:-80.2784,tz:'America/New_York',size:'medium'},
  {id:3448,name:'Teterboro Airport',city:'Teterboro',country:'United States',iata:'TEB',icao:'KTEB',lat:40.8501,lon:-74.0608,tz:'America/New_York',size:'medium'},
  {id:3797,name:'Dallas Love Field',city:'Dallas',country:'United States',iata:'DAL',icao:'KDAL',lat:32.8471,lon:-96.8518,tz:'America/Chicago',size:'large'},
  {id:3494,name:'Los Angeles International Airport',city:'Los Angeles',country:'United States',iata:'LAX',icao:'KLAX',lat:33.9425,lon:-118.408,tz:'America/Los_Angeles',size:'large'}
];

let state = loadState();
let airports = [];
let airlines = new Map();
let airportSizes = new Map();
let currentAirport = null;
let parsedFlights = [];
let parsedMeta = {};
let calendarRange = 3;
let calendarAnchor = startOfDay(new Date());
let buildFlight = null;
let scheduleFlightId = null;

const $ = id => document.getElementById(id);
const qsa = sel => [...document.querySelectorAll(sel)];

function loadState(){
  try { return {...structuredClone(DEFAULTS), ...(JSON.parse(localStorage.getItem('lineforge-state')||'{}'))}; }
  catch { return structuredClone(DEFAULTS); }
}
function saveState(){ localStorage.setItem('lineforge-state', JSON.stringify(state)); updateBadges(); }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2); }
function esc(s=''){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function ymd(d){ return d.toISOString().slice(0,10); }
function displayDate(d){ return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(d); }
function parseHHMM(s){ const m=String(s||'').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]*60 + +m[2]) : null; }
function minsToTime(m){ m=((m%1440)+1440)%1440; return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')+'Z'; }
function iataToIcao(code){ const a=airports.find(x=>x.iata===code?.toUpperCase()); return a?.icao || code?.toUpperCase() || ''; }
function airportByCode(code){ code=(code||'').toUpperCase(); return airports.find(a=>a.iata===code || a.icao===code); }

function applyTheme(){ document.body.classList.toggle('dark', state.theme==='dark'); $('themeBtn').textContent = state.theme==='dark'?'Light mode':'Dark mode'; }
function updateClock(){ $('utcClock').textContent = new Date().toISOString().slice(11,19)+'Z'; }
setInterval(updateClock,1000); updateClock();

async function loadDatabases(){
  $('dbStatus').textContent='Loading airport database…'; $('dbStatus').className='status-pill';
  airports = [];
  try{
    const txt = await fetch(state.airportsUrl,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error(r.status);return r.text()});
    airports = parseCsv(txt).filter(r=>r.length>=12 && r[12]==='airport').map(r=>({id:+r[0],name:r[1],city:r[2],country:r[3],iata:r[4]==='\\N'?'':r[4],icao:r[5]==='\\N'?'':r[5],lat:+r[6],lon:+r[7],tz:r[11]==='\\N'?'UTC':r[11]}));
  }catch(e){ airports=[...fallbackAirports]; }
  try{
    const txt = await fetch(state.airlinesUrl,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error(r.status);return r.text()});
    airlines = new Map(); parseCsv(txt).forEach(r=>{ if(r[3] && r[3]!=='\\N' && r[4] && r[4]!=='\\N') airlines.set(r[3].toUpperCase(),r[4].toUpperCase()); });
  }catch(e){ airlines = new Map([['AA','AAL'],['DL','DAL'],['UA','UAL'],['WN','SWA'],['B6','JBU'],['NK','NKS'],['F9','FFT'],['AS','ASA']]); }
  airportSizes = new Map();
  try{
    const txt = await fetch(state.airportSizesUrl,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error(r.status);return r.text()});
    const rows=parseCsv(txt), head=rows.shift().map(x=>x.toLowerCase());
    const idx=k=>head.indexOf(k), identI=idx('ident'),typeI=idx('type'),iataI=idx('iata_code'),gpsI=idx('gps_code'),localI=idx('local_code');
    rows.forEach(r=>{ const t=r[typeI]||''; const size=t==='large_airport'?'large':t==='medium_airport'?'medium':t==='small_airport'?'small':''; if(!size)return; [r[identI],r[gpsI],r[iataI],r[localI]].filter(Boolean).forEach(c=>airportSizes.set(String(c).toUpperCase(),size)); });
  }catch(e){ console.warn('Airport size metadata unavailable',e); }
  airports.forEach(a=>a.size=airportSizes.get(a.icao)||airportSizes.get(a.iata)||a.size||'');
  populateCountries();
  $('dbStatus').textContent=`${airports.length.toLocaleString()} airports ready · ${airports.filter(a=>a.size).length.toLocaleString()} sized`;
  $('dbStatus').className='status-pill good';
}
function parseCsv(text){
  const rows=[]; let row=[],field='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){ if(q&&text[i+1]==='"'){field+='"';i++;} else q=!q; }
    else if(c===','&&!q){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!q){ if(c==='\r'&&text[i+1]==='\n')i++; row.push(field); if(row.some(x=>x!==''))rows.push(row); row=[];field=''; }
    else field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row);} return rows;
}
function populateCountries(){
  const sel=$('countryFilter'); sel.innerHTML='<option value="">Any country</option>';
  [...new Set(airports.map(a=>a.country).filter(Boolean))].sort().forEach(c=>sel.add(new Option(c,c)));
  sel.value=state.airportCountry || 'United States'; if(!sel.value) sel.value='';
}
function eligibleAirports(){
  const country=$('countryFilter').value, req=$('codeFilter').value;
  const sizes=new Set([$('sizeLarge').checked&&'large',$('sizeMedium').checked&&'medium',$('sizeSmall').checked&&'small'].filter(Boolean));
  if(!sizes.size) return [];
  return airports.filter(a=>(!country||a.country===country) && sizes.has(a.size) && (req==='any'||req==='iata'&&a.iata||req==='icao'&&a.icao||req==='both'&&a.iata&&a.icao));
}
function chooseAirport(a){
  if(!a)return; currentAirport=a;
  state.recentAirports=[a.iata||a.icao,...state.recentAirports.filter(x=>x!==(a.iata||a.icao))].slice(0,10);saveState();renderRecent();
  $('airportCard').classList.remove('empty');
  $('airportCard').innerHTML=`<h3>${esc(a.name)}</h3><div class="airport-codes">${esc(a.iata||'—')} / ${esc(a.icao||'—')}</div><div class="airport-meta">${esc(a.city)}, ${esc(a.country)} · ${esc((a.size||'unknown').toUpperCase())} · ${a.lat.toFixed(3)}, ${a.lon.toFixed(3)} · ${esc(a.tz)}</div><div class="button-row"><button class="btn primary" id="openDep">Open FR24 departures</button><button class="btn primary" id="openArr">Open FR24 arrivals</button></div>`;
  $('openDep').onclick=()=>openFR24Airport(a,'departures'); $('openArr').onclick=()=>openFR24Airport(a,'arrivals'); $('goPaste').onclick=importClipboardBackend;
}
function openFR24Path(path){
  // Use FR24's browser-oriented free.flightradar24.com hostname rather than the
  // www hostname that iPadOS commonly hands to the installed FR24 app as a Universal Link.
  // Open it directly in a Safari tab; do not bounce through a LineForge helper route.
  const url='https://free.flightradar24.com'+path;
  const w=window.open(url,'_blank','noopener,noreferrer');
  if(!w){
    try{ navigator.clipboard.writeText(url); }catch(e){}
    alert('Safari blocked the FR24 tab. The web URL was copied to your clipboard.');
  }
}
function openFR24Airport(a,kind){ const code=(a.iata||a.icao).toLowerCase(); openFR24Path(`/data/airports/${encodeURIComponent(code)}/${kind}`); }
function renderRecent(){ const box=$('recentAirports'); box.innerHTML=''; state.recentAirports.forEach(code=>{const a=airportByCode(code); if(!a)return; const b=document.createElement('button');b.className='chip';b.textContent=`${a.iata||a.icao} · ${a.city}`;b.onclick=()=>chooseAirport(a);box.appendChild(b);}); if(!box.children.length)box.innerHTML='<span class="muted">No recent airports.</span>'; }

function switchPage(page){ qsa('.tab').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); qsa('.page').forEach(p=>p.classList.remove('active')); $('page-'+page).classList.add('active'); if(page==='holding')renderHolding(); if(page==='calendar')renderCalendar(); if(page==='settings')renderSettings(); }
qsa('.tab').forEach(b=>b.onclick=()=>switchPage(b.dataset.page));

function deriveAirlineCode(f){ if(f.operatorCode) return f.operatorCode; const v=String(f.flight||'').toUpperCase(); let m=v.match(/^([A-Z]{3})(?=\d)/); if(m)return m[1]; m=v.match(/^([A-Z0-9]{2})(?=\d)/); if(!m)return ''; const p=m[1]; return airlines.get(p)||p; }
function dedupeFlights(arr){ const seen=new Set(); return arr.filter(f=>{const k=[f.flight,f.origin,f.dest,f.std,f.reg].join('|'); if(seen.has(k))return false;seen.add(k);return true;}); }

function renderParsed(result){
  parsedFlights=result.flights.map(f=>({...f,airlineCode:f.airlineCode||deriveAirlineCode(f)})); parsedMeta=result.meta;
  $('resultsTitle').textContent=result.type==='tail'?'Tail flight history':'Airport schedule';
  populateResultFilters(); renderFilteredFlights();
}
function populateResultFilters(){
  const defs=[['filterAirline','airlineCode'],['filterAircraft','aircraft'],['filterDeparture','origin'],['filterDestination','dest']];
  defs.forEach(([id,key])=>{const el=$(id),cur=el.value;el.innerHTML='<option value="">All</option>';[...new Set(parsedFlights.map(f=>f[key]).filter(Boolean))].sort().forEach(v=>el.add(new Option(v,v)));if([...el.options].some(o=>o.value===cur))el.value=cur;});
}
function renderFilteredFlights(){
  const filters={airline:$('filterAirline').value,aircraft:$('filterAircraft').value,origin:$('filterDeparture').value,dest:$('filterDestination').value};
  const rows=parsedFlights.filter(f=>(!filters.airline||f.airlineCode===filters.airline)&&(!filters.aircraft||f.aircraft===filters.aircraft)&&(!filters.origin||f.origin===filters.origin)&&(!filters.dest||f.dest===filters.dest));
  $('resultsCount').textContent=rows.length===parsedFlights.length?String(rows.length):`${rows.length} / ${parsedFlights.length}`;
  const body=$('resultsBody'); body.innerHTML='';
  if(!rows.length){body.innerHTML='<tr><td colspan="10" class="empty-cell">No flights match the active filters.</td></tr>';return;}
  rows.forEach(f=>body.appendChild(flightRow(f)));
}
function flightRow(f){
  const tr=document.createElement('tr');
  tr.innerHTML=`<td><strong>${esc(f.flight||'—')}</strong></td><td>${esc(f.airlineCode||'—')}</td><td>${esc(f.date||'—')}</td><td class="route">${esc(f.origin||'???')} → ${esc(f.dest||'???')}</td><td>${esc(f.aircraft||'—')}</td><td>${esc(f.reg||'—')}</td><td>${esc(f.std?f.std+'Z':'—')}</td><td>${esc(f.sta?f.sta+'Z':'—')}</td><td>${esc(f.status||'—')}</td><td><div class="actions"><button class="link-btn primary">Build</button><button class="link-btn">+ Trip</button><button class="link-btn">Tail</button></div></td>`;
  const [build,trip,tail]=tr.querySelectorAll('button'); build.onclick=()=>openBuild(f); trip.onclick=()=>addHolding(f); tail.onclick=()=>openTail(f); return tr;
}
function openTail(f){ if(!f.reg){alert('No registration was present in this row.');return;} openFR24Path(`/data/aircraft/${encodeURIComponent(f.reg.toLowerCase())}`); }

function profileFor(type){ return state.aircraftProfiles.find(p=>p.icao===String(type||'').toUpperCase()); }
function maxPaxFor(type){ return profileFor(type)?.maxPax || 12; }
function localHourFor(f){
  const a=airportByCode(f.origin), mins=parseHHMM(f.std); if(mins==null)return 12;
  if(a?.tz){ try{ const d=new Date(); d.setUTCHours(Math.floor(mins/60),mins%60,0,0); return +new Intl.DateTimeFormat('en-US',{timeZone:a.tz,hour:'2-digit',hour12:false}).format(d).replace(/^24$/,'0'); }catch{} }
  return Math.floor(mins/60);
}
function randomPax(f){
  const h=localHourFor(f), max=maxPaxFor(f.aircraft); let lo=.5,hi=.85;
  if((h>=6&&h<10)||(h>=16&&h<20)){lo=.8;hi=1;} else if(h>=10&&h<16){lo=.65;hi=.95;} else if(h>=22||h<5){lo=.4;hi=.65;} else {lo=.55;hi=.85;}
  return Math.max(1,Math.min(max,Math.round(max*(lo+Math.random()*(hi-lo)))));
}
function deriveCallsign(f){
  if(f.operatorCode){ const num=(f.flight.match(/\d+/)||[])[0]||''; return f.operatorCode+num; }
  const v=String(f.flight||'').toUpperCase(); let m=v.match(/^([A-Z]{3})(\d+[A-Z]?)$/); if(m)return v; m=v.match(/^([A-Z0-9]{2})(\d+[A-Z]?)$/); if(!m)return v; const prefix=m[1]; return (airlines.get(prefix)||prefix)+m[2];
}
function openBuild(f){
  buildFlight=f; const p=profileFor(f.aircraft); const pax=randomPax(f);
  $('buildRoute').textContent=`${f.origin||'???'} → ${f.dest||'???'} · source ${f.flight||'flight'}`;
  $('buildCallsign').value=deriveCallsign(f); $('buildType').value=p?.simbrief||f.aircraft||''; $('buildReg').value=f.reg||''; $('buildOrig').value=iataToIcao(f.origin); $('buildDest').value=iataToIcao(f.dest); $('buildStd').value=f.std||''; $('buildPax').value=pax; $('buildCargo').value=0; $('freightToggle').checked=false; $('freightDesc').value=''; $('hazmatToggle').checked=false; $('hazmatFields').classList.add('hidden'); $('buildRemarks').value='';
  populateFallbacks(p?.fallback||''); $('buildDialog').showModal();
}
function populateFallbacks(recommended){
  const s=$('buildFallback'); s.innerHTML='<option value="">Use imported / mapped type</option>';
  const types=[...new Set(state.aircraftProfiles.map(p=>p.simbrief).filter(Boolean))].sort();
  types.forEach(t=>s.add(new Option((recommended&&t===recommended?'Configured fallback: ':'')+t,t)));
  s.value='';
}
function updateCargo(){
  if(!$('freightToggle').checked){$('buildCargo').value=0;return;}
  const pax=+$('buildPax').value||0, base=pax*(+state.paxWeight||220), cargo=Math.round(base*(Math.random()*.2)); $('buildCargo').value=cargo;
}
function composeRemarks(){
  const lines=[]; const desc=$('freightDesc').value.trim(); const cargo=+$('buildCargo').value||0; if(cargo>0) lines.push(`FREIGHT: ${cargo} LB${desc?' - '+desc.toUpperCase():''}`);
  if($('hazmatToggle').checked){
    const bits=[$('hazUn').value.trim(),$('hazName').value.trim(),$('hazClass').value.trim()&&`CLASS ${$('hazClass').value.trim()}`,$('hazPg').value.trim()&&`PG ${$('hazPg').value.trim()}`,$('hazQty').value.trim()&&`QTY ${$('hazQty').value.trim()}`,$('hazLoc').value.trim()&&`LOC ${$('hazLoc').value.trim()}`].filter(Boolean);
    lines.push(`SIM DG/HAZMAT: ${bits.join(' / ')}`); lines.push('SIMULATION ONLY - VERIFY ALL REAL-WORLD DG/TSA/FAA/ICAO/IATA REQUIREMENTS AND DOCUMENTATION.');
  }
  return lines.join('\n');
}
function openSimbrief(){
  const remarks=[ $('buildRemarks').value.trim(), composeRemarks() ].filter(Boolean).join('\n');
  const type=$('buildFallback').value || $('buildType').value.trim().toUpperCase();
  if(!type || !$('buildOrig').value || !$('buildDest').value){alert('Aircraft type, origin, and destination are required by SimBrief.');return;}
  const callsign=$('buildCallsign').value.trim().toUpperCase(); const m=callsign.match(/^([A-Z]{3})(\d+[A-Z]?)$/);
  const params=new URLSearchParams({newflight:'1',type,orig:$('buildOrig').value.trim().toUpperCase(),dest:$('buildDest').value.trim().toUpperCase(),callsign,reg:$('buildReg').value.trim().toUpperCase(),pax:$('buildPax').value||'0',cargo:$('buildCargo').value||'0',units:'LBS',manualrmk:remarks,find_sidstar:'1'});
  if(m){params.set('airline',m[1]);params.set('fltnum',m[2]);}
  const std=$('buildStd').value.match(/(\d{1,2}):(\d{2})/); if(std){params.set('deph',std[1].padStart(2,'0'));params.set('depm',std[2]);}
  window.open('https://www.simbrief.com/system/dispatch.php?'+params.toString(),'_blank','noopener');
}

function addHolding(f){
  if(state.holding.some(x=>sameFlight(x,f)) || state.scheduled.some(x=>sameFlight(x,f))){alert('That leg is already in your holding area or trip board.');return;}
  state.holding.push({...f,id:uid(),addedAt:new Date().toISOString()}); saveState(); updateBadges(); switchPage('holding');
}
function sameFlight(a,b){return a.flight===b.flight&&a.origin===b.origin&&a.dest===b.dest&&a.std===b.std&&a.reg===b.reg;}
function renderHolding(){
  const body=$('holdingBody'); body.innerHTML=''; if(!state.holding.length){body.innerHTML='<tr><td colspan="7" class="empty-cell">No unscheduled legs. Use “+ Trip” on any parsed flight.</td></tr>';return;}
  state.holding.forEach(f=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td><strong>${esc(f.flight||'—')}</strong></td><td class="route">${esc(f.origin)} → ${esc(f.dest)}</td><td>${esc(f.aircraft||'—')} ${esc(f.reg||'')}</td><td>${esc(f.std?f.std+'Z':'—')}</td><td>${esc(f.sta?f.sta+'Z':'—')}</td><td><button class="link-btn">Build</button></td><td><div class="actions"><button class="link-btn primary">Choose date</button><button class="link-btn">Random roll</button><button class="link-btn">Remove</button></div></td>`; const bs=tr.querySelectorAll('button');bs[0].onclick=()=>openBuild(f);bs[1].onclick=()=>openScheduleDialog(f);bs[2].onclick=()=>randomSchedule(f);bs[3].onclick=()=>removeHolding(f.id); body.appendChild(tr); });
}
function removeHolding(id){state.holding=state.holding.filter(x=>x.id!==id);saveState();renderHolding();}
function openScheduleDialog(f){scheduleFlightId=f.id;$('scheduleFlightLabel').textContent=`${f.flight||'Flight'} · ${f.origin} → ${f.dest} · ${f.std||'--:--'}Z`;$('scheduleDate').value=ymd(new Date());$('scheduleDialog').showModal();}
function scheduleOnDate(id,date){
  const i=state.holding.findIndex(x=>x.id===id);if(i<0)return; const f=state.holding[i]; state.scheduled.push({...f,scheduledDate:date}); state.holding.splice(i,1);saveState();renderHolding();renderCalendar();
}
function randomSchedule(f){
  for(let tries=0;tries<100;tries++){ const d=addDays(startOfDay(new Date()),Math.floor(Math.random()*30)); const date=ymd(d); if(!hasOverlap(f,date)){scheduleOnDate(f.id,date);return;} } alert('Could not find a non-overlapping slot in the next 30 days.');
}
function hasOverlap(f,date){
  const s=parseHHMM(f.std)??720; let e=parseHHMM(f.sta); if(e==null){const dur=parseHHMM(f.flightTime)||120;e=s+dur;} if(e<s)e+=1440;
  return state.scheduled.filter(x=>x.scheduledDate===date).some(x=>{const xs=parseHHMM(x.std)??720;let xe=parseHHMM(x.sta);if(xe==null)xe=xs+120;if(xe<xs)xe+=1440;return s<xe&&e>xs;});
}
function rollAll(){[...state.holding].forEach(f=>randomSchedule(f));}
function updateBadges(){$('holdingBadge').textContent=state.holding.length;}

function renderCalendar(){
  const label=$('rangeLabel'); const view=$('calendarView');
  if(calendarRange===30){ renderMonth(view,label); return; }
  const start=calendarAnchor,end=addDays(start,calendarRange-1); label.textContent=`${displayDate(start)} – ${displayDate(end)}`;
  view.innerHTML=''; const timeline=document.createElement('div');timeline.className='timeline';timeline.style.setProperty('--days',calendarRange);
  const axis=document.createElement('div');axis.className='time-axis';axis.innerHTML='<div class="day-head">UTC<span>Zulu</span></div>'+Array.from({length:24},(_,h)=>`<div class="tick">${String(h).padStart(2,'0')}:00</div>`).join('');timeline.appendChild(axis);
  for(let i=0;i<calendarRange;i++){ const d=addDays(start,i),date=ymd(d); const col=document.createElement('div');col.className='day-col';col.innerHTML=`<div class="day-head">${new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(d)}<span>${date}</span></div>`; const flights=state.scheduled.filter(f=>f.scheduledDate===date); flights.forEach(f=>placeFlight(col,f)); timeline.appendChild(col); }
  view.appendChild(timeline);
}
function placeFlight(col,f){
  const s=parseHHMM(f.std)??720;let e=parseHHMM(f.sta);if(e==null){const dur=parseHHMM(f.flightTime)||120;e=s+dur;}if(e<s)e+=1440;const pxPerMin=48/60; const before=+state.dutyBefore||0, after=+state.dutyAfter||0;
  const duty=document.createElement('div');duty.className='duty-block';duty.style.top=(40+Math.max(0,s-before)*pxPerMin)+'px';duty.style.height=(Math.min(1440,e+after)-Math.max(0,s-before))*pxPerMin+'px';col.appendChild(duty);
  const b=document.createElement('div');b.className='flight-block';b.style.top=(40+s*pxPerMin)+'px';b.style.height=Math.max(28,(e-s)*pxPerMin)+'px';b.innerHTML=`<strong>${esc(f.flight||f.reg||'Flight')}</strong>${esc(f.origin)}→${esc(f.dest)} · ${esc(f.aircraft||'')}<br>${minsToTime(s)}–${minsToTime(e)}`;b.title=`Planned duty ${minsToTime(s-before)}–${minsToTime(e+after)} (${state.opType})`;col.appendChild(b);
}
function renderMonth(view,label){
  const a=new Date(calendarAnchor); const first=new Date(a.getFullYear(),a.getMonth(),1), last=new Date(a.getFullYear(),a.getMonth()+1,0); label.textContent=new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(first); const grid=document.createElement('div');grid.className='month-grid';['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(x=>{const h=document.createElement('div');h.className='month-head';h.textContent=x;grid.appendChild(h)}); const start=addDays(first,-first.getDay()); for(let i=0;i<42;i++){const d=addDays(start,i),date=ymd(d),cell=document.createElement('div');cell.className='month-day'+(d.getMonth()!==first.getMonth()?' out':'');cell.innerHTML=`<div class="date-num">${d.getDate()}</div>`;state.scheduled.filter(f=>f.scheduledDate===date).forEach(f=>{const x=document.createElement('div');x.className='month-flight';x.textContent=`${f.std||'--:--'} ${f.flight||f.reg||''} ${f.origin}-${f.dest}`;cell.appendChild(x)});grid.appendChild(cell);}view.innerHTML='';view.appendChild(grid);
}

function renderSettings(){
  $('opType').value=state.opType;$('paxWeight').value=state.paxWeight;$('dutyBefore').value=state.dutyBefore;$('dutyAfter').value=state.dutyAfter;$('airportsUrl').value=state.airportsUrl;$('airlinesUrl').value=state.airlinesUrl;$('airportSizesUrl').value=state.airportSizesUrl;renderProfiles();
}
function renderProfiles(){
  const body=$('profilesBody');body.innerHTML='';state.aircraftProfiles.forEach((p,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td><input class="profile-input" data-k="icao" value="${esc(p.icao)}"></td><td><input class="profile-input" data-k="simbrief" value="${esc(p.simbrief)}"></td><td><input class="profile-input" data-k="maxPax" type="number" min="1" value="${p.maxPax}"></td><td><input class="profile-input" data-k="fallback" value="${esc(p.fallback||'')}"></td><td><button class="remove-profile">Remove</button></td>`;tr.querySelectorAll('input').forEach(inp=>inp.onchange=()=>{let v=inp.type==='number'?+inp.value:inp.value.toUpperCase().trim();state.aircraftProfiles[i][inp.dataset.k]=v;saveState();});tr.querySelector('button').onclick=()=>{state.aircraftProfiles.splice(i,1);saveState();renderProfiles();};body.appendChild(tr);});
}
function exportJson(){ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lineforge-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }

const AIRPORT_SAMPLE=`OPF/KOPF\nMiami Opa Locka Executive Airport\nUnited States\nArrivals\nTIME FLIGHT FROM AIRLINE AIRCRAFT STATUS\nFriday, Sep 11\n03:28 LXJ660 Teterboro (TEB) Flexjet GLF6 (N660FX) Estimated 03:24\n07:12 VJT768 Los Angeles (LAX) VistaJet GL7T (9H-VIT) Estimated 06:31\n14:07  Stuart (SUA) - PA31 (N56MH) Scheduled\n16:03 LXJ449 Teterboro (TEB) Flexjet E545 Scheduled\n17:40 XE1100 Teterboro (TEB) JSX ER4 Scheduled`;
const TAIL_SAMPLE=`Flight history for aircraft - N989CL\nAIRCRAFT Hawker 800XP\nAIRLINE Fly Alliance\nOPERATOR Fly Alliance\nTYPE CODE H25B\nCode KPO\nCode KPO\nMODE S ADCCD0\nFLIGHTS HISTORY\nKPO989\n10 Sep 2026\n2:32\nLanded 18:04\nSTD\n14:40\nATD\n15:32\nSTA\n18:02\nFROM\nMiami (OPF)\nTO\nWesthampton Beach (FOK)\nKPO989\n09 Sep 2026\n2:10\nLanded 16:58\nSTD\n14:35\nATD\n14:48\nSTA\n17:02\nFROM\nWashington (IAD)\nTO\nMiami (OPF)\nKPO989\n08 Sep 2026\n2:15\nLanded 15:31\nSTD\n12:30\nATD\n13:16\nSTA\n15:37\nFROM\nNaples (APF)\nTO\nWashington (IAD)`;

const REGISTRATION_COUNTRIES=[
  ['US','United States','N'],
  ['CA','Canada','C-F / C-G'],
  ['GB','United Kingdom','G-'],
  ['DE','Germany','D-'],
  ['FR','France','F-'],
  ['AU','Australia','VH-'],
  ['NZ','New Zealand','ZK- / ZL- / ZM-'],
  ['IE','Ireland','EI-'],
  ['NL','Netherlands','PH-'],
  ['BE','Belgium','OO-'],
  ['CH','Switzerland','HB-'],
  ['AT','Austria','OE-'],
  ['ES','Spain','EC-'],
  ['PT','Portugal','CS-'],
  ['IT','Italy','I-'],
  ['NO','Norway','LN-'],
  ['SE','Sweden','SE-'],
  ['DK','Denmark','OY-'],
  ['FI','Finland','OH-'],
  ['PL','Poland','SP-'],
  ['CZ','Czech Republic','OK-'],
  ['GR','Greece','SX-'],
  ['JP','Japan','JA'],
  ['CN','China','B-'],
  ['KR','South Korea','HL'],
  ['IN','India','VT-'],
  ['BR','Brazil','PP- / PR- / PT- / PU-'],
  ['MX','Mexico','XA- / XB- / XC-'],
  ['ZA','South Africa','ZS- / ZT- / ZU-'],
  ['AE','United Arab Emirates','A6-'],
  ['SA','Saudi Arabia','HZ-'],
  ['IL','Israel','4X- / 4Z-'],
  ['TR','Türkiye','TC-'],
  ['SG','Singapore','9V-'],
  ['MY','Malaysia','9M-'],
  ['TH','Thailand','HS-']
];
const REG_PREFIXES={
  US:['N'],CA:['C-F','C-G','CF-','CG-'],GB:['G-'],DE:['D-'],FR:['F-'],AU:['VH-'],NZ:['ZK-','ZL-','ZM-'],IE:['EI-'],NL:['PH-'],BE:['OO-'],CH:['HB-'],AT:['OE-'],ES:['EC-'],PT:['CS-'],IT:['I-'],NO:['LN-'],SE:['SE-'],DK:['OY-'],FI:['OH-'],PL:['SP-'],CZ:['OK-'],GR:['SX-'],JP:['JA'],CN:['B-'],KR:['HL'],IN:['VT-'],BR:['PP-','PR-','PT-','PU-'],MX:['XA-','XB-','XC-'],ZA:['ZS-','ZT-','ZU-'],AE:['A6-'],SA:['HZ-'],IL:['4X-','4Z-'],TR:['TC-'],SG:['9V-'],MY:['9M-'],TH:['HS-']
};
const RANDOM_TYPES=['H25B','C25A','C25B','C25C','E545','C750','CL30','CL35','CL60','GLF4','GLF5','GLF6','GL7T','PC24','B350','B738','B737','B739','A319','A320','A321','E145','E170','E190','CRJ2','CRJ7','CRJ9','B763','B772','B77W','B788','B789','A332','A333','A359','A35K'];
function populateTailCountries(){
  const sel=$('tailCountry'); sel.innerHTML='';
  REGISTRATION_COUNTRIES.forEach(([code,name,prefix])=>sel.add(new Option(`${name} — ${prefix}`,code)));
  const wanted=REGISTRATION_COUNTRIES.some(x=>x[0]===state.tailCountry)?state.tailCountry:'US'; sel.value=wanted; state.tailCountry=wanted;
}
function regMatchesCountry(reg,code){
  const u=String(reg||'').trim().toUpperCase(), prefixes=REG_PREFIXES[code]||[];
  return prefixes.length ? prefixes.some(p=>u.startsWith(p)) : false;
}
function normalizeAdsb(a={}){
  return {hex:a.hex||'',registration:a.r||a.reg||'',callsign:String(a.flight||'').trim(),aircraft:a.t||a.type||'',operator:a.ownOp||a.owner||'',altitude:a.alt_baro??a.alt_geom??'',lat:a.lat??null,lon:a.lon??null,source:'ADSB.lol'};
}
async function fetchJsonStrict(url){
  const r=await fetch(url,{headers:{Accept:'application/json'}});
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const ct=(r.headers.get('content-type')||'').toLowerCase();
  if(!ct.includes('json')) throw new Error('Provider returned non-JSON data');
  return r.json();
}
async function directAdsbTail(country,type){
  const types=type?[type]:[...RANDOM_TYPES].sort(()=>Math.random()-.5);
  const tries=Math.min(type?1:14,types.length);
  let last='No matching live aircraft found.';
  for(let i=0;i<tries;i++){
    const t=types[i];
    try{
      const j=await fetchJsonStrict(`https://api.adsb.lol/v2/type/${encodeURIComponent(t)}`);
      const rows=(j.ac||j.aircraft||[]).map(normalizeAdsb).filter(a=>a.registration&&regMatchesCountry(a.registration,country));
      if(rows.length){const out=rows[Math.floor(Math.random()*rows.length)];out.source='ADSB.lol';return out;}
      last=`No live ${t} aircraft matched the selected registration country.`;
    }catch(e){last=e.message; if(type) throw e;}
  }
  throw new Error(last);
}
async function directOpenSkyTail(country,type){
  // OpenSky state vectors do not include registrations. We use OpenSky to choose live
  // ICAO24 aircraft, then resolve registration/type through ADSB.lol and apply the
  // selected national registration prefix. That keeps this filter about the tail,
  // not the aircraft's present location or OpenSky origin-country label.
  const j=await fetchJsonStrict('https://opensky-network.org/api/states/all');
  const states=[...(j.states||[])].filter(s=>s&&s[0]).sort(()=>Math.random()-.5);
  const limit=Math.min(states.length,type?120:70);
  for(const s of states.slice(0,limit)){
    try{
      const x=await fetchJsonStrict(`https://api.adsb.lol/v2/icao/${encodeURIComponent(String(s[0]).toLowerCase())}`);
      const a=(x.ac||x.aircraft||[])[0]; if(!a) continue;
      const out=normalizeAdsb(a);
      if(!out.registration||!regMatchesCountry(out.registration,country)) continue;
      if(type&&String(out.aircraft).toUpperCase()!==type) continue;
      out.callsign=out.callsign||String(s[1]||'').trim(); out.source='OpenSky + ADSB.lol'; return out;
    }catch(e){}
  }
  throw new Error('OpenSky did not yield a live aircraft matching that registration country/type.');
}
async function rollRandomTail(){
  const country=$('tailCountry').value||'US',source=$('tailSource').value||'auto';
  let aircraft=$('tailAircraft').value||'';
  if(aircraft==='CUSTOM') aircraft=$('tailCustomAircraft').value.trim().toUpperCase();
  state.tailCountry=country;state.tailSource=source;state.tailAircraft=$('tailAircraft').value||'';saveState();
  $('tailStatus').textContent='Searching live aircraft…'; $('tailStatus').className='status-pill'; $('randomTailBtn').disabled=true;
  try{
    const qs=new URLSearchParams({country,source}); if(aircraft)qs.set('type',aircraft);
    const r=await fetch(`/api/random-tail?${qs.toString()}`); const j=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error||`Lookup failed (${r.status})`);
    $('tailStatus').textContent=j.source||'Found'; $('tailStatus').className='status-pill good';
    const hasReg=!!j.registration,rc=REGISTRATION_COUNTRIES.find(x=>x[0]===country);
    $('tailCard').classList.remove('empty');
    $('tailCard').innerHTML=`<h3>${esc(j.registration||'Registration unavailable')}</h3><div class="airport-codes">${esc(j.aircraft||'TYPE —')} · ${esc(j.callsign||'NO CALLSIGN')}</div><div class="airport-meta">${esc(rc?`${rc[1]} registration (${rc[2]})`:country)} · HEX ${esc(String(j.hex||'').toUpperCase())} · ${esc(j.operator||'Operator unavailable')} · ${esc(j.source||'')}</div><div class="button-row"><button id="openRandomTail" class="btn primary" ${hasReg?'':'disabled'}>Open FR24 tail history</button></div>`;
    if(hasReg)$('openRandomTail').onclick=()=>openFR24Path(`/data/aircraft/${encodeURIComponent(j.registration.toLowerCase())}`);
  }catch(e){
    $('tailStatus').textContent='Lookup failed'; $('tailStatus').className='status-pill bad';
    $('tailCard').classList.remove('empty'); $('tailCard').innerHTML=`<div class="notice warning">${esc(e.message)}<br><br>Try again, select another aircraft type, or switch provider.</div>`;
  }finally{$('randomTailBtn').disabled=false;}
}

async function parsePastedFR24(){
  const text=String($('fr24Paste').value||'').trim();
  if(!text){
    alert('Paste the copied FR24 page text into the import box first.');
    $('fr24Paste').focus();
    return;
  }
  const btn=$('parsePasteBtn');
  const old=btn.textContent;
  btn.disabled=true; btn.textContent='Parsing…';
  try{
    const r=await fetch('/api/parse-fr24',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text})
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error||`Parse failed (${r.status})`);
    renderParsed(j);
    switchPage('results');
  }catch(e){
    alert(`Could not parse the FR24 page: ${e.message}`);
  }finally{
    btn.disabled=false; btn.textContent=old;
  }
}

// Wire UI
$('themeBtn').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';saveState();applyTheme();};
$('parsePasteBtn').onclick=parsePastedFR24;
$('clearPasteBtn').onclick=()=>{$('fr24Paste').value='';$('fr24Paste').focus();};
$('fr24Paste').addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')parsePastedFR24();});
populateTailCountries(); $('tailSource').value=state.tailSource||'auto'; $('tailAircraft').value=state.tailAircraft||''; $('tailCustomWrap').classList.toggle('hidden',$('tailAircraft').value!=='CUSTOM');
$('randomTailBtn').onclick=rollRandomTail; $('tailCountry').onchange=()=>{state.tailCountry=$('tailCountry').value;saveState();}; $('tailSource').onchange=()=>{state.tailSource=$('tailSource').value;saveState();}; $('tailAircraft').onchange=()=>{state.tailAircraft=$('tailAircraft').value; $('tailCustomWrap').classList.toggle('hidden',$('tailAircraft').value!=='CUSTOM'); saveState();};
$('randomAirportBtn').onclick=()=>{const x=eligibleAirports();if(!x.length)return alert('No airports match those filters.');chooseAirport(x[Math.floor(Math.random()*x.length)]);};
$('searchAirportBtn').onclick=()=>{const q=$('airportSearch').value.trim().toLowerCase();if(!q)return;const a=airports.find(x=>x.iata.toLowerCase()===q||x.icao.toLowerCase()===q)||airports.find(x=>`${x.name} ${x.city} ${x.country}`.toLowerCase().includes(q));if(a)chooseAirport(a);else alert('No matching airport found.');};
$('airportSearch').addEventListener('keydown',e=>{if(e.key==='Enter')$('searchAirportBtn').click();});
$('countryFilter').onchange=()=>{state.airportCountry=$('countryFilter').value;saveState();};
$('clearRecentBtn').onclick=()=>{state.recentAirports=[];saveState();renderRecent();};
['filterAirline','filterAircraft','filterDeparture','filterDestination'].forEach(id=>$(id).onchange=renderFilteredFlights);
$('freightToggle').onchange=()=>{updateCargo();}; $('buildPax').onchange=()=>{if($('freightToggle').checked)updateCargo();};
$('hazmatToggle').onchange=()=>{$('hazmatFields').classList.toggle('hidden',!$('hazmatToggle').checked);};
$('openSimbriefBtn').onclick=openSimbrief;
$('saveScheduleBtn').onclick=()=>{if(!$('scheduleDate').value)return; scheduleOnDate(scheduleFlightId,$('scheduleDate').value);$('scheduleDialog').close();};
$('rollAllBtn').onclick=rollAll;
qsa('.range-btn').forEach(b=>b.onclick=()=>{calendarRange=+b.dataset.range;qsa('.range-btn').forEach(x=>x.classList.toggle('active',x===b));renderCalendar();});
$('prevRange').onclick=()=>{calendarAnchor=calendarRange===30?new Date(calendarAnchor.getFullYear(),calendarAnchor.getMonth()-1,1):addDays(calendarAnchor,-calendarRange);renderCalendar();};
$('nextRange').onclick=()=>{calendarAnchor=calendarRange===30?new Date(calendarAnchor.getFullYear(),calendarAnchor.getMonth()+1,1):addDays(calendarAnchor,calendarRange);renderCalendar();};
$('todayRange').onclick=()=>{calendarAnchor=startOfDay(new Date());renderCalendar();};
['opType','paxWeight','dutyBefore','dutyAfter'].forEach(id=>$(id).onchange=()=>{state[id]=$(id).type==='number'?+$(id).value:$(id).value;saveState();});
$('airportsUrl').onchange=()=>{state.airportsUrl=$('airportsUrl').value.trim();saveState();};$('airlinesUrl').onchange=()=>{state.airlinesUrl=$('airlinesUrl').value.trim();saveState();};$('airportSizesUrl').onchange=()=>{state.airportSizesUrl=$('airportSizesUrl').value.trim();saveState();};
$('reloadDbBtn').onclick=loadDatabases;$('addProfileBtn').onclick=()=>{state.aircraftProfiles.push({icao:'NEW',simbrief:'',maxPax:10,fallback:''});saveState();renderProfiles();};
$('exportBtn').onclick=exportJson;$('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{state={...structuredClone(DEFAULTS),...JSON.parse(await f.text())};saveState();applyTheme();renderSettings();renderHolding();renderCalendar();loadDatabases();}catch{alert('Invalid LineForge JSON file.')}};
$('resetBtn').onclick=()=>{if(confirm('Reset all LineForge local data?')){localStorage.removeItem('lineforge-state');location.reload();}};

applyTheme(); updateBadges(); renderRecent(); renderSettings(); renderHolding(); renderCalendar(); loadDatabases();
})();
