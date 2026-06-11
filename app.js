const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat('ko-KR');
const PROCESS_LABELS = {purchase:'구매품', sheet:'판금/절곡', cnc:'CNC/MCT', lathe:'선반', injection:'사출', print3d:'3D프린팅', profile:'압출/프로파일', welding:'용접', unknown:'분류 필요'};
const MATERIALS = ['AL6061','SUS304','SS400','SPCC','ABS','POM'];
const PROCESSES = ['purchase','sheet','cnc','lathe','injection','print3d','profile','welding','unknown'];
const state = {rates:null, fileName:'', assemblyName:'-', parts:[], selectedId:null, occt:null, debug:{}, meshObjects:[], meshByNorm:new Map(), three:{}};
const DEFAULT_RATES = {
  materials:{
    AL6061:{density:2.70,sheet:6900,cnc:7200,injection:7200,print3d:8500,profile:7600},
    SUS304:{density:7.93,sheet:6100,cnc:6500,injection:0,print3d:0,profile:6500},
    SS400:{density:7.85,sheet:1650,cnc:1800,injection:0,print3d:0,profile:1800},
    SPCC:{density:7.85,sheet:1600,cnc:1750,injection:0,print3d:0,profile:1750},
    ABS:{density:1.04,sheet:0,cnc:4500,injection:3800,print3d:8500,profile:0},
    POM:{density:1.41,sheet:0,cnc:9200,injection:8500,print3d:12000,profile:0}
  },
  process:{
    commonHourly:65000,
    sheet:{bendUnit:3000,margin:18},
    cnc:{setup:50000,margin:22},
    lathe:{setup:30000,margin:20},
    injection:{setup:0,margin:20},
    print3d:{setup:5000,margin:28},
    profile:{processPerEa:2000,margin:15},
    welding:{margin:0},
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
  $('showAllBtn').addEventListener('click', showAllMeshes);
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
function isBadName(name){ const n=String(name||'').trim(); return !n || /^#?\d+$/.test(n) || /^PRODUCT_DEFINITION/i.test(n) || /^NEXT ASSEMBLY RELATIONSHIP$/i.test(n) || /^DESIGN$/i.test(n); }
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
      const group=new THREE.Group(); group.name=mesh.name; group.add(mesh); group.add(edges); root.add(group);
      const metrics=computeMeshMetrics(m,g);
      state.meshObjects.push({group,mesh,raw:m,name:mesh.name,norm:norm(mesh.name),metrics});
      if(norm(mesh.name)) state.meshByNorm.set(norm(mesh.name), group);
    }catch(e){ console.warn('mesh build fail', e); }
  });
  fitCamera();
}
function color(i){return [0x92b4ff,0x9cf6d0,0xffd166,0xffaaa5,0xc4b5fd,0x93c5fd,0xfcd34d,0xa7f3d0][i%8];}
function showAllMeshes(){ state.meshObjects.forEach(o=>o.group.visible=true); state.selectedId=null; fitCamera(false); }
function showPart(part){
  if(!part) return;
  state.meshObjects.forEach(o=>o.group.visible=false);
  let shown=false;
  if(part.meshNorm){
    const g=state.meshByNorm.get(part.meshNorm);
    if(g){ g.visible=true; shown=true; }
  }
  if(!shown && part.meshName){
    const pn=norm(part.meshName);
    for(const o of state.meshObjects){
      if(o.norm===pn || o.norm.includes(pn) || pn.includes(o.norm)){ o.group.visible=true; shown=true; break; }
    }
  }
  if(!shown){
    // 형상 매칭이 없는 파트는 전체를 보여주되, 표/우측 패널에서 수정 가능하게 둔다.
    state.meshObjects.forEach(o=>o.group.visible=true);
  }
  fitCamera(true);
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
  const {root,camera,controls}=state.three; if(!root||!camera)return;
  let box, has;
  if(visibleOnly) ({box,has}=visibleSceneBox(root));
  else { box=new THREE.Box3().setFromObject(root); has=Number.isFinite(box.min.x); }
  if(!has || !Number.isFinite(box.min.x)) return;
  const size=new THREE.Vector3(); box.getSize(size);
  const center=new THREE.Vector3(); box.getCenter(center);
  const max=Math.max(size.x,size.y,size.z)||10;
  camera.position.copy(center).add(new THREE.Vector3(max*1.4,max*1.7,max*1.0));
  camera.near=Math.max(max/2000,0.001); camera.far=Math.max(max*200,1000);
  camera.updateProjectionMatrix();
  controls?.target.copy(center); controls?.update();
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
    state.selectedId=state.parts[0]?.id||null; recalcAll(); renderParts(); renderSelected(); updateStats(); renderDebug({textInfo,occt}); showAllMeshes();
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
  const validMesh=meshes.map((m,i)=>({name:m.name||`MESH_${i+1}`,norm:norm(m.name||''),metrics:findMeshMetrics(m.name)})).filter(m=>!isBadName(m.name)&&!isAssemblyName(m.name));
  const matched=new Set(); const result=[];
  for(const p of textInfo.parts){
    const pn=norm(p.name); let mesh=validMesh.find(m=>m.norm===pn) || validMesh.find(m=>m.norm.includes(pn)||pn.includes(m.norm));
    if(mesh) matched.add(mesh.norm);
    result.push({...p, meshName:mesh?.name||'', meshNorm:mesh?.norm||'', metrics:mesh?.metrics||null});
  }
  for(const m of validMesh){
    if(matched.has(m.norm)) continue;
    if(textInfo.parts.length && isNumberishMesh(m.name)) continue;
    result.push({name:m.name, qty:1, source:'3D mesh', meshName:m.name, meshNorm:m.norm, metrics:m.metrics});
  }
  return groupByName(result).map(p=>({ ...p, meshName:result.find(r=>norm(r.name)===norm(p.name))?.meshName||'', meshNorm:result.find(r=>norm(r.name)===norm(p.name))?.meshNorm||'', metrics:result.find(r=>norm(r.name)===norm(p.name))?.metrics||null }));
}
function findMeshMetrics(name){ const n=norm(name); return state.meshObjects.find(o=>o.norm===n)?.metrics || null; }
function isNumberishMesh(name){ return /^#?\d+$/.test(String(name).trim()) || /^MESH_\d+$/i.test(name); }

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
    meshName:p.meshName||'', meshNorm:p.meshNorm||'', metrics:p.metrics||null,
    process, material, kgPerEa:kg, timePerEa:0, bends:0, purchaseUnit,
    margin:state.rates.process[process]?.margin??0, classInfo:classification, quote:0, costBreakdown:{}
  };
}
function classify(p){
  const name=String(p.name||''); const up=name.toUpperCase(); const m=p.metrics||{};
  const score={purchase:0,profile:0,lathe:0,sheet:0,cnc:0,injection:0,print3d:0,welding:0}; const reasons=[];
  // 구매품은 공장장이 단가만 수정하도록 최우선
  if(/BOLT|SCREW|NUT|WASHER|RIVET|REVET|BEARING|SENSOR|MOTOR|VALVE|NIPPLE|PIPE|TUBE|PIE|LEAD|FITTING|SPRING|O[-_ ]?RING|CHECK|HANDLE|LEVER/.test(up)){score.purchase+=180; reasons.push('표준품/구매품 이름');}
  // 압출/프로파일: 파이프/튜브는 구매품 우선
  if(/PROFILE|AL[_-]?FRAME|2020|3030|4040|4080|EXTRUSION/.test(up) && !/PIPE|TUBE|PIE/.test(up)){score.profile+=140; reasons.push('프로파일/압출 이름');}
  // 선반
  if(/SHAFT|PIN|BUSH|ROLLER|COLLAR|ROD/.test(up)){score.lathe+=100; reasons.push('축/선반품 이름');}
  if(m.cylinderLike){score.lathe+=60; reasons.push('원통형 형상');}
  // 판금/절곡: 이름 + 얇은 판재형이면 강하게, 이름만 있으면 후보
  if(/HOOD|COVER|PANEL|SHEET|SKEL|BODY|SIDE|TOP|BRACKET/.test(up)){score.sheet+=45; reasons.push('판금류 이름');}
  if(m.sheetLike){score.sheet+=80; reasons.push('얇은 판재형 형상');}
  if(/BEND|BENT|FOLD|FLANGE|절곡/.test(up)){score.sheet+=55; reasons.push('절곡 힌트');}
  // CNC/MCT
  if(/BASE|BLOCK|JIG|FIXTURE|MOUNT|HOLDER|SUPPORT|ADAPTER|GUIDE|CLAMP|PLATE/.test(up)){score.cnc+=55; reasons.push('절삭 가공품 이름');}
  if(/12T|15T|20T|25T|30T/.test(up)){score.cnc+=45; score.sheet-=10; reasons.push('두꺼운 소재 표기');}
  if(m.solidness>.35 && !m.sheetLike && !m.cylinderLike){score.cnc+=55; reasons.push('덩어리형 형상');}
  if(/CASE|HOUSING|MOLD|PLASTIC/.test(up)){score.injection+=45; score.print3d+=25; reasons.push('사출/3D 후보');}
  if(score.purchase>=100){score.sheet-=100; score.cnc-=90; score.profile-=90; score.lathe-=50;}
  if(score.profile>=100){score.purchase-=20; score.sheet-=90; score.cnc-=70;}
  const entries=Object.entries(score).sort((a,b)=>b[1]-a[1]); const [best,bscore]=entries[0], [,second]=entries[1];
  const process=(bscore<35 || bscore-second<15)?'unknown':best;
  return {process, score, reasons:reasons.slice(0,4), confidence:bscore>=100?'높음':bscore>=60?'보통':'낮음'};
}
function defaultMaterial(process,name){
  const u=String(name).toUpperCase();
  if(/SUS|STS|NIPPLE|VALVE/.test(u)) return 'SUS304';
  if(process==='sheet') return /HOOD|COVER|BODY|SKEL/.test(u)?'SUS304':'SPCC';
  if(process==='purchase') return /BOLT|NUT|SCREW/.test(u)?'SS400':'SUS304';
  if(process==='injection'||process==='print3d') return 'ABS';
  return 'AL6061';
}
function estimateKg(p,mat){
  const m=p.metrics;
  if(m?.volume){ const d=state.rates.materials[mat]?.density||1; return round(Math.max(.001,m.volume/1000*d/1000),3); }
  const n=p.name.toUpperCase();
  if(/BOLT|SCREW/.test(n))return .004; if(/NUT/.test(n))return .03; if(/VALVE|NIPPLE/.test(n))return .04; if(/12T/.test(n))return .044; if(/HOOD|COVER|BODY|SKEL/.test(n))return .25; return .05;
}
function estimatePurchaseUnit(name){
  const u=String(name).toUpperCase();
  if(/BOLT|SCREW/.test(u))return 120; if(/NUT/.test(u))return 50; if(/VALVE/.test(u))return 1000; if(/NIPPLE/.test(u))return 2500; if(/LEAD|HANDLE|LEVER/.test(u))return 18000; return 1000;
}
function round(n,d=2){ const p=10**d; return Math.round((Number(n)||0)*p)/p; }

function recalcAll(){ state.parts.forEach(calcPart); updateStats(); }
function recalcAll(){ state.parts.forEach(calcPart); updateStats(); }
function materialKgPrice(material,process){
  const mat=state.rates.materials[material]||{};
  if(process==='sheet') return mat.sheet||mat.cnc||0;
  if(process==='cnc'||process==='lathe'||process==='welding') return mat.cnc||mat.sheet||0;
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
    detail.process=qty*num(p.timePerEa)*num(r.commonHourly);
    pre=matCost+detail.process+detail.setup;
  } else if(p.process==='profile'){
    detail.process=qty*num(r.profile.processPerEa);
    pre=matCost+detail.process;
  } else if(p.process==='welding'){
    pre=0; detail.material=0; detail.process=0; detail.note='용접은 내부 검토';
  } else { pre=0; detail.material=0; }
  detail.margin=pre*num(p.margin)/100; p.quote=Math.round(pre+detail.margin); p.costBreakdown=detail; return p.quote;
}

function renderParts(){ const body=$('partsBody'); if(!state.parts.length){ body.innerHTML='<tr><td colspan="8" class="empty-row">파트가 없습니다.</td></tr>'; return; }
  body.innerHTML=state.parts.map(p=>`
    <tr data-id="${p.id}" class="${p.id===state.selectedId?'row-selected':''} ${p.meshName?'':'unmatched'}">
      <td><span class="part-name">${esc(p.name)}</span><span class="part-sub">${p.meshName?'mesh: '+esc(p.meshName):'형상 미연결'}</span></td>
      <td>${input(p.id,'qty',p.qty,'number')}</td>
      <td><span class="tag">${PROCESS_LABELS[p.process]}</span><div class="reason">${esc(reasonText(p))}</div></td>
      <td>${selectProcess(p)}</td>
      <td>${selectMaterial(p)}</td>
      <td>${processInputCell(p)}</td>
      <td>${input(p.id,'margin',p.margin,'number','1',p.process==='welding')}</td>
      <td class="money">${p.process==='welding'?'내부검토':won(p.quote)}</td>
    </tr>`).join('');
  body.querySelectorAll('tr[data-id]').forEach(tr=>tr.addEventListener('click',e=>{ if(e.target.closest('input,select,button')) return; selectPart(tr.dataset.id); }));
  body.querySelectorAll('input,select').forEach(el=>el.addEventListener('change', onPartEdit));
}
function processInputCell(p){
  if(p.process==='sheet') return `<div class="inline-edit"><label>절곡수</label>${input(p.id,'bends',p.bends,'number','1',false)}</div>`;
  if(usesTime(p.process)) return `<div class="inline-edit"><label>시간/개</label>${input(p.id,'timePerEa',p.timePerEa,'number','0.01',false)}</div>`;
  if(p.process==='purchase') return `<div class="inline-edit"><label>구매단가</label>${input(p.id,'purchaseUnit',p.purchaseUnit,'number','1',false)}</div>`;
  if(p.process==='profile') return `<span class="muted-small">압출 가공비 적용</span>`;
  if(p.process==='welding') return `<span class="muted-small">내부 검토</span>`;
  return `<span class="muted-small">공법 선택 필요</span>`;
}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function input(id,field,val,type='number',step='1',disabled=false){ return `<input data-id="${id}" data-field="${field}" type="${type}" step="${step}" value="${esc(val)}" ${disabled?'disabled':''}>`; }
function selectProcess(p){ return `<select data-id="${p.id}" data-field="process">${PROCESSES.map(k=>`<option value="${k}" ${p.process===k?'selected':''}>${PROCESS_LABELS[k]}</option>`).join('')}</select>`; }
function selectMaterial(p){ return `<select data-id="${p.id}" data-field="material">${MATERIALS.map(m=>`<option value="${m}" ${p.material===m?'selected':''}>${m}</option>`).join('')}</select>`; }
function reasonText(p){ const c=p.classInfo; const score=c?.score?Object.entries(c.score).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${PROCESS_LABELS[k]} ${v}`).join(' · '):''; return `${(c?.reasons||[]).join(' / ')}${score?' · '+score:''}`; }
function onPartEdit(e){
  const p=state.parts.find(x=>x.id===e.target.dataset.id); if(!p)return;
  const f=e.target.dataset.field; let v=e.target.value;
  if(['qty','kgPerEa','timePerEa','bends','purchaseUnit','margin'].includes(f)) v=num(v);
  p[f]=v;
  if(f==='process'){
    p.margin=state.rates.process[p.process]?.margin??p.margin;
    if(p.process==='purchase' && !p.purchaseUnit) p.purchaseUnit=estimatePurchaseUnit(p.name);
    if(p.process!=='sheet') p.bends=0;
    if(!usesTime(p.process)) p.timePerEa=0;
  }
  calcPart(p); renderParts(); renderSelected(); updateStats();
}
function selectPart(id){ state.selectedId=id; const p=state.parts.find(x=>x.id===id); showPart(p); renderParts(); renderSelected(); }
function renderSelected(){ const p=state.parts.find(x=>x.id===state.selectedId); const el=$('selectedPanel'); if(!p){ el.innerHTML='<h2>선택 파트</h2><p class="muted">파트를 선택하세요.</p>'; return; }
  const b=p.costBreakdown||{}; const mode = p.process==='sheet'?'판금: 절곡수 입력':usesTime(p.process)?'시간 공정: 시간/개 입력':p.process==='purchase'?'구매품: 단가 입력':p.process==='welding'?'용접: 내부 검토':'기본 계산';
  el.innerHTML=`<h2>선택 파트</h2><h3>${esc(p.name)}</h3><p class="muted">${esc(p.meshName||'형상 미연결')}</p>
  <div class="selected-grid"><div><b>공법</b><br>${PROCESS_LABELS[p.process]}</div><div><b>수량</b><br>${p.qty}</div><div><b>입력 기준</b><br>${mode}</div><div><b>예상 무게</b><br>${p.kgPerEa}kg/개</div></div>
  <div class="service-note">재료비 ${won(b.material||0)} / 공정비 ${won(b.process||0)} / 셋업 ${won(b.setup||0)} / 마진 ${won(b.margin||0)}</div>
  <h3>빠른 변경</h3><div class="quick-actions">
    <button data-quick="sheet">판금/절곡</button><button data-quick="cnc">CNC/MCT</button><button data-quick="purchase">구매품</button><button data-quick="print3d">3D프린팅</button>
    <button data-quick="profile">압출</button><button data-quick="welding">용접검토</button><button data-quick="bendPlus">절곡 +1</button><button data-quick="bendMinus">절곡 -1</button>
  </div><h2 class="money">${p.process==='welding'?'내부검토':won(p.quote)}</h2>`;
  el.querySelectorAll('button[data-quick]').forEach(btn=>btn.addEventListener('click',()=>quickEdit(p,btn.dataset.quick)));
}
function quickEdit(p,cmd){
  if(PROCESSES.includes(cmd)){ p.process=cmd; p.margin=state.rates.process[cmd]?.margin??p.margin; if(cmd==='purchase'&&!p.purchaseUnit)p.purchaseUnit=estimatePurchaseUnit(p.name); if(cmd!=='sheet')p.bends=0; if(!usesTime(cmd))p.timePerEa=0; }
  if(cmd==='bendPlus')p.bends++; if(cmd==='bendMinus')p.bends=Math.max(0,p.bends-1);
  calcPart(p); renderParts(); renderSelected(); updateStats();
}

function renderRateEditors(){ renderMaterialRates(); renderProcessRates(); }
function renderMaterialRates(){ const mat=state.rates.materials; $('materialRateEditor').innerHTML=`<table class="rate-table"><thead><tr><th>재질</th><th>판재 kg</th><th>CNC/선반 kg</th><th>사출 kg</th><th>3D kg</th><th>압출 kg</th></tr></thead><tbody>${MATERIALS.map(m=>`<tr><td><b>${m}</b></td>${['sheet','cnc','injection','print3d','profile'].map(k=>`<td><input data-rate="mat" data-mat="${m}" data-key="${k}" type="number" value="${mat[m]?.[k]||0}"></td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('materialRateEditor').querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{ state.rates.materials[i.dataset.mat][i.dataset.key]=num(i.value); recalcAll(); renderParts(); renderSelected(); }));
}
function renderProcessRates(){ const lines=[
  ['commonHourly','공통 시간당 단가'],
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

function updateStats(){ $('statAssembly').textContent=state.assemblyName||'-'; $('statParts').textContent=state.parts.length; $('statMeshes').textContent=state.meshObjects.length; $('statTotal').textContent=won(state.parts.reduce((s,p)=>s+p.quote,0)); }
function renderDebug(obj){ $('debugPre').textContent=JSON.stringify(obj||state.debug,null,2); }
function exportCsv(){ const rows=[['파트','수량','공법','재질','예상kg/개','절곡수','시간/개','구매단가','마진%','견적가']].concat(state.parts.map(p=>[p.name,p.qty,PROCESS_LABELS[p.process],p.material,p.kgPerEa,p.bends,p.timePerEa,p.purchaseUnit,p.margin,p.quote])); const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='step_quote.csv'; a.click(); URL.revokeObjectURL(a.href); }
