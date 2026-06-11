const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat('ko-KR');
const PROCESS_LABELS = {purchase:'구매품', sheet:'판금/절곡', cnc:'CNC/MCT', lathe:'선반', injection:'사출', print3d:'3D프린팅', profile:'압출/프로파일', unknown:'분류 필요'};
const MATERIALS = ["AL6061", "AL5052", "AL7075", "SUS304", "SUS316", "SUS430", "SS400", "S45C", "SCM440", "SKD11", "SPCC", "SPHC", "SECC", "SGCC", "C3604", "C1100", "ABS", "POM", "PC", "PP", "PE", "PA66", "MC_NYLON", "PLA", "PETG", "TPU", "PEEK"];
const PROCESSES = ['purchase','sheet','cnc','lathe','injection','print3d','profile','unknown'];
const state = {rates:null, rules:null, fileName:'', assemblyName:'-', parts:[], selectedId:null, occt:null, debug:{}, meshObjects:[], meshByNorm:new Map(), three:{}, manualCounter:1};
const DEFAULT_RATES = {
  materials:{
      "AL6061": {
          "density": 2.7,
          "sheet": 6900,
          "cnc": 7200,
          "injection": 7200,
          "print3d": 8500,
          "profile": 7600
      },
      "AL5052": {
          "density": 2.68,
          "sheet": 6500,
          "cnc": 6900,
          "injection": 0,
          "print3d": 8200,
          "profile": 7200
      },
      "AL7075": {
          "density": 2.81,
          "sheet": 9800,
          "cnc": 10500,
          "injection": 0,
          "print3d": 0,
          "profile": 10800
      },
      "SUS304": {
          "density": 7.93,
          "sheet": 6100,
          "cnc": 6500,
          "injection": 0,
          "print3d": 0,
          "profile": 6500
      },
      "SUS316": {
          "density": 7.98,
          "sheet": 8400,
          "cnc": 9000,
          "injection": 0,
          "print3d": 0,
          "profile": 9000
      },
      "SUS430": {
          "density": 7.7,
          "sheet": 4300,
          "cnc": 4700,
          "injection": 0,
          "print3d": 0,
          "profile": 4700
      },
      "SS400": {
          "density": 7.85,
          "sheet": 1650,
          "cnc": 1800,
          "injection": 0,
          "print3d": 0,
          "profile": 1800
      },
      "S45C": {
          "density": 7.85,
          "sheet": 0,
          "cnc": 2200,
          "injection": 0,
          "print3d": 0,
          "profile": 2200
      },
      "SCM440": {
          "density": 7.85,
          "sheet": 0,
          "cnc": 3300,
          "injection": 0,
          "print3d": 0,
          "profile": 3300
      },
      "SKD11": {
          "density": 7.7,
          "sheet": 0,
          "cnc": 9500,
          "injection": 0,
          "print3d": 0,
          "profile": 0
      },
      "SPCC": {
          "density": 7.85,
          "sheet": 1600,
          "cnc": 1750,
          "injection": 0,
          "print3d": 0,
          "profile": 1750
      },
      "SPHC": {
          "density": 7.85,
          "sheet": 1550,
          "cnc": 1700,
          "injection": 0,
          "print3d": 0,
          "profile": 1700
      },
      "SECC": {
          "density": 7.85,
          "sheet": 1900,
          "cnc": 2050,
          "injection": 0,
          "print3d": 0,
          "profile": 2050
      },
      "SGCC": {
          "density": 7.85,
          "sheet": 2000,
          "cnc": 2150,
          "injection": 0,
          "print3d": 0,
          "profile": 2150
      },
      "C3604": {
          "density": 8.5,
          "sheet": 0,
          "cnc": 9800,
          "injection": 0,
          "print3d": 0,
          "profile": 9800
      },
      "C1100": {
          "density": 8.96,
          "sheet": 11000,
          "cnc": 11500,
          "injection": 0,
          "print3d": 0,
          "profile": 11500
      },
      "ABS": {
          "density": 1.04,
          "sheet": 0,
          "cnc": 4500,
          "injection": 3800,
          "print3d": 8500,
          "profile": 0
      },
      "POM": {
          "density": 1.41,
          "sheet": 0,
          "cnc": 9200,
          "injection": 8500,
          "print3d": 12000,
          "profile": 0
      },
      "PC": {
          "density": 1.2,
          "sheet": 0,
          "cnc": 6200,
          "injection": 5800,
          "print3d": 13000,
          "profile": 0
      },
      "PP": {
          "density": 0.9,
          "sheet": 0,
          "cnc": 3200,
          "injection": 2700,
          "print3d": 0,
          "profile": 0
      },
      "PE": {
          "density": 0.95,
          "sheet": 0,
          "cnc": 3500,
          "injection": 2900,
          "print3d": 0,
          "profile": 0
      },
      "PA66": {
          "density": 1.14,
          "sheet": 0,
          "cnc": 6800,
          "injection": 6200,
          "print3d": 11000,
          "profile": 0
      },
      "MC_NYLON": {
          "density": 1.16,
          "sheet": 0,
          "cnc": 7800,
          "injection": 0,
          "print3d": 0,
          "profile": 0
      },
      "PLA": {
          "density": 1.24,
          "sheet": 0,
          "cnc": 0,
          "injection": 0,
          "print3d": 5500,
          "profile": 0
      },
      "PETG": {
          "density": 1.27,
          "sheet": 0,
          "cnc": 0,
          "injection": 0,
          "print3d": 7200,
          "profile": 0
      },
      "TPU": {
          "density": 1.2,
          "sheet": 0,
          "cnc": 0,
          "injection": 0,
          "print3d": 9500,
          "profile": 0
      },
      "PEEK": {
          "density": 1.31,
          "sheet": 0,
          "cnc": 65000,
          "injection": 58000,
          "print3d": 90000,
          "profile": 0
      }
  },
  process:{
    sheet:{bendUnit:3000,margin:18},
    cnc:{hourly:65000,setup:50000,margin:22},
    lathe:{hourly:55000,setup:30000,margin:20},
    injection:{hourly:45000,setup:0,margin:20},
    print3d:{hourly:15000,setup:5000,margin:28},
    profile:{processPerEa:2000,margin:15},
    purchase:{margin:10},
    unknown:{margin:0}
  }
};
window.addEventListener('DOMContentLoaded', async () => {
  await loadRates();
  initUpload();
  initViewer();
  bindActions();
  renderRateEditors();
  updateStats();
});

async function loadRates(){
  try{
    const saved = localStorage.getItem('factoryStepRates');
    if(saved) state.rates = JSON.parse(saved);
  }catch{}
  if(!state.rates){
    try{ const r = await fetch('data/rates.json'); state.rates = r.ok ? await r.json() : structuredClone(DEFAULT_RATES); }
    catch{ state.rates = structuredClone(DEFAULT_RATES); }
  }
  mergeDefaults(state.rates, DEFAULT_RATES);
  try{
    const rr = await fetch('data/process_rules_core.json');
    if(rr.ok) state.rules = await rr.json();
  }catch(e){ state.rules = null; }
}
function mergeDefaults(obj, def){ for(const k in def){ if(obj[k]===undefined) obj[k]=structuredClone(def[k]); else if(def[k] && typeof def[k]==='object' && !Array.isArray(def[k])) mergeDefaults(obj[k], def[k]); } }

function initUpload(){
  const input=$('stepFile'), btn=$('selectFileBtn'), dz=$('dropZone');
  btn.addEventListener('click',()=>input.click()); dz.addEventListener('click',()=>input.click());
  input.addEventListener('change', e=>{ const f=e.target.files?.[0]; if(f) handleFile(f); });
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault(); dz.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault(); dz.classList.remove('drag');}));
  dz.addEventListener('drop',e=>{ const f=e.dataTransfer.files?.[0]; if(f) handleFile(f); });
}
function bindActions(){
  $('recalcBtn').addEventListener('click',()=>{ recalcAll(); renderParts(); renderSelected(); });
  $('exportCsvBtn').addEventListener('click', exportCsv);
  $('addPartBtn')?.addEventListener('click', addManualPart);
  $('deleteSelectedBtn')?.addEventListener('click', () => deletePart(state.selectedId));
  $('fitBtn').addEventListener('click', fitCamera);
  $('saveRatesBtn').addEventListener('click', saveRatesToBrowser);
  $('downloadRatesBtn').addEventListener('click', downloadRates);
  $('loadRatesBtn').addEventListener('click', ()=>$('ratesFile').click());
  $('ratesFile').addEventListener('change', importRatesFile);
  $('copyRatesBtn').addEventListener('click', copyRates);
  $('pasteRatesBtn').addEventListener('click', pasteRates);
}

function setMessage(type,msg){ const el=$('message'); el.className='message '+(type||''); el.textContent=msg; }
function won(n){ return nf.format(Math.round(Number(n)||0))+'원'; }
function num(v,d=0){ const n=Number(v); return Number.isFinite(n)?n:d; }
function norm(s){ return String(s||'').toUpperCase().replace(/[^A-Z0-9가-힣]/g,''); }
function cleanName(s){ return String(s||'').replace(/^['"]|['"]$/g,'').trim(); }
function isBadName(name){ const n=String(name||'').trim(); const nn=norm(n); return !n || /^#?\d+$/.test(n) || /^MESH[_-]?\d+$/i.test(n) || /^MESH\d+$/i.test(nn) || /^PRODUCT_DEFINITION/i.test(n) || /^NEXT ASSEMBLY RELATIONSHIP$/i.test(n) || /^DESIGN$/i.test(n); }
function isAssemblyName(name){ return /(^|[_-])(ASSY|ASM|ASSEMBLY)([_-]|$)/i.test(name); }

function initViewer(){
  const c=$('viewer'); if(!window.THREE){ c.innerHTML='<div class="empty-view">3D 라이브러리 로딩 실패</div>'; return; }
  c.innerHTML=''; const w=c.clientWidth||900, h=c.clientHeight||430;
  const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setSize(w,h); renderer.setPixelRatio(Math.min(devicePixelRatio||1,2)); renderer.setClearColor(0x0f172a,1); c.appendChild(renderer.domElement);
  const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(45,w/h,.1,100000); camera.position.set(240,320,240); camera.up.set(0,0,1);
  scene.add(new THREE.HemisphereLight(0xffffff,0x223344,1.2)); const dl=new THREE.DirectionalLight(0xffffff,.85); dl.position.set(200,350,500); scene.add(dl);
  const root=new THREE.Group(); scene.add(root);
  const controls=THREE.OrbitControls?new THREE.OrbitControls(camera,renderer.domElement):null; if(controls){controls.enableDamping=true; controls.dampingFactor=.08;}
  state.three={scene,camera,renderer,controls,root};
  (function loop(){requestAnimationFrame(loop); controls?.update(); renderer.render(scene,camera);})();
  addEventListener('resize',()=>{ const ww=c.clientWidth||900, hh=c.clientHeight||430; renderer.setSize(ww,hh); camera.aspect=ww/hh; camera.updateProjectionMatrix(); });
}
function resetScene(){ const root=state.three.root; if(root) while(root.children.length) root.remove(root.children[0]); state.meshObjects=[]; state.meshByNorm.clear(); }
function buildThreeMeshes(meshes){
  resetScene(); const root=state.three.root; if(!root||!window.THREE) return;
  meshes.forEach((m,idx)=>{
    try{
      const pos=m.attributes?.position?.array, ind=m.index?.array; if(!pos||!ind) return;
      const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); if(m.attributes.normal) g.setAttribute('normal', new THREE.Float32BufferAttribute(m.attributes.normal.array,3)); g.setIndex(new THREE.BufferAttribute(Uint32Array.from(ind),1)); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
      const mat=new THREE.MeshPhongMaterial({color:color(idx),shininess:20}); const mesh=new THREE.Mesh(g,mat); mesh.name=m.name||`MESH_${idx+1}`;
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(g,28),new THREE.LineBasicMaterial({color:0x0b1220,transparent:true,opacity:.38}));
      const group=new THREE.Group(); group.name=mesh.name; group.visible=false; group.add(mesh); group.add(edges); root.add(group);
      const metrics=computeMeshMetrics(m,g);
      state.meshObjects.push({group,mesh,raw:m,name:mesh.name,norm:norm(mesh.name),metrics});
      if(norm(mesh.name)) state.meshByNorm.set(norm(mesh.name), group);
    }catch(e){ console.warn('mesh build fail', e); }
  });
}
function color(i){return [0x92b4ff,0x9cf6d0,0xffd166,0xffaaa5,0xc4b5fd,0x93c5fd,0xfcd34d,0xa7f3d0][i%8];}
function clearFocusClone(){
  const root = state.three.root;
  if(state.focusClone && root){
    root.remove(state.focusClone);
    state.focusClone.traverse(o=>{
      if(o.geometry && o.geometry.dispose) o.geometry.dispose();
      if(o.material && o.material.dispose) o.material.dispose();
    });
  }
  state.focusClone = null;
}
function showAllMeshes(){
  clearFocusClone();
  state.meshObjects.forEach(o=>o.group.visible=false);
  // 어셈블리 전체보기는 서비스 화면에서 쓰지 않는다. 첫 파트만 크게 표시.
  const first = state.parts.find(p=>p.meshIndex!=null) || state.parts[0];
  if(first) showPart(first);
}
function hideAllMeshes(){
  clearFocusClone();
  state.meshObjects.forEach(o=>o.group.visible=false);
}
function meshGroupForPart(part){
  if(!part) return null;
  if(part.meshIndex!=null && state.meshObjects[part.meshIndex]) return state.meshObjects[part.meshIndex].group;
  if(part.meshNorm){
    const g=state.meshByNorm.get(part.meshNorm);
    if(g) return g;
  }
  const pn=norm(part.meshName || part.name);
  if(pn){
    // 1) 정확/부분 이름 매칭
    for(const o of state.meshObjects){
      if(!isNumberishMesh(o.name) && (o.norm===pn || o.norm.includes(pn) || pn.includes(o.norm))) return o.group;
    }
    // 2) 숫자 토큰 매칭
    const pNums=numberTokens(part.name);
    if(pNums.length){
      for(const o of state.meshObjects){
        const mNums=numberTokens(o.name);
        if(mNums.some(x=>pNums.includes(x))) return o.group;
      }
    }
  }
  // 3) 사전에 할당한 fallback mesh
  if(part.fallbackMeshIndex!=null && state.meshObjects[part.fallbackMeshIndex]) return state.meshObjects[part.fallbackMeshIndex].group;
  // 4) 행 순서 기반 fallback: 구매품이라도 STEP에 형상이 있으면 일단 보여준다.
  const rowIndex=state.parts.findIndex(x=>x.id===part.id);
  if(rowIndex>=0 && state.meshObjects[rowIndex]) return state.meshObjects[rowIndex].group;
  return null;
}
function makeFocusedClone(srcGroup, part){
  const clone = srcGroup.clone(true);
  clone.name = 'focus_' + (part?.name || srcGroup.name || 'part');
  clone.visible = true;
  clone.traverse(o=>{
    o.visible = true;
    if(o.isMesh){
      o.material = new THREE.MeshPhongMaterial({color:0x9be7ff, shininess:28, side:THREE.DoubleSide});
      if(o.geometry && !o.geometry.boundingBox) o.geometry.computeBoundingBox();
    }
    if(o.isLineSegments){
      o.material = new THREE.LineBasicMaterial({color:0x06111f, transparent:true, opacity:.55});
    }
  });
  clone.updateWorldMatrix(true,true);
  const box = new THREE.Box3().setFromObject(clone);
  if(Number.isFinite(box.min.x)){
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const target = 180; // 볼트/너트 같은 소형 구매품도 항상 화면에 크게 보이게 정규화
    const scale = target / maxDim;
    // STEP 원좌표가 어셈블리 위치 기준이어도, 선택 파트는 원점 중심으로 옮겨서 크게 보여준다.
    clone.position.x -= center.x;
    clone.position.y -= center.y;
    clone.position.z -= center.z;
    clone.scale.setScalar(scale);
    clone.userData.normalizedScale = scale;
  }
  return clone;
}
function showPart(part){
  clearFocusClone();
  state.meshObjects.forEach(o=>o.group.visible=false);
  const root = state.three.root;
  if(!part || !root) return;
  const src = meshGroupForPart(part);
  if(src){
    const focus = makeFocusedClone(src, part);
    state.focusClone = focus;
    root.add(focus);
    fitCamera(true);
    return;
  }
  // 정말 mesh가 없을 때만 단순 프록시를 보여준다. 견적표에는 남겨서 단가 입력 가능.
  if(window.THREE){
    const geom=new THREE.BoxGeometry(90,50,30);
    const mat=new THREE.MeshPhongMaterial({color:0x9ca3af,shininess:10});
    const proxy=new THREE.Group();
    proxy.name='proxy-'+part.name;
    proxy.add(new THREE.Mesh(geom,mat));
    proxy.visible=true;
    state.focusClone=proxy;
    root.add(proxy);
    fitCamera(true);
  }
}
function numberTokens(s){
  return (String(s||'').match(/\d+/g)||[]).map(x=>String(Number(x))).filter(x=>x && x!=='NaN');
}
function visibleSceneBox(root){
  const box=new THREE.Box3();
  let has=false;
  if(!root) return {box,has};
  root.updateWorldMatrix(true,true);
  root.traverse(o=>{
    if(!o.visible || !o.isMesh || !o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(Number.isFinite(b.min.x)){ box.union(b); has=true; }
  });
  return {box,has};
}
function fitCamera(visibleOnly=false){
  const {root,camera,controls}=state.three; if(!root||!camera||!window.THREE)return;
  let box, has;
  if(visibleOnly) ({box,has}=visibleSceneBox(root));
  else { box=new THREE.Box3().setFromObject(root); has=Number.isFinite(box.min.x); }
  if(!has || !Number.isFinite(box.min.x)) return;
  const size=new THREE.Vector3(); box.getSize(size);
  const center=new THREE.Vector3(); box.getCenter(center);
  const maxDim=Math.max(size.x,size.y,size.z,1);
  const fov = camera.fov * Math.PI / 180;
  const dist = Math.max((maxDim/2) / Math.tan(fov/2) * 1.45, 20);
  camera.position.set(center.x+dist, center.y+dist*.72, center.z+dist*.58);
  camera.near=Math.max(maxDim/5000,0.01);
  camera.far=Math.max(maxDim*80,2000);
  camera.updateProjectionMatrix();
  if(controls){ controls.target.copy(center); controls.update(); }
}


async function handleFile(file){
  state.fileName=file.name; state.parts=[]; state.selectedId=null; resetScene();
  setMessage('','파일 분석 중입니다...'); $('partsBody').innerHTML='<tr><td colspan="8" class="empty-row">분석 중...</td></tr>';
  try{
    const buffer=await file.arrayBuffer(); const text=await file.text(); const textInfo=parseStepText(text,file.name);
    let occt={ok:false,meshes:[],error:''};
    try{ occt=await parseWithOcct(buffer); buildThreeMeshes(occt.meshes); } catch(e){ occt={ok:false,meshes:[],error:e.message||String(e)}; }
    const parts=makeParts(textInfo, occt.meshes||[]);
    state.assemblyName=textInfo.assemblyName || baseFileName(file.name);
    state.parts=parts.map((p,i)=>initPart(p,i)).filter(Boolean);
    if(!state.parts.length) setMessage('err','파트를 찾지 못했습니다. 파싱 진단을 확인하세요.'); else setMessage('ok',`분석 완료: 파트 ${state.parts.length}종을 불러왔습니다.`);
    state.selectedId=state.parts[0]?.id||null; recalcAll(); renderParts(); renderSelected(); updateStats(); renderDebug({textInfo,occt}); if(state.selectedId){ showPart(state.parts[0]); } else { hideAllMeshes(); }
  }catch(e){ console.error(e); setMessage('err','파일 처리 오류: '+(e.message||e)); }
}
async function parseWithOcct(buffer){
  if(!window.occtimportjs) throw new Error('OCCT 로딩 실패');
  const occt=state.occt || await window.occtimportjs({locateFile:p=>`vendor/occt/${p}`}); state.occt=occt;
  const result=occt.ReadStepFile(new Uint8Array(buffer), null); if(!result?.meshes) throw new Error('OCCT mesh 결과 없음');
  return {ok:true,meshes:result.meshes,result};
}

function parseStepText(text,fileName){
  const entityCount=(text.match(/#[0-9]+\s*=/g)||[]).length;
  const records=[]; const re=/#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*?)\)\s*;/gi; let m;
  while((m=re.exec(text))){ records.push({id:'#'+m[1],num:+m[1],type:m[2].toUpperCase(),args:splitArgs(m[3]),raw:m[0]}); }
  const byId=new Map(records.map(r=>[r.id,r]));
  const products=new Map(); const formations=new Map(); const pdefs=new Map(); const links=[];
  for(const r of records){
    if(r.type==='PRODUCT') products.set(r.id, cleanName(firstString(r.args))||`PRODUCT_${r.num}`);
  }
  for(const r of records){
    if(r.type.startsWith('PRODUCT_DEFINITION_FORMATION')){ const prodRef=r.args.find(a=>products.has(ref(a))); if(prodRef) formations.set(r.id, ref(prodRef)); }
  }
  for(const r of records){
    if(r.type==='PRODUCT_DEFINITION'){
      const formRef=r.args.find(a=>formations.has(ref(a))); let name=''; if(formRef) name=products.get(formations.get(ref(formRef)))||'';
      if(!name) name=nearestPreviousProduct(records,r.num,products);
      pdefs.set(r.id,{id:r.id,name:cleanName(name)||`#${r.num}`});
    }
  }
  for(const r of records){
    if(r.type==='NEXT_ASSEMBLY_USAGE_OCCURRENCE'){
      const refs=r.args.map(a=>ref(a)).filter(Boolean).filter(x=>pdefs.has(x));
      if(refs.length>=2) links.push({id:r.id,parent:refs[0],child:refs[1],occ:firstString(r.args)});
    }
  }
  const parentSet=new Set(links.map(l=>l.parent)); const childSet=new Set(links.map(l=>l.child));
  const leafPds=[...childSet].filter(id=>!parentSet.has(id));
  const assemblyPds=[...parentSet];
  const rootPd=[...parentSet].find(id=>!childSet.has(id));
  let assemblyName=rootPd?pdefs.get(rootPd)?.name:''; if(!assemblyName||isBadName(assemblyName)) assemblyName=guessAssemblyName([...products.values()],fileName);
  const rows=[];
  for(const pdId of leafPds){ const pd=pdefs.get(pdId); if(!pd) continue; const name=pd.name; if(isBadName(name)||isAssemblyName(name)) continue; rows.push({name, qty: links.filter(l=>l.child===pdId).length||1, source:'STEP product'}); }
  if(!rows.length){
    for(const [id,pd] of pdefs){ if(!parentSet.has(id)&&!isAssemblyName(pd.name)&&!isBadName(pd.name)) rows.push({name:pd.name,qty:1,source:'PRODUCT_DEFINITION fallback'}); }
  }
  const grouped=groupByName(rows);
  return {entityCount, productCount:products.size, productDefinitionCount:pdefs.size, linkCount:links.length, assemblyExcludedCount:assemblyPds.length, assemblyName, parts:grouped, samples:{products:[...products.values()].slice(0,40), links:links.slice(0,20), leaves:grouped.slice(0,40)}};
}
function splitArgs(s){ const out=[]; let cur='',q=false,depth=0; for(let i=0;i<s.length;i++){ const c=s[i]; if(c==="'"&&s[i-1]!=="\\") q=!q; if(!q){ if(c==='(')depth++; if(c===')')depth--; if(c===','&&depth===0){out.push(cur.trim()); cur=''; continue;} } cur+=c; } if(cur.trim())out.push(cur.trim()); return out; }
function firstString(args){ const a=args.find(x=>/^\s*'/.test(x)); return a?cleanName(a.replace(/^\s*'/,'').replace(/'\s*$/,'')):''; }
function ref(a){ const m=String(a||'').match(/#\d+/); return m?m[0]:''; }
function nearestPreviousProduct(records,num,products){ let best=''; for(const r of records){ if(r.num<num && products.has(r.id)) best=products.get(r.id); if(r.num>=num) break; } return best; }
function guessAssemblyName(names,fileName){ return names.find(isAssemblyName)||baseFileName(fileName); }
function baseFileName(n){ return String(n||'').replace(/\.[^.]+$/,''); }
function groupByName(rows){ const map=new Map(); for(const r of rows){ const key=norm(r.name); if(!key||isBadName(r.name)) continue; if(!map.has(key)) map.set(key,{...r, qty:0}); map.get(key).qty += Math.max(1,num(r.qty,1)); } return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name)); }

function makeParts(textInfo, meshes){
  // 견적표는 STEP 텍스트에서 얻은 실제 말단 PRODUCT만 사용한다.
  // 3D mesh는 표시용으로 최대한 매칭한다. 정확 매칭이 안 되면 순서/번호 기반으로 추정 매칭해서, 파트 클릭 시 형상을 보여준다.
  const meshList=state.meshObjects.map((o,i)=>({name:o.name||`MESH_${i+1}`, norm:o.norm||norm(o.name||''), metrics:o.metrics, index:i}));
  const usableMeshes=meshList.filter(m=>!isAssemblyName(m.name));
  const raw=[];
  for(const p of textInfo.parts){
    if(isBadName(p.name) || isAssemblyName(p.name)) continue;
    const mesh=bestMeshForPart(p.name, usableMeshes, new Set());
    raw.push({...p, meshName:mesh?.name||'', meshNorm:mesh?.norm||'', metrics:mesh?.metrics||null, meshIndex:mesh?.index, matchType:mesh?'name':''});
  }
  // 텍스트 파트명이 없을 때만 mesh 자체를 파트로 쓴다.
  if(!raw.length){
    for(const m of usableMeshes){
      if(isBadName(m.name) || isAssemblyName(m.name)) continue;
      raw.push({name:m.name, qty:1, source:'3D mesh', meshName:m.name, meshNorm:m.norm, metrics:m.metrics, meshIndex:m.index, matchType:'mesh'});
    }
  }
  const grouped=new Map();
  for(const r of raw){
    const key=dedupeKey(r.name);
    if(!key) continue;
    if(!grouped.has(key)) grouped.set(key,{...r, qty:0});
    const g=grouped.get(key);
    g.qty += Math.max(1,num(r.qty,1));
    if(!g.meshName && r.meshName){ g.meshName=r.meshName; g.meshNorm=r.meshNorm; g.metrics=r.metrics; g.meshIndex=r.meshIndex; g.matchType=r.matchType; }
  }
  const arr=[...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name));
  assignFallbackMeshes(arr, usableMeshes);
  return arr;
}
function bestMeshForPart(name, meshes, used){
  const pn=norm(name); if(!pn) return null;
  let c=meshes.find(m=>!used.has(m.index) && m.norm===pn); if(c) return c;
  c=meshes.find(m=>!used.has(m.index) && !isNumberishMesh(m.name) && pn.length>3 && (m.norm.includes(pn)||pn.includes(m.norm))); if(c) return c;
  const pNums=numberTokens(name);
  if(pNums.length){
    c=meshes.find(m=>!used.has(m.index) && numberTokens(m.name).some(x=>pNums.includes(x))); if(c) return c;
  }
  const toks=wordTokens(name).filter(t=>t.length>=3);
  if(toks.length){
    c=meshes.map(m=>({m,score:toks.reduce((s,t)=>s+(m.norm.includes(norm(t))?1:0),0)})).filter(x=>!used.has(x.m.index)&&x.score>0).sort((a,b)=>b.score-a.score)[0]?.m;
    if(c) return c;
  }
  return null;
}
function assignFallbackMeshes(parts, meshes){
  const used=new Set(parts.filter(p=>p.meshIndex!=null).map(p=>p.meshIndex));
  let cursor=0;
  for(const p of parts){
    if(p.meshIndex!=null) continue;
    let m=bestMeshForPart(p.name, meshes, used);
    if(!m){
      while(cursor<meshes.length && used.has(meshes[cursor].index)) cursor++;
      m=meshes[cursor] || null;
    }
    if(m){ p.meshName=m.name; p.meshNorm=m.norm; p.metrics=m.metrics; p.meshIndex=m.index; p.matchType='추정'; used.add(m.index); cursor++; }
  }
}
function wordTokens(s){ return String(s||'').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean); }

function dedupeKey(name){
  const n=norm(name);
  if(!n || /^MESH\d+$/.test(n) || /^PRODUCTDEFINITION/.test(n) || n==='DESIGN') return '';
  return n;
}
function findMeshMetrics(name){ const n=norm(name); return state.meshObjects.find(o=>o.norm===n)?.metrics || null; }
function isNumberishMesh(name){ const n=norm(name); return /^#?\d+$/.test(String(name).trim()) || /^MESH[_-]?\d+$/i.test(String(name).trim()) || /^MESH\d+$/.test(n); }

function computeMeshMetrics(raw, geom){
  const pos=raw.attributes?.position?.array||[], idx=raw.index?.array||[]; const m={dims:[0,0,0],minDim:0,midDim:0,maxDim:0,bboxVolume:0,volume:0,area:0,solidness:0,flatness:0,slenderness:0,cylinderLike:false,sheetLike:false,holeScore:0,bendSignal:0};
  try{
    let min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity]; for(let i=0;i<pos.length;i+=3){ for(let k=0;k<3;k++){ const v=pos[i+k]; if(v<min[k])min[k]=v; if(v>max[k])max[k]=v; } }
    const d=[max[0]-min[0],max[1]-min[1],max[2]-min[2]].map(v=>Math.max(0,v)); const s=[...d].sort((a,b)=>a-b); Object.assign(m,{dims:d,minDim:s[0]||0,midDim:s[1]||0,maxDim:s[2]||0,bboxVolume:d[0]*d[1]*d[2]});
    let area=0, vol=0; const normals=new Map(); const tris=Math.floor(idx.length/3); const step=Math.max(1,Math.floor(tris/10000)); const edgeMap=new Map();
    for(let t=0;t<tris;t+=step){ const ia=idx[t*3]*3,ib=idx[t*3+1]*3,ic=idx[t*3+2]*3; const A=[pos[ia],pos[ia+1],pos[ia+2]],B=[pos[ib],pos[ib+1],pos[ib+2]],C=[pos[ic],pos[ic+1],pos[ic+2]]; if(!A.every(Number.isFinite)||!B.every(Number.isFinite)||!C.every(Number.isFinite)) continue;
      const AB=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], AC=[C[0]-A[0],C[1]-A[1],C[2]-A[2]]; const N=[AB[1]*AC[2]-AB[2]*AC[1],AB[2]*AC[0]-AB[0]*AC[2],AB[0]*AC[1]-AB[1]*AC[0]]; const len=Math.hypot(...N); if(!len) continue; const triArea=len/2*step; area+=triArea; vol+=(A[0]*(B[1]*C[2]-B[2]*C[1])-A[1]*(B[0]*C[2]-B[2]*C[0])+A[2]*(B[0]*C[1]-B[1]*C[0]))/6*step;
      const key=`${Math.round(Math.abs(N[0]/len)/.18)}:${Math.round(Math.abs(N[1]/len)/.18)}:${Math.round(Math.abs(N[2]/len)/.18)}`; normals.set(key,(normals.get(key)||0)+triArea);
      [[idx[t*3],idx[t*3+1]],[idx[t*3+1],idx[t*3+2]],[idx[t*3+2],idx[t*3]]].forEach(e=>{ const k=e[0]<e[1]?`${e[0]}-${e[1]}`:`${e[1]}-${e[0]}`; edgeMap.set(k,(edgeMap.get(k)||0)+1); });
    }
    m.area=area; m.volume=Math.abs(vol); m.solidness=m.bboxVolume?Math.min(1,m.volume/m.bboxVolume):0; m.flatness=m.minDim?m.maxDim/m.minDim:0; m.slenderness=m.midDim?m.maxDim/m.midDim:0; m.cylinderLike=m.minDim&&m.midDim&&(m.midDim/m.minDim<1.35)&&(m.maxDim/m.midDim>2.2); m.sheetLike=m.minDim>0&&m.maxDim/m.minDim>9&&m.midDim/m.minDim>3;
    const sig=[...normals.values()].filter(v=>area&&v/area>.05).length; m.bendSignal=Math.max(0,sig-2); const boundary=[...edgeMap.values()].filter(c=>c===1).length; m.holeScore=Math.max(0,Math.round(boundary/35));
  }catch(e){console.warn('metric error',e);} return m;
}

function initPart(p,idx){
  const classification=classify(p);
  const process=classification.process;
  const material=defaultMaterial(process,p.name);
  const kg=estimateKg(p,material);
  const purchaseUnit=process==='purchase'?estimatePurchaseUnit(p.name):0;
  return {
    id:`p${idx}_${norm(p.name)}`, name:p.name, qty:p.qty||1, source:p.source||'',
    meshName:p.meshName||'', meshNorm:p.meshNorm||'', metrics:p.metrics||null, meshIndex:p.meshIndex,
    process, material, kgPerEa:kg, timePerEa:0, bends:0, purchaseUnit,
    margin:state.rates.process[process]?.margin??0, classInfo:classification, quote:0, costBreakdown:{}
  };
}

function applyRulePackScores(up, m, add, score){
  const pack = state.rules?.processRules;
  if(!pack) return;
  for(const [process, rule] of Object.entries(pack)){
    if(Array.isArray(rule.namePatterns)){
      for(const item of rule.namePatterns){
        try{
          const re = new RegExp(item.pattern, 'i');
          if(re.test(up)) add(process, item.points || 0, item.reason || `${process} 규칙`);
        }catch(e){}
      }
    }
    if(Array.isArray(rule.meshRules)){
      for(const item of rule.meshRules){
        const k = item.key;
        const op = item.op || 'gt';
        const val = Number(item.value);
        const points = Number(item.points)||0;
        const mv = Number(m?.[k]);
        if(!Number.isFinite(mv)) continue;
        let ok=false;
        if(op==='gt') ok = mv > val;
        else if(op==='gte') ok = mv >= val;
        else if(op==='lt') ok = mv < val;
        else if(op==='lte') ok = mv <= val;
        else if(op==='eq') ok = mv === val;
        if(ok) add(process, points, item.reason || `${process} 형상 규칙`);
      }
    }
  }
  const exclusive = state.rules?.exclusivePriority || [];
  for(const item of exclusive){
    try{
      const re = new RegExp(item.pattern, 'i');
      if(re.test(up)){
        const p = item.process;
        for(const k of Object.keys(score)) if(k!==p) score[k] -= item.penalty || 0;
        score[p] += item.bonus || 0;
      }
    }catch(e){}
  }
}

function classify(p){
  const name=String(p.name||'');
  const up=name.toUpperCase();
  const clean=up.replace(/[^A-Z0-9가-힣]+/g,'_');
  const m=p.metrics||{};
  const score={purchase:0,profile:0,lathe:0,sheet:0,cnc:0,injection:0,print3d:0};
  const reasons=[];
  const add=(k,v,r)=>{ score[k]+=v; if(r) reasons.push({process:k, text:r, points:v}); };
  applyRulePackScores(up, m, add, score);

  // 1) 표준품/구매품: 장비·배관·체결류는 가공 공법보다 먼저 제외한다.
  const purchaseStrong = /BOLT|SCREW|HEX[_-]?NUT|\bNUT\b|WASHER|RIVET|REVET|BEARING|SENSOR|MOTOR|VALVE|CHECK[_-]?VALVE|NIPPLE|PIPE|TUBE|PIE\d*|FITTING|COUPLER|COUPLING|ELBOW|TEE|HOSE|LEAD|SPRING|O[-_ ]?RING|HANDLE|LEVER|GRIP|KNOB|CYLINDER|DAMPER|GAS[_-]?SPRING|GSR/.test(up);
  if(purchaseStrong) add('purchase',180,'표준품/배관/체결류 이름');
  if(m.cylinderLike && /PIPE|TUBE|NIPPLE|VALVE|FITTING|LEAD|HANDLE/.test(up)) add('purchase',50,'원통형 표준 구매품 형상');

  // 2) 압출/프로파일: 파이프/튜브/니플은 구매품 처리, 알루미늄 프로파일만 압출.
  if(/PROFILE|AL[_-]?FRAME|EXTRUSION|2020|3030|4040|4080|4545|5050|6060|8080/.test(up) && !/PIPE|TUBE|PIE|NIPPLE/.test(up)) add('profile',145,'프로파일/압출 규격 이름');
  if(m.slenderness>8 && m.solidness>.20 && /FRAME|RAIL|BAR/.test(up) && !purchaseStrong) add('profile',45,'긴 일정 단면 후보');

  // 3) 선반: 축/핀/부싱류. 단, 배관류는 구매품 우선.
  if(/SHAFT|PIN|BUSH|BUSHING|ROLLER|COLLAR|ROD|SPINDLE|SLEEVE/.test(up) && !purchaseStrong) add('lathe',120,'축/핀/부싱류 이름');
  if(m.cylinderLike && !purchaseStrong) add('lathe',65,'길쭉한 회전체 형상');

  // 4) 판금/절곡: 이름과 얇은 판재형이 같이 맞으면 강하게 추천. 절곡 횟수는 공장장이 입력한다.
  const sheetNameStrong=/HOOD|COVER|PANEL|SHEET|SKEL|BODY|SIDE|TOP|BRACKET|PLATE_COVER|DUCT|CASE_PANEL|WATER[_-]?BOTTLE/.test(up);
  const thickHint=/12T|15T|20T|25T|30T|BLOCK|BASE|JIG/.test(up);
  if(sheetNameStrong && !purchaseStrong){ add('sheet',60,'판금/커버/후드/패널류 이름'); }
  if(m.sheetLike && !purchaseStrong){ add('sheet',95,'얇은 판재형 mesh'); }
  if(/BEND|BENT|FOLD|FLANGE|절곡/.test(up)){ add('sheet',70,'절곡/플랜지 이름 힌트'); }
  if(/HOOD_BODY|HOOD_SKEL|TOP_COVER|WATER_BOTTLE_SIDE|WATER_BOTTLE_TOP/.test(up)){ add('sheet',55,'제품명 규칙: 판금 부품군'); }
  if(thickHint && !/HOOD|COVER|PANEL|SHEET/.test(up)){ score.sheet-=35; }

  // 5) CNC/MCT: 표준품, 프로파일, 선반, 명확한 판금을 제외하고 남는 플레이트/블록/지그류.
  if(/BASE|BLOCK|JIG|FIXTURE|MOUNT|HOLDER|SUPPORT|ADAPTER|GUIDE|CLAMP|PLATE|BRACKET|BY2/.test(up) && !purchaseStrong){ add('cnc',70,'플레이트/지그/가공품 이름'); }
  if(thickHint && !purchaseStrong){ add('cnc',75,'두꺼운 소재 표기'); }
  if(m.solidness>.34 && !m.sheetLike && !m.cylinderLike && !purchaseStrong){ add('cnc',65,'bbox 대비 체적이 있는 덩어리형'); }
  if(m.holeScore>2 && !m.sheetLike && !purchaseStrong){ add('cnc',25,'홀/탭 가공 후보'); }

  // 6) 사출/3D프린팅: 플라스틱 제품명/소재 힌트. 금형비 등은 별도 공장 판단.
  if(/ABS|POM|PC|PP|PE|PA66|NYLON|PLASTIC|RESIN|사출|INJECTION/.test(up)){ add('injection',80,'플라스틱/사출 소재 이름'); }
  if(/PRINT|3D|FDM|SLA|SLS|MJF|PLA|PETG|TPU|시제품/.test(up)){ add('print3d',90,'3D프린팅 이름 힌트'); }
  if(/CASE|HOUSING|CAP|COVER/.test(up) && !m.sheetLike && !purchaseStrong){ add('injection',35,'케이스/하우징 후보'); add('print3d',25,'소량 시제품 후보'); }

  // 제외 규칙: 강한 구매품/프로파일/선반/판금은 서로 간섭을 줄인다.
  if(score.purchase>=140){ score.sheet-=120; score.cnc-=110; score.profile-=90; score.lathe-=70; score.injection-=40; score.print3d-=40; }
  if(score.profile>=120){ score.sheet-=90; score.cnc-=70; score.purchase-=10; }
  if(score.lathe>=100){ score.sheet-=90; score.cnc-=25; }
  if(score.sheet>=115){ score.cnc-=45; score.profile-=45; }

  const entries=Object.entries(score).sort((a,b)=>b[1]-a[1]);
  const [best,bscore]=entries[0];
  const secondScore=entries[1]?.[1] ?? 0;
  const gap=bscore-secondScore;
  let process=best;
  // 낮거나 애매하면 강제로 자동 확정하지 않는다. 공장장이 선택하게 둔다.
  if(bscore<55 || gap<18) process='unknown';
  // 구매품/강한 판금/강한 CNC는 예외적으로 확정
  if(score.purchase>=150) process='purchase';
  else if(score.sheet>=135 && gap>=10) process='sheet';
  else if(score.cnc>=130 && gap>=10) process='cnc';

  const confidenceScore = Math.max(0, Math.min(100, Math.round((bscore/180)*70 + Math.min(gap,60)/60*30)));
  const confidence = confidenceScore>=78?'높음':confidenceScore>=55?'보통':'확인 필요';
  const sortedReasons = reasons
    .filter(r=>process==='unknown' ? true : r.process===process)
    .sort((a,b)=>b.points-a.points)
    .map(r=>r.text)
    .slice(0,3);
  if(!sortedReasons.length){ sortedReasons.push('자동 확정 근거 부족'); }
  return {process, score, reasons:sortedReasons, confidence, confidenceScore, top:entries.slice(0,4)};
}
function defaultMaterial(process,name){
  const u=String(name).toUpperCase();
  if(/SUS316|STS316/.test(u)) return 'SUS316';
  if(/SUS430|STS430/.test(u)) return 'SUS430';
  if(/SUS|STS|NIPPLE|VALVE/.test(u)) return 'SUS304';
  if(/7075/.test(u)) return 'AL7075';
  if(/5052/.test(u)) return 'AL5052';
  if(/6061|AL/.test(u)) return 'AL6061';
  if(/S45C/.test(u)) return 'S45C';
  if(/SCM/.test(u)) return 'SCM440';
  if(/SKD/.test(u)) return 'SKD11';
  if(/SPCC/.test(u)) return 'SPCC';
  if(/SPHC/.test(u)) return 'SPHC';
  if(/SECC/.test(u)) return 'SECC';
  if(/SGCC/.test(u)) return 'SGCC';
  if(/BRASS|C3604|황동/.test(u)) return 'C3604';
  if(/COPPER|C1100|동/.test(u)) return 'C1100';
  if(/POM|MC/.test(u)) return 'POM';
  if(/PC/.test(u)) return 'PC';
  if(/PP/.test(u)) return 'PP';
  if(/PEEK/.test(u)) return 'PEEK';
  if(process==='sheet') return /HOOD|COVER|BODY|SKEL/.test(u)?'SUS304':'SPCC';
  if(process==='purchase') return /BOLT|NUT|SCREW/.test(u)?'SS400':'SUS304';
  if(process==='injection'||process==='print3d') return 'ABS';
  return 'AL6061';
}
function estimateKg(p,mat){
  // 예상무게는 '형상 체적 × 선택 재질 밀도'로 계산한다.
  // 재질을 바꾸면 같은 파트라도 AL/SUS/플라스틱별 무게가 즉시 달라져야 한다.
  const density = Number(state.rates.materials?.[mat]?.density) || 1;
  const volumeCm3 = estimateVolumeCm3(p);
  return round(Math.max(0.001, volumeCm3 * density / 1000), 3);
}
function estimateVolumeCm3(p){
  const m=p.metrics;
  // OCCT mesh volume은 mm³ 기준으로 계산되어 있으므로 cm³로 변환한다.
  if(m?.volume && Number.isFinite(m.volume) && m.volume>0) return Math.max(0.001, m.volume/1000);
  // mesh volume이 없을 때만 이름 기반 체적 추정값을 사용한다. 이 값도 재질 밀도와 곱해 무게가 달라진다.
  const n=String(p.name||'').toUpperCase();
  if(/BOLT|SCREW/.test(n)) return 0.5;
  if(/HEX[_-]?NUT|NUT/.test(n)) return 3.8;
  if(/VALVE|NIPPLE|FITTING|PIPE|TUBE|PIE/.test(n)) return 5.2;
  if(/12T/.test(n)) return 16.5;
  if(/HOOD|COVER|BODY|SKEL|PANEL|SHEET/.test(n)) return 31.5;
  if(/PROFILE|FRAME|4040|3030|2020/.test(n)) return 42;
  return 8;
}
function estimatePurchaseUnit(name){
  const u=String(name).toUpperCase();
  if(/BOLT|SCREW/.test(u))return 120; if(/NUT/.test(u))return 50; if(/VALVE/.test(u))return 1000; if(/NIPPLE/.test(u))return 2500; if(/LEAD|HANDLE|LEVER/.test(u))return 18000; return 1000;
}
function round(n,d=2){ const p=10**d; return Math.round((Number(n)||0)*p)/p; }

function recalcAll(){ state.parts.forEach(calcPart); updateStats(); }
function materialKgPrice(material,process){
  const mat=state.rates.materials[material]||{};
  if(process==='sheet') return mat.sheet||mat.cnc||0;
  if(process==='cnc'||process==='lathe') return mat.cnc||mat.sheet||0;
  if(process==='injection') return mat.injection||mat.cnc||0;
  if(process==='print3d') return mat.print3d||mat.injection||mat.cnc||0;
  if(process==='profile') return mat.profile||mat.cnc||0;
  return mat.cnc||mat.sheet||0;
}
function usesTime(proc){ return ['cnc','lathe','injection','print3d'].includes(proc); }
function calcPart(p){
  const qty=Math.max(0,num(p.qty)); const kg=Math.max(0,num(p.kgPerEa));
  const matCost=kg*qty*materialKgPrice(p.material,p.process);
  const r=state.rates.process; let pre=0, detail={material:matCost, process:0, setup:0, margin:0, note:''};
  if(p.process==='purchase'){
    pre=qty*num(p.purchaseUnit);
    detail.material=0; detail.process=pre;
  } else if(p.process==='sheet'){
    detail.process=qty*num(p.bends)*num(r.sheet.bendUnit);
    pre=matCost+detail.process;
  } else if(usesTime(p.process)){
    const pr=r[p.process]||{};
    detail.setup=qty>0?num(pr.setup):0;
    detail.process=qty*num(p.timePerEa)*num(pr.hourly);
    pre=matCost+detail.process+detail.setup;
  } else if(p.process==='profile'){
    detail.process=qty*num(r.profile.processPerEa);
    pre=matCost+detail.process;
  } else { pre=0; detail.material=0; }
  detail.margin=pre*num(p.margin)/100; p.quote=Math.round(pre+detail.margin); p.costBreakdown=detail; return p.quote;
}


function addManualPart(){
  const name = cleanName(prompt('추가할 파트명을 입력하세요. 예: 구매 볼트 M6, 외주 가공품, 표준 브라켓') || '');
  if(!name) return;
  const id = 'manual_' + Date.now() + '_' + (state.manualCounter++);
  const p = {
    id,
    name,
    qty:1,
    source:'수동 추가',
    meshName:'',
    meshNorm:'',
    metrics:null,
    meshIndex:null,
    matchType:'manual',
    process:'purchase',
    material:'SS400',
    kgPerEa:0,
    baseVolumeCm3:0,
    timePerEa:0,
    bends:0,
    purchaseUnit:0,
    margin:state.rates.process.purchase?.margin ?? 10,
    classInfo:{process:'purchase',confidence:'수동 추가',confidenceScore:100,reasons:['공장이 직접 추가한 파트입니다. 공법/수량/단가를 수정하세요.'],top:[['purchase',100]]},
    quote:0,
    costBreakdown:{}
  };
  state.parts.push(p);
  state.selectedId=id;
  calcPart(p);
  renderParts();
  renderSelected();
  updateStats();
  showPart(p);
  setMessage('ok','수동 파트를 추가했습니다. 공법과 단가를 수정하세요.');
}
function deletePart(id){
  if(!id) return;
  const p = state.parts.find(x=>x.id===id);
  if(!p) return;
  if(!confirm(`'${p.name}' 파트를 견적표에서 삭제할까요?`)) return;
  state.parts = state.parts.filter(x=>x.id!==id);
  if(state.selectedId===id){
    state.selectedId = state.parts[0]?.id || null;
    const next = state.parts.find(x=>x.id===state.selectedId);
    if(next) showPart(next); else hideAllMeshes();
  }
  recalcAll();
  renderParts();
  renderSelected();
  updateStats();
  setMessage('ok','파트를 삭제했습니다. 삭제한 파트는 견적 합계와 CSV에서 제외됩니다.');
}

function renderParts(){ const body=$('partsBody'); if(!state.parts.length){ body.innerHTML='<tr><td colspan="9" class="empty-row">파트가 없습니다. [파트 추가]로 구매품/수동 파트를 추가할 수 있습니다.</td></tr>'; return; }
  body.innerHTML=state.parts.map(p=>`
    <tr data-id="${p.id}" class="${p.id===state.selectedId?'row-selected':''} ${p.meshName?'':'unmatched'}">
      <td><span class="part-name">${esc(p.name)}</span><span class="part-sub">${p.meshName?'mesh: '+esc(p.meshName)+(p.matchType==='추정'?' · 추정':''):'형상 대기'}</span></td>
      <td>${input(p.id,'qty',p.qty,'number')}</td>
      <td><span class="tag">${PROCESS_LABELS[p.process]}</span><span class="conf ${confClass(p)}">${esc(p.classInfo?.confidence||'확인 필요')}</span><div class="reason">${esc(reasonText(p))}</div></td>
      <td>${selectProcess(p)}</td>
      <td>${selectMaterial(p)}</td>
      <td>${processInputCell(p)}</td>
      <td>${input(p.id,'margin',p.margin,'number','1',false)}</td>
      <td class="money">${won(p.quote)}</td>
      <td><button type="button" class="row-delete" data-delete="${p.id}">삭제</button></td>
    </tr>`).join('');
  body.querySelectorAll('tr[data-id]').forEach(tr=>tr.addEventListener('click',e=>{ if(e.target.closest('input,select,button')) return; selectPart(tr.dataset.id); }));
  body.querySelectorAll('input,select').forEach(el=>el.addEventListener('change', onPartEdit));
  body.querySelectorAll('button[data-delete]').forEach(btn=>btn.addEventListener('click', e=>{ e.stopPropagation(); deletePart(btn.dataset.delete); }));
}
function processInputCell(p){
  if(p.process==='sheet') return `<div class="inline-edit"><label>절곡수</label>${input(p.id,'bends',p.bends,'number','1',false)}</div>`;
  if(usesTime(p.process)) return `<div class="inline-edit"><label>시간/개</label>${input(p.id,'timePerEa',p.timePerEa,'number','0.01',false)}</div>`;
  if(p.process==='purchase') return `<div class="inline-edit"><label>구매단가</label>${input(p.id,'purchaseUnit',p.purchaseUnit,'number','1',false)}</div>`;
  if(p.process==='profile') return `<span class="muted-small">압출 가공비 적용</span>`;
  return `<span class="muted-small">공법 선택 필요</span>`;
}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function input(id,field,val,type='number',step='1',disabled=false){ return `<input data-id="${id}" data-field="${field}" type="${type}" step="${step}" value="${esc(val)}" ${disabled?'disabled':''}>`; }
function selectProcess(p){ return `<select data-id="${p.id}" data-field="process">${PROCESSES.map(k=>`<option value="${k}" ${p.process===k?'selected':''}>${PROCESS_LABELS[k]}</option>`).join('')}</select>`; }
function selectMaterial(p){ return `<select data-id="${p.id}" data-field="material">${MATERIALS.map(m=>`<option value="${m}" ${p.material===m?'selected':''}>${m}</option>`).join('')}</select>`; }
function reasonText(p){ const c=p.classInfo||{}; const top=(c.top||[]).slice(0,3).map(([k,v])=>`${PROCESS_LABELS[k]} ${v}`).join(' · '); const rs=(c.reasons||[]).join(' / '); return `${c.confidence||'확인 필요'}${c.confidenceScore!=null?' '+c.confidenceScore+'%':''} · ${rs}${top?' · 점수 '+top:''}`; }
function confClass(p){ const c=p.classInfo?.confidenceScore||0; return c>=78?'high':c>=55?'mid':'low'; }
function onPartEdit(e){
  const p=state.parts.find(x=>x.id===e.target.dataset.id); if(!p)return;
  const f=e.target.dataset.field; let v=e.target.value;
  if(['qty','kgPerEa','timePerEa','bends','purchaseUnit','margin'].includes(f)) v=num(v);
  p[f]=v;
  if(f==='process'){
    if(!PROCESSES.includes(p.process)) p.process='unknown';
    p.margin=state.rates.process[p.process]?.margin??p.margin;
    if(p.process==='purchase' && !p.purchaseUnit) p.purchaseUnit=estimatePurchaseUnit(p.name);
    if(p.process!=='sheet') p.bends=0;
    if(!usesTime(p.process)) p.timePerEa=0;
    // 공법 변경 후에도 선택 재질 기준 예상무게는 다시 계산한다.
    p.kgPerEa=estimateKg(p,p.material);
  }
  if(f==='material'){
    // 핵심 수정: 재질 변경 시 예상무게를 선택 재질 밀도로 즉시 재계산한다.
    p.kgPerEa=estimateKg(p,p.material);
  }
  calcPart(p); renderParts(); renderSelected(); updateStats();
}
function selectPart(id){ state.selectedId=id; const p=state.parts.find(x=>x.id===id); showPart(p); renderParts(); renderSelected(); }
function renderSelected(){ const p=state.parts.find(x=>x.id===state.selectedId); const el=$('selectedPanel'); if(!p){ el.innerHTML='<h2>선택 파트</h2><p class="muted">파트를 선택하세요.</p>'; return; }
  const b=p.costBreakdown||{}; const mode = p.process==='sheet'?'판금/절곡: 절곡수만 입력':usesTime(p.process)?`${PROCESS_LABELS[p.process]}: 시간/개 입력`:p.process==='purchase'?'구매품: 구매단가 입력':p.process==='profile'?'압출: 가공비 단가표 적용':'공법 선택 필요';
  const top=(p.classInfo?.top||[]).slice(0,4).map(([k,v])=>`<li>${PROCESS_LABELS[k]} ${v}</li>`).join('');
  el.innerHTML=`<h2>선택 파트</h2><h3>${esc(p.name)}</h3><p class="muted">${esc(p.meshName?('mesh: '+p.meshName+(p.matchType==='추정'?' · 추정 매칭':'')):'형상 표시 대기')}</p>
  <div class="selected-grid"><div><b>추천</b><br>${PROCESS_LABELS[p.process]} / ${esc(p.classInfo?.confidence||'확인 필요')}</div><div><b>수량</b><br>${p.qty}</div><div><b>입력 기준</b><br>${mode}</div><div><b>예상 무게</b><br>${p.kgPerEa}kg/개<br><span class="muted-small">${esc(p.material)} 밀도 반영</span></div></div>
  <div class="service-note"><b>추천 근거</b><br>${esc((p.classInfo?.reasons||[]).join(' / ')||'자동 근거 부족')}</div>
  <ul class="score-list">${top}</ul>
  <div class="service-note">재료비 ${won(b.material||0)} / 공정비 ${won(b.process||0)} / 셋업 ${won(b.setup||0)} / 마진 ${won(b.margin||0)}</div>
  <h3>빠른 변경</h3><div class="quick-actions">
    <button data-quick="sheet">판금/절곡</button><button data-quick="cnc">CNC/MCT</button><button data-quick="purchase">구매품</button><button data-quick="lathe">선반</button><button data-quick="print3d">3D프린팅</button><button data-quick="profile">압출</button>
  </div><button type="button" id="deletePartInPanel" class="danger-wide">선택 파트 삭제</button><h2 class="money">${won(p.quote)}</h2>`;
  el.querySelectorAll('button[data-quick]').forEach(btn=>btn.addEventListener('click',()=>quickEdit(p,btn.dataset.quick)));
  el.querySelector('#deletePartInPanel')?.addEventListener('click',()=>deletePart(p.id));
}
function quickEdit(p,cmd){
  if(PROCESSES.includes(cmd)){
    p.process=cmd;
    p.margin=state.rates.process[cmd]?.margin??p.margin;
    if(cmd==='purchase'&&!p.purchaseUnit)p.purchaseUnit=estimatePurchaseUnit(p.name);
    if(cmd!=='sheet')p.bends=0;
    if(!usesTime(cmd))p.timePerEa=0;
    p.kgPerEa=estimateKg(p,p.material);
  }
    calcPart(p); renderParts(); renderSelected(); updateStats();
}

function renderRateEditors(){ renderMaterialRates(); renderProcessRates(); }
function renderMaterialRates(){ const mat=state.rates.materials; $('materialRateEditor').innerHTML=`<table class="rate-table"><thead><tr><th>재질</th><th>판재 kg</th><th>CNC/선반 kg</th><th>사출 kg</th><th>3D kg</th><th>압출 kg</th></tr></thead><tbody>${MATERIALS.map(m=>`<tr><td><b>${m}</b></td>${['sheet','cnc','injection','print3d','profile'].map(k=>`<td><input data-rate="mat" data-mat="${m}" data-key="${k}" type="number" value="${mat[m]?.[k]||0}"></td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('materialRateEditor').querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{ state.rates.materials[i.dataset.mat][i.dataset.key]=num(i.value); recalcAll(); renderParts(); renderSelected(); }));
}
function renderProcessRates(){ const lines=[
  ['cnc.hourly','CNC/MCT 시간당 단가'],
  ['lathe.hourly','선반 시간당 단가'],
  ['injection.hourly','사출 시간당 단가'],
  ['print3d.hourly','3D프린팅 시간당 단가'],
  ['sheet.bendUnit','판금 절곡 1회 단가'],
  ['cnc.setup','CNC 셋업비'],
  ['lathe.setup','선반 셋업비'],
  ['injection.setup','사출 셋업비'],
  ['print3d.setup','3D프린팅 셋업비'],
  ['profile.processPerEa','압출/프로파일 가공비/개'],
  ['sheet.margin','판금 마진%'],['cnc.margin','CNC 마진%'],['lathe.margin','선반 마진%'],['injection.margin','사출 마진%'],['print3d.margin','3D프린팅 마진%'],['profile.margin','압출 마진%'],['purchase.margin','구매품 마진%']
];
  $('processRateEditor').innerHTML=lines.map(([path,label])=>`<div class="rate-line"><label>${label}</label><input data-path="${path}" type="number" step="0.01" value="${getPath(state.rates.process,path)}"></div>`).join('');
  $('processRateEditor').querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{ setPath(state.rates.process,i.dataset.path,num(i.value)); syncMarginsFromRates(); recalcAll(); renderParts(); renderSelected(); }));
}
function getPath(o,path){ return path.split('.').reduce((a,k)=>a?.[k],o)??0; }
function setPath(o,path,v){ const a=path.split('.'); let cur=o; for(let i=0;i<a.length-1;i++) cur=cur[a[i]]; cur[a.at(-1)]=v; }
function syncMarginsFromRates(){ state.parts.forEach(p=>{ if(state.rates.process[p.process]?.margin!==undefined) p.margin=state.rates.process[p.process].margin; }); }
function saveRatesToBrowser(){ localStorage.setItem('factoryStepRates', JSON.stringify(state.rates)); setMessage('ok','단가표를 브라우저에 저장했습니다. 다음 접속 시 자동 적용됩니다.'); }
function downloadRates(){ const blob=new Blob([JSON.stringify(state.rates,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='factory-rates.json'; a.click(); URL.revokeObjectURL(a.href); }
async function importRatesFile(e){ const f=e.target.files?.[0]; if(!f)return; try{ const obj=JSON.parse(await f.text()); state.rates=obj; mergeDefaults(state.rates,DEFAULT_RATES); renderRateEditors(); syncMarginsFromRates(); recalcAll(); renderParts(); renderSelected(); setMessage('ok','단가표를 불러왔습니다.'); }catch(err){ setMessage('err','단가표 JSON을 읽지 못했습니다.'); } }
function copyRates(){ const txt=JSON.stringify(state.rates,null,2); $('ratesPaste').value=txt; navigator.clipboard?.writeText(txt); setMessage('ok','단가표 JSON을 복사했습니다.'); }
function pasteRates(){ try{ const obj=JSON.parse($('ratesPaste').value); state.rates=obj; mergeDefaults(state.rates,DEFAULT_RATES); renderRateEditors(); syncMarginsFromRates(); recalcAll(); renderParts(); renderSelected(); setMessage('ok','붙여넣은 단가표를 적용했습니다.'); }catch{ setMessage('err','붙여넣은 내용이 올바른 JSON이 아닙니다.'); } }

function updateStats(){ $('statParts').textContent=state.parts.length; $('statTotal').textContent=won(state.parts.reduce((s,p)=>s+p.quote,0)); }
function renderDebug(obj){ $('debugPre').textContent=JSON.stringify(obj||state.debug,null,2); }
function exportCsv(){ const rows=[['파트','수량','공법','재질','예상kg/개','절곡수','시간/개','구매단가','마진%','견적가']].concat(state.parts.map(p=>[p.name,p.qty,PROCESS_LABELS[p.process],p.material,p.kgPerEa,p.bends,p.timePerEa,p.purchaseUnit,p.margin,p.quote])); const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='step_quote.csv'; a.click(); URL.revokeObjectURL(a.href); }
