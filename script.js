/* ---------- Edit these squares any time. Need at least 24. ---------- */
const SQUARES = [
  "McNeil Plant","SR71 Blackbird","Miles of pipes under campus","Takes 5 minutes to answer a simple question","The holy grail of thermodynamics",
  "Personal Wood stove","Theres a really good Veritasium Video on this","UVM Physical Plant","Tells an anecdotal story semi related to thermodynamics","Airplanes are just big metal tubes in the sky",
  "It would end up somewhere in the lake","Benchmark space systems","I can't tell if you guys don't understand or if it's really obvious","Any Questions?","Shows past exam histogram",
  "There's no need to memorize any of this","Makes a student give up on their question","Same sentence 5 times in a row","Tests all the markers","Dangerous for engineers to only memorize the formulas",
  "Talks himself out of breath","Filler text 22","Filler text 23","Filler text 24","Filler text 25"
];

const $ = id => document.getElementById(id);
const today = (() => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); })();
$("date").textContent = new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});

let db = null, player = null, state = null, docRef = null, saveTimer = null, dbWritable = true;

/* Seeded shuffle so a name + date always gives the same card, even on another device */
function hash(str){ let h=1779033703^str.length; for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19} return ()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0} }
function rng(seed){ let a=hash(seed)(); return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296} }
function makeCard(key){
  const r = rng(key), pool = SQUARES.slice();
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  const cells = pool.slice(0,24); cells.splice(12,0,"FREE");
  return {cells, marks: cells.map((_,i)=>i===12)};
}
const keyFor = name => name.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "player";

/* Storage: shared db when available, this device's browser otherwise */
function localGet(k){ try{ return JSON.parse(localStorage.getItem(k)) }catch(e){ return null } }
function localSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)) }catch(e){} }

async function loadCard(name){
  const id = today+"_"+keyFor(name);
  const lk = "bingo:"+id;
  let saved = null;
  if(db){
    try{
      docRef = db.doc("cards/"+id);
      const snap = await docRef.get();
      if(snap.exists) saved = snap.data();
    }catch(e){ docRef = null }
  }
  if(!saved) saved = localGet(lk);
  if(!saved || !Array.isArray(saved.cells) || saved.cells.length!==25){
    saved = {...makeCard(id), name:name.trim(), date:today};
    persist(saved, true);
  }
  return saved;
}
function persist(s, immediate){
  const id = today+"_"+keyFor(player);
  localSet("bingo:"+id, s);
  if(!db || !docRef || !dbWritable) return;
  clearTimeout(saveTimer);
  const write = async ()=>{
    try{ await docRef.set({name:s.name,date:s.date,cells:s.cells,marks:s.marks,bingos:countWins(s.marks),squares:s.marks.filter(Boolean).length-1}); $("status").textContent="Saved"; }
    catch(e){
      if(e && e.code==="invalid_argument"){ dbWritable=false; $("status").textContent="Saved on this device"; }
      else if(e && e.code==="unavailable"){ setTimeout(write,800+Math.random()*800); }
    }
  };
  immediate ? write() : (saveTimer=setTimeout(write,400));
}

/* Win check */
const LINES = [];
for(let i=0;i<5;i++){ LINES.push([0,1,2,3,4].map(c=>i*5+c)); LINES.push([0,1,2,3,4].map(r=>r*5+i)); }
LINES.push([0,6,12,18,24],[4,8,12,16,20]);

const countWins = m => LINES.filter(l=>l.every(i=>m[i])).length;

/* Leaderboard */
let boardRows = [];
function renderBoard(){
  const ol = $("lb"); ol.innerHTML = "";
  const rows = boardRows.slice().sort((a,b)=> (b.bingos-a.bingos) || (b.squares-a.squares) || a.name.localeCompare(b.name));
  $("lbEmpty").hidden = rows.length>0;
  const me = player ? keyFor(player) : null;
  let rank = 0, prev = null;
  rows.forEach((r,i)=>{
    const sig = r.bingos+"/"+r.squares; if(sig!==prev){ rank=i+1; prev=sig; }
    const li = document.createElement("li");
    if(rank===1 && r.bingos>0) li.classList.add("top");
    if(me && keyFor(r.name)===me) li.classList.add("me");
    const rk=document.createElement("span"); rk.className="rank"; rk.textContent=rank;
    const nm=document.createElement("span"); nm.className="pname"; nm.textContent=r.name; nm.title=r.name;
    const sc=document.createElement("span"); sc.className="score";
    const b=document.createElement("b"); b.textContent=r.bingos;
    sc.append(b, document.createTextNode(r.bingos===1?" bingo · ":" bingos · "), document.createTextNode(r.squares+" sq"));
    li.append(rk,nm,sc); ol.appendChild(li);
  });
}
function watchBoard(){
  if(!db){ $("lbEmpty").textContent = "The shared leaderboard isn't available on this page."; return; }
  db.collection("cards").where("date","==",today).onSnapshot(snap=>{
    boardRows = snap.docs.map(d=>d.data()).filter(d=>d && typeof d.name==="string" && Array.isArray(d.marks))
      .map(d=>({name:d.name, bingos: Number.isFinite(d.bingos)?d.bingos:countWins(d.marks), squares: Number.isFinite(d.squares)?d.squares:d.marks.filter(Boolean).length-1}));
    renderBoard();
  }, ()=>{ $("lbEmpty").textContent = "The leaderboard couldn't load. Reload the page to try again."; $("lbEmpty").hidden=false; });
}

function render(){
  const g = $("grid"); g.innerHTML="";
  state.cells.forEach((text,i)=>{
    const b = document.createElement("button");
    b.className = "cell"+(i===12?" free":"");
    b.setAttribute("aria-pressed", state.marks[i]?"true":"false");
    const s = document.createElement("span"); s.textContent = text; b.appendChild(s);
    b.addEventListener("click",()=>{ state.marks[i]=!state.marks[i]; b.setAttribute("aria-pressed",state.marks[i]); checkWin(); persist(state); });
    g.appendChild(b);
  });
  checkWin(true);
}
let hadBingo = false;
function checkWin(quiet){
  const wins = LINES.filter(l=>l.every(i=>state.marks[i]));
  if(player){
    const k=keyFor(player), row={name:player,bingos:wins.length,squares:state.marks.filter(Boolean).length-1};
    const idx=boardRows.findIndex(r=>keyFor(r.name)===k);
    if(idx>=0) boardRows[idx]=row; else boardRows.push(row);
    renderBoard();
  }
  const cells = $("grid").children, hit = new Set(wins.flat());
  for(let i=0;i<25;i++) cells[i].classList.toggle("line",hit.has(i));
  const bn = $("banner");
  if(wins.length){
    bn.textContent = wins.length>1 ? "BINGO ×"+wins.length+"!" : "BINGO!";
    if(!hadBingo && !quiet){ bn.classList.remove("show"); void bn.offsetWidth; bn.classList.add("show"); }
    hadBingo = true;
  } else { bn.textContent=""; hadBingo=false; }
}

async function start(name){
  name = name.trim(); if(!name){ $("name").focus(); return; }
  player = name; hadBingo = false;
  $("go").disabled = true; $("status").textContent = "Loading your card…";
  state = await loadCard(name);
  $("go").disabled = false; $("status").textContent = "";
  $("who").textContent = name;
  $("join").hidden = true; $("play").hidden = false;
  try{ sessionStorage.setItem("bingo:last", JSON.stringify({name, date:today})) }catch(e){}
  render();
}

$("joinForm").addEventListener("submit",()=>start($("name").value));
$("switch").addEventListener("click",()=>{
  $("play").hidden = true; $("join").hidden = false; $("name").value=""; $("name").focus();
  player = null; renderBoard();
  try{ sessionStorage.removeItem("bingo:last") }catch(e){}
});
$("clear").addEventListener("click",()=>{
  state.marks = state.cells.map((_,i)=>i===12); render(); persist(state);
});

/* Light up shared saving when available; page works without it */
(async ()=>{
  try{
    if(window.claude && typeof window.claude.use==="function"){
      db = await window.claude.use("db");
      const user = await window.claude.use("user");
      if(user && user.can && (await user.can("data.write"))===false) dbWritable = false;
    }
  }catch(e){ db = null }
  watchBoard();
  try{
    const last = JSON.parse(sessionStorage.getItem("bingo:last"));
    if(last && last.date===today && $("play").hidden) start(last.name);
  }catch(e){}
})();