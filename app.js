import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const PROCESS_LIST = ['분류 필요','구매품','CNC/MCT','선반','판금/절곡','3D프린팅','사출','프로파일/압출','용접'];
const MATERIAL_LIST = ['AL6061','SUS304','SS400','SPCC','POM','ABS','PLA'];
const state = {
  rates: null,
  parts: [],
  selectedIndex: -1,
  occtResult: null,
  meshByPart: new Map(),
  allMeshes: [],
  viewerReady: false,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  modelGroup: null,
  debug: {}
};

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(Number(n)||0).toLocaleString('ko-KR') + '원';
const cleanName = (s) => String(s || '').replace(/^'+|'+$/g,'').replace(/\\X2\\.*?\\X0\\/g,'').trim();
const normalize = (s) => cleanName(s).replace(/\s+/g,'_').toUpperCase();
const isGenericName = (s) => /^(DESIGN|NEXT ASSEMBLY RELATIONSHIP|NONE|UNNAMED|PART|PRODUCT|ASSEMBLY|)$/i.test(cleanName(s));

window.addEventListener('DOMContentLoaded', async () => {
  await loadRates();
  initInputs();
  initUpload();
  initViewer();
  bindButtons();
});

async function loadRates(){
  try{
    const res = await fetch('data/rates.json', {cache:'no-store'});
    state.rates = await res.json();
  }catch(e){
    state.rates = defaultRates();
  }
}
function defaultRates(){return {materials:{AL6061:{market:6200,markupMode:'percent',markup:15,density:2.7},SUS304:{market:4800,markupMode:'percent',markup:18,density:7.93},SS400:{market:1300,markupMode:'amount',markup:350,density:7.85},SPCC:{market:1200,markupMode:'amount',markup:300,density:7.85},POM:{market:7200,markupMode:'percent',markup:20,density:1.41},ABS:{market:3900,markupMode:'percent',markup:20,density:1.04},PLA:{market:23000,markupMode:'percent',markup:25,density:1.24}},margins:{'분류 필요':0,'구매품':10,'CNC/MCT':22,'선반':20,'판금/절곡':18,'3D프린팅':28,'사출':18,'프로파일/압출':15,'용접':22},process:{tapUnit:{default:1800},bendUnitByThickness:[{max:1,price:1200},{max:2,price:2200},{max:3.2,price:3800},{max:6,price:6500},{max:999,price:10000}],sheetSetup:25000,cncBase:{small:30000,medium:70000,large:150000},latheBase:35000,profileCut:1000,profileTap:1200,purchaseMinimum:100,weldingBase:50000}}}
function initInputs(){
  const marginBox = $('marginInputs');
  marginBox.innerHTML = '';
  PROCESS_LIST.forEach(p=>{
    const label = document.createElement('label'); label.textContent = p;
    const inp = document.createElement('input'); inp.type='number'; inp.value = state.rates.margins[p] ?? 0; inp.dataset.process=p;
    inp.addEventListener('input',()=>{state.rates.margins[p]=Number(inp.value)||0; renderParts();});
    marginBox.append(label, inp);
  });
  const matBox = $('materialInputs'); matBox.innerHTML='';
  Object.entries(state.rates.materials).forEach(([k,v])=>{
    const label = document.createElement('label'); label.textContent = k;
    const inp = document.createElement('input'); inp.type='number'; inp.value = v.markup; inp.title='할증값: % 또는 원/kg'; inp.dataset.material=k;
    inp.addEventListener('input',()=>{v.markup=Number(inp.value)||0; renderParts();});
    matBox.append(label, inp);
  });
  $('processRates').innerHTML = `탭 기본 ${fmt(state.rates.process.tapUnit.default).replace('원','')} / 절곡 두께별 / 판금 셋업 ${fmt(state.rates.process.sheetSetup)} / CNC 기본 ${fmt(state.rates.process.cncBase.small)}~${fmt(state.rates.process.cncBase.large)}`;
}
function initUpload(){
  const dz = $('dropZone'), fi = $('fileInput');
  dz.addEventListener('click',()=>fi.click());
  fi.addEventListener('change',()=>{ if(fi.files?.[0]) handleFile(fi.files[0]); });
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault(); dz.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault(); dz.classList.remove('drag');}));
  dz.addEventListener('drop',e=>{const f=e.dataTransfer.files?.[0]; if(f) handleFile(f);});
}
function bindButtons(){
  $('btnRecalc').addEventListener('click',()=>renderParts());
  $('btnCsv').addEventListener('click',exportCsv);
  $('btnApplySheet').addEventListener('click',()=>{ if(state.selectedIndex>=0){state.parts[state.selectedIndex].material='SUS304'; renderParts(); selectPart(state.selectedIndex);} });
  $('btnShowAll').addEventListener('click',showAllMeshes);
  $('btnFit').addEventListener('click',fitCamera);
}

async function handleFile(file){
  setStatus('info', `읽는 중: ${file.name}`);
  clearScene();
  state.parts = []; state.selectedIndex=-1; state.occtResult=null; state.meshByPart.clear(); state.allMeshes=[];
  updateStats(); renderParts();
  const buffer = await file.arrayBuffer();
  const text = await file.text();
  const textParse = StepTextParser.parse(text, file.name);
  state.debug.textParse = textParse.debug;
  let occtOk = false;
  try{
    occtOk = await tryOcctParse(new Uint8Array(buffer), file.name, textParse);
  }catch(e){
    console.warn(e);
    state.debug.occtError = String(e?.message || e);
  }
  if(!occtOk){
    state.parts = textParse.parts.map(p => enrichPart(p, {source:'STEP text'}));
    $('statMode').textContent = '텍스트';
    setStatus(state.parts.length?'ok':'err', state.parts.length ? `텍스트 파서 완료: 말단 파트 ${state.parts.length}종 표시. 실제 3D mesh는 OCCT가 실패하여 표시하지 않습니다.` : '말단 파트를 찾지 못했습니다. 파싱 진단을 확인하세요.');
  }
  renderParts();
  updateStats(textParse);
  renderDebug(file.name, textParse);
  if(state.parts.length) selectPart(0);
}

async function tryOcctParse(fileBuffer, fileName, textParse){
  if(typeof window.occtimportjs !== 'function'){
    state.debug.occtError = 'occtimportjs 로더가 없습니다. CDN 차단 또는 네트워크 문제.';
    return false;
  }
  setStatus('info', 'OCCT WASM으로 실제 STEP mesh 파싱 중입니다. 큰 파일은 시간이 걸립니다.');
  const occt = await window.occtimportjs();
  const result = occt.ReadStepFile(fileBuffer, {
    linearUnit:'millimeter',
    linearDeflectionType:'bounding_box_ratio',
    linearDeflection:0.001,
    angularDeflection:0.5
  });
  state.debug.occtRaw = summarizeOcct(result);
  if(!result || result.success === false || !Array.isArray(result.meshes) || result.meshes.length===0){
    state.debug.occtError = 'OCCT 결과에 mesh가 없습니다.';
    return false;
  }
  state.occtResult = result;
  const leaves = collectOcctLeafNodes(result.root);
  const usable = leaves.filter(l => l.meshes.length>0);
  const grouped = groupOcctParts(usable, textParse.parts);
  if(grouped.length===0){
    state.debug.occtError = 'OCCT mesh는 있으나 leaf node를 만들지 못했습니다.';
    return false;
  }
  state.parts = grouped.map(p => enrichPart(p, {source:'OCCT mesh'}));
  buildThreeMeshes(result);
  mapMeshesToParts(state.parts, grouped);
  showAllMeshes();
  $('statMode').textContent = 'OCCT 3D';
  setStatus('ok', `OCCT 실제 mesh 파싱 완료: mesh ${result.meshes.length}개, 말단 파트 ${state.parts.length}종 표시.`);
  return true;
}

function summarizeOcct(result){
  if(!result) return null;
  return {success:result.success, meshCount:result.meshes?.length||0, rootName:result.root?.name, rootChildren:result.root?.children?.length||0, leafSample:collectOcctLeafNodes(result.root).slice(0,20).map(x=>({name:x.name,path:x.path.join(' > '),meshes:x.meshes}))};
}
function collectOcctLeafNodes(root){
  const out=[];
  function walk(node,path=[]){
    if(!node) return;
    const name = cleanName(node.name || 'UNNAMED');
    const nextPath = [...path, name];
    const children = Array.isArray(node.children) ? node.children : [];
    const meshes = Array.isArray(node.meshes) ? node.meshes : [];
    if(children.length===0 && meshes.length>0){ out.push({name, path:nextPath, meshes}); return; }
    if(meshes.length>0 && !isAssemblyName(name)){ out.push({name,path:nextPath,meshes}); }
    children.forEach(c=>walk(c,nextPath));
  }
  walk(root,[]);
  return out;
}
function groupOcctParts(leaves, textParts){
  const map = new Map();
  for(const leaf of leaves){
    let name = bestNameFromPath(leaf.path);
    if(isGenericName(name)) name = matchTextNameByOrder(map.size, textParts) || name;
    const key = normalize(name);
    if(!map.has(key)) map.set(key,{name,qty:0,meshIndices:[],paths:[],source:'OCCT leaf mesh'});
    const g = map.get(key); g.qty += 1; g.meshIndices.push(...leaf.meshes); g.paths.push(leaf.path.join(' > '));
  }
  return [...map.values()].filter(p=>!isAssemblyName(p.name));
}
function bestNameFromPath(path){
  const candidates = [...path].reverse().map(cleanName).filter(n=>n && !isGenericName(n) && !/NEXT ASSEMBLY RELATIONSHIP/i.test(n));
  return candidates[0] || cleanName(path[path.length-1]);
}
function matchTextNameByOrder(i, textParts){ return textParts?.[i]?.name; }
function isAssemblyName(name){ return /(_ASM$|ASSY|ASSEMBLY)/i.test(name||''); }

function buildThreeMeshes(result){
  clearScene();
  state.allMeshes = [];
  result.meshes.forEach((m, idx)=>{
    const geom = meshToGeometry(m);
    if(!geom) return;
    const color = Array.isArray(m.color) ? new THREE.Color(m.color[0],m.color[1],m.color[2]) : new THREE.Color(0x7d8798);
    const mat = new THREE.MeshStandardMaterial({color, roughness:.72, metalness:.08, side:THREE.DoubleSide});
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = cleanName(m.name || `mesh_${idx}`);
    mesh.userData.meshIndex = idx;
    state.allMeshes[idx] = mesh;
  });
}
function meshToGeometry(m){
  const posRaw = m?.attributes?.position?.array;
  if(!posRaw || posRaw.length===0) return null;
  const pos = flattenNumbers(posRaw);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  const normRaw = m?.attributes?.normal?.array;
  if(normRaw?.length){ geom.setAttribute('normal', new THREE.Float32BufferAttribute(flattenNumbers(normRaw),3)); }
  const idxRaw = m?.index?.array;
  if(idxRaw?.length){ geom.setIndex(flattenNumbers(idxRaw)); }
  if(!normRaw?.length) geom.computeVertexNormals();
  geom.computeBoundingBox(); geom.computeBoundingSphere();
  return geom;
}
function flattenNumbers(arr){ return Array.isArray(arr[0]) ? arr.flat(Infinity).map(Number) : Array.from(arr).map(Number); }
function mapMeshesToParts(parts, grouped){
  state.meshByPart.clear();
  parts.forEach((p,i)=>{ state.meshByPart.set(i, [...new Set(grouped[i]?.meshIndices || [])]); });
}

function initViewer(){
  const el = $('viewer');
  el.innerHTML='';
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x0f172a);
  state.camera = new THREE.PerspectiveCamera(45, el.clientWidth/el.clientHeight, 0.1, 100000);
  state.camera.position.set(250,200,250);
  state.renderer = new THREE.WebGLRenderer({antialias:true});
  state.renderer.setSize(el.clientWidth, el.clientHeight);
  state.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  el.appendChild(state.renderer.domElement);
  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.modelGroup = new THREE.Group(); state.scene.add(state.modelGroup);
  const hemi = new THREE.HemisphereLight(0xffffff,0x29344a,2.2); state.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff,2.0); dir.position.set(200,300,200); state.scene.add(dir);
  const grid = new THREE.GridHelper(500,20,0x334155,0x1f2937); state.scene.add(grid);
  window.addEventListener('resize',()=>{ const w=el.clientWidth,h=el.clientHeight; state.camera.aspect=w/h; state.camera.updateProjectionMatrix(); state.renderer.setSize(w,h); });
  (function animate(){ requestAnimationFrame(animate); state.controls.update(); state.renderer.render(state.scene,state.camera); })();
  state.viewerReady=true;
}
function clearScene(){ if(state.modelGroup){ while(state.modelGroup.children.length) state.modelGroup.remove(state.modelGroup.children[0]); } }
function showAllMeshes(){
  clearScene();
  state.allMeshes.forEach(m=>{ if(m){ const c=m.clone(); c.geometry=m.geometry; state.modelGroup.add(c);} });
  fitCamera();
}
function showPartMesh(index){
  clearScene();
  const ids = state.meshByPart.get(index) || [];
  if(!ids.length){ showPreviewOnly(index); return; }
  ids.forEach(id=>{ const m=state.allMeshes[id]; if(m){ const c=m.clone(); c.geometry=m.geometry; c.material=m.material.clone(); c.material.color.set(0x82a7ff); state.modelGroup.add(c); }});
  fitCamera();
}
function showPreviewOnly(index){
  clearScene();
  const p = state.parts[index];
  if(!p) return;
  const geom = new THREE.BoxGeometry(80, Math.max(4, p.thickness*3 || 12), 50);
  const mat = new THREE.MeshStandardMaterial({color:0x778293, roughness:.7});
  const mesh = new THREE.Mesh(geom, mat); state.modelGroup.add(mesh); fitCamera();
}
function fitCamera(){
  if(!state.modelGroup || state.modelGroup.children.length===0) return;
  const box = new THREE.Box3().setFromObject(state.modelGroup);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x,size.y,size.z,1);
  const dist = maxDim * 2.3;
  state.camera.position.set(center.x+dist, center.y+dist*.8, center.z+dist);
  state.camera.near = Math.max(maxDim/1000,.1); state.camera.far = Math.max(maxDim*20,1000); state.camera.updateProjectionMatrix();
  state.controls.target.copy(center); state.controls.update();
}

const StepTextParser = {
  parse(text,fileName){
    const entities = parseEntities(text);
    const products = new Map(), formations = new Map(), pdefs = new Map(), links=[];
    for(const e of entities.values()){
      if(e.type==='PRODUCT') products.set(e.id,{id:e.id,name:firstString(e.args)||e.id,args:e.args});
    }
    for(const e of entities.values()){
      if(e.type.startsWith('PRODUCT_DEFINITION_FORMATION')){
        const prodRef = getRefs(e.raw).find(r=>products.has(r));
        formations.set(e.id,{id:e.id,product:prodRef});
      }
    }
    for(const e of entities.values()){
      if(e.type==='PRODUCT_DEFINITION'){
        const refs = getRefs(e.raw);
        const formation = refs.find(r=>formations.has(r));
        const prod = formation ? formations.get(formation).product : refs.find(r=>products.has(r));
        const pdName = firstString(e.args) || '';
        pdefs.set(e.id,{id:e.id,name:pdName,formation,product:prod,productName:products.get(prod)?.name || pdName || e.id});
      }
    }
    for(const e of entities.values()){
      if(e.type==='NEXT_ASSEMBLY_USAGE_OCCURRENCE'){
        const refs = getRefs(e.raw).filter(r=>pdefs.has(r));
        if(refs.length>=2){
          links.push({id:e.id,parent:refs[0],child:refs[1],occurrenceName: secondString(e.args) || firstString(e.args) || ''});
        }
      }
    }
    const rows = buildLeafRows(pdefs, links);
    const parts = rows.map(r=>({name:r.name, qty:r.qty, source:'STEP text leaf', pdIds:r.pdIds, paths:r.paths}));
    const debug = {fileName, entityCount:entities.size, productCount:products.size, productDefinitionCount:pdefs.size, linkCount:links.length, leafCount:rows.length, samples:{products:[...products.values()].slice(0,40), links:links.slice(0,40), rows:rows.slice(0,60)}};
    return {parts, debug};
  }
};
function parseEntities(text){
  const map = new Map();
  const re = /#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*?)\);/g;
  let m;
  while((m=re.exec(text))){
    const id='#'+m[1], type=m[2].toUpperCase(), argRaw=m[3];
    map.set(id,{id,type,args:splitArgs(argRaw),raw:argRaw});
  }
  return map;
}
function splitArgs(s){
  const out=[]; let cur='', depth=0, inStr=false;
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(ch==="'" && s[i-1] !== '\\') inStr = !inStr;
    if(!inStr){ if(ch==='(') depth++; if(ch===')') depth--; if(ch===',' && depth===0){ out.push(cur.trim()); cur=''; continue; } }
    cur += ch;
  }
  if(cur.trim()) out.push(cur.trim());
  return out;
}
function firstString(args){ const a=args.find(x=>/^'/.test(x.trim())); return a?cleanName(a.slice(1,-1)):''; }
function secondString(args){ const ss=args.filter(x=>/^'/.test(x.trim())).map(x=>cleanName(x.slice(1,-1))); return ss[1]||''; }
function getRefs(raw){ return [...raw.matchAll(/#\d+/g)].map(m=>m[0]); }
function buildLeafRows(pdefs, links){
  const parentSet = new Set(links.map(l=>l.parent));
  const childSet = new Set(links.map(l=>l.child));
  const edgeMap = new Map();
  for(const l of links){
    if(!edgeMap.has(l.parent)) edgeMap.set(l.parent, new Map());
    const m = edgeMap.get(l.parent);
    m.set(l.child, (m.get(l.child)||0)+1);
  }
  let roots = [...parentSet].filter(p=>!childSet.has(p));
  if(roots.length===0 && parentSet.size) roots = [[...parentSet].sort((a,b)=>(edgeMap.get(b)?.size||0)-(edgeMap.get(a)?.size||0))[0]];
  const leafCounts = new Map();
  const paths = new Map();
  function pdName(pd){ const d=pdefs.get(pd); return cleanName(d?.productName || d?.name || pd); }
  function walk(pd, mult, path, seen){
    if(seen.has(pd)) return; seen.add(pd);
    const edges = edgeMap.get(pd);
    if(!edges || edges.size===0){
      const name = pdName(pd);
      if(isAssemblyName(name)) return;
      const key = normalize(name);
      if(!leafCounts.has(key)) leafCounts.set(key,{name,qty:0,pdIds:new Set(),paths:[]});
      const row = leafCounts.get(key); row.qty += mult; row.pdIds.add(pd); row.paths.push([...path,name].join(' > '));
      return;
    }
    for(const [child,count] of edges){ walk(child, mult*count, [...path,pdName(pd)], new Set(seen)); }
  }
  roots.forEach(r=>walk(r,1,[],new Set()));
  if(leafCounts.size===0){
    for(const [pd,d] of pdefs){ const name=cleanName(d.productName || d.name); if(!isAssemblyName(name) && !isGenericName(name)){ const key=normalize(name); leafCounts.set(key,{name,qty:1,pdIds:new Set([pd]),paths:[name]}); } }
  }
  return [...leafCounts.values()].map(r=>({name:r.name,qty:r.qty,pdIds:[...r.pdIds],paths:r.paths})).sort((a,b)=>a.name.localeCompare(b.name));
}

function enrichPart(part, meta={}){
  const rec = classify(part.name);
  const thickness = inferThickness(part.name, rec.process);
  const taps = inferTaps(part.name, rec.process);
  const bends = inferBends(part.name, rec.process, thickness);
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    name: cleanName(part.name), qty: Math.max(1, Number(part.qty)||1),
    process: rec.process, material: rec.material, thickness,
    tapCount: taps, bendCount: bends,
    margin: state.rates.margins[rec.process] ?? 0,
    reason: rec.reason, confidence: rec.confidence,
    cost:0, source: meta.source || part.source || '',
    meshIndices: part.meshIndices || [], paths: part.paths || []
  };
}
function classify(name){
  const n = normalize(name);
  if(/BOLT|NUT|SCREW|WASHER|BEARING|SENSOR|MOTOR|CYLINDER|RIVET|REVET|NIPPLE|PIPE|TUBE|HOSE|VALVE|HEX|PIE|파이프|튜브|각관|배관/i.test(n)) return {process:'구매품', material:'SS400', confidence:'높음', reason:'구매품명/표준품 힌트'};
  if(/PROFILE|AL.?FRAME|프로파일|압출|\b(2020|3030|4040|4080|4545|5050|6060|8080)\b/i.test(n)) return {process:'프로파일/압출', material:'AL6061', confidence:'높음', reason:'프로파일/압출 규격 힌트'};
  if(/SHAFT|PIN|BUSH|ROLLER|ROD|축|샤프트|부싱/i.test(n)) return {process:'선반', material:'SS400', confidence:'높음', reason:'회전체/축류 이름 힌트'};
  if(/BEND|BENT|FOLD|FLANGE|L_BRACKET|U_BRACKET|절곡/i.test(n)) return {process:'판금/절곡', material:'SUS304', confidence:'높음', reason:'절곡/플랜지 이름 힌트'};
  if(/HOOD|COVER|PANEL|BODY|SIDE|SKEL|BOTTLE|SHEET|PLATE/i.test(n)) return {process:'판금/절곡', material:'SUS304', confidence:'보통', reason:'판금 후보. 절곡 횟수는 공장 확인'};
  if(/BASE|BLOCK|MOUNT|JIG|FIXTURE|HOLDER|BRACKET|ADAPTER|GUIDE|SUPPORT|CLAMP|BY/i.test(n)) return {process:'CNC/MCT', material:'AL6061', confidence:'보통', reason:'절삭 가공품 이름 힌트'};
  return {process:'분류 필요', material:'AL6061', confidence:'낮음', reason:'명확한 공법 힌트 없음'};
}
function inferThickness(name, process){ const n=normalize(name); const m=n.match(/(?:_|-)(\d+(?:\.\d+)?)T\b|\b(\d+(?:\.\d+)?)T\b/); if(m) return Number(m[1]||m[2]); if(process==='판금/절곡') return 1.5; if(process==='CNC/MCT') return 8; return 3; }
function inferTaps(name, process){ const n=normalize(name); const m=n.match(/M(\d+)/); if(/SCREW|BOLT|NUT|REVET|RIVET/.test(n)) return 0; return process==='CNC/MCT' && /TAP|M\d+|TH/.test(n) ? 1 : 0; }
function inferBends(name, process, t){ const n=normalize(name); if(process!=='판금/절곡') return 0; if(/U_BRACKET|U-BRACKET|U형/.test(n)) return 2; if(/L_BRACKET|L-BRACKET|ㄱ/.test(n)) return 1; if(/BEND|BENT|FOLD|FLANGE|절곡/.test(n)) return 1; return 0; }

function calculate(part){
  const qty = Math.max(0, Number(part.qty)||0), margin = Number(part.margin)||0;
  const mat = state.rates.materials[part.material] || state.rates.materials.AL6061;
  const unitMat = mat.markupMode==='amount' ? mat.market + mat.markup : mat.market * (1 + mat.markup/100);
  let materialCost = 0, processCost = 0, note='';
  const p = part.process;
  const t = Number(part.thickness)||0;
  if(p==='분류 필요'){ materialCost=0; processCost=0; note='공법 선택 전'; }
  else if(p==='구매품'){
    const base = purchasePrice(part.name); processCost = base * qty; note='구매품 단가×수량';
  }else if(p==='프로파일/압출'){
    const len = inferLength(part.name) || 500; materialCost = (len/1000) * 12000 * qty; processCost = (state.rates.process.profileCut + part.tapCount*state.rates.process.profileTap) * qty; note='길이/절단/탭';
  }else if(p==='선반'){
    materialCost = unitMat * 0.15 * qty; processCost = state.rates.process.latheBase * qty + part.tapCount * state.rates.process.tapUnit.default; note='선반 기본+탭';
  }else if(p==='판금/절곡'){
    const areaM2 = inferArea(part.name) || 0.12; materialCost = areaM2 * (t/1.5) * unitMat * mat.density * qty * 0.2;
    const bendUnit = bendUnit(t); processCost = (state.rates.process.sheetSetup + bendUnit * part.bendCount + part.tapCount * state.rates.process.tapUnit.default) * qty; note='판재+셋업+절곡+탭';
  }else if(p==='CNC/MCT'){
    const size = cncSize(part.name); materialCost = unitMat * (size==='large'?1.2:size==='medium'?0.45:0.12) * qty;
    processCost = state.rates.process.cncBase[size] * qty + part.tapCount * state.rates.process.tapUnit.default; note='CNC 기본+탭';
  }else if(p==='3D프린팅'){
    materialCost = unitMat * 0.05 * qty; processCost = 18000 * qty; note='출력 기본';
  }else if(p==='사출'){
    materialCost = unitMat * 0.03 * qty; processCost = 200 * qty; note='금형비 미포함';
  }else if(p==='용접'){
    materialCost = unitMat * 0.5 * qty; processCost = state.rates.process.weldingBase * qty; note='용접 기본';
  }
  const subtotal = materialCost + processCost;
  const total = subtotal * (1 + margin/100);
  return {materialCost, processCost, marginAmount: total-subtotal, total, note};
}
function bendUnit(t){ return (state.rates.process.bendUnitByThickness.find(x=>t<=x.max)||state.rates.process.bendUnitByThickness.at(-1)).price; }
function purchasePrice(name){ const n=normalize(name); if(/NUT/.test(n)) return 80; if(/SCREW|BOLT/.test(n)) return 120; if(/REVET|RIVET/.test(n)) return 70; if(/BEARING/.test(n)) return 2500; if(/NIPPLE|PIPE|TUBE|PIE|VALVE/.test(n)) return 4500; return 1000; }
function inferLength(name){ const m=normalize(name).match(/L(\d{2,5})/); return m?Number(m[1]):0; }
function inferArea(name){ return /COVER|HOOD|BODY|PANEL|SIDE|BOTTLE/i.test(name) ? 0.35 : 0.12; }
function cncSize(name){ const n=normalize(name); if(/BASE|BLOCK|JIG|FIXTURE/.test(n)) return 'large'; if(/MOUNT|HOLDER|BRACKET|SUPPORT|BY/.test(n)) return 'medium'; return 'small'; }

function renderParts(){
  const body = $('partsBody'); body.innerHTML='';
  if(!state.parts.length){ body.innerHTML='<tr><td colspan="10" class="empty-cell">파일을 업로드하면 여기에 말단 파트가 표시됩니다.</td></tr>'; updateStats(); return; }
  const tpl = $('partRowTemplate');
  state.parts.forEach((part,i)=>{
    const calc = calculate(part); part.cost = calc.total; part._calc = calc;
    const tr = tpl.content.firstElementChild.cloneNode(true);
    if(i===state.selectedIndex) tr.classList.add('active');
    tr.querySelector('.part-name').innerHTML = `<b>${escapeHtml(part.name)}</b><small>${part.source || ''}</small>`;
    const qty = tr.querySelector('.qty-input'); qty.value=part.qty; qty.addEventListener('input',()=>{part.qty=Number(qty.value)||0; renderParts(); selectPart(i,false);});
    tr.querySelector('.recommend').innerHTML = `<span class="pill">${part.confidence}</span><small>${escapeHtml(part.reason)}</small>`;
    const proc = tr.querySelector('.process-select'); fillSelect(proc, PROCESS_LIST, part.process); proc.addEventListener('change',()=>{part.process=proc.value; part.margin=state.rates.margins[part.process]??part.margin; renderParts(); selectPart(i,false);});
    const mat = tr.querySelector('.material-select'); fillSelect(mat, MATERIAL_LIST, part.material); mat.addEventListener('change',()=>{part.material=mat.value; renderParts(); selectPart(i,false);});
    const th = tr.querySelector('.thickness-input'); th.value=part.thickness; th.addEventListener('input',()=>{part.thickness=Number(th.value)||0; renderParts(); selectPart(i,false);});
    const tap = tr.querySelector('.tap-input'); tap.value=part.tapCount; tap.addEventListener('input',()=>{part.tapCount=Number(tap.value)||0; renderParts(); selectPart(i,false);});
    const bend = tr.querySelector('.bend-input'); bend.value=part.bendCount; bend.addEventListener('input',()=>{part.bendCount=Number(bend.value)||0; renderParts(); selectPart(i,false);});
    const margin = tr.querySelector('.margin-input'); margin.value=part.margin; margin.addEventListener('input',()=>{part.margin=Number(margin.value)||0; renderParts(); selectPart(i,false);});
    tr.querySelector('.cost-cell').textContent = fmt(part.cost);
    tr.addEventListener('click',(e)=>{ if(['INPUT','SELECT','BUTTON'].includes(e.target.tagName)) return; selectPart(i); });
    body.appendChild(tr);
  });
  updateStats();
}
function fillSelect(sel, list, val){ sel.innerHTML=''; list.forEach(x=>{const o=document.createElement('option'); o.value=x; o.textContent=x; if(x===val)o.selected=true; sel.appendChild(o);}); }
function selectPart(i, showMesh=true){
  state.selectedIndex=i; const part=state.parts[i]; if(!part) return;
  if(showMesh) showPartMesh(i);
  document.querySelectorAll('#partsBody tr').forEach((tr,idx)=>tr.classList.toggle('active',idx===i));
  const calc = part._calc || calculate(part);
  $('selectedBox').innerHTML = `<div class="selected-card"><h3>${escapeHtml(part.name)}</h3><div class="preview-box"><div class="preview-shape"></div></div><div><span class="pill">${part.process}</span><span class="pill">${part.material}</span><span class="pill">수량 ${part.qty}</span></div><div class="selected-meta">두께 ${part.thickness}T / 탭 ${part.tapCount} / 절곡 ${part.bendCount}<br>재료 ${fmt(calc.materialCost)} / 공정 ${fmt(calc.processCost)} / 마진 ${fmt(calc.marginAmount)}<br>근거: ${escapeHtml(part.reason)}<br>경로: ${(part.paths||[]).slice(0,2).map(escapeHtml).join('<br>')}</div><div class="selected-price">파트 견적 ${fmt(calc.total)}</div></div>`;
}
function updateStats(textParse){
  $('statParts').textContent = state.parts.length;
  $('statAsm').textContent = textParse?.debug?.assemblyExcludedCount ?? countAssembliesFromDebug(textParse) ?? 0;
  $('statEntities').textContent = textParse?.debug?.entityCount ?? state.debug?.textParse?.entityCount ?? 0;
  $('statTotal').textContent = fmt(state.parts.reduce((a,p)=>a+(p.cost||calculate(p).total),0));
}
function countAssembliesFromDebug(tp){ return tp?.debug?.linkCount ? Math.max(0,(tp.debug.productDefinitionCount||0)-state.parts.length) : 0; }
function renderDebug(fileName, textParse){
  const dbg = {fileName, textParser:textParse.debug, occt:state.debug.occtRaw || null, occtError:state.debug.occtError || null, parts:state.parts.map(p=>({name:p.name,qty:p.qty,process:p.process,source:p.source,paths:p.paths?.slice(0,3)}))};
  $('debugPre').textContent = JSON.stringify(dbg,null,2);
}
function setStatus(type,msg){ const el=$('statusBox'); el.className='status '+type; el.textContent=msg; }
function escapeHtml(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function exportCsv(){
  if(!state.parts.length) return;
  const rows = [['파트명','수량','공법','재질','두께','탭','절곡','마진','견적가']];
  state.parts.forEach(p=>rows.push([p.name,p.qty,p.process,p.material,p.thickness,p.tapCount,p.bendCount,p.margin,Math.round(p.cost||calculate(p).total)]));
  const csv = rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='step_quote_parts.csv'; a.click(); URL.revokeObjectURL(a.href);
}
