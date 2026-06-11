/* 공장용 STEP 견적 계산기 Real Viewer V11 - mesh-first leaf grouping + sheet bend/hole connected-component analyzer */
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

    state.parts = state.parts
      .filter(p => p && p.name && !isBadName(p.name) && !isNumberishName(p.name) && !/^PRODUCT_DEFINITION/i.test(p.name))
      .map((p, idx) => enrichPart(p, idx));
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
      const metrics = computeMeshMetrics(m, geom);
      state.meshObjects.push({group, mesh, raw:m, name:mesh.name, norm:norm(mesh.name), metrics});
      const n = norm(mesh.name); if(n) state.meshByName.set(n, group);
    } catch(e){ console.warn('mesh build fail', idx, e); }
  });
  fitCamera();
}
function colorFromIndex(i){ const colors=[0x92b4ff,0xffc857,0x6ee7b7,0xfca5a5,0xc4b5fd,0x93c5fd,0xfcd34d,0xa7f3d0]; return colors[i%colors.length]; }


function computeMeshMetrics(rawMesh, geom){
  const pos = rawMesh?.attributes?.position?.array || [];
  const idx = rawMesh?.index?.array || [];
  const metrics = {
    dims:[0,0,0], sortedDims:[0,0,0], minDim:0, midDim:0, maxDim:0,
    bboxVolumeMm3:0, surfaceAreaMm2:0, volumeMm3:0, solidness:0,
    flatness:0, slenderness:0, cylinderLike:false, flatPlateLike:false,
    normalClusterCount:0, majorPlaneDirections:0, dominantPlaneDirections:0, normalComplexity:0, bendPatchCount:0, holeCandidateCount:0, bendPatchDebug:'', holeDebug:'', triangleCount: Math.floor((idx.length||0)/3)
  };
  try{
    let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
    for(let i=0;i<pos.length;i+=3){
      const x=pos[i], y=pos[i+1], z=pos[i+2];
      if(!Number.isFinite(x+y+z)) continue;
      if(x<minX)minX=x; if(y<minY)minY=y; if(z<minZ)minZ=z;
      if(x>maxX)maxX=x; if(y>maxY)maxY=y; if(z>maxZ)maxZ=z;
    }
    const dx=Math.max(0,maxX-minX), dy=Math.max(0,maxY-minY), dz=Math.max(0,maxZ-minZ);
    const sorted=[dx,dy,dz].sort((a,b)=>a-b);
    metrics.dims=[dx,dy,dz]; metrics.sortedDims=sorted; metrics.minDim=sorted[0]||0; metrics.midDim=sorted[1]||0; metrics.maxDim=sorted[2]||0;
    metrics.bboxVolumeMm3=Math.max(0,dx*dy*dz);
    let area=0, vol=0;
    const cluster = new Map();
    const maxTris = Math.floor(idx.length/3);
    const step = Math.max(1, Math.floor(maxTris/7000));
    for(let t=0;t<maxTris;t+=step){
      const ia=idx[t*3]*3, ib=idx[t*3+1]*3, ic=idx[t*3+2]*3;
      const ax=pos[ia], ay=pos[ia+1], az=pos[ia+2];
      const bx=pos[ib], by=pos[ib+1], bz=pos[ib+2];
      const cx=pos[ic], cy=pos[ic+1], cz=pos[ic+2];
      if(!Number.isFinite(ax+ay+az+bx+by+bz+cx+cy+cz)) continue;
      const abx=bx-ax, aby=by-ay, abz=bz-az;
      const acx=cx-ax, acy=cy-ay, acz=cz-az;
      const nx=aby*acz-abz*acy, ny=abz*acx-abx*acz, nz=abx*acy-aby*acx;
      const len=Math.hypot(nx,ny,nz); if(len<=1e-9) continue;
      const triArea=len/2; area += triArea*step;
      vol += (ax*(by*cz-bz*cy) - ay*(bx*cz-bz*cx) + az*(bx*cy-by*cx))/6 * step;
      const ux=Math.abs(nx/len), uy=Math.abs(ny/len), uz=Math.abs(nz/len);
      // opposite normals are treated as the same plane direction. 0.2 bucket is enough for STEP tessellation noise.
      const key=`${Math.round(ux/0.20)}:${Math.round(uy/0.20)}:${Math.round(uz/0.20)}`;
      cluster.set(key,(cluster.get(key)||0)+triArea*step);
    }
    metrics.surfaceAreaMm2=Math.round(area);
    metrics.volumeMm3=Math.abs(vol);
    metrics.solidness = metrics.bboxVolumeMm3>0 ? Math.min(1, metrics.volumeMm3/metrics.bboxVolumeMm3) : 0;
    metrics.flatness = metrics.minDim>0 ? metrics.maxDim/metrics.minDim : 0;
    metrics.slenderness = metrics.midDim>0 ? metrics.maxDim/metrics.midDim : 0;
    const areas=[...cluster.values()].sort((a,b)=>b-a);
    const significant=areas.filter(v=>area>0 && v/area>0.035);
    const major=areas.filter(v=>area>0 && v/area>0.08);
    const dominant=areas.filter(v=>area>0 && v/area>0.15);
    metrics.normalClusterCount=significant.length;
    metrics.majorPlaneDirections=major.length;
    metrics.dominantPlaneDirections=dominant.length;
    metrics.normalComplexity=Math.min(1, significant.length/8);
    metrics.cylinderLike = metrics.minDim>0 && metrics.midDim>0 && (metrics.midDim/metrics.minDim < 1.28) && (metrics.maxDim/metrics.midDim > 2.2);
    metrics.flatPlateLike = metrics.minDim>0 && metrics.maxDim/metrics.minDim>7 && metrics.midDim/metrics.minDim>2.2;
    const sheetFeatureEstimate = estimateSheetFeaturesFromTriangles(pos, idx, metrics, area);
    metrics.bendPatchCount = sheetFeatureEstimate.bends;
    metrics.holeCandidateCount = sheetFeatureEstimate.holes;
    metrics.directionBendCount = sheetFeatureEstimate.directionBends || 0;
    metrics.patchBendCount = sheetFeatureEstimate.patchBends || 0;
    metrics.edgeBendCount = sheetFeatureEstimate.edgeBends || 0;
    metrics.featureHoleCount = sheetFeatureEstimate.featureHoles || 0;
    metrics.bendPatchDebug = sheetFeatureEstimate.debug;
    metrics.holeDebug = sheetFeatureEstimate.holeDebug;
  }catch(e){ console.warn('metrics fail', e); }
  return metrics;
}

// 판금 특징 추정 V11
// 목표: "얇은 판재 + 꺾여 나온 플랜지/귀/탭"을 절곡 후보로 세고,
// 작고 닫힌 원통/구멍벽 성분은 홀·탭 후보로 분리한다.
// 확정값이 아니라 공장 수정용 초기값이다.

// 판금 특징 추정 V12
// 핵심 변경:
// 1) 얇은 판재에서 기준판을 제외한 큰 연결 패치 수를 절곡 후보로 본다.
// 2) 원형/타원형으로 보이는 작고 compact한 곡면 성분은 전부 홀 후보로 본다.
// 3) 이 값은 확정 견적이 아니라 공장장이 수정하는 자동 초기값이다.

// 판금 특징 추정 V13
// 목표: 공장장이 보는 초기값을 최대한 맞춘다.
// 1) 원형/타원형으로 닫힌 feature loop는 모두 홀 후보로 잡는다.
// 2) 절곡은 "판면 방향 수 - 1", "기준판 외 플랜지 패치", "긴 hard feature edge"를 함께 본다.
// 3) 확정값이 아니라 표에서 바로 수정하는 자동 초깃값이다.
function estimateSheetFeaturesFromTriangles(pos, idx, metrics, totalArea){
  const out = {bends:0, holes:0, debug:'', holeDebug:'', directionBends:0, patchBends:0, edgeBends:0, featureHoles:0};
  try{
    if(!pos || !idx || idx.length < 9 || !metrics) return out;
    const minDim = Number(metrics.minDim)||0, midDim=Number(metrics.midDim)||0, maxDim=Number(metrics.maxDim)||0;
    const sheetCandidate = minDim>0 && minDim<=12 && maxDim/minDim>3.5 && midDim/minDim>1.25;
    if(!sheetCandidate) return out;

    const maxTris = Math.floor(idx.length/3);
    const sampleStep = Math.max(1, Math.floor(maxTris/55000));
    const tris = [];
    const dirArea = new Map();
    let sampledArea = 0;

    for(let t=0;t<maxTris;t+=sampleStep){
      const ia=idx[t*3]*3, ib=idx[t*3+1]*3, ic=idx[t*3+2]*3;
      const ax=pos[ia], ay=pos[ia+1], az=pos[ia+2];
      const bx=pos[ib], by=pos[ib+1], bz=pos[ib+2];
      const cx=pos[ic], cy=pos[ic+1], cz=pos[ic+2];
      if(!Number.isFinite(ax+ay+az+bx+by+bz+cx+cy+cz)) continue;
      const abx=bx-ax, aby=by-ay, abz=bz-az;
      const acx=cx-ax, acy=cy-ay, acz=cz-az;
      let nx=aby*acz-abz*acy, ny=abz*acx-abx*acz, nz=abx*acy-aby*acx;
      const len=Math.hypot(nx,ny,nz); if(len<=1e-9) continue;
      const area=(len/2)*sampleStep; if(area<=0) continue;
      const sx=nx/len, sy=ny/len, sz=nz/len;
      const axn=Math.abs(sx), ayn=Math.abs(sy), azn=Math.abs(sz);
      // 0.08 bucket: 판금의 서로 다른 큰 판면 방향을 비교적 민감하게 분리
      const dirKey=`${Math.round(axn/0.08)}:${Math.round(ayn/0.08)}:${Math.round(azn/0.08)}`;
      const cxm=(ax+bx+cx)/3, cym=(ay+by+cy)/3, czm=(az+bz+cz)/3;
      tris.push({x:cxm,y:cym,z:czm,sx,sy,sz,ax:axn,ay:ayn,az:azn,dirKey,area,t});
      sampledArea += area;
      const d=dirArea.get(dirKey)||{area:0, ax:axn, ay:ayn, az:azn}; d.area+=area; dirArea.set(dirKey,d);
    }
    if(!tris.length || sampledArea<=0) return out;
    const dirs=[...dirArea.values()].sort((a,b)=>b.area-a.area);
    const significantDirs = dirs.filter(d => d.area/sampledArea >= 0.035);
    const majorDirs = dirs.filter(d => d.area/sampledArea >= 0.075);
    const base = dirs[0];

    // 방향 기반 절곡: 한 장 판금이 N개의 큰 판면 방향을 가지면 보통 절곡선은 N-1개 이상이다.
    // 사용자가 지적한 덕트/후드 형상처럼 4개 판면 방향이면 절곡 3회로 잡히게 한다.
    const directionBends = Math.max(0, Math.min(12, significantDirs.length - 1));

    const dotBaseAbs = tr => Math.abs(tr.ax*base.ax + tr.ay*base.ay + tr.az*base.az);
    const candidates = tris.filter(tr => dotBaseAbs(tr) < 0.92);

    // 위치 기반 플랜지/패치 클러스터링
    let patchBends = 0, compactHoles = 0;
    if(candidates.length){
      const eps = Math.max(4, Math.min(38, Math.max(minDim*7, maxDim*0.018)));
      const parent = Array.from({length:candidates.length},(_,i)=>i);
      const find=i=>{ while(parent[i]!==i){ parent[i]=parent[parent[i]]; i=parent[i]; } return i; };
      const unite=(a,b)=>{ const ra=find(a), rb=find(b); if(ra!==rb) parent[rb]=ra; };
      const buckets = new Map();
      for(let i=0;i<candidates.length;i++){
        const tr=candidates[i];
        const bx=Math.floor(tr.x/eps), by=Math.floor(tr.y/eps), bz=Math.floor(tr.z/eps);
        for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) for(let dz=-1;dz<=1;dz++){
          const arr=buckets.get(`${bx+dx}:${by+dy}:${bz+dz}`); if(!arr) continue;
          for(const j of arr){
            const ot=candidates[j];
            const dist=Math.hypot(tr.x-ot.x,tr.y-ot.y,tr.z-ot.z);
            const ndot=Math.abs(tr.sx*ot.sx + tr.sy*ot.sy + tr.sz*ot.sz);
            if(dist <= eps && (ndot > 0.25 || dist <= eps*0.50)) unite(i,j);
          }
        }
        const k=`${bx}:${by}:${bz}`; if(!buckets.has(k)) buckets.set(k,[]); buckets.get(k).push(i);
      }
      const comps = new Map();
      for(let i=0;i<candidates.length;i++){
        const r=find(i), tr=candidates[i];
        const c=comps.get(r)||{area:0,count:0,minx:Infinity,maxx:-Infinity,miny:Infinity,maxy:-Infinity,minz:Infinity,maxz:-Infinity,dirs:new Map()};
        c.area+=tr.area; c.count++;
        if(tr.x<c.minx)c.minx=tr.x; if(tr.x>c.maxx)c.maxx=tr.x;
        if(tr.y<c.miny)c.miny=tr.y; if(tr.y>c.maxy)c.maxy=tr.y;
        if(tr.z<c.minz)c.minz=tr.z; if(tr.z>c.maxz)c.maxz=tr.z;
        c.dirs.set(tr.dirKey,(c.dirs.get(tr.dirKey)||0)+tr.area);
        comps.set(r,c);
      }
      const compList=[...comps.values()].map(c=>{
        const sx=c.maxx-c.minx, sy=c.maxy-c.miny, sz=c.maxz-c.minz;
        const spans=[sx,sy,sz].sort((a,b)=>a-b);
        const dirCount=[...c.dirs.values()].filter(v=>c.area>0 && v/c.area>0.12).length;
        return {...c,sx,sy,sz,spanMin:spans[0]||0,spanMid:spans[1]||0,spanMax:spans[2]||0,dirCount};
      });
      const holeMax = Math.max(10, Math.min(80, Math.max(minDim*42, maxDim*0.08)));
      const holeComps = compList.filter(c => {
        const compact = c.spanMax <= holeMax && c.spanMid <= holeMax;
        const enough = c.area >= Math.max(2, sampledArea*0.000025);
        const roundish = c.dirCount >= 2 || c.count >= 5;
        const notLong = c.spanMax / Math.max(1,c.spanMid) < 3.2;
        return compact && enough && roundish && notLong;
      });
      compactHoles = holeComps.length;
      const minFlangeArea = Math.max(30, sampledArea*0.0010);
      const flangeComps = compList.filter(c => {
        if(holeComps.includes(c)) return false;
        const longPatch = c.spanMax >= Math.max(14, minDim*7);
        const enough = c.area >= minFlangeArea;
        const notOuterNeedle = c.spanMid >= Math.max(2, minDim*0.65) || c.area >= sampledArea*0.006;
        return longPatch && enough && notOuterNeedle;
      });
      patchBends = Math.max(0, Math.min(16, flangeComps.length));
    }

    // Feature edge 기반 홀/절곡 보정
    const edgeEstimate = estimateFeatureEdgesForSheet(pos, idx, metrics);
    const edgeBends = edgeEstimate.bends || 0;
    const edgeHoles = edgeEstimate.holes || 0;

    const bends = Math.max(directionBends, patchBends, edgeBends);
    const holes = Math.max(compactHoles, edgeHoles);

    out.directionBends = directionBends;
    out.patchBends = patchBends;
    out.edgeBends = edgeBends;
    out.featureHoles = edgeHoles;
    out.bends = Math.max(0, Math.min(16, Math.round(bends)));
    out.holes = Math.max(0, Math.min(120, Math.round(holes)));
    out.debug = `sheetV13 dirs=${significantDirs.length}/major${majorDirs.length} dirB=${directionBends} patchB=${patchBends} edgeB=${edgeBends}`;
    out.holeDebug = `holes compact=${compactHoles} featureLoop=${edgeHoles}`;
    return out;
  }catch(e){ console.warn('sheet feature estimate fail', e); return out; }
}

function estimateFeatureEdgesForSheet(pos, idx, metrics){
  const res = {bends:0, holes:0, debug:''};
  try{
    const maxTris = Math.floor(idx.length/3);
    if(maxTris <= 0 || maxTris > 90000) return res;
    const minDim=Number(metrics.minDim)||1, maxDim=Number(metrics.maxDim)||100;
    const vkey = (i) => `${Math.round(pos[i]*1000)/1000},${Math.round(pos[i+1]*1000)/1000},${Math.round(pos[i+2]*1000)/1000}`;
    const triNormals=[];
    const edges=new Map();
    for(let t=0;t<maxTris;t++){
      const va=idx[t*3]*3, vb=idx[t*3+1]*3, vc=idx[t*3+2]*3;
      const ax=pos[va], ay=pos[va+1], az=pos[va+2], bx=pos[vb], by=pos[vb+1], bz=pos[vb+2], cx=pos[vc], cy=pos[vc+1], cz=pos[vc+2];
      if(!Number.isFinite(ax+ay+az+bx+by+bz+cx+cy+cz)) continue;
      const abx=bx-ax, aby=by-ay, abz=bz-az, acx=cx-ax, acy=cy-ay, acz=cz-az;
      const nx=aby*acz-abz*acy, ny=abz*acx-abx*acz, nz=abx*acy-aby*acx;
      const len=Math.hypot(nx,ny,nz); if(len<=1e-9) continue;
      triNormals[t]=[nx/len,ny/len,nz/len];
      const verts=[va,vb,vc].map(vkey);
      for(const [a,b] of [[0,1],[1,2],[2,0]]){
        const k = verts[a] < verts[b] ? `${verts[a]}|${verts[b]}` : `${verts[b]}|${verts[a]}`;
        const e = edges.get(k)||{v1:verts[a],v2:verts[b],tris:[]}; e.tris.push(t); edges.set(k,e);
      }
    }
    const feature=[];
    for(const e of edges.values()){
      if(e.tris.length===1){ feature.push({...e, boundary:true, hard:false}); continue; }
      if(e.tris.length>=2){
        const n1=triNormals[e.tris[0]], n2=triNormals[e.tris[1]]; if(!n1||!n2) continue;
        const dot=Math.abs(n1[0]*n2[0]+n1[1]*n2[1]+n1[2]*n2[2]);
        if(dot < 0.91) feature.push({...e,boundary:false,hard:true,dot});
      }
    }
    if(!feature.length) return res;
    const vertToEdges=new Map();
    feature.forEach((e,i)=>{ for(const v of [e.v1,e.v2]){ if(!vertToEdges.has(v)) vertToEdges.set(v,[]); vertToEdges.get(v).push(i);} });
    const seen=new Set(), comps=[];
    const parseV=s=>s.split(',').map(Number);
    for(let i=0;i<feature.length;i++){
      if(seen.has(i)) continue;
      const stack=[i]; seen.add(i);
      const c={edges:0,boundary:0,hard:0,minx:Infinity,maxx:-Infinity,miny:Infinity,maxy:-Infinity,minz:Infinity,maxz:-Infinity,verts:new Set()};
      while(stack.length){
        const ei=stack.pop(), e=feature[ei]; c.edges++; if(e.boundary)c.boundary++; if(e.hard)c.hard++;
        for(const v of [e.v1,e.v2]){
          c.verts.add(v); const [x,y,z]=parseV(v);
          if(x<c.minx)c.minx=x; if(x>c.maxx)c.maxx=x; if(y<c.miny)c.miny=y; if(y>c.maxy)c.maxy=y; if(z<c.minz)c.minz=z; if(z>c.maxz)c.maxz=z;
          for(const ni of vertToEdges.get(v)||[]) if(!seen.has(ni)){ seen.add(ni); stack.push(ni); }
        }
      }
      const sx=c.maxx-c.minx, sy=c.maxy-c.miny, sz=c.maxz-c.minz; const spans=[sx,sy,sz].sort((a,b)=>a-b);
      c.spanMin=spans[0]||0; c.spanMid=spans[1]||0; c.spanMax=spans[2]||0; comps.push(c);
    }
    const holeMax=Math.max(8, Math.min(80, Math.max(minDim*45, maxDim*0.075)));
    const holeComps=comps.filter(c=>{
      const compact=c.spanMax<=holeMax && c.spanMid<=holeMax;
      const enough=c.edges>=8 || c.verts.size>=8;
      const loopish=c.boundary>0 || c.hard>0;
      const notOuter=c.spanMax < maxDim*0.22;
      const notLine=c.spanMax/Math.max(1,c.spanMid) < 3.6;
      return compact && enough && loopish && notOuter && notLine;
    });
    const bendComps=comps.filter(c=>{
      const long=c.spanMax>=Math.max(18,minDim*9);
      const mostlyHard=c.hard>=Math.max(2,c.edges*0.45);
      const notOuterBoundary=c.boundary < c.edges*0.55;
      const notCompact=c.spanMax/Math.max(1,c.spanMid)>=3.0 || c.spanMax>maxDim*0.18;
      return long && mostlyHard && notOuterBoundary && notCompact;
    });
    res.holes=Math.min(120,holeComps.length);
    res.bends=Math.min(16,bendComps.length);
    res.debug=`feature comps=${comps.length} holes=${res.holes} bends=${res.bends}`;
    return res;
  }catch(e){ console.warn('feature edge estimate fail',e); return res; }
}

function parseStepText(text, fileName){
  const entities = readEntities(text);
  const products = new Map(), formations = new Map(), pdMap = new Map(), links = [];
  const productByNumber = [];

  for (const e of entities) {
    if (e.type === 'PRODUCT') {
      const strings = getStepStrings(e.args);
      const name = cleanName(strings[0] || strings[1] || e.id);
      const obj = {id:e.id, num:refNum(e.id), name, args:strings};
      products.set(e.id, obj);
      productByNumber.push(obj);
    }
  }
  productByNumber.sort((a,b)=>a.num-b.num);

  // STEP exporter에 따라 PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE 등으로 나옴
  for (const e of entities) {
    if (e.type.startsWith('PRODUCT_DEFINITION_FORMATION')) {
      const refs = getRefs(e.args);
      const prodRef = refs.find(r => products.has(r));
      formations.set(e.id, {id:e.id, productId:prodRef || null, productName:prodRef ? products.get(prodRef).name : ''});
    }
  }

  for (const e of entities) {
    if (e.type === 'PRODUCT_DEFINITION') {
      const strings = getStepStrings(e.args);
      const refs = getRefs(e.args);
      const formRef = refs.find(r => formations.has(r));
      const form = formRef ? formations.get(formRef) : null;
      const pdName = cleanName(strings.find(s => s && s.trim()) || '');
      const nearest = nearestProductName(e.id, productByNumber);
      let productName = form?.productName || '';
      if (isBadName(productName)) productName = nearest || '';
      if (isBadName(productName) && !isBadName(pdName)) productName = pdName;
      pdMap.set(e.id, {id:e.id, num:refNum(e.id), pdName, formationId:formRef, productId:form?.productId || null, productName, nearestProductName:nearest});
    }
  }

  for (const e of entities) {
    if (e.type === 'NEXT_ASSEMBLY_USAGE_OCCURRENCE') {
      const refs = getRefs(e.args);
      const strings = getStepStrings(e.args);
      if (refs.length >= 2) {
        const occCandidate = cleanName(strings.find(s => s && !isGenericOccurrence(s)) || '');
        links.push({id:e.id, parent:refs[0], child:refs[1], occurrenceName:occCandidate, rawStrings:strings});
      }
    }
  }

  const parentSet = new Set(links.map(l=>l.parent));
  const leafLinks = links.filter(l => !parentSet.has(l.child));
  const byKey = new Map();

  for (const l of leafLinks) {
    const pd = pdMap.get(l.child);
    let name = choosePartName(pd, l.occurrenceName, '');
    // Next assembly relationship/design/#숫자 같은 이름은 절대 파트명으로 사용하지 않음.
    // 실제 PRODUCT명으로 해결되지 않은 leaf는 표에서 제외하고 진단에만 남긴다.
    if (isBadName(name) || isNumberishName(name) || /^#\d+$/.test(String(name).trim())) continue;
    if (isAssemblyName(name)) continue;
    const key = norm(name) || l.child;
    if (!byKey.has(key)) byKey.set(key, {
      id:key, name, quantity:0, pdIds:new Set(), linkIds:[], source:'leaf product',
      rawNames:new Set(), meshIndex:null, meshName:''
    });
    const row = byKey.get(key);
    row.quantity += 1;
    row.pdIds.add(l.child);
    row.linkIds.push(l.id);
    row.rawNames.add(name);
  }

  // 일부 exporter는 NAUO link는 있어도 leaf 링크 이름이 깨질 수 있음. 그땐 parent로 쓰이지 않는 PRODUCT_DEFINITION을 직접 leaf로 사용.
  if (byKey.size === 0 || [...byKey.values()].every(r => isBadName(r.name) || isNumberishName(r.name))) {
    byKey.clear();
    for (const [pdId, pd] of pdMap) {
      if (parentSet.has(pdId)) continue;
      let name = choosePartName(pd, '', '');
      if (isBadName(name) || isNumberishName(name) || /^#\d+$/.test(String(name).trim())) continue;
      if (isAssemblyName(name)) continue;
      const key = norm(name) || pdId;
      if (!byKey.has(key)) byKey.set(key,{id:key,name,quantity:1,pdIds:new Set([pdId]),linkIds:[],source:'leaf PRODUCT_DEFINITION',rawNames:new Set([name]),meshIndex:null,meshName:''});
      else byKey.get(key).quantity += 1;
    }
  }

  const rows = [...byKey.values()].map(v => ({...v, pdIds:[...v.pdIds], rawNames:[...v.rawNames]}));
  rows.sort((a,b)=> naturalCompare(a.name,b.name));
  return { parts: rows, debug:{
    fileName, entityCount:entities.length, productCount:products.size, productDefinitionCount:pdMap.size,
    linkCount:links.length, leafLinkCount:leafLinks.length, assemblyExcludedCount:parentSet.size,
    sampleProducts:[...products.values()].slice(0,60), samplePd:[...pdMap.values()].slice(0,60), sampleLinks:links.slice(0,60), sampleRows:rows.slice(0,80)
  }};
}

function readEntities(text){
  const list=[]; const re=/#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*?)\);/gi; let m;
  while((m=re.exec(text))!==null){ list.push({id:'#'+m[1], type:m[2].toUpperCase(), args:m[3]}); }
  return list;
}
function getRefs(s){ return (s.match(/#\d+/g)||[]); }
function getStepStrings(s){ const arr=[]; const re=/'((?:''|[^'])*)'/g; let m; while((m=re.exec(s))!==null) arr.push(m[1].replace(/''/g,"'")); return arr; }
function cleanName(s){ return String(s||'').replace(/^\s+|\s+$/g,'').replace(/^['"]|['"]$/g,'').replace(/\s+/g,' '); }
function refNum(ref){ const m=String(ref||'').match(/#(\d+)/); return m?Number(m[1]):0; }
function nearestProductName(pdId, sortedProducts){
  const n=refNum(pdId); let best=null;
  for (const p of sortedProducts){ if(p.num < n) best=p; else break; }
  return best && !isBadName(best.name) ? best.name : '';
}
function isGenericOccurrence(s){ const n=String(s||'').toLowerCase(); return !n || n==='next assembly relationship' || n==='design' || n==='na' || n==='none'; }
function isNumberishName(s){ return /^#?\d+$/.test(String(s||'').trim()); }
function isBadName(s){ const n=String(s||'').trim().toLowerCase(); return !n || n==='design' || n==='next assembly relationship' || n==='part' || n==='unknown' || n==='unnamed_part' || isNumberishName(n); }
function choosePartName(pd, occ, fallback){ if(occ && !isGenericOccurrence(occ) && !isNumberishName(occ)) return occ; if(pd?.productName && !isBadName(pd.productName)) return pd.productName; if(pd?.nearestProductName && !isBadName(pd.nearestProductName)) return pd.nearestProductName; if(pd?.pdName && !isBadName(pd.pdName)) return pd.pdName; return fallback || 'UNNAMED_PART'; }
function isAssemblyName(name){ const n=String(name||'').toUpperCase(); return /(_ASM$|_ASSY$|ASSY_|ASSEMBLY|ASM$)/.test(n); }
function norm(s){ return String(s||'').toUpperCase().replace(/[^A-Z0-9가-힣]/g,''); }
function naturalCompare(a,b){ return String(a).localeCompare(String(b),'ko',{numeric:true,sensitivity:'base'}); }

function meshCleanName(name){
  const raw=String(name||'').trim();
  let n=raw.replace(/^mesh[_ -]*/i,'').replace(/\.[^.]+$/,'');
  n=n.replace(/^(PRODUCT|PART|SHAPE)[_ -]*/i,'');
  return cleanName(n) || raw;
}
function betterPartName(partName, meshName){
  const pc=cleanName(partName), mc=meshCleanName(meshName);
  if(!isBadName(pc) && !isNumberishName(pc)) return pc;
  if(!isBadName(mc) && !isNumberishName(mc)) return mc;
  return pc || mc || 'UNNAMED_PART';
}
function mergeTextPartsWithMeshes(parts, meshes){
  const meshInfo = state.meshObjects.map((o,i)=>({idx:i, name:o.name||`MESH_${i+1}`, clean:meshCleanName(o.name||`MESH_${i+1}`), norm:o.norm, cleanNorm:norm(meshCleanName(o.name||'')), metrics:o.metrics}));
  const meshGroups = new Map();
  for(const mi of meshInfo){
    if(isBadName(mi.clean) || isNumberishName(mi.clean) || isAssemblyName(mi.clean)) continue;
    const key = mi.cleanNorm || norm(mi.clean);
    if(!key) continue;
    if(!meshGroups.has(key)) meshGroups.set(key,{id:key,name:mi.clean,quantity:0,meshIndex:mi.idx,meshName:mi.name,meshMetrics:mi.metrics,source:'mesh leaf'});
    meshGroups.get(key).quantity += 1;
  }

  const by = new Map();
  const usedMeshKeys = new Set();
  const addRow = (row) => {
    const key = norm(row.name) || row.id;
    if(!key || isBadName(row.name) || isNumberishName(row.name) || isAssemblyName(row.name)) return;
    if(!by.has(key)) by.set(key,{...row,id:key,quantity:0,pdIds:[],linkIds:[]});
    const r=by.get(key);
    r.quantity += Number(row.quantity)||1;
    if(row.pdIds) r.pdIds.push(...row.pdIds);
    if(row.linkIds) r.linkIds.push(...row.linkIds);
    if((r.meshIndex==null || !r.meshName) && row.meshIndex!=null){ r.meshIndex=row.meshIndex; r.meshName=row.meshName; r.meshMetrics=row.meshMetrics; }
  };

  for(const p of parts){
    const originalName = p.name;
    if(isBadName(originalName) || isNumberishName(originalName)) continue; // #82708 같은 가짜 leaf 제거
    const pn = norm(originalName);
    const psimple = norm(String(originalName).replace(/(_REV\d+|REV\d+|_ASM|_ASSY|ASSY|ASM)$/ig,''));
    let matched = null, matchedKey = '';
    if(pn){
      for(const [k,mi] of meshGroups){ if(k.includes(pn) || pn.includes(k)){ matched=mi; matchedKey=k; break; } }
    }
    if(!matched && psimple){
      for(const [k,mi] of meshGroups){ if(k.includes(psimple) || psimple.includes(k)){ matched=mi; matchedKey=k; break; } }
    }
    if(matchedKey) usedMeshKeys.add(matchedKey);
    addRow({...p, name:betterPartName(originalName, matched?.name || ''), meshIndex:matched?.meshIndex ?? null, meshName:matched?.meshName||'', meshMetrics:matched?.meshMetrics||null});
  }

  // V13: 어셈블리 중복 방지.
  // STEP 텍스트에서 실제 PRODUCT leaf가 3종 이상 잡힌 경우, 이름이 안 맞는 mesh-only 행은 표에 추가하지 않는다.
  // 그렇지 않으면 #82708 같은 OCCT 내부 번호/가짜 mesh가 견적표에 섞인다.
  if(by.size < 3){
    for(const [key,mg] of meshGroups){
      if(usedMeshKeys.has(key) || by.has(key)) continue;
      if(isBadName(mg.name) || isNumberishName(mg.name) || isAssemblyName(mg.name)) continue;
      addRow({id:key,name:mg.name,quantity:mg.quantity,source:'mesh leaf fallback',pdIds:[],linkIds:[],meshIndex:mg.meshIndex,meshName:mg.meshName,meshMetrics:mg.meshMetrics});
    }
  }

  return [...by.values()].sort((a,b)=>naturalCompare(a.name,b.name));
}

function enrichPart(p, idx){
  const features = deriveFeatures(p.name, p.meshMetrics);
  const cls = classifyPartAdvanced(p.name, features);
  const process = cls.process;
  return {
    ...p,
    id: p.id || `part_${idx}`,
    process,
    material: features.presetMaterial || defaultMaterial(process, p.name),
    thickness: features.thickness,
    taps: features.taps,
    bends: features.bends,
    margin: getDefaultMargin(process),
    features,
    reason: cls.reason,
    confidence: cls.confidence,
    scores: cls.scores,
    scoreLine: cls.scoreLine,
    quote: 0,
    selected: false
  };
}



function presetByPartName(name){
  const n = String(name||'').toUpperCase();
  // V13: 이름 규칙은 "fallback" 또는 "강한 제외" 용도만 쓴다.
  // 절곡/홀은 mesh 분석값을 1순위로 쓰고, mesh가 못 잡은 경우에만 기본값을 보태는 구조다.
  const preset = { forceSheet:false, forcePurchase:false, forceCnc:false, thickness:null, bends:null, holes:null, material:null, note:'' };
  if(/BOLT|SCREW|HEX[_ -]?NUT|\bNUT\b|WASHER|RIVET|REVET|BEARING|SENSOR|MOTOR|VALVE|NIPPLE|FITTING|PIPE|TUBE|각관|배관|피팅|PIE|LEAD/.test(n)){
    preset.forcePurchase=true;
    preset.thickness=8;
    preset.bends=0;
    preset.holes=0;
    preset.material=/SUS|STS|NIPPLE|PIPE|TUBE|PIE|VALVE/.test(n)?'SUS304':'SS400';
    preset.note='구매품/표준품 이름 규칙';
    return preset;
  }
  if(/HOOD|COVER|PANEL|BODY|SKEL|SHEET|SIDE|TOP|BRACKET|WATER[_ -]?BOTTLE/.test(n) && !/BASE|BLOCK|JIG|FIXTURE/.test(n)){
    preset.forceSheet=true;
    preset.thickness=/\b(\d+(?:\.\d+)?)T\b/.test(n) ? null : 1.5;
    preset.material='SUS304';
    // mesh가 전혀 없거나 못 잡을 때 최소값만 주는 fallback. 자동 확정이 아니다.
    if(/HOOD[_ -]?BODY|TOP[_ -]?COVER|COVER[_ -]?TOP/.test(n)){ preset.bends=3; preset.holes=2; preset.note='판금명 fallback: 실제 mesh 분석값 우선'; }
    else if(/HOOD[_ -]?SKEL|SKEL/.test(n)){ preset.bends=2; preset.holes=2; preset.note='SKEL fallback: 실제 mesh 분석값 우선'; }
    else if(/WATER[_ -]?BOTTLE/.test(n)){ preset.bends=2; preset.holes=2; preset.note='WATER_BOTTLE fallback: 실제 mesh 분석값 우선'; }
    else { preset.bends=null; preset.holes=null; preset.note='판금명 후보'; }
  }
  return preset;
}

function deriveFeatures(name, metrics){
  const n = String(name||'').toUpperCase();
  const preset = presetByPartName(n);
  const tMatch = n.match(/(?:^|[-_\s])(\d+(?:\.\d+)?)\s*T(?:$|[-_\s])|(?:^|[-_\s])T\s*(\d+(?:\.\d+)?)(?:$|[-_\s])/);
  const tName = tMatch ? Number(tMatch[1]||tMatch[2]) : 0;
  const m = metrics || {};
  const minDim = Number(m.minDim)||0, midDim=Number(m.midDim)||0, maxDim=Number(m.maxDim)||0;
  const solidness = Number(m.solidness)||0;
  const majorPlaneDirections = Number(m.majorPlaneDirections)||0;
  const dominantPlaneDirections = Number(m.dominantPlaneDirections)||0;
  const normalClusterCount = Number(m.normalClusterCount)||0;
  const flatPlateLike = Boolean(m.flatPlateLike || (minDim>0 && maxDim/minDim>7 && midDim/minDim>2.2));
  const shellLike = Boolean(flatPlateLike || (solidness>0 && solidness<0.24 && maxDim>45 && minDim>0 && maxDim/minDim>4));
  const cylinderLike = Boolean(m.cylinderLike);
  const purchaseName = preset.forcePurchase || /BOLT|SCREW|HEX[_ -]?NUT|\bNUT\b|WASHER|RIVET|REVET|BEARING|SENSOR|MOTOR|VALVE|NIPPLE|FITTING|PIPE|TUBE|각관|배관|피팅|PIE|LEAD/.test(n);
  const bendNameHint = /BEND|BENT|FOLD|FLANGE|절곡|L[-_ ]?BRACKET|U[-_ ]?BRACKET|ㄱ|ㄷ/.test(n);
  const sheetNameHint = preset.forceSheet || /HOOD|COVER|PANEL|BODY|SKEL|SHEET|SIDE|TOP|브라켓|BRACKET|WATER[_ -]?BOTTLE|CASE_COVER/.test(n);
  const thickByName = tName>=10;
  let thickness = preset.thickness || tName || (minDim>0 && minDim<=12 ? round1(minDim) : (sheetNameHint ? 1.5 : 8));
  const sheetGeometry = preset.forceSheet || ((flatPlateLike || shellLike || (sheetNameHint && minDim>0 && minDim<=8)) && minDim>0 && minDim <= 12 && !cylinderLike && !thickByName && !purchaseName);

  // V13 절곡 기준: mesh 분석값을 우선하고, 이름 규칙은 mesh가 못 잡은 경우 보조로만 쓴다.
  let bends = 0;
  const patchBends = Number(m.bendPatchCount)||0;
  const directionBends = Number(m.directionBendCount)||0;
  const edgeBends = Number(m.edgeBendCount)||0;
  const meshBends = Math.max(patchBends, directionBends, edgeBends);
  if(sheetGeometry && meshBends > 0) bends = meshBends;
  else if(sheetGeometry && preset.bends != null) bends = Number(preset.bends)||0;
  else if(sheetGeometry && bendNameHint) bends = Math.max(1, Number(m.majorPlaneDirections||0)-1);
  else if(sheetGeometry && sheetNameHint && majorPlaneDirections >= 2) bends = Math.max(1, majorPlaneDirections - 1);
  else if(sheetGeometry && majorPlaneDirections >= 3 && solidness < 0.24) bends = Math.max(1, majorPlaneDirections - 2);
  if(/U[-_ ]?BRACKET|UBRACKET|ㄷ/.test(n)) bends = Math.max(bends,2);
  if(/L[-_ ]?BRACKET|LBRACKET|ㄱ/.test(n)) bends = Math.max(bends,1);
  bends = Math.max(0, Math.min(16, Math.round(bends)));

  // V13 홀/탭 후보: 원형/타원형 feature loop, cylindrical patch, compact hole component를 모두 홀 후보로 본다.
  let holeCandidates = Math.max(0, Number(m.holeCandidateCount)||0, Number(m.featureHoleCount)||0);
  if(!purchaseName){
    if(holeCandidates === 0 && preset.holes != null) holeCandidates = Number(preset.holes)||0;
    if(/TAP|M\d+/.test(n)) holeCandidates = Math.max(holeCandidates, 1);
    // 원형을 놓치는 경우를 막기 위한 보수 fallback. 단, 이것은 초기값이고 공장이 수정한다.
    if(holeCandidates === 0 && sheetGeometry && normalClusterCount>=10) holeCandidates = Math.max(holeCandidates, Math.min(24, Math.round((normalClusterCount-6)/2)));
  }
  const taps = Math.max(0, Math.round(holeCandidates));
  const holeDebug = purchaseName ? '구매품은 홀/탭 자동 0' : (taps>0 ? `원형/타원형 홀 후보 ${taps}개: mesh=${m.holeCandidateCount||0}, loop=${m.featureHoleCount||0}, fallback=${preset.holes||0}` : '홀 후보 없음');
  const bendDebug = bends>0 ? `절곡 후보 ${bends}회: direction=${directionBends}, patch=${patchBends}, edge=${edgeBends}, fallback=${preset.bends||0}` : '절곡 후보 없음';
  return {metrics:m, tName, thickness, minDim, midDim, maxDim, solidness, flatPlateLike, shellLike, cylinderLike, normalClusterCount, majorPlaneDirections, dominantPlaneDirections, bendNameHint, sheetNameHint, thickByName, bends, taps, sheetGeometry, patchBends, directionBends, edgeBends, holeDebug, bendDebug, presetNote:preset.note, forceSheet:preset.forceSheet, forcePurchase:preset.forcePurchase, presetMaterial:preset.material};
}

function round1(v){ return Math.round(v*10)/10; }

function classifyPartAdvanced(name, f){
  const n = String(name||'').toUpperCase();
  const scores = {purchase:0, profile:0, lathe:0, sheet:0, cnc:0, print3d:0, injection:0, welding:0, unknown:0};
  const why = {purchase:[], profile:[], lathe:[], sheet:[], cnc:[], print3d:[], injection:[], welding:[], unknown:[]};
  const add=(k,pts,msg)=>{ scores[k]+=pts; if(msg) why[k].push(msg); };

  if(f.forcePurchase) add('purchase',150,'구매품 강제 규칙');
  if(f.forceSheet) add('sheet',95,'판금 강제 규칙: '+(f.presetNote||''));

  // 1) 구매품: 볼트/너트/리벳/파이프/피팅/니플/센서/모터는 최우선. 파이프는 프로파일보다 먼저 잡는다.
  if(/BOLT|SCREW|HEX[_ -]?NUT|\bNUT\b|WASHER|RIVET|REVET|BEARING|SENSOR|MOTOR|VALVE|NIPPLE|FITTING|PIPE|TUBE|각관|배관|피팅|PIE|LEAD/.test(n)) add('purchase',110,'표준품/구매품 이름');
  if(/M\d+[-_ ]?L\d+/.test(n) && /BOLT|SCREW/.test(n)) add('purchase',30,'볼트/스크류 규격');
  if(/PIPE|TUBE|PIE|NIPPLE|FITTING/.test(n)) { add('profile',-100,'파이프류는 프로파일 제외'); add('cnc',-80,'파이프류는 CNC 제외'); add('sheet',-60,'파이프류는 판금 제외'); }

  // 2) 프로파일/압출: 2020/3030/4040 등. 단 PIPE/TUBE면 구매품에서 끝난다.
  if(/PROFILE|AL[-_ ]?FRAME|EXTRUSION|3030|4040|4080|2020|4545|6060|8080/.test(n)) add('profile',90,'프로파일/압출 규격명');
  if(f.maxDim>0 && f.metrics?.slenderness>5 && !/PIPE|TUBE|PIE/.test(n)) add('profile',18,'긴 일정 단면 가능성');

  // 3) 선반: 회전체/축류. 구매품 키워드와 겹치면 구매품을 우선한다.
  if(/SHAFT|BUSH|BUSHING|ROLLER|COLLAR|ROD|SPACER|축|부싱/.test(n)) add('lathe',75,'축/부싱/롤러 이름');
  if(/PIN/.test(n)) add('lathe',35,'핀 후보');
  if(f.cylinderLike) add('lathe',45,'형상: 길쭉한 원통형 bbox');

  // 4) 판금/절곡: 같은 두께 판재/쉘형 + 커버/후드/패널/바디명. 절곡은 bends 값으로 따로 관리.
  if(f.sheetNameHint) add('sheet',32,'판금/커버/후드/패널류 이름');
  if(f.flatPlateLike) add('sheet',48,'형상: 얇고 넓은 판재형');
  if(f.shellLike) add('sheet',38,'형상: bbox 대비 체적 낮은 쉘/판재형');
  if(f.sheetGeometry && f.majorPlaneDirections>=2) add('sheet',32,`형상: 서로 다른 판면 방향 ${f.majorPlaneDirections}개`);
  if(f.tName>0 && f.tName<=6) add('sheet',28,`두께명 ${f.tName}T`);
  if(f.tName>12) add('sheet',-35,`두께명 ${f.tName}T: 두꺼워 판금 감점`);
  if(f.bends>0) add('sheet',25,`절곡 후보 ${f.bends}회`);
  if(f.patchBends>0) add('sheet',18,`mesh 플랜지 패치 ${f.patchBends}개`);
  if(/HOOD|WATER[_ -]?BOTTLE|COVER|PANEL|SIDE|TOP/.test(n)) add('sheet',18,'제품명상 판금 가능성');

  // 5) 사출/3D프린팅: 플라스틱 케이스류는 확정하지 않고 낮은 점수만 부여.
  if(/PLASTIC|ABS|POM|PA66|NYLON|RESIN/.test(n)) { add('print3d',35,'플라스틱 소재명'); add('injection',35,'플라스틱 소재명'); }
  if(/CASE|HOUSING|CAP|COVER/.test(n) && !/TOP_COVER|HOOD|PANEL/.test(n)) { add('print3d',20,'케이스류'); add('injection',18,'케이스류'); }

  // 6) CNC/MCT: 구매품/프로파일/선반/판금을 빼고 남는 덩어리형·두꺼운 플레이트·지그류.
  if(/BASE|BLOCK|JIG|FIXTURE|MOUNT|HOLDER|SUPPORT|ADAPTER|GUIDE|CLAMP|PLATE|BRKT/.test(n)) add('cnc',38,'가공품/지그/플레이트 이름');
  if(f.solidness>0.28 && f.maxDim>0) add('cnc',42,'형상: bbox 대비 체적 높은 덩어리형');
  if(f.tName>=8) add('cnc',35,`두꺼운 ${f.tName}T 소재`);
  if(!f.sheetNameHint && !f.flatPlateLike && !f.cylinderLike && scores.purchase<50 && scores.profile<50) add('cnc',18,'다른 공법 제외 후 절삭 후보');
  if(f.shellLike || f.flatPlateLike) add('cnc',-35,'판재/쉘형이므로 CNC 감점');

  // Strong exclusion by higher-priority classes.
  if(scores.purchase>=80){ ['profile','lathe','sheet','cnc','print3d','injection','welding'].forEach(k=>scores[k]-=80); }
  if(scores.profile>=80){ ['sheet','cnc'].forEach(k=>scores[k]-=55); }
  if(scores.lathe>=80){ ['sheet','cnc'].forEach(k=>scores[k]-=35); }
  if(scores.sheet>=75){ scores.cnc-=45; }

  const order=['purchase','profile','lathe','sheet','cnc','print3d','injection','welding'];
  const ranked=order.map(k=>[k,scores[k]]).sort((a,b)=>b[1]-a[1]);
  const [best,bestScore]=ranked[0]; const secondScore=ranked[1]?.[1] ?? 0;
  let process=best, confidence='낮음';
  if(bestScore<42 || bestScore-secondScore<12){ process='unknown'; confidence='낮음'; add('unknown',1,'공장이 선택 필요'); }
  else if(bestScore>=92 && bestScore-secondScore>=25) confidence='높음';
  else confidence='보통';
  const reasonKey = process==='unknown' ? best : process;
  const reason = (why[reasonKey]||[]).slice(0,4).join(' / ') || '명확한 자동분류 근거 부족';
  const scoreLine = ranked.slice(0,4).map(([k,v])=>`${PROCESS_LABELS[k]} ${Math.round(v)}`).join(' · ');
  return {process, reason, confidence, scores, scoreLine};
}

function defaultMaterial(process, name){
  const n=String(name||'').toUpperCase();
  if(/SUS|STS|304|HOOD|WATER[_ -]?BOTTLE|NIPPLE|PIPE|TUBE|PIE/.test(n)) return 'SUS304';
  if(process==='purchase') return 'SS400';
  if(process==='sheet') return 'SPCC';
  if(process==='print3d'||process==='injection') return /POM/.test(n)?'POM':'ABS';
  return 'AL6061';
}
function getDefaultMargin(process){ return Number(state.rates?.process?.[process]?.margin ?? 0); }

function recalcAll(){ state.parts.forEach(p => p.quote = calcQuote(p)); updateStats(); }
function calcQuote(p){
  const q = Math.max(0, Number(p.quantity)||0); const material = state.rates.materials[p.material] || state.rates.materials.AL6061;
  const materialRate = material.market * (1 + (Number(material.markupPercent)||0)/100);
  const matCost = estimateMaterialCost(p, materialRate);
  let procCost = 0; const pr = state.rates.process[p.process] || state.rates.process.unknown;
  const f = p.features || {}; const maxDim = Number(f.maxDim)||0; const volCm3 = (Number(f.metrics?.volumeMm3)||0)/1000;
  const sizeKey = maxDim > 300 ? 'large' : (maxDim > 120 ? 'medium' : 'small');
  if(p.process==='unknown') return 0;
  if(p.process==='purchase') procCost = purchaseUnitPrice(p.name) * q;
  else if(p.process==='profile') {
    const lengthM = Math.max(0.1, (maxDim || 600)/1000);
    procCost = ((pr.base||0) + lengthM*(pr.perMeter||0) + (pr.cut||0)*2 + (Number(p.taps)||0)*(pr.tap||0))*q;
  }
  else if(p.process==='lathe') procCost = (((pr[sizeKey]||pr.small||0)) + (Number(p.taps)||0)*(pr.tap||0))*q;
  else if(p.process==='sheet') {
    const bendPremium = Number(p.bends||0)*(pr.bend||0);
    const tapPremium = Number(p.taps||0)*(p.process==='sheet' ? (pr.hole||pr.tap||0) : (pr.tap||0));
    const sizePremium = maxDim>800 ? 12000 : (maxDim>400 ? 6000 : 0);
    procCost = ((pr.base||0) + bendPremium + tapPremium + sizePremium)*q;
  }
  else if(p.process==='cnc') {
    const complexity = Math.max(0, Math.min(1, (f.metrics?.normalComplexity||0) + (f.solidness>0.35?0.15:0)));
    procCost = (((pr[sizeKey]||pr.small||0)) + (Number(p.taps)||0)*(pr.tap||0) + Math.round(complexity*25000))*q;
  }
  else if(p.process==='print3d') procCost = ((pr.perCm3||0)*Math.max(20,volCm3))*q;
  else if(p.process==='injection') procCost = ((pr.piece||0)*q);
  else if(p.process==='welding') procCost = ((pr.base||0))*q;
  const subtotal = matCost + procCost;
  return Math.round(subtotal * (1 + (Number(p.margin)||0)/100));
}
function estimateMaterialCost(p, materialRate){
  if(p.process==='purchase' || p.process==='unknown') return 0;
  const q=Number(p.quantity)||0; const t=Number(p.thickness)||1;
  const density = Number((state.rates.materials[p.material]||{}).density)||2.7;
  const mm3 = Number(p.features?.metrics?.volumeMm3)||0;
  if(mm3>0){
    const kg = (mm3 * density) / 1000000; // mm3 -> cm3 -> g -> kg
    if(Number.isFinite(kg) && kg>0 && kg<10000) return Math.round(kg * q * materialRate);
  }
  let kg = 0.05;
  if(p.process==='sheet') kg = Math.max(0.05, t * 0.18);
  else if(p.process==='profile') kg = 0.5;
  else if(p.process==='cnc') kg = Math.max(0.08, t * 0.12);
  else if(p.process==='lathe') kg = 0.18;
  else if(p.process==='print3d') kg = 0.08;
  else if(p.process==='injection') kg = 0.03;
  return Math.round(kg * q * materialRate);
}
function purchaseUnitPrice(name){
  const n=String(name||'').toUpperCase();
  if(/SCREW/.test(n)) return 70; if(/BOLT/.test(n)) return 120; if(/HEX[_ -]?NUT|\bNUT\b/.test(n)) return 50; if(/RIVET|REVET/.test(n)) return 60;
  if(/BEARING/.test(n)) return 2500; if(/SENSOR/.test(n)) return 12000; if(/MOTOR/.test(n)) return 45000;
  if(/NIPPLE|FITTING/.test(n)) return 2500; if(/PIPE|TUBE|PIE/.test(n)) return 3500; if(/LEAD/.test(n)) return 18000;
  return 1000;
}

function renderParts(){
  const body=$('partsBody');
  if(!state.parts.length){ body.innerHTML='<tr><td colspan="10" class="empty-row">분석된 말단 파트가 없습니다.</td></tr>'; return; }
  body.innerHTML = state.parts.map(p => `
    <tr data-id="${esc(p.id)}" class="${p.id===state.selectedId?'active':''}">
      <td><div class="part-name">${esc(p.name)}</div><div class="hint">${esc(p.source||'leaf')} ${p.meshName?`/ mesh: ${esc(p.meshName)}`:''}</div></td>
      <td><input data-field="quantity" data-id="${esc(p.id)}" type="number" min="0" value="${p.quantity}"></td>
      <td><span class="badge">${esc(PROCESS_LABELS[p.process]||p.process)}</span><div class="hint">${esc(p.reason)} / 신뢰도 ${esc(p.confidence)}<br>${esc(p.scoreLine||'')}</div></td>
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
  const m=p.features?.metrics||{}; const dims=(m.dims||[]).map(x=>Math.round(x)).join(' × ');
  panel.innerHTML = `<h2>선택 파트 검토</h2><h3>${esc(p.name)}</h3><div class="preview-box">${esc(PROCESS_LABELS[p.process]||p.process)}</div>
    <div><span class="badge">${esc(PROCESS_LABELS[p.process]||p.process)}</span> <span class="badge">${esc(p.material)}</span> <span class="badge">수량 ${p.quantity}</span> <span class="badge">신뢰도 ${esc(p.confidence)}</span></div>
    <p class="mini">근거: ${esc(p.reason)}<br>점수: ${esc(p.scoreLine||'')}<br>크기: ${dims || '-'} mm / 체적비: ${Number(m.solidness||0).toFixed(2)} / 평면군: ${m.normalClusterCount||0} / 큰 판면방향: ${m.majorPlaneDirections||0}<br>절곡 분석: 방향 ${m.directionBendCount||0} · 패치 ${m.patchBendCount||0} · 엣지 ${m.edgeBendCount||0} → 적용 ${p.bends}<br>홀 분석: 원형성분 ${m.holeCandidateCount||0} · feature loop ${m.featureHoleCount||0} → 적용 ${p.taps}<br>두께 ${p.thickness}T / 홀·탭 후보 ${p.taps} / 절곡 ${p.bends}${m.bendPatchDebug ? '<br>절곡판정: '+esc(m.bendPatchDebug) : ''}<br>${p.features?.presetNote ? '기본규칙: '+esc(p.features.presetNote)+'<br>' : ''}${esc(p.features?.bendDebug||'')} / ${esc(p.features?.holeDebug||'')}<br>${p.meshName?'mesh: '+esc(p.meshName):'mesh 매칭 없음'}</p>
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
function exportCsv(){ const rows=[['파트명','수량','공법','재질','두께','홀/탭','절곡','마진','견적']].concat(state.parts.map(p=>[p.name,p.quantity,PROCESS_LABELS[p.process],p.material,p.thickness,p.taps,p.bends,p.margin,p.quote])); const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'); const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='step_quote_parts.csv'; a.click(); URL.revokeObjectURL(a.href); }
function esc(v){ return String(v??'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function won(v){ return `${Math.round(Number(v)||0).toLocaleString('ko-KR')}원`; }
