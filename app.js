'use strict';

const MONEY = new Intl.NumberFormat('ko-KR');
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const DEFAULT_RATES = {
  material: {
    AL6061: { base: 6200, addonPct: 18, density: 2.70 },
    SUS304: { base: 5200, addonPct: 25, density: 7.93 },
    SS400: { base: 1300, addonPct: 20, density: 7.85 },
    POM: { base: 7800, addonPct: 18, density: 1.41 },
    ABS: { base: 4200, addonPct: 20, density: 1.04 },
    PLA: { base: 3000, addonPct: 30, density: 1.24 }
  },
  processMargin: {
    '분류 필요': 0, '구매품': 10, 'CNC/MCT': 22, '선반': 20, '판금/절곡': 18, '3D프린팅': 28, '사출': 18, '프로파일/압출': 15, '용접': 22
  },
  baseProcess: {
    '분류 필요': 0,
    '구매품': 8000,
    'CNC/MCT': 65000,
    '선반': 45000,
    '판금/절곡': 30000,
    '3D프린팅': 25000,
    '사출': 0,
    '프로파일/압출': 18000,
    '용접': 40000
  },
  tap: { M3:1500, M4:1800, M5:2200, M6:2600, M8:3800, M10:5500, M12:7500 },
  bend: { under1:1500, t1to2:2500, t2to32:4000, t32to6:7000, over6:12000 },
  post: { 없음:0, 아노다이징:25000, 도장:30000, 분체도장:45000, 도금:35000, 샌딩:15000 }
};

const state = { parts: [], selectedId: null, rates: structuredClone(DEFAULT_RATES), parseReport: null };

function won(n){ return `${MONEY.format(Math.round(n||0))}원`; }
function safeName(s){ return (s || '').toString().replace(/\\'/g,"'").replace(/''/g,"'").trim(); }
function norm(s){ return (s || '').toString().toUpperCase().replace(/[^A-Z0-9가-힣_\-\.]/g,'_'); }
function parseStepStringLiteralArgs(text){
  // STEP single-quoted strings with doubled quotes are common. This extracts top-level args enough for PRODUCT/NAUO names.
  const args = [];
  let cur = '', depth = 0, inStr = false;
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    if(ch === "'"){
      if(inStr && text[i+1] === "'"){ cur += "'"; i++; continue; }
      inStr = !inStr; cur += ch; continue;
    }
    if(!inStr){
      if(ch === '(') depth++;
      if(ch === ')') depth--;
      if(ch === ',' && depth === 0){ args.push(cur.trim()); cur=''; continue; }
    }
    cur += ch;
  }
  if(cur.trim()) args.push(cur.trim());
  return args;
}
function unquote(v){
  v = (v||'').trim();
  if(v.startsWith("'") && v.endsWith("'")) return safeName(v.slice(1,-1));
  return v;
}
function refIds(s){ return [...(s||'').matchAll(/#\d+/g)].map(m=>m[0]); }

class StepTextParser {
  parse(text, fileName='uploaded.step'){
    const raw = text.replace(/\r/g,'');
    const records = this.extractRecords(raw);
    const entities = new Map(records.map(r=>[r.id, r]));

    const products = new Map();
    const pdfToProduct = new Map();
    const pdToProduct = new Map();
    const pdNames = new Map();
    const shapeReps = new Set();
    const brepNames = [];
    const links = [];

    for(const r of records){
      if(r.type === 'PRODUCT'){
        const args = parseStepStringLiteralArgs(r.body);
        products.set(r.id, { id:r.id, name:unquote(args[0]) || r.id, args });
      }
    }
    for(const r of records){
      if(r.type === 'PRODUCT_DEFINITION_FORMATION' || r.type === 'PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE'){
        const refs = refIds(r.body);
        const prodRef = refs.find(x=>products.has(x));
        if(prodRef) pdfToProduct.set(r.id, prodRef);
      }
    }
    for(const r of records){
      if(r.type === 'PRODUCT_DEFINITION'){
        const args = parseStepStringLiteralArgs(r.body);
        const refs = refIds(r.body);
        const pdfRef = refs.find(x=>pdfToProduct.has(x));
        if(pdfRef) pdToProduct.set(r.id, pdfToProduct.get(pdfRef));
        const nm = unquote(args[0]);
        if(nm && nm !== '$') pdNames.set(r.id, nm);
      }
    }
    for(const r of records){
      if(r.type.includes('SHAPE_DEFINITION_REPRESENTATION')) refIds(r.body).forEach(id=>shapeReps.add(id));
      if(r.type === 'MANIFOLD_SOLID_BREP' || r.type === 'BREP_WITH_VOIDS'){
        const args = parseStepStringLiteralArgs(r.body);
        const n = unquote(args[0]);
        if(n && n !== '$') brepNames.push({ id:r.id, name:n });
      }
    }
    for(const r of records){
      if(r.type === 'NEXT_ASSEMBLY_USAGE_OCCURRENCE'){
        const args = parseStepStringLiteralArgs(r.body);
        const refs = refIds(r.body).filter(id=>pdToProduct.has(id) || entities.get(id)?.type === 'PRODUCT_DEFINITION');
        // ISO: id/name/description/relating_product_definition/related_product_definition/reference_designator
        let parent = refs[0], child = refs[1];
        const occName = [unquote(args[1]), unquote(args[0]), unquote(args[2])].find(x=>x && x !== '$' && x !== '*') || '';
        if(parent && child){ links.push({ id:r.id, parent, child, occurrenceName:occName }); }
      }
    }

    const parentSet = new Set(links.map(l=>l.parent));
    const childSet = new Set(links.map(l=>l.child));
    const assemblyContainers = new Set(parentSet);
    const leafPds = [...childSet].filter(id=>!parentSet.has(id));

    // If links are present, leaf occurrence rows should come from NAUO child links, not just product name.
    let occurrenceRows = [];
    if(links.length){
      for(const l of links){
        if(!assemblyContainers.has(l.child)){
          const productName = this.productNameForPd(l.child, pdToProduct, products, pdNames);
          const occ = l.occurrenceName && !/^\s*(ASSEMBLY|DESIGN|ROOT)\s*$/i.test(l.occurrenceName) ? l.occurrenceName : '';
          const displayName = this.bestPartName([occ, productName, pdNames.get(l.child), l.child]);
          occurrenceRows.push({ pdId:l.child, parentPd:l.parent, name:displayName, productName, occurrenceName:l.occurrenceName, linkId:l.id, source:'NAUO leaf occurrence' });
        }
      }
    }

    // Some exporters do not expose useful NAUO. Fall back to product categories / BREP names.
    if(occurrenceRows.length === 0){
      const productRows = [...pdToProduct.keys()].filter(pd=>!assemblyContainers.has(pd)).map(pd=>({
        pdId:pd, parentPd:null, name:this.productNameForPd(pd,pdToProduct,products,pdNames), productName:this.productNameForPd(pd,pdToProduct,products,pdNames), occurrenceName:'', linkId:'', source:'PRODUCT_DEFINITION fallback'
      }));
      occurrenceRows = productRows;
    }
    if(occurrenceRows.length === 0 && brepNames.length){
      occurrenceRows = brepNames.map(b=>({pdId:b.id,parentPd:null,name:b.name,productName:b.name,occurrenceName:'',linkId:'',source:'BREP fallback'}));
    }

    // Remove assembly-ish names, but only if there are enough real part rows; otherwise keep for visibility with source/debug.
    const filtered = occurrenceRows.filter(row=>!this.isAssemblyContainerName(row.name));
    const rowsForQuote = filtered.length ? filtered : occurrenceRows;

    const grouped = new Map();
    for(const row of rowsForQuote){
      const key = norm(row.name) || row.pdId;
      if(!grouped.has(key)) grouped.set(key, { ...row, ids:[], qty:0, occurrences:[] });
      const g = grouped.get(key);
      g.qty += 1;
      g.ids.push(row.pdId);
      g.occurrences.push(row.occurrenceName || row.name);
    }

    const parts = [...grouped.values()].map((g, idx)=>this.makePart(g, idx));
    const report = { fileName, entityCount:records.length, productCount:products.size, productDefinitionCount:pdToProduct.size, linkCount:links.length, leafPdCount:leafPds.length, assemblyExcludedCount:assemblyContainers.size, brepCount:brepNames.length, samples:{ products:[...products.values()].slice(0,30), links:links.slice(0,30), rows:occurrenceRows.slice(0,50) } };
    return { parts, report };
  }
  extractRecords(text){
    const recs = [];
    let i=0;
    while(i<text.length){
      const hash = text.indexOf('#', i);
      if(hash < 0) break;
      const eq = text.indexOf('=', hash);
      if(eq < 0) break;
      const id = text.slice(hash, eq).trim();
      if(!/^#\d+$/.test(id)){ i=hash+1; continue; }
      let j=eq+1, inStr=false, depth=0;
      for(; j<text.length; j++){
        const ch=text[j];
        if(ch==="'"){
          if(inStr && text[j+1]==="'"){ j++; continue; }
          inStr=!inStr; continue;
        }
        if(inStr) continue;
        if(ch==='(') depth++;
        else if(ch===')') depth--;
        else if(ch===';' && depth<=0) break;
      }
      const statement=text.slice(eq+1,j).trim();
      const typeMatch=statement.match(/^([A-Z0-9_]+)\s*\((.*)\)$/is);
      if(typeMatch){ recs.push({ id, type:typeMatch[1].toUpperCase(), body:typeMatch[2], statement }); }
      i=j+1;
    }
    return recs;
  }
  productNameForPd(pd, pdToProduct, products, pdNames){
    const prodId = pdToProduct.get(pd);
    const pName = prodId ? products.get(prodId)?.name : '';
    return this.bestPartName([pdNames.get(pd), pName, pd]);
  }
  bestPartName(cands){
    for(let s of cands){
      s = safeName(s);
      if(!s || s === '$' || s === '*' || /^#\d+$/.test(s)) continue;
      if(/^\s*(NONE|UNKNOWN|UNNAMED|DEFAULT)\s*$/i.test(s)) continue;
      return s;
    }
    return 'PART_' + Math.random().toString(36).slice(2,7).toUpperCase();
  }
  isAssemblyContainerName(name){
    const n = norm(name);
    return /^(ASM|ASSEMBLY|SUBASM|SUB_ASSEMBLY|ROOT|DESIGN|PRODUCT|TOP|MAIN_ASSY)$/.test(n) || /(^|_)ASM($|_)/.test(n);
  }
  makePart(g, idx){
    const features = estimateFeatures(g.name, g.qty, idx);
    const rec = recommendProcess(g.name, features);
    return {
      id:'p'+idx, name:g.name, qty:g.qty, source:g.source, pdIds:g.ids, occurrences:g.occurrences,
      process:rec.process, recommendedProcess:rec.process, confidence:rec.confidence, reasons:rec.reasons,
      material: defaultMaterial(rec.process, g.name), thickness: features.thickness, tapCount: features.tapCount, bendCount: features.bendCount,
      margin: DEFAULT_RATES.processMargin[rec.process] ?? 20, post:'없음', features,
      cost:0
    };
  }
}

function estimateFeatures(name, qty, idx){
  const n = norm(name);
  const tMatch = n.match(/(?:^|_)(\d+(?:\.\d+)?)T(?:_|$)/) || n.match(/THK[_-]?(\d+(?:\.\d+)?)/);
  const thickness = tMatch ? parseFloat(tMatch[1]) : (/PLATE|PANEL|COVER|BRACKET|SHEET|FLANGE/.test(n) ? 2 : (/BASE|BLOCK/.test(n) ? 12 : 3));
  let bendCount = 0;
  if(/U_BRACKET|U-BRACKET|ㄷ|CHANNEL/.test(n)) bendCount = 2;
  else if(/L_BRACKET|L-BRACKET|ANGLE/.test(n)) bendCount = 1;
  else if(/BEND|BENT|FOLD|FLANGE|절곡/.test(n)) bendCount = /BOX|CASE|COVER/.test(n) ? 4 : 1;
  if(thickness > 6) bendCount = 0;
  const tapMatch = n.match(/M(3|4|5|6|8|10|12)[X_\-]?(\d+)/);
  const tapCount = tapMatch ? parseInt(tapMatch[2],10) : (/BASE|PLATE|JIG|FIXTURE|MOUNT/.test(n) ? 4 : 0);
  const size = guessSize(name, thickness, idx);
  return {
    thickness, bendCount, tapCount,
    isPipe:/PIPE|TUBE|각관|파이프|배관|SQUARE_TUBE|ROUND_TUBE/.test(n),
    isProfile:/PROFILE|ALFRAME|AL_FRAME|2020|3030|4040|4080|4545|5050|6060|8080/.test(n),
    isRotary:/SHAFT|PIN|BUSH|BUSHING|ROLLER|COLLAR|SPACER|축|샤프트/.test(n),
    isSheetLike: thickness <= 6 && /PLATE|PANEL|COVER|SHEET|BRACKET|FLANGE|BEND|BENT|FOLD|절곡/.test(n),
    hasBendHint:/BEND|BENT|FOLD|FLANGE|L_BRACKET|U_BRACKET|절곡/.test(n),
    hasCncHint:/BASE|BLOCK|JIG|FIXTURE|MOUNT|HOLDER|SUPPORT|ADAPTER|CLAMP|GUIDE|PLATE/.test(n),
    hasBuyHint:/BOLT|NUT|WASHER|BEARING|SENSOR|MOTOR|CYLINDER|SCREW|볼트|너트|베어링|센서|모터/.test(n),
    size
  };
}
function guessSize(name, thickness, idx){
  const n = norm(name);
  const l = n.match(/L(\d{2,5})/); const len = l ? parseInt(l[1],10) : 80 + (idx%7)*25;
  const w = /BASE|PLATE/.test(n) ? 120 : /COVER|PANEL/.test(n) ? 180 : 50 + (idx%5)*15;
  const h = thickness || 5;
  return { x: Math.max(w, len > 500 ? 40 : w), y: len > 500 ? len : 50 + (idx%6)*20, z: h };
}
function recommendProcess(name, f){
  const n = norm(name), reasons=[];
  if(f.hasBuyHint || f.isPipe){ reasons.push(f.isPipe?'파이프/튜브/각관은 표준 구매재 우선':'구매품 이름 힌트'); return {process:'구매품', confidence:'높음', reasons}; }
  if(f.isProfile){ reasons.push('프로파일/압출 규격 이름 힌트'); return {process:'프로파일/압출', confidence:'높음', reasons}; }
  if(f.isRotary){ reasons.push('축/핀/부싱/롤러 회전체 이름 힌트'); return {process:'선반', confidence:'높음', reasons}; }
  if(f.isSheetLike && f.hasBendHint){ reasons.push('얇은 판재형 + 절곡/플랜지 힌트'); return {process:'판금/절곡', confidence:f.bendCount>0?'높음':'보통', reasons}; }
  if(f.isSheetLike && /COVER|PANEL|SHEET/.test(n)){ reasons.push('얇은 판재형이나 절곡 힌트 없음. 절곡 0회로 공장 확인'); return {process:'판금/절곡', confidence:'보통', reasons}; }
  if(/CASE|HOUSING|COVER/.test(n) && /ABS|PLA|PLASTIC|RESIN|PP|PC/.test(n)){ reasons.push('플라스틱 케이스/하우징 힌트'); return {process:'3D프린팅', confidence:'보통', reasons}; }
  if(f.hasCncHint){ reasons.push('구매품/프로파일/선반/판금 제외 후 절삭 가공품 힌트'); return {process:'CNC/MCT', confidence:'보통', reasons}; }
  reasons.push('명확한 공법 힌트 없음. 공장이 선택');
  return {process:'분류 필요', confidence:'낮음', reasons};
}
function defaultMaterial(process,name){
  const n=norm(name); if(/SUS|STS|304|316/.test(n)) return 'SUS304'; if(/SS400|STEEL|철/.test(n)) return 'SS400'; if(/ABS/.test(n)) return 'ABS'; if(/PLA/.test(n)) return 'PLA'; if(process==='구매품') return 'SS400'; return 'AL6061';
}

function materialUnit(material){ const m=state.rates.material[material]||state.rates.material.AL6061; return m.base*(1+m.addonPct/100); }
function calcPart(part){
  const r=state.rates, q=Number(part.qty)||0, t=Number(part.thickness)||0, taps=Number(part.tapCount)||0, bends=Number(part.bendCount)||0;
  const size = part.features.size; const volumeCm3 = Math.max(1,(size.x*size.y*Math.max(t,1))/1000); // loose estimate only for editable default
  const density = (r.material[part.material]||r.material.AL6061).density;
  const kg = volumeCm3 * density / 1000;
  let materialCost = kg * materialUnit(part.material) * q;
  let processCost = (r.baseProcess[part.process]||0) * q;
  if(part.process==='CNC/MCT') processCost += (t>10?25000:0)*q + taps*2600*q;
  if(part.process==='선반') processCost += Math.max(0, size.y-100)*90*q;
  if(part.process==='판금/절곡') processCost += bends * bendUnit(t) * q + taps*1800*q;
  if(part.process==='3D프린팅') processCost += volumeCm3*450*q;
  if(part.process==='프로파일/압출') processCost += Math.max(size.y,size.x)*22*q;
  if(part.process==='구매품') { materialCost = 0; processCost = Math.max(3000, (part.features.isPipe?9000:5000)) * q; }
  if(part.process==='분류 필요') { materialCost = 0; processCost = 0; }
  const post = (r.post[part.post]||0) * (part.post==='없음'?0:1);
  const subtotal = materialCost + processCost + post;
  const margin = subtotal * ((Number(part.margin)||0)/100);
  part.cost = subtotal + margin;
  part.costDetail = { materialCost, processCost, post, margin, subtotal };
  return part.cost;
}
function bendUnit(t){ const b=state.rates.bend; if(t<=1) return b.under1; if(t<=2) return b.t1to2; if(t<=3.2) return b.t2to32; if(t<=6) return b.t32to6; return b.over6; }

function renderAll(){ renderStats(); renderTable(); renderRates(); renderPreview(); }
function renderStats(){
  const total = state.parts.reduce((a,p)=>a+calcPart(p),0);
  $('#statLeaf').textContent = state.parts.length;
  $('#statAsm').textContent = state.parseReport?.assemblyExcludedCount ?? 0;
  $('#statEntity').textContent = state.parseReport?.entityCount ?? 0;
  $('#statTotal').textContent = won(total);
  $('#statStatus').textContent = state.parseReport ? '완료' : '대기';
}
function renderTable(){
  const tb = $('#partsTable tbody'); tb.innerHTML='';
  state.parts.forEach(p=>{
    calcPart(p);
    const tr=document.createElement('tr'); tr.dataset.id=p.id; if(p.id===state.selectedId) tr.classList.add('selected');
    tr.innerHTML=`
      <td><b>${escapeHtml(p.name)}</b><div class="muted">${p.confidence} · ${escapeHtml(p.source||'')}</div></td>
      <td><input data-k="qty" value="${p.qty}" type="number" min="0" /></td>
      <td><span class="badge">${p.recommendedProcess}</span><div class="muted">${p.reasons.map(escapeHtml).join('<br>')}</div></td>
      <td>${select('process', p.process, ['분류 필요','구매품','CNC/MCT','선반','판금/절곡','3D프린팅','사출','프로파일/압출','용접'])}</td>
      <td>${select('material', p.material, Object.keys(state.rates.material))}</td>
      <td><input data-k="thickness" value="${p.thickness}" type="number" step="0.1" /></td>
      <td><input data-k="tapCount" value="${p.tapCount}" type="number" min="0" /></td>
      <td><input data-k="bendCount" value="${p.bendCount}" type="number" min="0" /></td>
      <td><input data-k="margin" value="${p.margin}" type="number" min="0" /></td>
      <td class="money">${won(p.cost)}</td>`;
    tr.addEventListener('click',e=>{ if(!['INPUT','SELECT','BUTTON'].includes(e.target.tagName)){ state.selectedId=p.id; renderAll(); }});
    tr.querySelectorAll('input,select').forEach(el=>{
      el.addEventListener('change',()=>{ p[el.dataset.k]= el.type==='number'?Number(el.value):el.value; calcPart(p); renderAll(); });
      el.addEventListener('click',e=>e.stopPropagation());
    });
    tb.appendChild(tr);
  });
}
function select(k,val,opts){ return `<select data-k="${k}">${opts.map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select>`; }
function renderPreview(){
  const p=state.parts.find(x=>x.id===state.selectedId) || state.parts[0];
  const box=$('#partPreview');
  if(!p){ box.className='preview empty'; box.textContent='파트를 선택하세요.'; return; }
  state.selectedId=p.id; calcPart(p); box.className='preview';
  box.innerHTML=`<b>${escapeHtml(p.name)}</b><div class="thumb"></div>
  <p><span class="badge">${p.process}</span><span class="badge">${p.material}</span><span class="badge">수량 ${p.qty}</span></p>
  <div class="muted">크기 추정: ${p.features.size.x} × ${p.features.size.y} × ${p.features.size.z} mm<br>두께: ${p.thickness}T / 탭: ${p.tapCount} / 절곡: ${p.bendCount}<br>추천 근거: ${p.reasons.map(escapeHtml).join(', ')}</div>
  <hr><b>파트 견적 ${won(p.cost)}</b>
  <div class="muted">재료 ${won(p.costDetail.materialCost)} / 공정 ${won(p.costDetail.processCost)} / 마진 ${won(p.costDetail.margin)}</div>`;
}
function renderRates(){
  const root=$('#rateInputs'); root.innerHTML='';
  for(const [k,v] of Object.entries(state.rates.processMargin)){
    const row=document.createElement('div'); row.className='rateRow'; row.innerHTML=`<label>${k} 마진%</label><input type="number" value="${v}" />`;
    row.querySelector('input').addEventListener('change',e=>{ state.rates.processMargin[k]=Number(e.target.value)||0; state.parts.forEach(p=>{ if(p.process===k) p.margin=state.rates.processMargin[k]; }); renderAll(); });
    root.appendChild(row);
  }
}
function updateMessage(type,msg){ const m=$('#message'); m.className='message '+type; m.innerHTML=msg; }
function renderDebug(report){
  $('#debugText').textContent = JSON.stringify(report, null, 2).slice(0,30000);
}
function escapeHtml(s){ return (s??'').toString().replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

async function handleFile(file){
  try{
    updateMessage('warn','파일 읽는 중...');
    const text=await file.text();
    const parser=new StepTextParser();
    const {parts, report}=parser.parse(text,file.name);
    state.parts=parts; state.selectedId=parts[0]?.id || null; state.parseReport=report;
    renderDebug(report); renderAll();
    if(parts.length){
      updateMessage('ok',`읽기 완료: entity ${report.entityCount.toLocaleString()}개, PRODUCT ${report.productCount}개, assembly link ${report.linkCount}개. <b>어셈블리 컨테이너는 제외하고 말단 파트 ${parts.length}종을 표시했습니다.</b>`);
    }else{
      updateMessage('bad',`파트를 찾지 못했습니다. 진단창의 PRODUCT / link 샘플을 확인해야 합니다. 이 파일은 일반적인 NAUO 구조가 아닐 수 있습니다.`);
    }
  }catch(err){ console.error(err); updateMessage('bad','파싱 오류: '+escapeHtml(err.message)); }
}

$('#fileInput').addEventListener('change',e=>{ const f=e.target.files?.[0]; if(f) handleFile(f); });
const dz=$('#dropZone');
['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault(); dz.style.filter='brightness(.97)';}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault(); dz.style.filter='';}));
dz.addEventListener('drop',e=>{ const f=e.dataTransfer.files?.[0]; if(f) handleFile(f); });
$('#resetBtn').addEventListener('click',()=>renderAll());
$('#applyAl').addEventListener('click',()=>{ state.parts.forEach(p=>p.material='AL6061'); renderAll(); });
$('#csvBtn').addEventListener('click',()=>{
  const header=['파트명','수량','추천','공법','재질','두께','탭','절곡','마진','견적가'];
  const rows=state.parts.map(p=>[p.name,p.qty,p.recommendedProcess,p.process,p.material,p.thickness,p.tapCount,p.bendCount,p.margin,Math.round(calcPart(p))]);
  const csv=[header,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='step_quote_parts.csv'; a.click();
});

renderAll();
