const MATERIALS = {
  AL6061:{label:'AL6061', price:6200, uplift:1.18}, AL5052:{label:'AL5052', price:5800, uplift:1.15},
  SS400:{label:'SS400', price:1600, uplift:1.25}, SUS304:{label:'SUS304', price:5200, uplift:1.28},
  POM:{label:'POM', price:8500, uplift:1.18}, ABS:{label:'ABS', price:4200, uplift:1.2}, PP:{label:'PP', price:2600, uplift:1.18}
};
const PROCESSES = ['분류 필요','구매품','프로파일/압출','선반','판금/절곡','CNC/MCT','3D프린팅','사출','용접','제외'];
const MARGINS = {'CNC/MCT':22,'선반':20,'판금/절곡':18,'3D프린팅':28,'사출':18,'프로파일/압출':15,'용접':22,'구매품':10,'분류 필요':20,'제외':0};
const APP_VERSION = 'v3.1-product-definition-name-map';
const RATES = {cncBase:42000, latheBase:28000, sheetBase:22000, printBase:18000, profileBase:12000, weldBase:35000, tap:2200, bend:3500, cut:1200, purchaseDefault:5000};
let rows = [], originalRows = [], selectedId = null;

const $ = s => document.querySelector(s);
const fmt = n => Math.round(Number(n)||0).toLocaleString('ko-KR')+'원';
const clean = s => String(s||'').replace(/\s+/g,' ').trim();
const stripQuote = s => {
  s = String(s||'').trim();
  if(s === '$' || s === '*') return '';
  if(s.startsWith("'") && s.endsWith("'")) return s.slice(1,-1).replace(/''/g,"'");
  return s;
};
const isGeneric = s => {
  const x = clean(s).toLowerCase();
  return !x || ['design','default','part','product','component','assembly','assy','body','unnamed','none','null','next assembly relationship'].includes(x) || /^[-_\d\s]+$/.test(x);
};
const chooseName = (...names) => {
  for(const n of names){ const v=clean(stripQuote(n)); if(v && !isGeneric(v)) return v; }
  for(const n of names){ const v=clean(stripQuote(n)); if(v) return v; }
  return '';
};


function parseStepEntities(text){
  const entities = new Map();
  let i=0, n=text.length;
  while(i<n){
    if(text[i] !== '#'){ i++; continue; }
    let j=i+1, num='';
    while(j<n && /[0-9]/.test(text[j])) num += text[j++];
    if(!num){ i++; continue; }
    while(j<n && /\s/.test(text[j])) j++;
    if(text[j] !== '='){ i++; continue; }
    j++;
    while(j<n && /\s/.test(text[j])) j++;
    let type='';
    while(j<n && /[A-Za-z0-9_]/.test(text[j])) type += text[j++].toUpperCase();
    while(j<n && /\s/.test(text[j])) j++;
    if(text[j] !== '('){ i=j+1; continue; }
    let start = j+1, depth=1, inStr=false;
    j++;
    for(; j<n; j++){
      const ch=text[j], nx=text[j+1];
      if(inStr){
        if(ch==="'" && nx==="'"){ j++; continue; }
        if(ch==="'") inStr=false;
        continue;
      }
      if(ch==="'"){ inStr=true; continue; }
      if(ch==='(') depth++;
      else if(ch===')'){
        depth--;
        if(depth===0){
          const args = text.slice(start,j);
          while(j<n && text[j] !== ';') j++;
          entities.set('#'+num,{id:'#'+num,type,args,params:splitTop(args),num:Number(num)});
          break;
        }
      }
    }
    i = j+1;
  }
  return entities;
}
function splitTop(s){
  const out=[]; let cur='', depth=0, inStr=false;
  for(let i=0;i<s.length;i++){
    const ch=s[i], nx=s[i+1];
    if(inStr){ cur+=ch; if(ch==="'" && nx==="'"){cur+=nx;i++;continue;} if(ch==="'") inStr=false; continue; }
    if(ch==="'"){ inStr=true; cur+=ch; continue; }
    if(ch==='('){depth++;cur+=ch;continue;} if(ch===')'){depth--;cur+=ch;continue;}
    if(ch===',' && depth===0){ out.push(cur.trim()); cur=''; continue; }
    cur+=ch;
  }
  if(cur.trim() || s.endsWith(',')) out.push(cur.trim());
  return out;
}
function refs(s){ return [...String(s||'').matchAll(/#\d+/g)].map(m=>m[0]); }
function refNum(r){ return Number(String(r||'').replace('#',''))||0; }
function normalizeKey(s){ return clean(s).toUpperCase().replace(/\s+/g,'_'); }
function betterName(a,b){
  const aa=clean(a), bb=clean(b);
  if(aa && !isGeneric(aa)) return aa;
  if(bb && !isGeneric(bb)) return bb;
  return aa || bb || '';
}
function nearestProductBefore(id, products, maxGap=8){
  const n=refNum(id); let best=null, bestGap=Infinity;
  for(const p of products.values()){
    const gap=n-refNum(p.id);
    if(gap>=0 && gap<bestGap && gap<=maxGap){ best=p; bestGap=gap; }
  }
  return best;
}
function findBestProductRef(entity, products){
  const rs=refs(entity.args).filter(r=>products.has(r));
  if(!rs.length) return '';
  // STEP formation normally has PRODUCT as the last real reference. Prefer the last product ref.
  return rs[rs.length-1];
}

function analyzeStep(text){
  const entities = parseStepEntities(text);
  const products = new Map(), formations = new Map(), pdefs = new Map();
  const reps = new Map(), pdsTargets = new Map(), pdRepNames = new Map(), brepNames=[];

  for(const e of entities.values()){
    if(e.type === 'PRODUCT'){
      // PRODUCT('part name','id','desc',context). In many CAD exports param0 is the real part name.
      const nm = chooseName(e.params[0], e.params[1], e.params[2]) || `PRODUCT_${e.id.slice(1)}`;
      products.set(e.id,{id:e.id,name:nm});
    }
  }

  for(const e of entities.values()){
    if(e.type.startsWith('PRODUCT_DEFINITION_FORMATION')){
      let productId=findBestProductRef(e, products);
      if(!productId){
        const near=nearestProductBefore(e.id, products, 4);
        productId=near?.id || '';
      }
      const p=products.get(productId);
      formations.set(e.id,{id:e.id, productId, name:p?.name || '', source: productId ? 'formation product ref' : 'unmapped'});
    }
  }

  for(const e of entities.values()){
    if(e.type === 'PRODUCT_DEFINITION'){
      const formRef = refs(e.args).find(r=>formations.has(r));
      let f = formRef ? formations.get(formRef) : null;
      // Critical fallback for SolidWorks/STEP exports where PRODUCT_DEFINITION_FORMATION mapping is hard to resolve.
      // In the user's sample file, PRODUCT #18 -> FORMATION #19 -> PRODUCT_DEFINITION #20.
      // The fallback maps PRODUCT_DEFINITION #20 back to nearest previous PRODUCT #18.
      let prod = f?.productId ? products.get(f.productId) : null;
      let source = prod ? 'formation' : 'none';
      if(!prod || isGeneric(prod.name)){
        const near=nearestProductBefore(e.id, products, 5);
        if(near && !isGeneric(near.name)){ prod=near; source='nearest PRODUCT before PD'; }
      }
      const pdParamName = chooseName(e.params[0], e.params[1]);
      const name = chooseName(prod?.name, pdParamName) || `PD_${e.id.slice(1)}`;
      pdefs.set(e.id,{id:e.id, formationId:formRef, productId:prod?.id || '', name, productName:prod?.name || '', source});
    }
  }

  for(const e of entities.values()){
    if(e.type.includes('SHAPE_REPRESENTATION')){
      reps.set(e.id,{id:e.id,name:chooseName(e.params[0])});
    }
    if(/BREP|SOLID|SHELL|SURFACE_MODEL/.test(e.type)){
      const nm=chooseName(e.params[0]); if(nm && !isGeneric(nm)) brepNames.push(nm);
    }
  }
  for(const e of entities.values()){
    if(e.type === 'PRODUCT_DEFINITION_SHAPE'){
      const r=refs(e.args).find(x=>pdefs.has(x)) || refs(e.args).at(-1);
      pdsTargets.set(e.id,r);
    }
  }
  for(const e of entities.values()){
    if(e.type === 'SHAPE_DEFINITION_REPRESENTATION'){
      const r=refs(e.args); const pds=r.find(x=>pdsTargets.has(x)); const rep=r.find(x=>reps.has(x));
      if(pds && rep){
        const target=pdsTargets.get(pds); const nm=reps.get(rep).name;
        if(nm && !isGeneric(nm)){
          if(!pdRepNames.has(target)) pdRepNames.set(target,[]);
          pdRepNames.get(target).push(nm);
        }
      }
    }
  }

  const links=[];
  for(const e of entities.values()){
    if(e.type === 'NEXT_ASSEMBLY_USAGE_OCCURRENCE'){
      const r=refs(e.args).filter(x=>pdefs.has(x));
      if(r.length>=2){
        // Args are typically (..., parent PRODUCT_DEFINITION, child PRODUCT_DEFINITION, ...)
        const occRaw=chooseName(e.params[2], e.params[1], e.params[0]);
        links.push({id:e.id,parent:r[0],child:r[1],occName:occRaw});
      }
    }
  }

  const parentSet = new Set(links.map(l=>l.parent));
  let leafLinks = links.filter(l=>!parentSet.has(l.child));
  let excludedAssembly = new Set(links.filter(l=>parentSet.has(l.child)).map(l=>l.child)).size;
  let source = 'NAUO child PRODUCT_DEFINITION leaf';

  let rawRows = leafLinks.map((l,idx)=>{
    const pd=pdefs.get(l.child);
    const rep=(pdRepNames.get(l.child)||[]).find(x=>!isGeneric(x)) || '';
    // IMPORTANT: occurrenceName is often the generic phrase "Next assembly relationship".
    // Never let that override PRODUCT/PD names.
    let name=chooseName(pd?.name, rep, l.occName);
    if(isGeneric(name)) name = `PART_${idx+1}_${l.child.replace('#','')}`;
    return {name, child:l.child, parent:l.parent, link:l.id, occName:l.occName, pdName:pd?.name||'', productId:pd?.productId||'', productName:pd?.productName||'', pdSource:pd?.source||'', repName:rep, path:`${l.parent} > ${l.child} (${l.id})`};
  });

  // Fallback 1: If links exist but mapped names are still generic, rebuild by nearest PRODUCT before child PD.
  const genericCount = rawRows.filter(r=>isGeneric(r.name) || /^PART_/.test(r.name)).length;
  if(rawRows.length && genericCount/rawRows.length > 0.5){
    rawRows = leafLinks.map((l,idx)=>{
      const near=nearestProductBefore(l.child, products, 5);
      const pd=pdefs.get(l.child);
      const rep=(pdRepNames.get(l.child)||[]).find(x=>!isGeneric(x)) || '';
      const name=chooseName(near?.name, pd?.name, rep) || `PART_${idx+1}_${l.child.replace('#','')}`;
      return {name, child:l.child, parent:l.parent, link:l.id, occName:l.occName, pdName:pd?.name||'', productId:near?.id || pd?.productId || '', productName:near?.name || pd?.productName || '', pdSource:'leaf child nearest PRODUCT fallback', repName:rep, path:`${l.parent} > ${l.child} (${l.id})`};
    });
    source += ' + nearest PRODUCT name fallback';
  }

  // Fallback 2: no usable NAUO -> show non-assembly product definitions.
  if(rawRows.length === 0 && pdefs.size){
    const candidate=[];
    for(const [pdId,pd] of pdefs.entries()){
      if(parentSet.has(pdId)) continue;
      const name=chooseName(pd.name, (pdRepNames.get(pdId)||[])[0]) || `PART_${candidate.length+1}_${pdId.replace('#','')}`;
      candidate.push({name, child:pdId, parent:'', link:'fallback', occName:'', pdName:pd.name, productId:pd.productId, productName:pd.productName, pdSource:pd.source, repName:'', path:`fallback ${pdId}`});
    }
    rawRows=candidate; source='fallback: PRODUCT_DEFINITION without children';
  }

  // Fallback 3: named breps/solids.
  if(rawRows.length===0 && brepNames.length){
    rawRows = brepNames.map((nm,i)=>({name:nm,child:`BREP_${i+1}`,parent:'',link:'brep',occName:nm,pdName:'',productId:'',productName:nm,pdSource:'brep',repName:nm,path:`brep ${i+1}`}));
    source='fallback: named BREP/SOLID entities'; excludedAssembly=0;
  }

  // Group repeated occurrences by actual PRODUCT/PD name. Do not group generic relationship names.
  const groups = new Map();
  for(const r of rawRows){
    const keyName = isGeneric(r.name) ? `${r.child}` : normalizeKey(r.name);
    const k = keyName;
    if(!groups.has(k)) groups.set(k,{...r, qty:0, occurrences:[], children:new Set()});
    const g=groups.get(k); g.qty++; g.occurrences.push(r.link); g.children.add(r.child);
  }
  const grouped = [...groups.values()].map(g=>({...g, children:[...g.children]})).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  const partRows = grouped.map((r,i)=>makeQuoteRow(r,i));

  return {
    entities:entities.size, productCount:products.size, pdCount:pdefs.size, formationCount:formations.size, linkCount:links.length,
    leafLinkCount:leafLinks.length, excludedAssembly, source, rows:partRows,
    sampleLinks:links.slice(0,20), sampleProducts:[...products.values()].slice(0,35), samplePdefs:[...pdefs.values()].slice(0,35), sampleRows:rawRows.slice(0,40)
  };
}

function makeQuoteRow(r,i){
  const cls = classifyByName(r.name);
  const material = defaultMaterial(cls.process, r.name);
  const row={
    id:'p'+i, name:r.name, qty:r.qty||1, process:cls.process, material, thickness:cls.thickness||0,
    taps:cls.taps||0, bends:cls.bends||0, buyUnit:cls.buyUnit||RATES.purchaseDefault, margin:MARGINS[cls.process] ?? 20,
    reason:cls.reason, confidence:cls.confidence, meta:r
  };
  row.quote = calcQuote(row);
  return row;
}
function classifyByName(name){
  const n=name.toUpperCase();
  const reason=[];
  const has=(re)=>re.test(n);
  const qtyMatch = n.match(/(?:X|QTY|EA)[-_ ]?(\d{1,3})\b/);
  const tMatch = n.match(/(?:^|[_ -])(?:T|THK)(\d+(?:\.\d+)?)/) || n.match(/(\d+(?:\.\d+)?)T\b/);
  const thickness = tMatch ? Number(tMatch[1]) : 0;
  if(has(/BOLT|NUT|WASHER|BEARING|MOTOR|SENSOR|CYLINDER|SCREW|SPRING|LINEAR|LM\s?GUIDE|PIPE|TUBE|파이프|튜브|각관|배관|SQUARE[_ -]?TUBE|ROUND[_ -]?PIPE|HOSE|FITTING|VALVE|RIVET|REVET|NIPPLE|PIE/)){
    reason.push('표준품/구매재 키워드 우선'); return {process:'구매품', reason:reason.join(', '), confidence:'높음', buyUnit:guessBuyPrice(n)};
  }
  if(has(/PROFILE|AL[_ -]?FRAME|ALFRAME|프로파일|압출|\b20[24]0\b|\b3030\b|\b4040\b|\b4080\b|\b4545\b|\b8080\b/)){
    reason.push('프로파일/압출 규격 키워드'); return {process:'프로파일/압출', reason:reason.join(', '), confidence:'높음'};
  }
  if(has(/SHAFT|PIN|BUSH|BUSHING|ROLLER|SPINDLE|COLLAR|축|샤프트|핀|부싱|롤러/)){
    reason.push('원통/축류 키워드'); return {process:'선반', reason:reason.join(', '), confidence:'높음'};
  }
  const bendHint=has(/BEND|BENT|FOLD|FOLDED|FLANGE|절곡|접힘|L[_ -]?BRACKET|U[_ -]?BRACKET|ㄱ|ㄷ/);
  const sheetHint=has(/SHEET|HOOD|COVER|PANEL|COWL|BRACKET|BRKT|PLATE|판금|커버|패널|브라켓/);
  if(bendHint && (thickness>0 && thickness<=6 || sheetHint)){
    reason.push('같은 두께 판재 + 절곡/플랜지 힌트'); return {process:'판금/절곡', reason:reason.join(', '), confidence:'보통~높음', thickness:thickness||2, bends:guessBends(n)};
  }
  if(sheetHint && thickness>0 && thickness<=6){
    reason.push('얇은 판재 힌트, 절곡은 미확정'); return {process:'판금/절곡', reason:reason.join(', '), confidence:'보통', thickness, bends:0};
  }
  if(sheetHint){
    reason.push('판재/커버류 이름 힌트, 두께·절곡은 공장이 확인'); return {process:'판금/절곡', reason:reason.join(', '), confidence:'낮음~보통', thickness:1.5, bends:0};
  }
  if(has(/HOUSING|CASE|CAP|COVER/) && has(/ABS|PP|PC|PLASTIC|RESIN|수지|플라스틱/)){
    reason.push('플라스틱 케이스/하우징 후보'); return {process:'사출', reason:reason.join(', '), confidence:'보통'};
  }
  if(has(/PRINT|3DP|STL|PROTO|시제품/)){
    reason.push('3D프린팅/시제품 키워드'); return {process:'3D프린팅', reason:reason.join(', '), confidence:'보통'};
  }
  if(has(/BASE|BLOCK|JIG|FIXTURE|MOUNT|HOLDER|SUPPORT|ADAPTER|CLAMP|GUIDE|PLATE|브라켓|베이스|지그|블록/)){
    reason.push('구매품/프로파일/선반/판금 제외 후 절삭 가공품 키워드'); return {process:'CNC/MCT', reason:reason.join(', '), confidence:'보통', thickness:thickness||8, taps:guessTaps(n)};
  }
  reason.push('명확한 공법 힌트 없음'); return {process:'분류 필요', reason:reason.join(', '), confidence:'낮음', thickness:thickness||0};
}
function guessBuyPrice(n){ if(/BEARING|LM|MOTOR|SENSOR|CYLINDER/.test(n)) return 25000; if(/PIPE|TUBE|VALVE|FITTING/.test(n)) return 12000; if(/BOLT|NUT|WASHER|SCREW/.test(n)) return 250; return 5000; }
function guessBends(n){ if(/U[_ -]?BRACKET|ㄷ/.test(n)) return 2; if(/L[_ -]?BRACKET|ㄱ/.test(n)) return 1; if(/BOX|COVER|CASE/.test(n)) return 4; if(/FLANGE/.test(n)) return 1; return 1; }
function guessTaps(n){ const m=n.match(/M(\d{1,2})/); if(m) return 2; if(/BASE|JIG|FIXTURE|MOUNT/.test(n)) return 4; return 0; }
function defaultMaterial(process,name){ const n=name.toUpperCase(); if(/SUS|STS|304/.test(n)) return 'SUS304'; if(/SS400|STEEL|철/.test(n)) return 'SS400'; if(/POM/.test(n)) return 'POM'; if(/ABS/.test(n)) return 'ABS'; if(process==='사출') return 'ABS'; if(process==='3D프린팅') return 'ABS'; return 'AL6061'; }
function calcQuote(r){
  const qty=Math.max(0,Number(r.qty)||0), margin=(Number(r.margin)||0)/100;
  const mat=MATERIALS[r.material]||MATERIALS.AL6061;
  let cost=0;
  const materialCost = Math.max(0, (Number(r.thickness)||1) * qty * mat.price * mat.uplift * 0.18);
  if(r.process==='제외') cost=0;
  else if(r.process==='구매품') cost=(Number(r.buyUnit)||0)*qty;
  else if(r.process==='프로파일/압출') cost=qty*(RATES.profileBase + (Number(r.taps)||0)*RATES.tap + RATES.cut) + materialCost*0.5;
  else if(r.process==='선반') cost=qty*(RATES.latheBase + (Number(r.taps)||0)*RATES.tap) + materialCost;
  else if(r.process==='판금/절곡') cost=qty*(RATES.sheetBase + (Number(r.taps)||0)*1500 + (Number(r.bends)||0)*RATES.bend) + materialCost*0.7;
  else if(r.process==='CNC/MCT') cost=qty*(RATES.cncBase + (Number(r.taps)||0)*RATES.tap) + materialCost;
  else if(r.process==='3D프린팅') cost=qty*RATES.printBase + materialCost*0.8;
  else if(r.process==='사출') cost=qty*900 + 0; // 금형비는 기본 미포함. 별도 입력 전에는 과대 견적 방지.
  else if(r.process==='용접') cost=qty*RATES.weldBase + materialCost;
  else cost=0;
  return Math.round(cost*(1+margin));
}

function render(){
  const tbody=$('#partsBody');
  if(!rows.length){tbody.innerHTML='<tr><td colspan="11" class="empty">아직 분석된 파트가 없습니다.</td></tr>'; updateStats(); return;}
  tbody.innerHTML = rows.map(r=>`<tr data-id="${r.id}" class="${r.id===selectedId?'selected':''}">
    <td class="nameCell"><b>${escapeHtml(r.name)}</b><span>${escapeHtml(r.meta.child||'')}</span></td>
    <td><input data-k="qty" value="${r.qty}" type="number" min="0"></td>
    <td><b>${escapeHtml(r.process)}</b><span class="reason">${escapeHtml(r.confidence)} · ${escapeHtml(r.reason)}</span></td>
    <td><select data-k="process">${PROCESSES.map(p=>`<option ${p===r.process?'selected':''}>${p}</option>`).join('')}</select></td>
    <td><select data-k="material">${Object.keys(MATERIALS).map(m=>`<option ${m===r.material?'selected':''}>${m}</option>`).join('')}</select></td>
    <td><input data-k="thickness" value="${r.thickness}" type="number" min="0" step="0.1"></td>
    <td><input data-k="taps" value="${r.taps}" type="number" min="0"></td>
    <td><input data-k="bends" value="${r.bends}" type="number" min="0"></td>
    <td><input data-k="buyUnit" value="${r.buyUnit}" type="number" min="0"></td>
    <td><input data-k="margin" value="${r.margin}" type="number" min="0"></td>
    <td class="quote">${fmt(r.quote)}</td>
  </tr>`).join('');
  updateStats(); renderPreview();
}
function updateStats(){
  $('#leafCount').textContent=rows.length;
  $('#totalQuote').textContent=fmt(rows.reduce((s,r)=>s+(r.quote||0),0));
}
function renderPreview(){
  const r=rows.find(x=>x.id===selectedId) || rows[0];
  if(!r){ $('#partPreview').className='preview emptyPreview'; $('#partPreview').textContent='파트를 선택하세요.'; $('#partDetail').textContent=''; return; }
  selectedId=r.id;
  let cls='shapeIcon'; if(r.process==='판금/절곡') cls+=' sheet'; if(r.process==='구매품' && /PIPE|TUBE|파이프|튜브|각관/i.test(r.name)) cls+=' pipe'; if(r.process==='프로파일/압출') cls+=' profile';
  $('#partPreview').className='preview';
  $('#partPreview').innerHTML=`<div><b>${escapeHtml(r.name)}</b><div style="height:12px"></div><div class="${cls}"></div></div>`;
  $('#partDetail').innerHTML=`
    <span class="badge">${escapeHtml(r.process)}</span><span class="badge">${escapeHtml(r.material)}</span><span class="badge">수량 ${r.qty}</span>
    <p><b>견적가:</b> ${fmt(r.quote)}</p>
    <p><b>추천 근거:</b> ${escapeHtml(r.reason)}</p>
    <p><b>STEP 연결:</b> ${escapeHtml(r.meta.path || '')}</p>
    <p class="muted">어셈블리/서브어셈블리 컨테이너는 제외하고, 말단 후보만 표에 표시합니다. 명칭이 부정확하면 공법을 직접 수정하세요.</p>`;
}
function renderRates(){
  $('#marginGrid').innerHTML=Object.keys(MARGINS).filter(k=>k!=='제외').map(k=>`<div class="gridRow"><label>${k}</label><input value="${MARGINS[k]}" data-margin="${k}" type="number"></div>`).join('');
  $('#materialGrid').innerHTML=Object.entries(MATERIALS).map(([k,v])=>`<div class="gridRow"><label>${k} <span class="muted">${v.price.toLocaleString()}원/kg + ${Math.round((v.uplift-1)*100)}%</span></label><input value="${Math.round(v.price*v.uplift)}" disabled></div>`).join('');
}
function setMessage(txt,type='info'){ const el=$('#message'); el.textContent=txt; el.className='message '+type; }
function setDiag(a){
  $('#diagText').textContent = [
    `entity: ${a.entities}`,
    `PRODUCT: ${a.productCount}`,
    `PRODUCT_DEFINITION: ${a.pdCount}`,
    `NEXT_ASSEMBLY_USAGE_OCCURRENCE: ${a.linkCount}`,
    `leaf link: ${a.leafLinkCount}`,
    `source: ${a.source}`,
    '',
    '[표시된 row 샘플]', JSON.stringify(a.sampleRows, null, 2),
    '',
    '[assembly link 샘플]', JSON.stringify(a.sampleLinks, null, 2),
    '',
    '[PRODUCT 샘플]', JSON.stringify(a.sampleProducts, null, 2),
    '',
    '[PRODUCT_DEFINITION 샘플]', JSON.stringify(a.samplePdefs, null, 2)
  ].join('\n');
}
function escapeHtml(s){return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}

async function handleFile(file){
  if(!file) return;
  $('#status').textContent='읽는 중'; setMessage(`${file.name} 읽는 중...`,'info');
  const text=await file.text();
  try{
    const result=analyzeStep(text);
    rows=result.rows; originalRows=JSON.parse(JSON.stringify(rows)); selectedId=rows[0]?.id || null;
    $('#asmCount').textContent=result.excludedAssembly;
    $('#status').textContent=rows.length?'완료':'실패';
    if(rows.length){ setMessage(`읽기 완료: entity ${result.entities.toLocaleString()}개, PRODUCT ${result.productCount}개, assembly link ${result.linkCount}개. 말단 파트 ${rows.length}개를 표시했습니다.`, 'good'); }
    else { setMessage('말단 파트를 찾지 못했습니다. 아래 파싱 진단을 확인하세요.', 'bad'); }
    setDiag(result); render();
  }catch(err){ console.error(err); $('#status').textContent='오류'; setMessage('파싱 오류: '+err.message,'bad'); $('#diagText').textContent=err.stack; }
}

$('#fileInput').addEventListener('change',e=>handleFile(e.target.files[0]));
$('#dropZone').addEventListener('dragover',e=>{e.preventDefault();});
$('#dropZone').addEventListener('drop',e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);});
$('#partsBody').addEventListener('click',e=>{ const tr=e.target.closest('tr[data-id]'); if(!tr) return; selectedId=tr.dataset.id; render(); });
$('#partsBody').addEventListener('input',e=>{
  const tr=e.target.closest('tr[data-id]'); if(!tr) return;
  const r=rows.find(x=>x.id===tr.dataset.id); if(!r) return;
  const k=e.target.dataset.k; let v=e.target.value;
  if(['qty','thickness','taps','bends','buyUnit','margin'].includes(k)) v=Number(v)||0;
  r[k]=v; if(k==='process' && MARGINS[v]!=null) r.margin=MARGINS[v]; r.quote=calcQuote(r); render();
});
$('#resetBtn').addEventListener('click',()=>{ rows=JSON.parse(JSON.stringify(originalRows)); selectedId=rows[0]?.id||null; render(); });
$('#csvBtn').addEventListener('click',()=>{
  const head=['파트명','수량','공법','재질','두께','탭','절곡','구매단가','마진','견적가'];
  const lines=[head.join(',')].concat(rows.map(r=>[r.name,r.qty,r.process,r.material,r.thickness,r.taps,r.bends,r.buyUnit,r.margin,r.quote].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')));
  const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='step_quote_parts.csv'; a.click(); URL.revokeObjectURL(a.href);
});
renderRates(); render();
