const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('ko-KR');

const PROCESS_LABELS = {
  purchase:'구매품', sheet:'판금/절곡', cnc:'CNC/MCT', lathe:'선반',
  injection:'사출', print3d:'3D프린팅', profile:'압출', unknown:'분류 필요'
};
const PROCESS_LIST = ['purchase','sheet','cnc','lathe','injection','print3d','profile','unknown'];
const MATERIALS = ['AL6061','AL5052','AL7075','SUS304','SUS316','SUS430','SS400','S45C','SCM440','SKD11','SPCC','SPHC','SECC','SGCC','C3604','C1100','ABS','POM','PC','PP','PE','PA66','MC_NYLON','PLA','PETG','TPU','PEEK'];

const DEFAULT_RATES = {
  materials:{
    AL6061:{density:2.70,sheet:6900,cnc:7200,injection:0,print3d:8500,profile:7600},
    AL5052:{density:2.68,sheet:6500,cnc:6900,injection:0,print3d:8200,profile:7200},
    AL7075:{density:2.81,sheet:9800,cnc:10500,injection:0,print3d:0,profile:10800},
    SUS304:{density:7.93,sheet:6100,cnc:6500,injection:0,print3d:0,profile:6500},
    SUS316:{density:7.98,sheet:8400,cnc:9000,injection:0,print3d:0,profile:9000},
    SUS430:{density:7.70,sheet:4300,cnc:4700,injection:0,print3d:0,profile:4700},
    SS400:{density:7.85,sheet:1650,cnc:1800,injection:0,print3d:0,profile:1800},
    S45C:{density:7.85,sheet:0,cnc:2200,injection:0,print3d:0,profile:2200},
    SCM440:{density:7.85,sheet:0,cnc:3300,injection:0,print3d:0,profile:3300},
    SKD11:{density:7.70,sheet:0,cnc:9500,injection:0,print3d:0,profile:0},
    SPCC:{density:7.85,sheet:1600,cnc:1750,injection:0,print3d:0,profile:1750},
    SPHC:{density:7.85,sheet:1550,cnc:1700,injection:0,print3d:0,profile:1700},
    SECC:{density:7.85,sheet:1900,cnc:2050,injection:0,print3d:0,profile:2050},
    SGCC:{density:7.85,sheet:2000,cnc:2150,injection:0,print3d:0,profile:2150},
    C3604:{density:8.50,sheet:0,cnc:9800,injection:0,print3d:0,profile:9800},
    C1100:{density:8.96,sheet:11000,cnc:11500,injection:0,print3d:0,profile:11500},
    ABS:{density:1.04,sheet:0,cnc:4500,injection:3800,print3d:8500,profile:0},
    POM:{density:1.41,sheet:0,cnc:9200,injection:8500,print3d:12000,profile:0},
    PC:{density:1.20,sheet:0,cnc:6200,injection:5800,print3d:13000,profile:0},
    PP:{density:0.90,sheet:0,cnc:3200,injection:2700,print3d:0,profile:0},
    PE:{density:0.95,sheet:0,cnc:3500,injection:2900,print3d:0,profile:0},
    PA66:{density:1.14,sheet:0,cnc:6800,injection:6200,print3d:11000,profile:0},
    MC_NYLON:{density:1.16,sheet:0,cnc:7800,injection:0,print3d:0,profile:0},
    PLA:{density:1.24,sheet:0,cnc:0,injection:0,print3d:5500,profile:0},
    PETG:{density:1.27,sheet:0,cnc:0,injection:0,print3d:7200,profile:0},
    TPU:{density:1.20,sheet:0,cnc:0,injection:0,print3d:9500,profile:0},
    PEEK:{density:1.31,sheet:0,cnc:65000,injection:62000,print3d:90000,profile:0}
  },
  process:{
    sheetBendEach:3000,
    sheetHoleEach:500,
    sheetBaseEach:0,
    cncHourly:65000,
    cncSetup:0,
    cncHoleEach:1500,
    latheHourly:55000,
    latheSetup:0,
    injectionHourly:50000,
    injectionSetup:0,
    print3dHourly:18000,
    print3dSetup:0,
    profileProcessEach:3000
  },
  margins:{purchase:10,sheet:18,cnc:22,lathe:20,injection:20,print3d:28,profile:15,unknown:0}
};

const state = {
  rates: structuredClone(DEFAULT_RATES), fileName:'', parts:[], selectedId:null,
  occt:null, meshObjects:[], meshByNorm:new Map(), three:{}, focusClone:null,
  manualSeq:1, parseInfo:null, sort:{key:'',dir:1}
};

function norm(s){return String(s||'').toUpperCase().replace(/[\s_\-\.\/\\()]+/g,'').replace(/[^A-Z0-9가-힣]/g,'');}
function cleanName(s){return String(s||'').replace(/^'+|'+$/g,'').replace(/\s+/g,' ').trim();}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
function won(v){return nf.format(Math.round(num(v)))+'원';}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function isBadName(s){const n=norm(s); return !n || n==='DESIGN' || n==='NEXTASSEMBLYRELATIONSHIP' || /^PRODUCTDEFINITION/.test(n) || /^#?\d+$/.test(n);}
function isAssemblyName(s){return /(^|[_\-])(ASM|ASSY|ASSEMBLY)($|[_\-])|_ASM$|_ASSY$/i.test(String(s||''));}
function isRealPartName(s){
  const n=String(s||'').trim();
  if(!n || isBadName(n) || isAssemblyName(n)) return false;
  if(/^MESH[_-]?\d+$/i.test(n)) return false;
  if(/^PART[_-]?\d+$/i.test(n)) return false;
  return true;
}
function basename(n){return String(n||'').replace(/\.[^.]+$/,'');}
function numberTokens(s){return (String(s||'').match(/\d+/g)||[]).map(x=>String(Number(x))).filter(Boolean);}
function wordTokens(s){return String(s||'').toUpperCase().split(/[^A-Z0-9가-힣]+/).filter(Boolean);}

function baseTokens(s){
  return wordTokens(s).filter(t=>t.length>=2 && !/^(REV|ASM|ASSY|PART|BODY|TOTAL|DESIGN|MODEL|LEFT|RIGHT|TOP|BOTTOM)$/.test(t));
}
function learnedMap(){
  try{return JSON.parse(localStorage.getItem('factory_step_process_learn_v46')||'{}')||{};}catch{return {};}
}
function saveLearnedProcess(part){
  if(!part || !part.name || part.process==='unknown') return;
  const key=norm(part.name); if(!key) return;
  const map=learnedMap();
  map[key]={process:part.process, material:part.material, margin:part.margin, savedAt:Date.now()};
  try{localStorage.setItem('factory_step_process_learn_v46', JSON.stringify(map));}catch{}
}
function findLearnedProcess(name){
  const key=norm(name); if(!key) return null;
  const map=learnedMap();
  if(map[key]) return {...map[key], reason:'이전에 수정한 동일 파트명'};
  const toks=baseTokens(name);
  let best=null;
  for(const [k,v] of Object.entries(map)){
    let score=0;
    for(const t of toks){ if(k.includes(norm(t))) score++; }
    if(score>=2 && (!best || score>best.score)) best={...v,score,reason:'이전에 수정한 유사 파트명'};
  }
  return best;
}
const PROC_RULES={
  purchase:[/BOLT|SCREW|HEX\s*NUT|\bNUT\b|WASHER|RIVET|REVET|BEARING|SENSOR|MOTOR|VALVE|NIPPLE|PIPE|TUBE|PIE|FITTING|LEAD|CABLE|WIRE|HANDLE|KNOB|LEVER|CYLINDER|DAMPER|CHECKVALVE|O[-_]?RING|SPRING|HINGE|CASTER|COUPLER|COUPLING/i],
  profile:[/PROFILE|AL[_-]?FRAME|ALFRAME|EXTRUSION|2020|3030|4040|4080|4545|5050|6060|8080|프로파일/i],
  lathe:[/SHAFT|PIN|BUSH|BUSHING|ROLLER|COLLAR|ROD|SPINDLE|SLEEVE|축|핀|부싱|롤러/i],
  sheet:[/HOOD|COVER|PANEL|SHEET|SKEL|SKIN|BODY|SIDE|TOP|BOTTOM|BRACKET|PLATE|DOOR|CASE|DUCT|판|커버|후드|브라켓|판금/i],
  cnc:[/BASE|BLOCK|JIG|FIXTURE|MOUNT|HOLDER|SUPPORT|ADAPTER|GUIDE|CLAMP|BY2|가공|블록|지그|마운트|홀더/i],
  injection:[/ABS|POM|PC|PP|PE|PA66|NYLON|PLASTIC|RESIN|INJECTION|MOLD|MOULD|사출|수지/i],
  print3d:[/PRINT|FDM|SLA|SLS|MJF|3D|PLA|PETG|TPU|프린팅|출력/i]
};
function anyMatch(list,name){return list.some(r=>r.test(name));}
function processLabel(p){return PROCESS_LABELS[p]||p;}

function init(){
  loadDefaultRates(); initThree(); bindEvents(); renderRates(); renderParts(); updateStats();
}
async function loadDefaultRates(){
  try{
    const saved=localStorage.getItem('factory_step_rates_v46');
    if(saved) state.rates=mergeRates(structuredClone(DEFAULT_RATES), JSON.parse(saved));
    else {
      const res=await fetch('data/rates.json'); if(res.ok) state.rates=mergeRates(structuredClone(DEFAULT_RATES), await res.json());
    }
  }catch(e){ console.warn('rates load fallback',e); state.rates=structuredClone(DEFAULT_RATES); }
  renderRates(); recalcAll();
}
function mergeRates(base, src){
  if(!src) return base;
  base.materials={...base.materials, ...(src.materials||{})};
  base.process={...base.process, ...(src.process||{})};
  base.margins={...base.margins, ...(src.margins||{})};
  return base;
}
function bindEvents(){
  $('fileButton').onclick=()=>$('fileInput').click();
  $('fileInput').onchange=e=>{const f=e.target.files?.[0]; if(f) handleFile(f);};
  $('dropZone').ondragover=e=>{e.preventDefault(); $('dropZone').classList.add('drag');};
  $('dropZone').ondragleave=()=>$('dropZone').classList.remove('drag');
  $('dropZone').ondrop=e=>{e.preventDefault(); $('dropZone').classList.remove('drag'); const f=e.dataTransfer.files?.[0]; if(f) handleFile(f);};
  $('recalcBtn').onclick=()=>{recalcAll(); renderParts(); renderSelected();};
  $('csvBtn').onclick=downloadCSV;
  $('addPartBtn').onclick=addManualPart;
  $('fitButton').onclick=()=>fitCamera(true);
  document.querySelectorAll('.quick-grid button').forEach(b=>b.onclick=()=>{const p=selectedPart(); if(p){applyProcess(p,b.dataset.proc); renderAll(); showPart(p);}});
  $('saveRatesBtn').onclick=()=>{localStorage.setItem('factory_step_rates_v46', JSON.stringify(state.rates)); flash('ok','단가표를 브라우저에 저장했습니다.');};
  $('downloadRatesBtn').onclick=downloadRates;
  $('loadRatesBtn').onclick=()=>$('rateFileInput').click();
  $('rateFileInput').onchange=e=>{const f=e.target.files?.[0]; if(f) loadRatesFile(f);};
  $('copyRatesBtn').onclick=async()=>{const t=JSON.stringify(state.rates,null,2); $('ratesPaste').value=t; try{await navigator.clipboard.writeText(t);}catch{} flash('ok','단가표 JSON을 복사했습니다.');};
  $('pasteRatesBtn').onclick=()=>{try{state.rates=mergeRates(structuredClone(DEFAULT_RATES),JSON.parse($('ratesPaste').value)); renderRates(); recalcAll(); renderParts(); renderSelected(); flash('ok','붙여넣은 단가표를 적용했습니다.');}catch(e){flash('err','JSON 형식이 맞지 않습니다.');}};
  document.querySelectorAll('th[data-sort]').forEach(th=>{
    th.title='클릭하면 같은 조건끼리 묶어서 정렬합니다.';
    th.onclick=()=>sortPartsBy(th.dataset.sort);
  });
}

function flash(type,msg){const el=$('message'); el.className='message '+type; el.textContent=msg;}

async function handleFile(file){
  state.fileName=file.name; state.parts=[]; state.selectedId=null; state.parseInfo=null; resetScene(); renderParts(); updateStats();
  flash('info','STEP 파일 분석 중입니다...');
  try{
    const buffer=await file.arrayBuffer();
    const text=await file.text();
    const textInfo=parseStepText(text,file.name);
    let occt={ok:false,meshes:[],error:''};
    try{occt=await parseWithOcct(buffer); buildThreeMeshes(occt.meshes||[]);}catch(e){console.warn(e); occt={ok:false,meshes:[],error:String(e.message||e)};}
    state.parseInfo={textInfo, occt};
    // V41 parts-only mode.
    // 견적표는 STEP 텍스트에서 검증된 말단 PRODUCT만 사용한다.
    // OCCT/mesh tree에서 나온 assembly/container/mesh 조각명은 표에 넣지 않는다.
    let extracted = makeParts(textInfo).filter(p => isRealPartName(p.name));
    if(!extracted.length && occt.ok && occt.result?.root){
      extracted = makePartsFromOcct(occt.result, textInfo).filter(p => isRealPartName(p.name));
    }
    state.parts = extracted.map((p,i)=>initPart(p,i)).filter(p => p && isRealPartName(p.name));
    // mesh-only fallback 제거: MESH_41, 숫자 leaf, assembly container가 표에 섞이는 원인.
    state.parts.forEach((p,i)=>{ if(!p.meshIndices?.length && p.meshIndex==null) assignMeshToPart(p,i); });
    state.selectedId=state.parts[0]?.id||null;
    recalcAll(); renderAll();
    if(state.selectedId) showPart(selectedPart());
    flash('ok',`분석 완료: 파트 ${state.parts.length}종을 불러왔습니다.`);
  }catch(e){console.error(e); flash('err','파일 처리 오류: '+(e.message||e));}
}
async function parseWithOcct(buffer){
  if(!window.occtimportjs) throw new Error('STEP 파서 로딩 실패');
  const occt=state.occt || await window.occtimportjs({locateFile:p=>`vendor/occt/${p}`});
  state.occt=occt;
  const result=occt.ReadStepFile(new Uint8Array(buffer), null);
  if(!result?.meshes) throw new Error('3D 형상 데이터가 없습니다.');
  return {ok:true,meshes:result.meshes,result};
}

function parseStepText(text,fileName){
  const entityCount=(text.match(/#\d+\s*=/g)||[]).length;
  const records=[]; const re=/#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*?)\)\s*;/gi; let m;
  while((m=re.exec(text))) records.push({id:'#'+m[1], num:+m[1], type:m[2].toUpperCase(), args:splitArgs(m[3]), raw:m[0]});
  const products=new Map(), formations=new Map(), pdefs=new Map(), links=[];
  for(const r of records){ if(r.type==='PRODUCT') products.set(r.id, cleanName(firstString(r.args))||`PRODUCT_${r.num}`); }
  for(const r of records){
    if(r.type.startsWith('PRODUCT_DEFINITION_FORMATION')){
      const refs=allRefs(r.raw); const prodRef=refs.find(x=>products.has(x)); if(prodRef) formations.set(r.id, prodRef);
    }
  }
  for(const r of records){
    if(r.type==='PRODUCT_DEFINITION'){
      const refs=allRefs(r.raw);
      let prod='';
      for(const rr of refs){ if(formations.has(rr)){ prod=products.get(formations.get(rr)); break; } }
      if(!prod){ const rr=refs.find(x=>products.has(x)); if(rr) prod=products.get(rr); }
      if(!prod) prod=nearestPreviousProduct(records,r.num,products);
      pdefs.set(r.id,{id:r.id,num:r.num,name:cleanName(prod)||`#${r.num}`});
    }
  }
  for(const r of records){
    if(r.type==='NEXT_ASSEMBLY_USAGE_OCCURRENCE'){
      const refs=allRefs(r.raw).filter(x=>pdefs.has(x));
      if(refs.length>=2) links.push({id:r.id,parent:refs[0],child:refs[1]});
    }
  }
  const parentSet=new Set(links.map(x=>x.parent)); const childSet=new Set(links.map(x=>x.child));
  const rows=[];
  if(links.length){
    for(const l of links){
      if(parentSet.has(l.child)) continue;
      const pd=pdefs.get(l.child); if(!pd) continue;
      const name=pd.name; if(!isRealPartName(name)) continue;
      rows.push({name,qty:1,source:'STEP leaf',pdId:l.child});
    }
  }
  if(!rows.length){
    for(const [id,pd] of pdefs){ if(parentSet.has(id)) continue; if(!isRealPartName(pd.name)) continue; rows.push({name:pd.name,qty:1,source:'STEP fallback',pdId:id}); }
  }
  const grouped=groupByName(rows);
  return {entityCount, products:[...products.values()], productCount:products.size, pdefCount:pdefs.size, linkCount:links.length, parts:grouped, debug:{sampleProducts:[...products.values()].slice(0,40), sampleLinks:links.slice(0,20)}};
}
function splitArgs(s){const out=[];let cur='',q=false,d=0;for(let i=0;i<s.length;i++){const c=s[i]; if(c==="'"&&s[i-1]!=="\\")q=!q; if(!q){if(c==='(')d++; if(c===')')d--; if(c===','&&d===0){out.push(cur.trim());cur='';continue;}} cur+=c;} if(cur.trim())out.push(cur.trim());return out;}
function firstString(args){const a=args.find(x=>/^\s*'/.test(x));return a?cleanName(a.replace(/^\s*'/,'').replace(/'\s*$/,'')):'';}
function allRefs(s){return [...String(s||'').matchAll(/#\d+/g)].map(x=>x[0]);}
function nearestPreviousProduct(records,num,products){let best=''; for(const r of records){if(r.num<num && products.has(r.id)) best=products.get(r.id); if(r.num>=num) break;} return best;}
function groupByName(rows){const map=new Map(); for(const r of rows){const key=dedupeKey(r.name); if(!key) continue; if(!map.has(key)) map.set(key,{...r,qty:0}); map.get(key).qty+=Math.max(1,num(r.qty,1));} return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));}
function dedupeKey(name){const n=norm(name); if(!n || isBadName(name) || isAssemblyName(name) || /^MESH\d+$/.test(n)) return ''; return n;}

function buildThreeMeshes(meshes){
  resetScene(); const root=state.three.root; if(!root||!window.THREE) return;
  meshes.forEach((m,idx)=>{
    try{
      const pos=m.attributes?.position?.array, ind=m.index?.array; if(!pos||!ind) return;
      const g=new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
      if(m.attributes.normal) g.setAttribute('normal', new THREE.Float32BufferAttribute(m.attributes.normal.array,3));
      g.setIndex(new THREE.BufferAttribute(Uint32Array.from(ind),1));
      g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
      const material=new THREE.MeshPhongMaterial({color:palette(idx),shininess:26,side:THREE.DoubleSide});
      const mesh=new THREE.Mesh(g,material); mesh.name=m.name||`MESH_${idx+1}`;
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(g,25),new THREE.LineBasicMaterial({color:0x06111f,transparent:true,opacity:.50}));
      const group=new THREE.Group(); group.name=mesh.name; group.visible=false; group.add(mesh); group.add(edges); root.add(group);
      const metrics=computeMetrics(m,g);
      const o={group,mesh,raw:m,name:mesh.name,norm:norm(mesh.name),metrics,index:idx};
      state.meshObjects.push(o); if(o.norm) state.meshByNorm.set(o.norm,o);
    }catch(e){console.warn('mesh build fail',e);}
  });
}
function palette(i){return [0x9be7ff,0xfff176,0x93c5fd,0x86efac,0xfda4af,0xc4b5fd,0xfcd34d,0xa7f3d0][i%8];}
function resetScene(){
  if(state.three.root){ state.three.root.clear(); }
  state.meshObjects=[]; state.meshByNorm=new Map(); state.focusClone=null;
}
function initThree(){
  const el=$('viewer'); if(!window.THREE || !el) return;
  const scene=new THREE.Scene(); scene.background=new THREE.Color(0x111827);
  const camera=new THREE.PerspectiveCamera(38,1,.01,1000000); camera.position.set(250,220,180);
  const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio||1,2)); el.innerHTML=''; el.appendChild(renderer.domElement);
  const root=new THREE.Group(); scene.add(root);
  scene.add(new THREE.AmbientLight(0xffffff,.82));
  const d1=new THREE.DirectionalLight(0xffffff,.75); d1.position.set(3,4,5); scene.add(d1);
  const d2=new THREE.DirectionalLight(0xffffff,.32); d2.position.set(-4,2,-3); scene.add(d2);
  let controls=null; if(THREE.OrbitControls){controls=new THREE.OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.08;}
  state.three={scene,camera,renderer,controls,root};
  const resize=()=>{const r=el.getBoundingClientRect(); renderer.setSize(Math.max(100,r.width),Math.max(100,r.height),false); camera.aspect=Math.max(1,r.width)/Math.max(1,r.height); camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(el); resize();
  (function loop(){requestAnimationFrame(loop); if(controls)controls.update(); renderer.render(scene,camera);})();
}
function meshesForPart(part){
  if(!part) return [];
  const out=[];
  if(Array.isArray(part.meshIndices) && part.meshIndices.length){
    for(const i of part.meshIndices){ if(state.meshObjects[i]) out.push(state.meshObjects[i]); }
  }
  if(out.length) return [...new Map(out.map(o=>[o.index,o])).values()];
  const one=meshForPart(part);
  return one ? [one] : [];
}
function meshForPart(part){
  if(!part) return null;
  if(part.meshIndex!=null && state.meshObjects[part.meshIndex]) return state.meshObjects[part.meshIndex];
  const n=norm(part.name); if(!n) return null;
  let c=state.meshObjects.find(o=>o.norm===n || (!isNumberish(o.name) && (o.norm.includes(n) || n.includes(o.norm)))); if(c) return c;
  const toks=baseTokens(part.name).filter(t=>t.length>=3);
  if(toks.length){
    let best=null,score=0;
    for(const o of state.meshObjects){
      if(isNumberish(o.name)) continue;
      const s=toks.reduce((a,t)=>a+(o.norm.includes(norm(t))?1:0),0);
      if(s>score){score=s; best=o;}
    }
    if(best && score>=2) return best;
  }
  const nums=numberTokens(part.name); if(nums.length){c=state.meshObjects.find(o=>numberTokens(o.name).some(x=>nums.includes(x))); if(c) return c;}
  return null;
}
function showPart(part){
  clearFocus(); state.meshObjects.forEach(o=>o.group.visible=false);
  if(!part || !state.three.root) return;
  const srcs=meshesForPart(part);
  if(!srcs.length){renderViewerMessage('이 파트의 3D 형상 연결을 확인해야 합니다.'); return;}
  $('viewer').querySelector('.viewer-empty')?.remove();
  const wrapper=new THREE.Group();
  wrapper.name='FOCUS_'+part.name;
  srcs.forEach(src=>{
    const clone=src.group.clone(true); clone.visible=true;
    clone.traverse(o=>{
      o.visible=true;
      if(o.isMesh){o.material=new THREE.MeshPhongMaterial({color:0x9be7ff,shininess:34,side:THREE.DoubleSide});}
      if(o.isLineSegments){o.material=new THREE.LineBasicMaterial({color:0x020617,transparent:true,opacity:.66});}
    });
    wrapper.add(clone);
  });
  normalizeFocusGroup(wrapper);
  state.focusClone=wrapper; state.three.root.add(wrapper);
  fitCamera(true);
}
function renderViewerMessage(msg){
  const el=$('viewer'); if(!el.querySelector('.viewer-empty')){const d=document.createElement('div'); d.className='viewer-empty'; el.appendChild(d);} el.querySelector('.viewer-empty').textContent=msg;
}
function clearFocus(){const root=state.three.root; if(state.focusClone&&root){root.remove(state.focusClone); state.focusClone.traverse(o=>{if(o.geometry?.dispose)o.geometry.dispose(); if(o.material?.dispose)o.material.dispose();});} state.focusClone=null;}
function normalizeFocusGroup(group){
  group.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromObject(group);
  if(!Number.isFinite(box.min.x)) return;
  const size=new THREE.Vector3(); const center=new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  const maxDim=Math.max(size.x,size.y,size.z,1);
  // Display every selected part at a consistent service-screen size.
  const targetSize=560;
  const scale=targetSize/maxDim;
  group.scale.setScalar(scale);
  group.position.set(-center.x*scale,-center.y*scale,-center.z*scale);
  group.updateMatrixWorld(true);
}
function isVisibleThroughParents(obj){
  let p=obj;
  while(p){ if(p.visible===false) return false; p=p.parent; }
  return true;
}
function visibleBox(){
  const box=new THREE.Box3(); let has=false;
  const target = state.focusClone || state.three.root;
  if(!target) return {box,has};
  target.updateWorldMatrix(true,true);
  target.traverse(o=>{
    if(!o.isMesh || !o.geometry) return;
    if(!isVisibleThroughParents(o)) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(Number.isFinite(b.min.x)){box.union(b);has=true;}
  });
  return {box,has};
}
function fitCamera(){
  const {camera,controls}=state.three; if(!camera) return;
  const {box,has}=visibleBox(); if(!has)return;
  const size=new THREE.Vector3(); const center=new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  const maxDim=Math.max(size.x,size.y,size.z,1);
  const fov=(camera.fov||38)*Math.PI/180;
  const dist=(maxDim/(2*Math.tan(fov/2)))*1.12;
  // Always frame the selected part, not the assembly. Use its real mapped mesh bounding box.
  camera.position.set(center.x+dist*.85, center.y+dist*.58, center.z+dist*.92);
  camera.near=Math.max(.001, dist/10000); camera.far=Math.max(100000, dist*30); camera.updateProjectionMatrix();
  if(controls){controls.target.copy(center); controls.update();}
}

function makeParts(textInfo){
  return (textInfo.parts||[]).map(p=>({name:p.name,qty:p.qty,source:p.source,pdId:p.pdId})).filter(p=>isRealPartName(p.name));
}

// OCCT root tree based part extraction. This is the preferred path for viewer accuracy.
function makePartsFromOcct(result, textInfo){
  const leaves = collectOcctLeafNodes(result?.root).filter(x=>Array.isArray(x.meshIndices) && x.meshIndices.length);
  if(!leaves.length) return [];
  const textParts = textInfo?.parts || [];
  const map = new Map();
  leaves.forEach((leaf, idx)=>{
    let name = bestLeafName(leaf.path, idx, textParts);
    if(!isRealPartName(name)) name = textParts[idx]?.name || '';
    if(!isRealPartName(name)) return;
    const key = dedupeKey(name);
    if(!key) return;
    if(!map.has(key)) map.set(key,{name, qty:0, source:'OCCT leaf', meshIndices:[], paths:[]});
    const row = map.get(key);
    row.qty += 1;
    row.meshIndices.push(...leaf.meshIndices);
    row.paths.push(leaf.path.join(' > '));
  });
  return [...map.values()].map(p=>({
    ...p,
    meshIndices:[...new Set(p.meshIndices)].filter(i=>state.meshObjects[i]),
    meshName:p.meshIndices?.length ? (state.meshObjects[p.meshIndices[0]]?.name || '') : ''
  })).sort((a,b)=>a.name.localeCompare(b.name));
}
function collectOcctLeafNodes(root){
  const out=[];
  function walk(node,path=[]){
    if(!node) return;
    const name = cleanName(node.name || node.Name || 'UNNAMED');
    const nextPath = [...path, name];
    const children = Array.isArray(node.children) ? node.children : [];
    const meshes = Array.isArray(node.meshes) ? node.meshes : [];
    if(children.length===0 && meshes.length>0){
      out.push({name, path:nextPath, meshIndices:meshes.map(Number).filter(Number.isFinite)});
      return;
    }
    // children이 있는 node는 assembly/container로 보고 표 대상에서 제외한다.
    // mesh가 붙어 있어도 leaf가 아니면 여기서는 part row로 만들지 않는다.
    children.forEach(c=>walk(c,nextPath));
  }
  walk(root,[]);
  return out;
}
function bestLeafName(path, idx, textParts){
  const candidates = [...(path||[])].reverse().map(cleanName).filter(n=>isRealPartName(n) && !/NEXT ASSEMBLY RELATIONSHIP/i.test(n));
  if(candidates.length) return candidates[0];
  return textParts?.[idx]?.name || '';
}
function assignMeshToPart(part, orderIndex){
  const pNorm=norm(part.name); let best=null, bestScore=-1;
  const consider=(o,score)=>{ if(o && score>bestScore){best=o; bestScore=score;} };
  if(pNorm){
    for(const o of state.meshObjects){
      if(o.norm===pNorm) consider(o,1000);
      else if(!isNumberish(o.name) && (o.norm.includes(pNorm)||pNorm.includes(o.norm))) consider(o,760);
    }
  }
  const nums=numberTokens(part.name);
  if(nums.length){
    for(const o of state.meshObjects){
      const on=numberTokens(o.name);
      const hits=on.filter(x=>nums.includes(x)).length;
      if(hits) consider(o,420+hits*40);
    }
  }
  const toks=baseTokens(part.name).filter(t=>t.length>=3);
  if(toks.length){
    for(const o of state.meshObjects){
      if(isNumberish(o.name)) continue;
      const score=toks.reduce((s,t)=>s+(o.norm.includes(norm(t))?95:0),0);
      if(score>0) consider(o,score);
    }
  }
  // 마지막 수단: 순서 매칭. 형상은 보여주되 추천/견적은 이름 기준을 우선한다.
  if(!best && state.meshObjects[orderIndex]) consider(state.meshObjects[orderIndex],80);
  if(best){part.meshIndex=best.index; part.meshIndices=[best.index]; part.meshName=best.name; part.metrics=best.metrics; part.meshMatchScore=bestScore;}
}
function isNumberish(name){return /^#?\d+$/.test(String(name||'').trim()) || /^MESH[_-]?\d+$/i.test(String(name||'').trim());}
function initPart(p,i){
  const meshIndices=Array.isArray(p.meshIndices)?p.meshIndices.filter(x=>state.meshObjects[x]):[];
  const firstMesh=meshIndices.length?state.meshObjects[meshIndices[0]]:null;
  const part={
    id:'p'+Date.now()+'_'+i, name:p.name, qty:num(p.qty,1), source:p.source||'',
    meshIndices, meshIndex:p.meshIndex, meshName:p.meshName||firstMesh?.name||'',
    metrics:p.metrics||firstMesh?.metrics||null, process:'unknown', material:'AL6061',
    inputValue:0, margin:0, purchaseUnit:1000, manualWeight:null, quote:0, score:null
  };
  if(!part.meshIndices.length && part.meshIndex==null) assignMeshToPart(part,i);
  if(part.meshIndices.length && part.meshIndex==null) part.meshIndex=part.meshIndices[0];
  const rec=recommendProcess(part); applyRecommendation(part,rec);
  return part;
}
function applyRecommendation(part,rec){
  part.score=rec; part.process=rec.process; part.material=defaultMaterial(part,rec.process); part.margin=num(state.rates.margins[part.process],0);
  if(part.process==='purchase') part.purchaseUnit=defaultPurchasePrice(part);
  part.inputValue=defaultInput(part);
}
function defaultMaterial(part,proc){
  const u=part.name.toUpperCase();
  if(/SUS|STS|304/.test(u)) return 'SUS304';
  if(/316/.test(u)) return 'SUS316';
  if(/SPCC|SPHC|SECC|SGCC/.test(u)) return u.match(/SPCC|SPHC|SECC|SGCC/)?.[0]||'SPCC';
  if(/SS400|STEEL|철/.test(u)) return 'SS400';
  if(/S45C/.test(u)) return 'S45C';
  if(/ABS|POM|PC|PP|PA66|NYLON|PLA|PETG|TPU|PEEK/.test(u)) return u.match(/ABS|POM|PC|PP|PA66|MC_NYLON|NYLON|PLA|PETG|TPU|PEEK/)?.[0].replace('NYLON','PA66')||'ABS';
  if(proc==='sheet') return 'SUS304';
  if(proc==='purchase') return /NUT|BOLT|SCREW|RIVET|REVET/.test(u)?'SS400':'SUS304';
  return 'AL6061';
}
function defaultInput(part){
  if(part.process==='purchase') return part.purchaseUnit;
  if(part.process==='sheet') return 0;
  if(part.process==='profile') return num(state.rates.process.profileProcessEach,3000);
  if(['cnc','lathe','injection','print3d'].includes(part.process)) return 0;
  return 0;
}
function defaultPurchasePrice(part){
  const u=part.name.toUpperCase();
  if(/BOLT|SCREW/.test(u)) return 120;
  if(/NUT/.test(u)) return 50;
  if(/RIVET|REVET/.test(u)) return 80;
  if(/NIPPLE|VALVE|FITTING|PIPE|TUBE|PIE/.test(u)) return 2500;
  if(/MOTOR|SENSOR|CYLINDER/.test(u)) return 25000;
  if(/LEAD|CABLE|WIRE/.test(u)) return 18000;
  return 1000;
}


function recommendProcess(part){
  const name=String(part.name||'').toUpperCase();
  const m=part.metrics||{};
  const scores={purchase:0,sheet:0,cnc:0,lathe:0,injection:0,print3d:0,profile:0,unknown:0};
  const ret=(process, confidence, score, reasonList, extraScores={})=>{
    const outScores={...scores,...extraScores};
    outScores[process]=Math.max(outScores[process]||0, score);
    return {process, confidence, score, scores:outScores, reasons:reasonList.filter(Boolean).slice(0,8)};
  };

  // 수동 학습값은 최우선. 공장장이 고친 값은 다음 업로드에서도 그대로 우선 적용한다.
  const learned=findLearnedProcess(name);
  if(learned?.process){
    return ret(learned.process,'높음',999,[learned.reason]);
  }

  const isPipeOrTube = /PIPE|TUBE|PIE|NIPPLE|FITTING|배관|파이프|튜브/i.test(name);
  const isStdPurchase = /BOLT|SCREW|HEX\s*NUT|\bNUT\b|WASHER|RIVET|REVET|BEARING|SENSOR|MOTOR|VALVE|LEAD|CABLE|WIRE|HANDLE|KNOB|LEVER|CYLINDER|DAMPER|O[-_]?RING|SPRING|HINGE|CASTER|COUPLER|COUPLING|CLAMP\s*LEVER|BRACKET[-_]?BUY|ASSY[-_]?PART/i.test(name);
  const isProfileName = /PROFILE|AL[_-]?FRAME|ALFRAME|EXTRUSION|2020|3030|4040|4080|4545|5050|6060|8080|프로파일/i.test(name);
  const isLatheName = /SHAFT|PIN|BUSH|BUSHING|ROLLER|COLLAR|ROD|SPINDLE|SLEEVE|축|핀|부싱|롤러/i.test(name);

  const isStrongSheetName = /HOOD|TOP[_-]?COVER|COVER|PANEL|SHEET|SKEL|SKIN|DUCT|SIDE|TOP|BOTTOM|DOOR|판금|커버|후드|판넬|패널/i.test(name);
  const isWeakSheetName = /BODY|BRACKET|PLATE|CASE/i.test(name);
  const isCncName = /BASE|BLOCK|JIG|FIXTURE|MOUNT|HOLDER|SUPPORT|ADAPTER|GUIDE|CLAMP|BY2|MACHINING|가공|블록|지그|마운트|홀더|서포트/i.test(name);
  const isInjectionName = /INJECTION|MOLD|MOULD|MOLDING|MOULDING|사출|금형/i.test(name);
  const isPrintName = /PRINT|FDM|SLA|SLS|MJF|3D|프린팅|출력/i.test(name);
  const plasticName = /\bABS\b|\bPOM\b|\bPC\b|\bPP\b|\bPE\b|PA66|NYLON|PLASTIC|RESIN|PLA|PETG|TPU|PEEK|수지/i.test(name);
  const metalName = /AL|A\d{4}|SUS|STS|SS400|S45C|SCM|SKD|STEEL|SPCC|SPHC|SECC|SGCC|C3604|C1100|철|스틸|스텐|알루미늄/i.test(name);
  const hasT = /(^|[^0-9])((?:0\.3|0\.5|0\.8|1|1\.0|1\.2|1\.5|2|2\.0|2\.3|3|3\.0|4|5|6|8|9|10|12|15|16|20)T)([^0-9]|$)/i.test(name);
  const hasThickT = /(^|[^0-9])(12T|15T|16T|20T|25T|30T|40T)([^0-9]|$)/i.test(name);

  // 사출 피처: 리브/보스/스냅/클립/훅/살대가 있으면 사출 우선.
  const hasRibName = /RIB|RIBS|RIBBED|WEB|GUSSET|BOSS|SNAP|CLIP|HOOK|STIFFENER|POST|STANDOFF|LOCATOR|LATCH|TAB|보강|리브|보스|스냅|클립|훅|살대|기둥/i.test(name);

  const minDim = num(m.minDim,0), midDim=num(m.midDim,0), maxDim=num(m.maxDim,0);
  const thinRatio = minDim>0 ? maxDim/minDim : 0;
  const widthRatio = minDim>0 ? midDim/minDim : 0;
  const surfaceDensity = num(m.surfaceDensity,0);
  const orientCount = num(m.orientationCount,0);
  const solidness = num(m.solidness,0);
  const estT = num(m.estimatedThickness,0);
  const complexity = num(m.complexityScore,0) || Math.round(surfaceDensity*22 + orientCount*4 + solidness*30);

  // 핵심 신규 기준.
  // 1~20mm 동일 두께 + 단순 형상 = 판금/절곡.
  // 10mm 이내 + 복잡 형상 = 리브/보스 있으면 사출, 없으면 CNC.
  const thicknessRef = estT>0 ? estT : minDim;
  const uniformThickness1to20 = ((estT>=1 && estT<=20) || (minDim>=1 && minDim<=20) || hasT) && !m.cylinderLike;
  const thicknessUnder10 = ((estT>0 && estT<=10) || (minDim>0 && minDim<=10) || /(^|[^0-9])((?:0\.3|0\.5|0\.8|1|1\.0|1\.2|1\.5|2|2\.0|2\.3|3|3\.0|4|5|6|8|9|10)T)([^0-9]|$)/i.test(name)) && !m.cylinderLike;
  const wideFlatRatio = thinRatio>=5.0 && widthRatio>=1.6;
  const panelRatio = thinRatio>=4.0 && widthRatio>=1.35;
  const sheetShape = wideFlatRatio || panelRatio || m.uniformSheet || m.sheetByThickness || m.lowSolidSheet || isStrongSheetName || (isWeakSheetName && (metalName || hasT));

  // 단순 판금은 방향 수/표면밀도/솔리드 복잡도가 낮은 판 구조.
  const simpleShape = !hasRibName && !m.ribLike && (surfaceDensity===0 || surfaceDensity<=2.65) && (orientCount===0 || orientCount<=9) && (solidness===0 || solidness<0.38);
  const complexShape = hasRibName || m.ribLike || surfaceDensity>=2.75 || orientCount>=10 || complexity>=92 || (solidness>=0.35 && !wideFlatRatio);
  const foldedSimpleSheet = uniformThickness1to20 && sheetShape && simpleShape && (solidness<0.30 || wideFlatRatio || isStrongSheetName || hasT);

  const compactSolid = !m.cylinderLike && !foldedSimpleSheet && (solidness>.20 || (minDim>8 && midDim/minDim<5.0));
  const geometricSolid = compactSolid || (!m.cylinderLike && !foldedSimpleSheet && maxDim>0);

  // 1) 구매품 우선. 파이프/튜브/니플은 가공품이 아니라 구매단가 입력 대상으로 본다.
  if(isPipeOrTube){
    return ret('purchase','높음',990,['파이프/튜브/니플 계열: 구매품 우선'],{purchase:990});
  }
  if(isStdPurchase){
    return ret('purchase','높음',970,['표준품/상용품 이름: 구매품 우선'],{purchase:970});
  }

  // 2) 프로파일/압출. PIPE/TUBE/NIPPLE은 이미 구매품으로 제외됨.
  if(isProfileName){
    return ret('profile','높음',930,['프로파일/압출 규격명'],{profile:930});
  }

  // 3) 선반. 이름이 명확하거나 실제 형상이 길쭉한 원통이면 선반.
  if(isLatheName){
    return ret('lathe', (m.cylinderLike || !m.dims)?'높음':'보통', (m.cylinderLike || !m.dims)?890:750, ['축/핀/부싱/롤러 계열'],{lathe:(m.cylinderLike || !m.dims)?890:750});
  }
  if(!isStrongSheetName && !isWeakSheetName && !isCncName && m.cylinderLike && m.slenderness>2.1){
    return ret('lathe','보통',750,['길쭉한 원통형 형상'],{lathe:750});
  }

  // 4) 리브/보스/스냅/클립이 있으면 사출. 사출도 동일두께이므로 판금보다 먼저 본다.
  if(hasRibName || m.ribLike || isInjectionName){
    const reasons=[];
    if(hasRibName) reasons.push('리브/보스/스냅/클립 피처');
    if(m.ribLike) reasons.push('얇은 벽 + 복잡 보강 구조');
    if(isInjectionName) reasons.push('사출/금형 힌트');
    if(thicknessRef) reasons.push(`두께 ${fmt1(thicknessRef)}mm`);
    if(surfaceDensity) reasons.push(`복잡도 ${fmt1(complexity)}`);
    return ret('injection','높음',940,reasons,{injection:940,cnc:520});
  }

  // 5) 10mm 이내 + 복잡 형상: 사출 또는 CNC.
  // 리브/보스가 없고 일반 기하학이면 CNC로 보낸다.
  if(thicknessUnder10 && complexShape){
    if(plasticName || isInjectionName){
      return ret('injection','보통',840,['10mm 이내 얇은 벽 + 복잡 형상 + 수지 힌트', `두께 ${fmt1(thicknessRef)}mm`, `복잡도 ${fmt1(complexity)}`],{injection:840,cnc:620});
    }
    return ret('cnc','보통',810,['10mm 이내 복잡 형상: 리브 없으므로 CNC/MCT', `두께 ${fmt1(thicknessRef)}mm`, `복잡도 ${fmt1(complexity)}`],{cnc:810,injection:480});
  }

  // 6) 판금/절곡: 한 파트 안에서 1~20mm 동일 두께가 유지되고, 형상이 단순한 판/접힌 판 구조일 때.
  if(foldedSimpleSheet){
    const reasons=[];
    reasons.push(`동일두께 ${fmt1(thicknessRef)}mm 범위`);
    if(wideFlatRatio || panelRatio) reasons.push('얇고 넓은 판 구조');
    if(m.lowSolidSheet) reasons.push('종이접기형 접힌 판 구조');
    if(isStrongSheetName || isWeakSheetName) reasons.push('판재 계열 파트명');
    if(simpleShape) reasons.push('단순 형상');
    return ret('sheet',(hasT||metalName||isStrongSheetName)?'높음':'보통',(hasT||metalName||isStrongSheetName)?910:820,reasons,{sheet:(hasT||metalName||isStrongSheetName)?910:820});
  }

  // 7) 3D프린팅은 명확한 출력 힌트가 있을 때만.
  if(isPrintName){
    return ret('print3d','높음',850,['3D프린팅/출력 공정 힌트'],{print3d:850});
  }

  // 8) 두꺼운 T, 블록/베이스/지그/마운트/일반 기하학 솔리드는 CNC/MCT.
  if(isCncName || hasThickT){
    return ret('cnc', hasThickT?'높음':'보통', hasThickT?870:800, [hasThickT?'두꺼운 T 표기':'절삭 가공품 이름'], {cnc:hasThickT?870:800});
  }
  if(geometricSolid){
    return ret('cnc','보통',770,['리브 없는 일반 기하학적 형상: CNC/MCT'],{cnc:770, injection:plasticName?480:0});
  }

  if(plasticName){
    return ret('unknown','낮음',0,['수지명은 있으나 리브/복잡 형상 확인 필요'],{unknown:0,injection:420,cnc:400});
  }

  return ret('unknown','낮음',0,['공법 선택 필요'],{unknown:0});
}
function computeMetrics(raw,geom){
  const pos=raw.attributes?.position?.array||[], idx=raw.index?.array||[];
  const m={
    dims:[0,0,0],minDim:0,midDim:0,maxDim:0,bboxVolume:0,bboxArea:0,
    volume:0,area:0,solidness:0,surfaceDensity:0,slenderness:0,
    cylinderLike:false,sheetLike:false,uniformSheet:false,estimatedThickness:0,
    sheetByThickness:false,lowSolidSheet:false,ribLike:false,orientationCount:0,triCount:0,complexityScore:0
  };
  try{
    let min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<pos.length;i+=3){for(let k=0;k<3;k++){const v=pos[i+k]; if(v<min[k])min[k]=v; if(v>max[k])max[k]=v;}}
    const d=[max[0]-min[0],max[1]-min[1],max[2]-min[2]].map(v=>Math.max(0,v));
    const s=[...d].sort((a,b)=>a-b);
    const bboxArea=2*(d[0]*d[1]+d[1]*d[2]+d[0]*d[2]);
    Object.assign(m,{dims:d,minDim:s[0]||0,midDim:s[1]||0,maxDim:s[2]||0,bboxVolume:d[0]*d[1]*d[2],bboxArea});
    let area=0,vol=0; const tris=Math.floor(idx.length/3); m.triCount=tris;
    const step=Math.max(1,Math.floor(tris/30000));
    const orientBins=new Set();
    for(let t=0;t<tris;t+=step){
      const ia=idx[t*3]*3, ib=idx[t*3+1]*3, ic=idx[t*3+2]*3;
      const A=[pos[ia],pos[ia+1],pos[ia+2]], B=[pos[ib],pos[ib+1],pos[ib+2]], C=[pos[ic],pos[ic+1],pos[ic+2]];
      if(!A.every(Number.isFinite)||!B.every(Number.isFinite)||!C.every(Number.isFinite)) continue;
      const AB=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], AC=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
      const N=[AB[1]*AC[2]-AB[2]*AC[1],AB[2]*AC[0]-AB[0]*AC[2],AB[0]*AC[1]-AB[1]*AC[0]];
      const len=Math.hypot(...N); if(!len)continue;
      area+=len/2*step;
      vol+=(A[0]*(B[1]*C[2]-B[2]*C[1])-A[1]*(B[0]*C[2]-B[2]*C[0])+A[2]*(B[0]*C[1]-B[1]*C[0]))/6*step;
      const n=[N[0]/len,N[1]/len,N[2]/len];
      // 곡면/보스/리브가 많으면 방향 버킷 수가 증가한다. 직교 판금은 보통 낮다.
      const q=n.map(v=>Math.round(v*4)/4).join(',');
      orientBins.add(q);
    }
    m.area=area;
    m.volume=Math.abs(vol);
    m.solidness=m.bboxVolume?Math.min(1,m.volume/m.bboxVolume):0;
    m.surfaceDensity=m.bboxArea?Math.max(0,area/m.bboxArea):0;
    m.orientationCount=orientBins.size;
    m.slenderness=m.midDim?m.maxDim/m.midDim:0;
    m.estimatedThickness=(m.volume>0 && m.area>0)?(2*m.volume/m.area):(m.minDim||0);
    m.cylinderLike=m.minDim>0 && m.midDim>0 && (m.midDim/m.minDim<1.45) && (m.maxDim/m.midDim>2.0);
    m.uniformSheet=m.minDim>0 && m.minDim<=12 && m.maxDim/m.minDim>=4.5 && m.midDim/m.minDim>=1.7 && !m.cylinderLike;
    m.sheetByThickness=m.estimatedThickness>0 && m.estimatedThickness<=8 && m.maxDim/m.estimatedThickness>=7 && m.midDim/m.estimatedThickness>=2.2 && !m.cylinderLike;
    m.lowSolidSheet=m.solidness>0 && m.solidness<0.18 && m.maxDim>25 && m.midDim>12 && !m.cylinderLike;
    m.sheetLike=m.uniformSheet || m.sheetByThickness || m.lowSolidSheet || (m.minDim>0 && m.minDim<=12 && m.maxDim/m.minDim>7 && m.midDim/m.minDim>2.1 && !m.cylinderLike);
    // 리브형 사출 후보: 얇은 벽·보스·스냅이 붙은 케이스/커버류에서 나타나는 고표면적·저체적 구조.
    m.ribLike=!m.cylinderLike && m.maxDim>18 && m.midDim>10 &&
      m.surfaceDensity>=2.8 && m.estimatedThickness>0 && m.estimatedThickness<=10 &&
      m.solidness>0.025 && m.solidness<0.52 &&
      (m.orientationCount>=7 || m.minDim>8 || !m.uniformSheet) &&
      !(m.minDim>0 && m.minDim<=5 && m.maxDim/m.minDim>10 && m.midDim/m.minDim>3.0);
    m.complexityScore=Math.round((m.surfaceDensity||0)*22 + (m.orientationCount||0)*4 + (m.solidness||0)*30 + (m.ribLike?35:0));
  }catch(e){console.warn('metrics fail',e);} return m;
}
function fmt1(v){return Number.isFinite(Number(v))?Number(v).toFixed(1):'0.0';}

function selectedPart(){return state.parts.find(p=>p.id===state.selectedId)||null;}
function materialRate(material,process){
  const m=state.rates.materials[material]||state.rates.materials.AL6061; if(process==='sheet')return num(m.sheet); if(process==='injection')return num(m.injection||m.cnc); if(process==='print3d')return num(m.print3d||m.cnc); if(process==='profile')return num(m.profile||m.cnc); return num(m.cnc||m.sheet);
}
function densityOf(material){return num((state.rates.materials[material]||{}).density,2.7);}
function volumeCm3(part){const v=part.metrics?.volume; if(v && Number.isFinite(v)) return Math.abs(v)/1000; const d=part.metrics?.dims||[0,0,0]; return (d[0]*d[1]*d[2])/1000 * .18 || 1;}
function kgEach(part){if(part.manualWeight!=null) return num(part.manualWeight); return volumeCm3(part)*densityOf(part.material)/1000;}
function recalcPart(p){
  const q=Math.max(0,num(p.qty,1)); const margin=num(p.margin,state.rates.margins[p.process]||0)/100; let base=0; let note='';
  const kg=kgEach(p); const mat=kg*q*materialRate(p.material,p.process);
  if(p.process==='purchase') {base=num(p.purchaseUnit||p.inputValue,0)*q; note=`구매단가 ${num(p.purchaseUnit||p.inputValue,0)}`;}
  else if(p.process==='sheet') {const bends=num(p.inputValue,0); base=mat + q*num(state.rates.process.sheetBaseEach,0) + q*bends*num(state.rates.process.sheetBendEach,0); note=`재료 ${Math.round(mat)} + 절곡 ${bends}`;}
  else if(p.process==='cnc') {const h=num(p.inputValue,0); base=mat + q*h*num(state.rates.process.cncHourly,0) + q*num(state.rates.process.cncSetup,0); note=`재료 ${Math.round(mat)} + 시간 ${h}`;}
  else if(p.process==='lathe') {const h=num(p.inputValue,0); base=mat + q*h*num(state.rates.process.latheHourly,0) + q*num(state.rates.process.latheSetup,0); note=`재료 ${Math.round(mat)} + 시간 ${h}`;}
  else if(p.process==='injection') {const h=num(p.inputValue,0); base=mat + q*h*num(state.rates.process.injectionHourly,0) + q*num(state.rates.process.injectionSetup,0); note=`재료 ${Math.round(mat)} + 시간 ${h}`;}
  else if(p.process==='print3d') {const h=num(p.inputValue,0); base=mat + q*h*num(state.rates.process.print3dHourly,0) + q*num(state.rates.process.print3dSetup,0); note=`재료 ${Math.round(mat)} + 시간 ${h}`;}
  else if(p.process==='profile') {base=mat + q*num(p.inputValue||state.rates.process.profileProcessEach,0); note=`재료 ${Math.round(mat)} + 가공비`;}
  else {base=0; note='공법 선택 필요';}
  p.calcNote=note; p.quote=Math.round(base*(1+margin)); return p.quote;
}
function recalcAll(){state.parts.forEach(recalcPart); updateStats();}
function totalQuote(){return state.parts.reduce((s,p)=>s+num(p.quote),0);}
function applyProcess(part,proc){part.process=proc; part.margin=num(state.rates.margins[proc],0); if(proc==='purchase'){part.purchaseUnit=part.purchaseUnit||defaultPurchasePrice(part); part.inputValue=part.purchaseUnit;} else {part.inputValue=defaultInput(part);} recalcPart(part); saveLearnedProcess(part);}

function sortPartsBy(key){
  if(!key) return;
  if(state.sort.key===key) state.sort.dir*=-1;
  else state.sort={key,dir:1};
  renderParts();
  const labels={name:'파트명',qty:'수량',recommend:'추천 공법',process:'공법',material:'재질',input:'입력값',margin:'마진',quote:'견적가'};
  flash('info',`${labels[key]||key} 기준으로 같은 조건끼리 묶었습니다.`);
}
function partSortValue(p,key){
  if(key==='name') return String(p.name||'');
  if(key==='qty') return num(p.qty,0);
  if(key==='recommend') return `${processLabel(p.score?.process||p.process)}_${p.score?.confidence||''}_${p.name||''}`;
  if(key==='process') return `${processLabel(p.process)}_${p.name||''}`;
  if(key==='material') return `${p.material||''}_${p.name||''}`;
  if(key==='input') return p.process==='purchase'?num(p.purchaseUnit||p.inputValue,0):num(p.inputValue,0);
  if(key==='margin') return num(p.margin,0);
  if(key==='quote') return num(p.quote,0);
  return '';
}
function sortedParts(){
  const arr=[...state.parts];
  const key=state.sort.key, dir=state.sort.dir||1;
  if(!key) return arr;
  arr.sort((a,b)=>{
    const av=partSortValue(a,key), bv=partSortValue(b,key);
    if(typeof av==='number' && typeof bv==='number') return (av-bv)*dir;
    return String(av).localeCompare(String(bv),'ko')*dir;
  });
  return arr;
}
function updateSortHeaders(){
  document.querySelectorAll('th[data-sort]').forEach(th=>{
    th.classList.toggle('sorted', state.sort.key===th.dataset.sort);
    th.dataset.dir = state.sort.key===th.dataset.sort ? (state.sort.dir>0?'asc':'desc') : '';
  });
}

function renderAll(){renderParts(); renderSelected(); updateStats();}
function updateStats(){ $('statParts').textContent=state.parts.length; $('statTotal').textContent=won(totalQuote()); $('statStatus').textContent=state.parts.length?'완료':'대기'; }
function renderParts(){
  updateSortHeaders();
  const body=$('partsBody');
  if(!state.parts.length){body.innerHTML='<tr><td colspan="9" class="empty-row">업로드 후 파트가 표시됩니다.</td></tr>';return;}
  updateSortHeaders();
  body.innerHTML=sortedParts().map(p=>rowHTML(p)).join('');
  body.querySelectorAll('tr[data-id]').forEach(tr=>{
    tr.onclick=e=>{ if(e.target.closest('input,select,button')) return; selectPart(tr.dataset.id); };
  });
  body.querySelectorAll('[data-act]').forEach(el=>{
    el.onchange=el.oninput=e=>handleCell(e.target);
    if(el.tagName==='SELECT') el.onchange=e=>handleCell(e.target);
  });
  body.querySelectorAll('.delbtn').forEach(b=>b.onclick=e=>{e.stopPropagation(); removePart(b.dataset.id);});
}
function rowHTML(p){
  const rec=p.score||{confidence:'낮음',score:0,reasons:[]};
  const inputLabel = p.process==='purchase'?'구매단가':p.process==='sheet'?'절곡수':['cnc','lathe','injection','print3d'].includes(p.process)?'시간/개':p.process==='profile'?'가공비/개':'입력';
  const inputVal = p.process==='purchase'?num(p.purchaseUnit||p.inputValue):num(p.inputValue);
  return `<tr data-id="${p.id}" class="${p.id===state.selectedId?'selected':''}">
    <td><span class="part-name">${esc(p.name)}</span><span class="sub">${p.meshName?'mesh: '+esc(p.meshName):'형상 연결 확인'}</span></td>
    <td><input data-act="qty" data-id="${p.id}" value="${p.qty}"></td>
    <td><span class="pill ${rec.confidence==='높음'?'high':rec.confidence==='보통'?'mid':'low'}">${processLabel(rec.process)} · ${rec.confidence}</span><div class="score-line">${esc((rec.reasons||[]).slice(0,2).join(' / '))}</div></td>
    <td><select data-act="process" data-id="${p.id}">${PROCESS_LIST.map(x=>`<option value="${x}" ${x===p.process?'selected':''}>${processLabel(x)}</option>`).join('')}</select></td>
    <td><select data-act="material" data-id="${p.id}">${MATERIALS.map(x=>`<option value="${x}" ${x===p.material?'selected':''}>${x}</option>`).join('')}</select></td>
    <td><label class="status-small">${inputLabel}</label><input data-act="input" data-id="${p.id}" value="${inputVal}"></td>
    <td><input data-act="margin" data-id="${p.id}" value="${p.margin}"></td>
    <td class="price">${won(p.quote)}</td>
    <td><button class="delbtn" data-id="${p.id}">삭제</button></td>
  </tr>`;
}
function handleCell(el){const p=state.parts.find(x=>x.id===el.dataset.id); if(!p)return; const act=el.dataset.act; if(act==='qty')p.qty=num(el.value,1); if(act==='process'){applyProcess(p,el.value); saveLearnedProcess(p);} if(act==='material')p.material=el.value; if(act==='input'){ if(p.process==='purchase')p.purchaseUnit=num(el.value,0); p.inputValue=num(el.value,0);} if(act==='margin')p.margin=num(el.value,0); recalcPart(p); renderAll(); if(p.id===state.selectedId) showPart(p);}
function selectPart(id){state.selectedId=id; renderParts(); renderSelected(); const p=selectedPart(); if(p)showPart(p);}
function removePart(id){state.parts=state.parts.filter(p=>p.id!==id); if(state.selectedId===id)state.selectedId=state.parts[0]?.id||null; recalcAll(); renderAll(); if(state.selectedId)showPart(selectedPart());}
function addManualPart(){const p=initPart({name:'수동 구매품 '+state.manualSeq++,qty:1,source:'manual'},state.parts.length); p.process='purchase'; p.material='SS400'; p.purchaseUnit=1000; p.inputValue=1000; p.margin=num(state.rates.margins.purchase,10); recalcPart(p); state.parts.push(p); state.selectedId=p.id; renderAll();}
function renderSelected(){
  const box=$('selectedInfo'), p=selectedPart(); if(!p){box.innerHTML='<div class="muted">파트를 선택하세요.</div>';return;}
  const m=p.metrics||{}; const dims=(m.dims||[]).map(x=>Math.round(x)).join(' × ');
  box.innerHTML=`<div class="selected-card"><b>${esc(p.name)}</b><div class="muted">${processLabel(p.process)} · ${p.material}</div><div class="calcnote">${esc(p.calcNote||'')}</div><div class="calcnote">추천근거: ${esc((p.score?.reasons||[]).slice(0,3).join(' / ')||'-')}</div><div class="calcnote">두께추정: ${fmt1(p.metrics?.estimatedThickness||0)}mm · 복잡도: ${fmt1(p.metrics?.complexityScore||0)} · 동일두께/판재: ${(p.metrics?.sheetLike||p.metrics?.sheetByThickness)?'가능':'낮음'} · 리브/보스: ${(p.metrics?.ribLike)?'가능':'낮음'}</div><div class="details-grid">
    <div><label>예상중량 kg/개</label><input id="selWeight" value="${kgEach(p).toFixed(4)}"></div>
    <div><label>크기 mm</label><input value="${esc(dims||'-')}" disabled></div>
    <div><label>체적 cm³</label><input value="${volumeCm3(p).toFixed(2)}" disabled></div>
    <div><label>견적가</label><input value="${won(p.quote)}" disabled></div>
  </div></div>`;
  const w=$('selWeight'); if(w) w.onchange=()=>{p.manualWeight=num(w.value,null); recalcPart(p); renderParts(); renderSelected(); updateStats();};
}
function renderRates(){renderMaterialRates();renderProcessRates();renderMarginRates();}
function renderMaterialRates(){
  const mats=state.rates.materials; const rows=MATERIALS.map(mat=>{const r=mats[mat]||{density:0,sheet:0,cnc:0,injection:0,print3d:0,profile:0}; return `<tr><td><b>${mat}</b></td>${['density','sheet','cnc','injection','print3d','profile'].map(k=>`<td><input data-rate="mat" data-mat="${mat}" data-key="${k}" value="${r[k]??0}"></td>`).join('')}</tr>`;}).join('');
  $('materialRates').innerHTML=`<table><thead><tr><th>재질</th><th>밀도</th><th>판재 kg</th><th>CNC/선반 kg</th><th>사출 kg</th><th>3D kg</th><th>압출 kg</th></tr></thead><tbody>${rows}</tbody></table>`;
  $('materialRates').querySelectorAll('input').forEach(i=>i.oninput=()=>{const mat=i.dataset.mat,key=i.dataset.key; state.rates.materials[mat]=state.rates.materials[mat]||{}; state.rates.materials[mat][key]=num(i.value,0); recalcAll(); renderParts(); renderSelected();});
}
function renderProcessRates(){
  const defs=[['sheetBendEach','절곡 1회 단가'],['sheetBaseEach','판금 기본비/개'],['cncHourly','CNC/MCT 시간당 단가'],['cncSetup','CNC 셋업비/개'],['latheHourly','선반 시간당 단가'],['latheSetup','선반 셋업비/개'],['injectionHourly','사출 시간당 단가'],['injectionSetup','사출 셋업비/개'],['print3dHourly','3D프린팅 시간당 단가'],['print3dSetup','3D프린팅 셋업비/개'],['profileProcessEach','압출 가공비/개']];
  $('processRates').innerHTML=defs.map(([k,label])=>`<label>${label}<input data-prate="${k}" value="${state.rates.process[k]??0}"></label>`).join('');
  $('processRates').querySelectorAll('input').forEach(i=>i.oninput=()=>{state.rates.process[i.dataset.prate]=num(i.value,0); recalcAll(); renderParts(); renderSelected();});
}
function renderMarginRates(){
  $('marginRates').innerHTML=PROCESS_LIST.filter(p=>p!=='unknown').map(p=>`<label>${processLabel(p)} 마진%<input data-marginrate="${p}" value="${state.rates.margins[p]??0}"></label>`).join('');
  $('marginRates').querySelectorAll('input').forEach(i=>i.oninput=()=>{state.rates.margins[i.dataset.marginrate]=num(i.value,0);});
}
function downloadRates(){downloadText('factory_rates.json',JSON.stringify(state.rates,null,2));}
async function loadRatesFile(f){try{state.rates=mergeRates(structuredClone(DEFAULT_RATES),JSON.parse(await f.text())); renderRates(); recalcAll(); renderParts(); renderSelected(); flash('ok','단가표를 불러왔습니다.');}catch(e){flash('err','단가표 파일을 읽지 못했습니다.');}}
function downloadCSV(){const header=['파트','수량','공법','재질','입력값','마진%','견적가']; const rows=state.parts.map(p=>[p.name,p.qty,processLabel(p.process),p.material,p.process==='purchase'?p.purchaseUnit:p.inputValue,p.margin,p.quote]); downloadText('quote.csv',[header,...rows].map(r=>r.map(csvCell).join(',')).join('\n'));}
function csvCell(v){return '"'+String(v??'').replace(/"/g,'""')+'"';}
function downloadText(name,text){const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

init();
