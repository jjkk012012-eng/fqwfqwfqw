/* 공장용 STEP 견적 계산기 Real Viewer V5 */
const $ = (id) => document.getElementById(id);
const state = {
  fileName: '',
  rates: null,
  parts: [],
  selectedId: null,
  debug: {},
  occt: null,
  meshObjects: [],
  meshByName: new Map(),
  three: { scene:null, camera:null, renderer:null, controls:null, root:null, selected:null }
};

const PROCESS_LABELS = {
  unknown:'분류 필요', purchase:'구매품', profile:'프로파일/압출', lathe:'선반', sheet:'판금/절곡', cnc:'CNC/MCT', print3d:'3D프린팅', injection:'사출', welding:'용접'
};
const MATERIALS = ['AL6061','SUS304','SS400','SPCC','ABS','POM'];
const PROCESSES = ['unknown','purchase','profile','lathe','sheet','cnc','print3d','injection','welding'];

const DEFAULT_RATES = {
  materials:{
    AL6061:{market:6200,markupPercent:18,density:2.7}, SUS304:{market:4800,markupPercent:25,density:7.93},
    SS400:{market:1250,markupPercent:20,density:7.85}, SPCC:{market:1350,markupPercent:18,density:7.85},
    ABS:{market:3800,markupPercent:20,density:1.04}, POM:{market:8200,markupPercent:20,density:1.41}
  },
  process:{purchase:{margin:10},profile:{base:1500,perMeter:12000,cut:1000,tap:1500,margin:15},lathe:{small:18000,medium:45000,large:90000,tap:1800,margin:20},sheet:{base:18000,bend:2500,hole:300,tap:1500,margin:18},cnc:{small:45000,medium:110000,large:240000,hole:600,tap:2000,margin:22},print3d:{perCm3:450,supportPercent:15,margin:28},injection:{piece:120,moldSimple:0,moldNormal:0,margin:20},welding:{base:30000,point:5000,margin:22},unknown:{margin:0}}
};

window.addEventListener('DOMContentLoaded', async () => {
  await loadRates();
  initUpload();
  initViewer();
  renderRateEditors();
  bindActions();
  updateStats();
});

async function loadRates(){
  try { const res = await fetch('data/rates.json'); state.rates = res.ok ? await res.json() : structuredClone(DEFAULT_RATES); }
  catch { state.rates = structuredClone(DEFAULT_RATES); }
}

function initUpload(){
  const input = $('stepFile');
  const btn = $('selectFileBtn');
  const dz = $('dropZone');
  btn.addEventListener('click', () => input.click());
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); input.click(); }});
  input.addEventListener('change', e => { const f=e.target.files?.[0]; if(f) handleFile(f); });
  ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => { const f=e.dataTransfer.files?.[0]; if(f) handleFile(f); });
}

function bindActions(){
  $('recalcBtn').addEventListener('click', () => { recalcAll(); renderParts(); renderSelected(); });
  $('exportCsvBtn').addEventListener('click', exportCsv);
  $('showAllBtn').addEventListener('click', () => showAllMeshes());
  $('fitBtn').addEventListener('click', () => fitCamera());
}

function initViewer(){
  const container = $('viewer');
  if (!window.THREE) { container.innerHTML = '<div class="viewer-empty">Three.js 로딩 실패</div>'; return; }
  container.innerHTML = '';
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 390;
  const renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0f172a, 1);
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 100000);
  camera.position.set(240, 320, 240);
  camera.up.set(0,0,1);
  const hemi = new THREE.HemisphereLight(0xffffff,0x223344,1.2); scene.add(hemi);
  const d1 = new THREE.DirectionalLight(0xffffff,0.8); d1.position.set(200,300,500); scene.add(d1);
  const root = new THREE.Group(); scene.add(root);
  let controls = null;
  if (THREE.OrbitControls) { controls = new THREE.OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08; }
  state.three = {scene,camera,renderer,controls,root,selected:null};
  const animate = () => { requestAnimationFrame(animate); controls?.update(); renderer.render(scene,camera); };
  animate();
  window.addEventListener('resize', () => {
    const w = container.clientWidth || 800, h = container.clientHeight || 390;
    renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();
  });
}

async function handleFile(file){
  state.fileName = file.name;
  setMessage('info', `${file.name} 읽는 중...`);
  resetScene();
  try {
    const buffer = await file.arrayBuffer();
    const text = await file.text();
    const textResult = parseStepText(text, file.name);
    let occtResult = null;
    try { occtResult = await parseWithOcct(buffer); }
    catch (err) { console.warn(err); occtResult = { ok:false, error:String(err?.message||err) }; }

    state.debug = { fileName:file.name, text:textResult.debug, occt: occtResult.ok ? {ok:true, meshCount:occtResult.meshes.length, sampleMeshNames:occtResult.meshes.slice(0,20).map(m=>m.name)} : occtResult };

    if (occtResult.ok && occtResult.meshes.length > 0) {
      buildThreeMeshes(occtResult.meshes);
      state.parts = mergeTextPartsWithMeshes(textResult.parts, occtResult.meshes);
      setMessage('ok', `OCCT 3D 파싱 완료: mesh ${occtResult.meshes.length}개, 텍스트 leaf ${textResult.parts.length}종. 실제 mesh와 파트명을 최대한 매칭했습니다.`);
      $('statMode').textContent = 'OCCT+텍스트';
    } else {
      state.parts = textResult.parts;
      setMessage(textResult.parts.length ? 'warn' : 'err', textResult.parts.length ? `OCCT는 실패했지만 STEP 텍스트 파서로 leaf part ${textResult.parts.length}종을 추출했습니다.` : '파트 추출 실패. 파싱 진단을 확인하세요.');
      $('statMode').textContent = '텍스트';
      $('viewerStatus').textContent = 'OCCT mesh 파싱 실패. 파트 목록은 STEP 텍스트에서 추출했습니다.';
    }

    state.parts = state.parts.map((p, idx) => enrichPart(p, idx));
    recalcAll();
    state.selectedId = state.parts[0]?.id || null;
    renderParts(); renderSelected(); updateStats(); renderDebug(); showAllMeshes();
  } catch(err) {
    console.error(err); setMessage('err', `파일 처리 오류: ${err.message || err}`);
  }
}

async function parseWithOcct(buffer){
  if (!window.occtimportjs) throw new Error('occt-import-js 스크립트가 로드되지 않았습니다. vendor/occt 폴더를 확인하세요.');
  const occt = state.occt || await window.occtimportjs({ locateFile: (p) => `vendor/occt/${p}` });
  state.occt = occt;
  const bytes = new Uint8Array(buffer);
  const result = occt.ReadStepFile(bytes, null);
  if (!result || !Array.isArray(result.meshes)) throw new Error('OCCT ReadStepFile 결과에 meshes가 없습니다.');
  return { ok:true, result, meshes: result.meshes };
}

function resetScene(){
  state.parts = []; state.selectedId = null; state.meshObjects = []; state.meshByName.clear();
  const root = state.three.root; if(root) while(root.children.length) root.remove(root.children[0]);
  $('partsBody').innerHTML = '<tr><td colspan="10" class="empty-row">분석 중...</td></tr>';
  $('selectedPanel').innerHTML = '<h2>선택 파트 검토</h2><p class="muted">분석 중...</p>';
}

function buildThreeMeshes(meshes){
  const root = state.three.root; if(!root || !window.THREE) return;
  while(root.children.length) root.remove(root.children[0]);
  state.meshObjects = []; state.meshByName.clear();
  meshes.forEach((m, idx) => {
    try {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
      if (m.attributes.normal) geom.setAttribute('normal', new THREE.Float32BufferAttribute(m.attributes.normal.array, 3));
      geom.setIndex(new THREE.BufferAttribute(Uint32Array.from(m.index.array), 1));
      geom.computeBoundingBox(); geom.computeBoundingSphere();
      const mat = new THREE.MeshPhongMaterial({color: colorFromIndex(idx), shininess:20, transparent:false, opacity:1});
      const mesh = new THREE.Mesh(geom, mat); mesh.name = m.name || `MESH_${idx+1}`; mesh.userData.index = idx;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 30), new THREE.LineBasicMaterial({color:0x0b1220, opacity:.35, transparent:true}));
      const group = new THREE.Group(); group.name = mesh.name; group.add(mesh); group.add(edges); root.add(group);
      state.meshObjects.push({group, mesh, raw:m, name:mesh.name, norm:norm(mesh.name)});
      const n = norm(mesh.name); if(n) state.meshByName.set(n, group);
    } catch(e){ console.warn('mesh build fail', idx, e); }
  });
  fitCamera();
}
function colorFromIndex(i){ const colors=[0x92b4ff,0xffc857,0x6ee7b7,0xfca5a5,0xc4b5fd,0x93c5fd,0xfcd34d,0xa7f3d0]; return colors[i%colors.length]; }

function parseStepText(text, fileName){
  const entities = readEntities(text);
  const products = new Map(), formations = new Map(), pdMap = new Map(), links = [];
  for (const e of entities) {
    if (e.type === 'PRODUCT') {
      const strings = getStepStrings(e.args); products.set(e.id, {id:e.id, name: cleanName(strings[0] || strings[1] || e.id), strings});
    }
  }
  for (const e of entities) {
    if (e.type.startsWith('PRODUCT_DEFINITION_FORMATION')) {
      const refs = getRefs(e.args); const prodRef = refs.find(r => products.has(r));
      formations.set(e.id, {id:e.id, productId:prodRef || null, productName:prodRef ? products.get(prodRef).name : ''});
    }
  }
  for (const e of entities) {
    if (e.type === 'PRODUCT_DEFINITION') {
      const strings = getStepStrings(e.args); const refs = getRefs(e.args);
      const formRef = refs.find(r => formations.has(r)); const form = formRef ? formations.get(formRef) : null;
      const pdName = cleanName(strings.find(s => s && s.trim()) || '');
      const productName = form?.productName || (isBadName(pdName) ? '' : pdName);
      pdMap.set(e.id, {id:e.id, pdName, formationId:formRef, productId:form?.productId || null, productName});
    }
  }
  for (const e of entities) {
    if (e.type === 'NEXT_ASSEMBLY_USAGE_OCCURRENCE') {
      const refs = getRefs(e.args); const strings = getStepStrings(e.args);
      if (refs.length >= 2) {
        const occCandidate = cleanName(strings.find(s => s && !isGenericOccurrence(s)) || '');
        links.push({id:e.id, parent:refs[0], child:refs[1], occurrenceName:occCandidate, rawStrings:strings});
      }
    }
  }
  const parentSet = new Set(links.map(l=>l.parent));
  let leafLinks = links.filter(l => !parentSet.has(l.child));
  const rows = [];
  const byKey = new Map();
  for (const l of leafLinks) {
    const pd = pdMap.get(l.child);
    let name = choosePartName(pd, l.occurrenceName, l.child);
    if (isAssemblyName(name)) continue;
    const key = norm(name) || l.child;
    if (!byKey.has(key)) byKey.set(key, {id:key, name, quantity:0, pdIds:new Set(), linkIds:[], source:'PRODUCT_DEFINITION leaf'});
    const row = byKey.get(key); row.quantity += 1; row.pdIds.add(l.child); row.linkIds.push(l.id);
  }
  for (const v of byKey.values()) rows.push({...v, pdIds:[...v.pdIds]});
  if (rows.length === 0) {
    for (const [pdId, pd] of pdMap) {
      const name = choosePartName(pd, '', pdId); if (isAssemblyName(name)) continue;
      const key = norm(name) || pdId;
      if(!byKey.has(key)) byKey.set(key, {id:key,name,quantity:1,pdIds:[pdId],linkIds:[],source:'PRODUCT_DEFINITION fallback'});
    }
    rows.push(...byKey.values());
  }
  rows.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  return { parts: rows, debug:{fileName, entityCount:entities.length, productCount:products.size, productDefinitionCount:pdMap.size, linkCount:links.length, leafLinkCount:leafLinks.length, assemblyExcludedCount:parentSet.size, sampleProducts:[...products.values()].slice(0,40), samplePd:[...pdMap.values()].slice(0,40), sampleLinks:links.slice(0,40), sampleRows:rows.slice(0,50)} };
}

function readEntities(text){
  const list=[]; const re=/#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*?)\);/gi; let m;
  while((m=re.exec(text))!==null){ list.push({id:'#'+m[1], type:m[2].toUpperCase(), args:m[3]}); }
  return list;
}
function getRefs(s){ return (s.match(/#\d+/g)||[]); }
function getStepStrings(s){ const arr=[]; const re=/'((?:''|[^'])*)'/g; let m; while((m=re.exec(s))!==null) arr.push(m[1].replace(/''/g,"'")); return arr; }
function cleanName(s){ return String(s||'').replace(/^\s+|\s+$/g,'').replace(/^['"]|['"]$/g,'').replace(/\s+/g,' '); }
function isGenericOccurrence(s){ const n=String(s||'').toLowerCase(); return !n || n==='next assembly relationship' || n==='design' || n==='na'; }
function isBadName(s){ const n=String(s||'').toLowerCase(); return !n || n==='design' || n==='next assembly relationship' || n==='part' || n==='unknown'; }
function choosePartName(pd, occ, fallback){ if(occ && !isGenericOccurrence(occ)) return occ; if(pd?.productName && !isBadName(pd.productName)) return pd.productName; if(pd?.pdName && !isBadName(pd.pdName)) return pd.pdName; return fallback || 'UNNAMED_PART'; }
function isAssemblyName(name){ const n=String(name||'').toUpperCase(); return /(_ASM$|_ASSY$|ASSY_|ASSEMBLY|ASM$)/.test(n); }
function norm(s){ return String(s||'').toUpperCase().replace(/[^A-Z0-9가-힣]/g,''); }

function mergeTextPartsWithMeshes(parts, meshes){
  const meshInfo = meshes.map((m,i)=>({idx:i, name:m.name||`MESH_${i+1}`, norm:norm(m.name||'')}));
  return parts.map((p, i) => {
    const pn = norm(p.name);
    let matched = meshInfo.find(mi => mi.norm && (mi.norm.includes(pn) || pn.includes(mi.norm)));
    if (!matched && meshInfo.length === parts.length) matched = meshInfo[i];
    return {...p, meshIndex: matched?.idx ?? null, meshName: matched?.name || ''};
  });
}

function enrichPart(p, idx){
  const cls = classifyPart(p.name);
  const features = estimateFeatures(p.name, cls);
  const process = cls.process;
  return {
    ...p,
    id: p.id || `part_${idx}`,
    process,
    material: defaultMaterial(process, p.name),
    thickness: features.thickness,
    taps: features.taps,
    bends: features.bends,
    margin: getDefaultMargin(process),
    features,
    reason: cls.reason,
    confidence: cls.confidence,
    quote: 0,
    selected: false
  };
}

function classifyPart(name){
  const n = name.toUpperCase(); const reasons=[];
  if(/BOLT|SCREW|NUT|WASHER|BEARING|RIVET|REVET|SENSOR|MOTOR|VALVE|NIPPLE|PIPE|TUBE|각관|배관|피팅|FITTING|PIE/.test(n)){ reasons.push('표준 구매품 이름'); return {process:'purchase', reason:reasons.join(', '), confidence:'높음'}; }
  if(/PROFILE|AL[-_ ]?FRAME|3030|4040|4080|2020|4545|6060|8080/.test(n)){ reasons.push('프로파일/알루미늄 프레임 이름'); return {process:'profile', reason:reasons.join(', '), confidence:'높음'}; }
  if(/SHAFT|PIN|BUSH|ROLLER|COLLAR|ROD|축|핀|부싱/.test(n)){ reasons.push('회전체/축류 이름'); return {process:'lathe', reason:reasons.join(', '), confidence:'보통'}; }
  if(/BEND|BENT|FOLD|FLANGE|L[-_ ]?BRACKET|U[-_ ]?BRACKET|절곡/.test(n)){ reasons.push('절곡/플랜지 힌트'); return {process:'sheet', reason:reasons.join(', '), confidence:'높음'}; }
  if(/HOOD|COVER|PANEL|BODY|SKEL|SIDE|TOP|BRACKET|SHEET/.test(n)){ reasons.push('판금/커버류 이름. 절곡 수는 공장 확인'); return {process:'sheet', reason:reasons.join(', '), confidence:'보통'}; }
  if(/CASE|HOUSING|CAP|BOTTLE/.test(n)){ reasons.push('케이스/성형품 후보. 공장 선택 필요'); return {process:'unknown', reason:reasons.join(', '), confidence:'낮음'}; }
  if(/BASE|PLATE|BLOCK|JIG|FIXTURE|MOUNT|HOLDER|SUPPORT|ADAPTER|GUIDE|CLAMP/.test(n)){ reasons.push('가공품 이름'); return {process:'cnc', reason:reasons.join(', '), confidence:'보통'}; }
  return {process:'unknown', reason:'명확한 공법 힌트 없음. 공장이 선택', confidence:'낮음'};
}
function estimateFeatures(name, cls){
  const n = name.toUpperCase();
  const tMatch = n.match(/(\d+(?:\.\d+)?)\s*T\b|T\s*(\d+(?:\.\d+)?)/);
  let thickness = tMatch ? Number(tMatch[1]||tMatch[2]) : (cls.process==='sheet' ? 1.6 : 8);
  let bends = 0;
  if(/L[-_ ]?BRACKET|LBRACKET/.test(n)) bends=1;
  if(/U[-_ ]?BRACKET|UBRACKET/.test(n)) bends=2;
  if(/BEND|BENT|FOLD|FLANGE|절곡/.test(n)) bends=Math.max(bends,1);
  const screwM = n.match(/M(\d+)/); let taps = 0;
  if(cls.process==='cnc' && /TAP|M\d+/.test(n)) taps = 1;
  if(cls.process==='purchase') thickness = 0;
  return {thickness, bends, taps};
}
function defaultMaterial(process, name){ const n=name.toUpperCase(); if(process==='purchase') return 'SS400'; if(/SUS|STS|304/.test(n)) return 'SUS304'; if(process==='sheet') return 'SPCC'; if(process==='print3d'||process==='injection') return 'ABS'; return 'AL6061'; }
function getDefaultMargin(process){ return Number(state.rates?.process?.[process]?.margin ?? 0); }

function recalcAll(){ state.parts.forEach(p => p.quote = calcQuote(p)); updateStats(); }
function calcQuote(p){
  const q = Math.max(0, Number(p.quantity)||0); const material = state.rates.materials[p.material] || state.rates.materials.AL6061;
  const materialRate = material.market * (1 + (Number(material.markupPercent)||0)/100);
  const matCost = estimateMaterialCost(p, materialRate);
  let procCost = 0; const pr = state.rates.process[p.process] || state.rates.process.unknown;
  if(p.process==='unknown') return 0;
  if(p.process==='purchase') procCost = purchaseUnitPrice(p.name) * q;
  else if(p.process==='profile') procCost = ((pr.base||0) + 0.6*(pr.perMeter||0) + (pr.cut||0)*2 + (Number(p.taps)||0)*(pr.tap||0))*q;
  else if(p.process==='lathe') procCost = ((pr.small||0) + (Number(p.taps)||0)*(pr.tap||0))*q;
  else if(p.process==='sheet') procCost = ((pr.base||0) + (Number(p.bends)||0)*(pr.bend||0) + (Number(p.taps)||0)*(pr.tap||0))*q;
  else if(p.process==='cnc') procCost = ((pr.small||0) + (Number(p.taps)||0)*(pr.tap||0))*q;
  else if(p.process==='print3d') procCost = ((pr.perCm3||0)*80)*q;
  else if(p.process==='injection') procCost = ((pr.piece||0)*q);
  else if(p.process==='welding') procCost = ((pr.base||0))*q;
  const subtotal = matCost + procCost;
  return Math.round(subtotal * (1 + (Number(p.margin)||0)/100));
}
function estimateMaterialCost(p, materialRate){
  if(p.process==='purchase' || p.process==='unknown') return 0;
  const q=Number(p.quantity)||0; const t=Number(p.thickness)||1;
  let kg = 0.05;
  if(p.process==='sheet') kg = Math.max(0.05, t * 0.18);
  else if(p.process==='profile') kg = 0.5;
  else if(p.process==='cnc') kg = Math.max(0.08, t * 0.12);
  else if(p.process==='lathe') kg = 0.18;
  else if(p.process==='print3d') kg = 0.08;
  else if(p.process==='injection') kg = 0.03;
  return Math.round(kg * q * materialRate);
}
function purchaseUnitPrice(name){ const n=name.toUpperCase(); if(/SCREW/.test(n)) return 70; if(/BOLT/.test(n)) return 120; if(/NUT/.test(n)) return 50; if(/RIVET|REVET/.test(n)) return 60; if(/BEARING/.test(n)) return 2500; if(/NIPPLE|PIPE|TUBE|PIE/.test(n)) return 2500; return 1000; }

function renderParts(){
  const body=$('partsBody');
  if(!state.parts.length){ body.innerHTML='<tr><td colspan="10" class="empty-row">분석된 말단 파트가 없습니다.</td></tr>'; return; }
  body.innerHTML = state.parts.map(p => `
    <tr data-id="${esc(p.id)}" class="${p.id===state.selectedId?'active':''}">
      <td><div class="part-name">${esc(p.name)}</div><div class="hint">${esc(p.source||'leaf')} ${p.meshName?`/ mesh: ${esc(p.meshName)}`:''}</div></td>
      <td><input data-field="quantity" data-id="${esc(p.id)}" type="number" min="0" value="${p.quantity}"></td>
      <td><span class="badge">${esc(PROCESS_LABELS[p.process]||p.process)}</span><div class="hint">${esc(p.reason)} / 신뢰도 ${esc(p.confidence)}</div></td>
      <td>${selectHtml(p,'process',PROCESSES.map(x=>[x,PROCESS_LABELS[x]]))}</td>
      <td>${selectHtml(p,'material',MATERIALS.map(x=>[x,x]))}</td>
      <td><input data-field="thickness" data-id="${esc(p.id)}" type="number" min="0" step="0.1" value="${p.thickness}"></td>
      <td><input data-field="taps" data-id="${esc(p.id)}" type="number" min="0" value="${p.taps}"></td>
      <td><input data-field="bends" data-id="${esc(p.id)}" type="number" min="0" value="${p.bends}"></td>
      <td><input data-field="margin" data-id="${esc(p.id)}" type="number" min="0" value="${p.margin}"></td>
      <td class="money">${won(p.quote)}</td>
    </tr>`).join('');
  body.querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', e => { if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return; selectPart(tr.dataset.id); }));
  body.querySelectorAll('input,select').forEach(el => el.addEventListener('change', onPartEdit));
}
function selectHtml(p, field, opts){ return `<select data-field="${field}" data-id="${esc(p.id)}">${opts.map(([v,l])=>`<option value="${esc(v)}" ${p[field]===v?'selected':''}>${esc(l)}</option>`).join('')}</select>`; }
function onPartEdit(e){ const p=state.parts.find(x=>x.id===e.target.dataset.id); if(!p) return; const f=e.target.dataset.field; let val=e.target.value; if(['quantity','thickness','taps','bends','margin'].includes(f)) val=Number(val)||0; p[f]=val; if(f==='process') p.margin=getDefaultMargin(val); p.quote=calcQuote(p); renderParts(); renderSelected(); updateStats(); isolateSelectedMesh(p); }
function selectPart(id){ state.selectedId=id; renderParts(); renderSelected(); const p=state.parts.find(x=>x.id===id); if(p) isolateSelectedMesh(p); }
function renderSelected(){
  const p=state.parts.find(x=>x.id===state.selectedId); const panel=$('selectedPanel');
  if(!p){ panel.innerHTML='<h2>선택 파트 검토</h2><p class="muted">파트를 선택하세요.</p>'; return; }
  panel.innerHTML = `<h2>선택 파트 검토</h2><h3>${esc(p.name)}</h3><div class="preview-box">${esc(PROCESS_LABELS[p.process]||p.process)}</div>
    <div><span class="badge">${esc(PROCESS_LABELS[p.process]||p.process)}</span> <span class="badge">${esc(p.material)}</span> <span class="badge">수량 ${p.quantity}</span></div>
    <p class="mini">${esc(p.reason)}<br>두께 ${p.thickness}T / 탭 ${p.taps} / 절곡 ${p.bends}<br>${p.meshName?'mesh: '+esc(p.meshName):'mesh 매칭 없음'}</p>
    <div class="selected-money">파트 견적 ${won(p.quote)}</div>`;
}
function isolateSelectedMesh(p){
  if(!state.meshObjects.length) return;
  let target = null;
  if(p.meshIndex != null) target = state.meshObjects[p.meshIndex]?.group;
  if(!target){ const pn=norm(p.name); const obj=state.meshObjects.find(mi=>mi.norm && (mi.norm.includes(pn)||pn.includes(mi.norm))); target = obj?.group || null; }
  if(target){ state.meshObjects.forEach(o=>o.group.visible = o.group===target); fitCamera(target); }
  else showAllMeshes();
}
function showAllMeshes(){ state.meshObjects.forEach(o=>o.group.visible=true); fitCamera(); }

function fitCamera(object){
  const root = object || state.three.root; if(!root || !state.three.camera) return;
  const box = new THREE.Box3().setFromObject(root); if(!isFinite(box.min.x) || box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x,size.y,size.z) || 100; const dist = maxDim * 2.2;
  const cam = state.three.camera; cam.position.set(center.x+dist, center.y+dist, center.z+dist*0.75); cam.near = Math.max(0.1, dist/1000); cam.far = dist*20; cam.lookAt(center); cam.updateProjectionMatrix();
  if(state.three.controls){ state.three.controls.target.copy(center); state.three.controls.update(); }
}

function renderRateEditors(){
  $('marginEditor').innerHTML = Object.entries(state.rates.process).map(([k,v])=>`<label class="rate-row"><span>${esc(PROCESS_LABELS[k]||k)}</span><input data-rate="process" data-key="${k}" data-field="margin" type="number" value="${v.margin||0}"></label>`).join('');
  $('materialEditor').innerHTML = Object.entries(state.rates.materials).map(([k,v])=>`<label class="rate-row"><span>${esc(k)} 시세/kg</span><input data-rate="material" data-key="${k}" data-field="market" type="number" value="${v.market||0}"></label><label class="rate-row"><span>${esc(k)} 할증%</span><input data-rate="material" data-key="${k}" data-field="markupPercent" type="number" value="${v.markupPercent||0}"></label>`).join('');
  document.querySelectorAll('[data-rate]').forEach(inp => inp.addEventListener('change', e => { const {rate,key,field}=e.target.dataset; if(rate==='process') state.rates.process[key][field]=Number(e.target.value)||0; else state.rates.materials[key][field]=Number(e.target.value)||0; recalcAll(); renderParts(); renderSelected(); }));
}
function updateStats(){ $('statParts').textContent=state.parts.length; $('statAssemblies').textContent=state.debug?.text?.assemblyExcludedCount||0; $('statEntities').textContent=state.debug?.text?.entityCount||0; $('statMeshes').textContent=state.meshObjects.length; $('statTotal').textContent=won(state.parts.reduce((a,p)=>a+(p.quote||0),0)); }
function renderDebug(){ $('debugPre').textContent = JSON.stringify(state.debug,null,2); }
function setMessage(type, text){ const m=$('message'); m.className=`message ${type}`; m.textContent=text; }
function exportCsv(){ const rows=[['파트명','수량','공법','재질','두께','탭','절곡','마진','견적']].concat(state.parts.map(p=>[p.name,p.quantity,PROCESS_LABELS[p.process],p.material,p.thickness,p.taps,p.bends,p.margin,p.quote])); const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'); const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='step_quote_parts.csv'; a.click(); URL.revokeObjectURL(a.href); }
function esc(v){ return String(v??'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function won(v){ return `${Math.round(Number(v)||0).toLocaleString('ko-KR')}원`; }
