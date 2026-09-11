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
    {icao:'A320',simbrief:'A320',maxPax:180,fallback:'A320'},
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
  $('airportCard').innerHTML=`<h3>${esc(a.name)}</h3><div class="airport-codes">${esc(a.iata||'—')} / ${esc(a.icao||'—')}</div><div class="airport-meta">${esc(a.city)}, ${esc(a.country)} · ${esc((a.size||'unknown').toUpperCase())} · ${a.lat.toFixed(3)}, ${a.lon.toFixed(3)} · ${esc(a.tz)}</div><div class="button-row"><button class="btn primary" id="openDep">Open FR24 departures</button><button class="btn primary" id="openArr">Open FR24 arrivals</button><button class="btn secondary" id="goPaste">Paste & Parse</button></div>`;
  $('openDep').onclick=()=>openFR24Airport(a,'departures'); $('openArr').onclick=()=>openFR24Airport(a,'arrivals'); $('goPaste').onclick=()=>switchPage('paste');
}
async function openFR24Path(path){
  const url='https://www.flightradar24.com'+path;
  // iPadOS can hand ordinary FR24 links to the installed FR24 app via Universal Links.
  // A web page cannot disable that association. The reliable browser-only workflow is
  // to copy the URL and open a same-origin Safari helper tab, where the user pastes it
  // into Safari's address bar. This app never directly navigates to the Universal Link.
  try{ await navigator.clipboard.writeText(url); }catch(e){ localStorage.setItem('lineforge-fr24-url',url); }
  const w=window.open('/fr24?path='+encodeURIComponent(path),'fr24Safari');
  if(!w) alert('Safari blocked the helper tab. FR24 URL copied: '+url);
}
function openFR24Airport(a,kind){ const code=(a.iata||a.icao).toLowerCase(); openFR24Path(`/data/airports/${encodeURIComponent(code)}/${kind}`); }
function renderRecent(){ const box=$('recentAirports'); box.innerHTML=''; state.recentAirports.forEach(code=>{const a=airportByCode(code); if(!a)return; const b=document.createElement('button');b.className='chip';b.textContent=`${a.iata||a.icao} · ${a.city}`;b.onclick=()=>chooseAirport(a);box.appendChild(b);}); if(!box.children.length)box.innerHTML='<span class="muted">No recent airports.</span>'; }

function switchPage(page){ qsa('.tab').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); qsa('.page').forEach(p=>p.classList.remove('active')); $('page-'+page).classList.add('active'); if(page==='holding')renderHolding(); if(page==='calendar')renderCalendar(); if(page==='settings')renderSettings(); }
qsa('.tab').forEach(b=>b.onclick=()=>switchPage(b.dataset.page));

function detectAndParse(text){
  if(/Flight history for aircraft|FLIGHTS HISTORY|TYPE CODE/i.test(text)) return parseTailPage(text);
  return parseAirportPage(text);
}
function parseAirportPage(text){
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  let airportCode='';
  for(const line of lines){ const m=line.match(/^([A-Z0-9]{3})\/([A-Z0-9]{4})$/); if(m){airportCode=m[1];break;} }
  const section = /TIME\s+FLIGHT\s+FROM/i.test(text) ? 'arrivals' : /TIME\s+FLIGHT\s+TO/i.test(text) ? 'departures' : (()=>{ const a=text.toLowerCase().lastIndexOf('arrivals'), d=text.toLowerCase().lastIndexOf('departures'); return d>a?'departures':a>d?'arrivals':'airport schedule'; })();
  const flights=[];

  // Desktop/tabular rows, usually one complete flight per line after copy.
  for(let i=0;i<lines.length;i++){
    const line=lines[i].replace(/\s+/g,' ');
    const tm=line.match(/^(\d{2}:\d{2})\s+/); if(!tm) continue;
    if(/^\d{2}:\d{2}\s*$/.test(line)) continue;
    const routeM=line.match(/\b([A-Za-z .'-]+)\s*\(([A-Z0-9]{3})\)/);
    if(!routeM) continue;
    const before=line.slice(tm[0].length, routeM.index).trim();
    const after=line.slice(routeM.index+routeM[0].length).trim();
    const flightM=before.match(/([A-Z0-9]{2,8})$/);
    const flight=flightM?flightM[1]:'';
    const airM=after.match(/\b([A-Z0-9]{3,4})\s*(?:\(([A-Z0-9-]{3,10})\))?/);
    const statusM=line.match(/(Scheduled|Estimated\s+\d{2}:\d{2}|Landed\s+\d{2}:\d{2}|Delayed(?:\s+\d{2}:\d{2})?|Canceled|Diverted).*$/i);
    if(flight || airM){
      const other=routeM[2]; const origin=section==='arrivals'?other:airportCode; const dest=section==='arrivals'?airportCode:other;
      flights.push(makeFlight({flight,date:'',origin,dest,aircraft:airM?.[1]||'',reg:airM?.[2]||'',std:section==='departures'?tm[1]:'',sta:section==='arrivals'?tm[1]:'',status:statusM?.[1]||'',airline:''}));
    }
  }

  // Mobile copy: scheduled/estimated marker then a line like "03:28 LXJ660 Teterboro(TEB)" and next aircraft line.
  if(!flights.length){
    for(let i=0;i<lines.length;i++){
      const m=lines[i].match(/^(\d{2}:\d{2})\s+([A-Z0-9]{2,8})?\s*(.+?)\s*\(([A-Z0-9]{3})\)$/);
      if(!m) continue;
      const next=(lines[i+1]||'').replace(/\s+/g,' ');
      const a=next.match(/^([A-Z0-9]{3,4})(?:\s*\(?([A-Z0-9-]{3,10})\)?)?(.*)$/);
      const prev=lines[i-1]||'';
      const status=/^(Estimated|Scheduled|Landed|Delayed|Canceled)/i.test(prev)?prev:'';
      const other=m[4], origin=section==='arrivals'?other:airportCode, dest=section==='arrivals'?airportCode:other;
      flights.push(makeFlight({flight:m[2]||'',date:'',origin,dest,aircraft:a?.[1]||'',reg:a?.[2]||'',std:section==='departures'?m[1]:'',sta:section==='arrivals'?m[1]:'',status,airline:a?.[3]||''}));
    }
  }

  // Broader scan for multi-column copied data where status is on following line.
  const uniq=dedupeFlights(flights);
  return {type:'airport',meta:{airportCode,section},flights:uniq};
}
function parseTailPage(text){
  const one=text.replace(/\s+/g,' ').trim();
  const meta={
    registration:(one.match(/Flight history for aircraft\s*-\s*([A-Z0-9-]+)/i)||[])[1]||'',
    aircraft:(one.match(/AIRCRAFT\s+(.+?)\s+AIRLINE/i)||[])[1]||'',
    airline:(one.match(/AIRLINE\s+(.+?)\s+OPERATOR/i)||[])[1]||'',
    operator:(one.match(/OPERATOR\s+(.+?)\s+TYPE CODE/i)||[])[1]||'',
    typeCode:(one.match(/TYPE CODE\s+([A-Z0-9]+)/i)||[])[1]||'',
    operatorCode:''
  };
  const afterType = one.split(/TYPE CODE\s+[A-Z0-9]+/i)[1]||'';
  meta.operatorCode=(afterType.match(/\bCode\s+([A-Z0-9]{3})\b/i)||[])[1]||'';
  const flights=[];
  const rx=/\b([A-Z0-9]{2,8})\s+(\d{2}\s+[A-Z][a-z]{2}\s+\d{4})\s+(\d{1,2}:\d{2})\s+Landed\s+(\d{2}:\d{2})\s+STD\s+(\d{2}:\d{2})\s+ATD\s+(\d{2}:\d{2})\s+STA\s+(\d{2}:\d{2})\s+FROM\s+(.+?)\s+\(([A-Z0-9]{3})\)\s+TO\s+(.+?)\s+\(([A-Z0-9]{3})\)(?=\s+[A-Z0-9]{2,8}\s+\d{2}\s+[A-Z][a-z]{2}\s+\d{4}|\s+More than|$)/g;
  let m; while((m=rx.exec(one))){
    flights.push(makeFlight({flight:m[1],date:m[2],flightTime:m[3],status:'Landed '+m[4],std:m[5],atd:m[6],sta:m[7],origin:m[9],originName:m[8],dest:m[11],destName:m[10],aircraft:meta.typeCode,reg:meta.registration,airline:meta.operator,operatorCode:meta.operatorCode}));
  }
  return {type:'tail',meta,flights};
}
function makeFlight(x){ const f={id:uid(),flight:x.flight||'',date:x.date||'',origin:(x.origin||'').toUpperCase(),dest:(x.dest||'').toUpperCase(),originName:x.originName||'',destName:x.destName||'',aircraft:(x.aircraft||'').toUpperCase(),reg:(x.reg||'').toUpperCase(),std:x.std||'',sta:x.sta||'',atd:x.atd||'',status:x.status||'',airline:x.airline||'',operatorCode:(x.operatorCode||'').toUpperCase(),flightTime:x.flightTime||''}; f.airlineCode=deriveAirlineCode(f); return f; }
function deriveAirlineCode(f){ if(f.operatorCode) return f.operatorCode; const v=String(f.flight||'').toUpperCase(); let m=v.match(/^([A-Z]{3})(?=\d)/); if(m)return m[1]; m=v.match(/^([A-Z0-9]{2})(?=\d)/); if(!m)return ''; const p=m[1]; return airlines.get(p)||p; }
function dedupeFlights(arr){ const seen=new Set(); return arr.filter(f=>{const k=[f.flight,f.origin,f.dest,f.std,f.reg].join('|'); if(seen.has(k))return false;seen.add(k);return true;}); }

function renderParsed(result){
  parsedFlights=result.flights.map(f=>({...f,airlineCode:f.airlineCode||deriveAirlineCode(f)})); parsedMeta=result.meta;
  $('resultsTitle').textContent=result.type==='tail'?'Tail flight history':'Airport schedule';
  $('sourceSummary').innerHTML=result.type==='tail'
    ? `<strong>Aircraft tail page</strong><br>Registration: ${esc(result.meta.registration||'—')}<br>Operator: ${esc(result.meta.operator||'—')}<br>ICAO type: ${esc(result.meta.typeCode||'—')}<br>Operator code: ${esc(result.meta.operatorCode||'—')}`
    : `<strong>Airport ${esc(result.meta.section||'schedule')}</strong><br>Airport: ${esc(result.meta.airportCode||'Not detected')}<br>Times: kept as pasted (Zulu expected)`;
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

const ISO_CODES=`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(/\s+/);
function populateTailCountries(){ const sel=$('tailCountry'),dn=new Intl.DisplayNames(['en'],{type:'region'}); sel.innerHTML=''; ISO_CODES.forEach(c=>sel.add(new Option(`${c} — ${dn.of(c)}`,c))); sel.value=state.tailCountry||'US'; }
async function rollRandomTail(){
  const country=$('tailCountry').value||'US',source=$('tailSource').value||'auto'; let aircraft=$('tailAircraft').value||''; if(aircraft==='CUSTOM') aircraft=$('tailCustomAircraft').value.trim().toUpperCase(); state.tailCountry=country;state.tailSource=source;state.tailAircraft=$('tailAircraft').value||'';saveState();
  $('tailStatus').textContent='Searching live aircraft…'; $('tailStatus').className='status-pill'; $('randomTailBtn').disabled=true;
  try{
    const r=await fetch(`/api/random-tail?country=${encodeURIComponent(country)}&source=${encodeURIComponent(source)}&type=${encodeURIComponent(aircraft)}`); const j=await r.json(); if(!r.ok)throw Error(j.error||'Lookup failed');
    $('tailStatus').textContent=j.source||'Found'; $('tailStatus').className='status-pill good';
    const hasReg=!!j.registration;
    $('tailCard').classList.remove('empty'); $('tailCard').innerHTML=`<h3>${esc(j.registration||'Registration unavailable')}</h3><div class="airport-codes">${esc(j.aircraft||'TYPE —')} · ${esc(j.callsign||'NO CALLSIGN')}</div><div class="airport-meta">${esc(j.country||country)} · HEX ${esc(String(j.hex||'').toUpperCase())} · ${esc(j.operator||'Operator unavailable')} · ${esc(j.source||'')}</div><div class="button-row"><button id="openRandomTail" class="btn primary" ${hasReg?'':'disabled'}>Open FR24 tail history</button><button id="tailToPaste" class="btn secondary">Paste & Parse</button></div>`;
    if(hasReg)$('openRandomTail').onclick=()=>openFR24Path(`/data/aircraft/${encodeURIComponent(j.registration.toLowerCase())}`); $('tailToPaste').onclick=()=>switchPage('paste');
  }catch(e){ $('tailStatus').textContent='Lookup failed'; $('tailStatus').className='status-pill bad'; $('tailCard').classList.remove('empty'); $('tailCard').innerHTML=`<div class="notice warning">${esc(e.message)}<br><br>Try again, change aircraft type, or switch data source. Auto mode will fall back between providers.</div>`; }
  finally{$('randomTailBtn').disabled=false;}
}

// Wire UI
$('themeBtn').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';saveState();applyTheme();};
populateTailCountries(); $('tailSource').value=state.tailSource||'auto'; $('tailAircraft').value=state.tailAircraft||''; $('tailCustomWrap').classList.toggle('hidden',$('tailAircraft').value!=='CUSTOM');
$('randomTailBtn').onclick=rollRandomTail; $('tailCountry').onchange=()=>{state.tailCountry=$('tailCountry').value;saveState();}; $('tailSource').onchange=()=>{state.tailSource=$('tailSource').value;saveState();}; $('tailAircraft').onchange=()=>{state.tailAircraft=$('tailAircraft').value; $('tailCustomWrap').classList.toggle('hidden',$('tailAircraft').value!=='CUSTOM'); saveState();};
$('randomAirportBtn').onclick=()=>{const x=eligibleAirports();if(!x.length)return alert('No airports match those filters.');chooseAirport(x[Math.floor(Math.random()*x.length)]);};
$('searchAirportBtn').onclick=()=>{const q=$('airportSearch').value.trim().toLowerCase();if(!q)return;const a=airports.find(x=>x.iata.toLowerCase()===q||x.icao.toLowerCase()===q)||airports.find(x=>`${x.name} ${x.city} ${x.country}`.toLowerCase().includes(q));if(a)chooseAirport(a);else alert('No matching airport found.');};
$('airportSearch').addEventListener('keydown',e=>{if(e.key==='Enter')$('searchAirportBtn').click();});
$('countryFilter').onchange=()=>{state.airportCountry=$('countryFilter').value;saveState();};
$('clearRecentBtn').onclick=()=>{state.recentAirports=[];saveState();renderRecent();};
$('parseBtn').onclick=()=>{const text=$('pasteBox').value.trim();if(!text)return alert('Paste FR24 page text first.');renderParsed(detectAndParse(text));};
$('clearPasteBtn').onclick=()=>{$('pasteBox').value='';parsedFlights=[];renderParsed({type:'airport',meta:{},flights:[]});$('sourceSummary').textContent='Nothing parsed yet.';};
$('sampleAirportBtn').onclick=()=>{$('pasteBox').value=AIRPORT_SAMPLE;renderParsed(detectAndParse(AIRPORT_SAMPLE));};
$('sampleTailBtn').onclick=()=>{$('pasteBox').value=TAIL_SAMPLE;renderParsed(detectAndParse(TAIL_SAMPLE));};
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
