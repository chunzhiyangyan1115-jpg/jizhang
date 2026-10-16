(function(){'use strict';
var $=function(id){return document.getElementById(id);};
var COLORS=['#e8684a','#5b8ff9','#f6bd16','#9270ca','#5d7092','#ff9d4d','#269a99','#1f8a5b','#aaaaaa'];
var lastAdded=null,formPhoto=undefined,db,entries=[],settings={budget:0,kw:null,pin:null},cur=new Date();cur.setDate(1);
function openDB(){return new Promise(function(res,rej){var r=indexedDB.open('jizhang',2);
 r.onupgradeneeded=function(){var d=r.result;if(!d.objectStoreNames.contains('entries'))d.createObjectStore('entries',{keyPath:'id'});if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv');if(!d.objectStoreNames.contains('photos'))d.createObjectStore('photos');};
 r.onsuccess=function(){res(r.result);};r.onerror=function(){rej(r.error);};});}
function tx(store,mode,fn){return new Promise(function(res,rej){var t=db.transaction(store,mode),s=t.objectStore(store),out=fn(s);t.oncomplete=function(){res(out instanceof IDBRequest?out.result:undefined);};t.onerror=function(){rej(t.error);};});}
function loadAll(){return tx('entries','readonly',function(s){return s.getAll();}).then(function(a){entries=a;});}
function putEntries(list){return tx('entries','readwrite',function(s){list.forEach(function(e){s.put(e);});});}
function delEntry(id){return tx('entries','readwrite',function(s){s.delete(id);}).then(function(){return tx('photos','readwrite',function(s){s.delete(id);});});}
function getPhoto(id){return tx('photos','readonly',function(s){return s.get(id);});}
function setPhoto(id,blob){return tx('photos','readwrite',function(s){if(blob)s.put(blob,id);else s.delete(id);});}
// downscale to JPEG (max 1280px) fully on-device
function shrink(file){return new Promise(function(res,rej){var u=URL.createObjectURL(file),im=new Image();im.onload=function(){var M=1280,w=im.naturalWidth,h=im.naturalHeight,k=Math.min(1,M/Math.max(w,h));var c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(function(b){b?res(b):rej(new Error('压缩失败'));},'image/jpeg',0.8);};im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('无法读取该图片（HEIC 请在设置→相机→格式选「兼容性最佳」或截图后再选）'));};im.src=u;});}
var thumbURLs=[];function thumbs(){thumbURLs.forEach(URL.revokeObjectURL);thumbURLs=[];document.querySelectorAll('#list img[data-p]').forEach(function(img){getPhoto(img.dataset.p).then(function(b){if(b){var u=URL.createObjectURL(b);thumbURLs.push(u);img.src=u;}});});}
function getKV(k){return tx('kv','readonly',function(s){return s.get(k);});}
function setKV(k,v){return tx('kv','readwrite',function(s){s.put(v,k);});}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function kw(){return settings.kw||JZ.DEFAULT_KW;}
function toast(m,big){var t=$('toast');t.textContent=m;t.classList.toggle('big',!!big);t.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(function(){t.classList.add('hidden');},big?5000:1800);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function money(n){return (Math.round(n*100)/100).toFixed(2);}
function ym(){return cur.getFullYear()+'-'+('0'+(cur.getMonth()+1)).slice(-2);}
function showTab(n){document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('hidden',t.id!=='tab-'+n);});
 document.querySelectorAll('nav button').forEach(function(b){b.classList.toggle('on',b.dataset.tab===n);});window.scrollTo(0,0);}
function addEntry(e){e.id=e.id||uid();e.created=e.created||Date.now();return putEntries([e]).then(loadAll).then(render);}
function render(){var k=ym();$('mLabel').textContent=cur.getFullYear()+'年'+(cur.getMonth()+1)+'月';
 var m=entries.filter(function(e){return e.date&&e.date.slice(0,7)===k;}).sort(function(a,b){return (b.time||b.date).localeCompare(a.time||a.date)||b.created-a.created;});
 var inc=0,exp=0,cats={};m.forEach(function(e){if(e.type==='income')inc+=e.amount;else{exp+=e.amount;cats[e.category]=(cats[e.category]||0)+e.amount;}});
 $('sumExp').textContent=money(exp);$('sumInc').textContent=money(inc);$('sumBal').textContent=money(inc-exp);
 var bb=$('budgetBox');if(settings.budget>0){var p=Math.min(100,exp/settings.budget*100);bb.classList.remove('hidden');
  bb.innerHTML='<div class="ct"><span>预算 '+money(settings.budget)+'</span><span>剩余 '+money(settings.budget-exp)+'</span></div><div class="bar"><i class="'+(exp>settings.budget?'over':'')+'" data-w="'+p+'"></i></div>';}else bb.classList.add('hidden');
 drawChart(cats,exp);
 fixStyles();$('list').innerHTML=m.length?m.map(function(e){return '<li data-id="'+esc(e.id)+'"'+(e.id===lastAdded?' class="new"':'')+'>'+(e.photo?'<img class="th" alt="" data-p="'+esc(e.id)+'">':'')+'<div class="grow"><div>'+esc(e.category)+' '+esc(e.note)+'</div><div class="n">'+esc(e.time||e.date)+(e.source?' · '+({wechat:'微信',alipay:'支付宝',ocr:'截图'}[e.source]||''):'')+'</div></div><b class="'+(e.type==='income'?'inc':'exp')+'">'+(e.type==='income'?'+':'-')+money(e.amount)+'</b></li>';}).join(''):'<li class="muted">本月暂无记录</li>';thumbs();}
function drawChart(cats,total){var c=$('chart'),x=c.getContext('2d'),dpr=window.devicePixelRatio||1,W=c.clientWidth||300,H=Math.round(W/2);
 c.width=W*dpr;c.height=H*dpr;x.scale(dpr,dpr);x.clearRect(0,0,W,H);
 var keys=JZ.CATS.filter(function(k){return cats[k]>0;}).sort(function(a,b){return cats[b]-cats[a];});
 var R=H/2-10,cx=H/2,cy=H/2,a=-Math.PI/2;
 if(!keys.length){x.fillStyle='#ccc';x.font='14px sans-serif';x.fillText('暂无支出',cx-28,cy);$('catTotals').innerHTML='';return;}
 keys.forEach(function(k){var s=cats[k]/total*Math.PI*2;x.beginPath();x.moveTo(cx,cy);x.arc(cx,cy,R,a,a+s);x.closePath();x.fillStyle=COLORS[JZ.CATS.indexOf(k)];x.fill();a+=s;});
 x.beginPath();x.arc(cx,cy,R*0.55,0,Math.PI*2);x.fillStyle='#fff';x.fill();
 var bx=H+10,bw=W-bx-60,max=cats[keys[0]];x.font='12px sans-serif';
 keys.slice(0,8).forEach(function(k,i){var y=14+i*((H-20)/8);x.fillStyle='#555';x.fillText(k,bx,y+9);x.fillStyle=COLORS[JZ.CATS.indexOf(k)];x.fillRect(bx+32,y,Math.max(2,(bw-32)*cats[k]/max),10);});
 $('catTotals').innerHTML=keys.map(function(k){return '<div class="ct"><span><i class="dot" data-c="'+COLORS[JZ.CATS.indexOf(k)]+'"></i>'+k+'</span><span>'+money(cats[k])+' ('+Math.round(cats[k]/total*100)+'%)</span></div>';}).join('');}
// CSP forbids style="" attrs; apply via CSSOM
function fixStyles(){document.querySelectorAll('[data-w]').forEach(function(e){e.style.width=e.dataset.w+'%';});document.querySelectorAll('[data-c]').forEach(function(e){e.style.background=e.dataset.c;});}
function openForm(e){showTab('add');e=e||{};$('fId').value=e.id||'';$('fAmount').value=e.amount||'';$('fNote').value=e.note||'';$('fDate').value=e.date||JZ.fmtDate(new Date());
 $('fCat').value=e.category||'餐饮';document.querySelector('input[name=fType][value='+(e.type==='income'?'income':'expense')+']').checked=true;
 $('formTitle').textContent=e.id?'编辑':'记一笔';formPhoto=undefined;$('fPhoto').value='';showPhoto(null);if(e.id&&e.photo)getPhoto(e.id).then(showPhoto);$('fDel').classList.toggle('hidden',!e.id);}
var prevURL=null;function showPhoto(b){if(prevURL){URL.revokeObjectURL(prevURL);prevURL=null;}var i=$('fPhotoPrev');if(b){prevURL=URL.createObjectURL(b);i.src=prevURL;i.classList.remove('hidden');$('fPhotoDel').classList.remove('hidden');}else{i.removeAttribute('src');i.classList.add('hidden');$('fPhotoDel').classList.add('hidden');}}

// ---- on-device OCR (tesseract.js, all assets same-origin under ocr/) ----
var ocrP=null,ocrTimer=null;
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('识别引擎加载失败（首次使用需联网下载到本机）'));};document.head.appendChild(s);});}
function ocrWorker(logger){clearTimeout(ocrTimer);ocrWorker.log=logger;
 if(!ocrP)ocrP=(window.Tesseract?Promise.resolve():loadScript('ocr/tesseract.min.js')).then(function(){var base=new URL('ocr/',location.href).href;
  var cw=Tesseract.createWorker(['chi_sim','eng'],1,{workerPath:base+'worker.min.js',corePath:base+'tesseract-core-'+(simd()?'simd-':'')+'lstm.js',langPath:base+'lang',gzip:false,workerBlobURL:false,cacheMethod:'none',logger:function(m){if(ocrWorker.log)ocrWorker.log(m);},errorHandler:function(e){console.warn('ocr',e);}});
  return Promise.race([cw,new Promise(function(_,rej){setTimeout(function(){rej(new Error('识别引擎加载超时，请检查网络后重试'));},120000);})]);
 }).then(function(w){return w.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'3'}).then(function(){return w;});}).catch(function(e){ocrP=null;throw e;});
 return ocrP;}
function simd(){try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));}catch(e){return false;}}
// free the ~100MB wasm heap a while after use
function releaseOcr(){clearTimeout(ocrTimer);ocrTimer=setTimeout(function(){if(ocrP){var p=ocrP;ocrP=null;p.then(function(w){w.terminate();}).catch(function(){});}},60000);}
// downscale (<=1080px wide) + grayscale + binarize (grey secondary text -> black; colored icons/backgrounds -> white/black blobs)
function prepImage(file){return new Promise(function(res,rej){var u=URL.createObjectURL(file),im=new Image();im.onload=function(){URL.revokeObjectURL(u);
  var w=im.naturalWidth,h=im.naturalHeight,k=Math.min(1,1080/w,4000/h);var c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);var x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);
  var d=x.getImageData(0,0,c.width,c.height),a=d.data,dark=0;for(var i=0;i<a.length;i+=4){var g=0.299*a[i]+0.587*a[i+1]+0.114*a[i+2];a[i]=g;dark+=g<128?1:0;}
  var inv=dark>a.length/8; // dark mode screenshot -> invert
  for(var j=0;j<a.length;j+=4){var v=a[j];if(inv)v=255-v;v=v<200?0:255;a[j]=a[j+1]=a[j+2]=v;}x.putImageData(d,0,0);res(c);};
 im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('无法读取该图片（HEIC 请改用截图或设置相机格式为「兼容性最佳」）'));};im.src=u;});}
function bind(){
 $('fPhoto').onchange=function(){var f=this.files[0];if(!f)return;shrink(f).then(function(b){formPhoto=b;showPhoto(b);}).catch(function(e){toast(e.message);});};
 $('fPhotoDel').onclick=function(){formPhoto=null;$('fPhoto').value='';showPhoto(null);};
 $('fPhotoPrev').onclick=function(){if(this.src)window.open(this.src);};
 $('fCat').innerHTML=JZ.CATS.map(function(c){return '<option>'+c+'</option>';}).join('');
 document.querySelectorAll('nav button').forEach(function(b){b.onclick=function(){if(b.dataset.tab==='add')openForm();else showTab(b.dataset.tab);};});
 $('mPrev').onclick=function(){cur.setMonth(cur.getMonth()-1);render();};$('mNext').onclick=function(){cur.setMonth(cur.getMonth()+1);render();};
 $('quick').oninput=function(){var p=JZ.parseQuick(this.value,kw());$('quickHint').textContent=p?('→ '+(p.type==='income'?'收入':'支出')+' ¥'+p.amount+' · '+p.category+' · '+(p.note||'无备注')+' · '+p.date):'';};
 $('quickForm').onsubmit=function(ev){ev.preventDefault();var p=JZ.parseQuick($('quick').value,kw());if(!p){toast('未识别到金额');return;}addEntry(p).then(function(){$('quick').value='';$('quickHint').textContent='';toast('已记录 ¥'+p.amount+' '+p.category);});};
 $('entryForm').onsubmit=function(ev){ev.preventDefault();var id=$('fId').value,old=entries.find(function(e){return e.id===id;})||{};
  var e=Object.assign({},old,{id:id||undefined,amount:Math.abs(JZ.parseAmount($('fAmount').value)),type:document.querySelector('input[name=fType]:checked').value,category:$('fCat').value,note:$('fNote').value.trim(),date:$('fDate').value});
  if(!(e.amount>0)){toast('金额无效');return;}e.id=e.id||uid();if(formPhoto!==undefined)e.photo=!!formPhoto;var ph=formPhoto;if(old.time&&old.date!==e.date)e.time=e.date+old.time.slice(10);
  (ph!==undefined?setPhoto(e.id,ph):Promise.resolve()).then(function(){return addEntry(e);}).then(function(){toast('已保存');showTab('home');});};
document.querySelectorAll('input[name=fType]').forEach(function(r){r.onchange=function(){if(r.value==='income')$('fCat').value='收入';else if($('fCat').value==='收入')$('fCat').value=JZ.categorize($('fNote').value,kw());};});
 $('fNote').onchange=function(){if(!$('fId').value&&document.querySelector('input[name=fType]:checked').value==='expense')$('fCat').value=JZ.categorize(this.value,kw());};
 $('fDel').onclick=function(){if(confirm('确定删除这条记录？'))delEntry($('fId').value).then(loadAll).then(function(){render();showTab('home');toast('已删除');});};
 $('fCancel').onclick=function(){showTab('home');};
 $('list').onclick=function(ev){var li=ev.target.closest('li[data-id]');if(li)openForm(entries.find(function(e){return e.id===li.dataset.id;}));};
 // import
 var pending=[];
 function showPreview(items,msg,resetInput){pending=JZ.dedupe(items,entries);var nd=pending.filter(function(p){return !p.dup;}).length;
  $('impMsg').textContent=msg.replace('{n}',pending.length).replace('{new}',nd).replace('{dup}',pending.length-nd);
  if(!pending.length){$('impPreview').innerHTML='';return;}
  $('impPreview').innerHTML='<button id="doImport">导入所选</button> <span class="muted">可修改金额/日期/备注/分类，取消勾选不导入</span><table>'+pending.map(function(p,i){return '<tr class="'+(p.dup?'dup':'')+'"><td><input type="checkbox" data-i="'+i+'" data-f="on"'+(p.dup?'':' checked')+'></td><td><input type="date" data-i="'+i+'" data-f="date" value="'+esc(p.date)+'">'+(p.dateGuessed?'<br><small class="muted">未识别日期</small>':'')+'</td><td><input data-i="'+i+'" data-f="note" value="'+esc(p.note)+'"></td><td><select data-i="'+i+'" data-f="category">'+JZ.CATS.map(function(c){return '<option'+(c===p.category?' selected':'')+'>'+c+'</option>';}).join('')+'</select></td><td class="'+(p.type==='income'?'inc':'exp')+'">'+(p.type==='income'?'+':'-')+'<input class="amt" type="number" step="0.01" min="0" inputmode="decimal" data-i="'+i+'" data-f="amount" value="'+money(p.amount)+'">'+(p.dup?' 重复':'')+'</td></tr>';}).join('')+'</table>';
  $('impPreview').onchange=function(ev){var el=ev.target,i=el.dataset.i,f=el.dataset.f;if(i==null||!f)return;var p=pending[i];
   if(f==='on')p.skip=!el.checked;else if(f==='amount')p.amount=Math.abs(JZ.parseAmount(el.value));else if(f==='date'){if(p.time)p.time=el.value+p.time.slice(10);p.date=el.value;}else p[f]=el.value;};
  pending.forEach(function(p){p.skip=!!p.dup;});
  $('doImport').onclick=function(){var list=pending.filter(function(p){return !p.skip&&p.amount>0&&p.date;}).map(function(p){var e=Object.assign({},p);delete e.dup;delete e.skip;delete e.dateGuessed;e.id=uid();e.created=Date.now();return e;});
   if(!list.length){toast('未选择任何记录');return;}
   putEntries(list).then(loadAll).then(function(){render();$('impPreview').innerHTML='';$('impMsg').textContent='已导入 '+list.length+' 条';resetInput();});};}
 $('billFile').onchange=function(){var f=this.files[0];if(!f)return;$('impMsg').textContent='解析中…';
  f.arrayBuffer().then(function(b){return JZ.parseBillFile(f.name,b,kw());}).then(function(r){
   showPreview(r.items,(r.source==='wechat'?'微信':'支付宝')+'账单：共{n}条，新{new}条，重复{dup}条，跳过(中性/退款/关闭)'+r.skipped+'条',function(){$('billFile').value='';});
  }).catch(function(err){$('impMsg').textContent='解析失败：'+err.message;});};
 $('billImg').onchange=function(){var fs=[].slice.call(this.files);if(!fs.length)return;var inp=this,all=[],i=0;inp.disabled=true;$('impPreview').innerHTML='';
  function prog(p){$('impMsg').textContent='正在识别'+(fs.length>1?'（'+(i+1)+'/'+fs.length+'）':'')+'… '+Math.round(p*100)+'%';}
  prog(0);ocrWorker(function(m){if(m.status==='recognizing text')prog(m.progress);else if(i===0&&/load|initiali/.test(m.status||''))$('impMsg').textContent='正在加载识别引擎（首次约12MB，之后离线可用）…';}).then(function(w){
   return fs.reduce(function(pr,f,k){return pr.then(function(){i=k;prog(0);return prepImage(f);}).then(function(c){return w.recognize(c,{},{blocks:true,text:true});}).then(function(r){var rt=JZ.ocrRowsText(JZ.ocrWordsFromData(r.data));var got=JZ.parseOcrText(rt||r.data.text,kw());if(!got.length&&rt)got=JZ.parseOcrText(r.data.text,kw());all=all.concat(got);});},Promise.resolve());
  }).then(function(){inp.disabled=false;showPreview(all,'截图识别：共{n}条，新{new}条，重复{dup}条。识别可能有误，请核对后导入。'+(all.length?'':'未识别到金额，请换一张更清晰的截图或手动记账。'),function(){inp.value='';});
  }).catch(function(err){inp.disabled=false;inp.value='';$('impMsg').textContent='识别失败：'+(err&&err.message||err);}).then(releaseOcr);};
 // settings
 $('budget').value=settings.budget||'';$('saveBudget').onclick=function(){settings.budget=parseFloat($('budget').value)||0;setKV('budget',settings.budget).then(function(){render();toast('已保存');});};
 function kwToText(k){return JZ.CATS.filter(function(c){return k[c];}).map(function(c){return c+': '+k[c].join(',');}).join('\n');}
 $('kwText').value=kwToText(kw());
 $('saveKw').onclick=function(){var k={};$('kwText').value.split('\n').forEach(function(l){var m=l.match(/^\s*([^:：]+)[:：](.*)$/);if(m&&JZ.CATS.indexOf(m[1].trim())>=0)k[m[1].trim()]=m[2].split(/[,，\s]+/).filter(Boolean);});settings.kw=k;setKV('kw',k).then(function(){toast('已保存');});};
 $('resetKw').onclick=function(){settings.kw=null;setKV('kw',null);$('kwText').value=kwToText(JZ.DEFAULT_KW);toast('已恢复默认');};
 $('exportBtn').onclick=function(){var data=JSON.stringify({app:'jizhang',version:1,exported:new Date().toISOString(),entries:entries,budget:settings.budget,kw:settings.kw},null,1);
  var blob=new Blob([data],{type:'application/json'}),name='记账备份-'+JZ.fmtDate(new Date())+'.json',file=new File([blob],name,{type:'application/json'});
  if(navigator.canShare&&navigator.canShare({files:[file]}))navigator.share({files:[file]}).catch(function(){});
  else{var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},5000);}
  $('bakMsg').textContent='已导出 '+entries.length+' 条（可"存储到文件"）';};
 $('importJson').onchange=function(){var f=this.files[0];if(!f)return;f.text().then(function(t){var d=JSON.parse(t);if(!d||!Array.isArray(d.entries))throw new Error('格式错误');
  var ids={};entries.forEach(function(e){ids[e.id]=1;});var add=d.entries.filter(function(e){return e&&e.id&&!ids[e.id]&&e.amount>0&&e.date;});
  if(!confirm('将合并导入 '+add.length+' 条记录（已存在的跳过），继续？'))return;
  return putEntries(add).then(function(){if(d.budget!=null){settings.budget=d.budget;setKV('budget',d.budget);}if(d.kw){settings.kw=d.kw;setKV('kw',d.kw);}}).then(loadAll).then(function(){render();$('bakMsg').textContent='已导入 '+add.length+' 条';});
 }).catch(function(e){$('bakMsg').textContent='导入失败：'+e.message;});this.value='';};
 $('pinSet').onclick=function(){var p=$('pinNew').value;if(p.length<4){toast('至少4位');return;}hashPin(p).then(function(h){settings.pin=h;return setKV('pin',h);}).then(function(){$('pinNew').value='';pinState();toast('密码已设置');});};
 $('pinOff').onclick=function(){var p=prompt('输入当前密码以关闭');if(p==null)return;verify(p).then(function(ok){if(!ok){toast('密码错误');return;}settings.pin=null;setKV('pin',null);pinState();toast('已关闭');});};
 $('lockBtn').onclick=unlock;$('lockPin').onkeydown=function(e){if(e.key==='Enter')unlock();};
}
function pinState(){$('pinState').textContent=settings.pin?'已开启：每次打开需输入密码':'未开启';}
function hex(b){return Array.from(new Uint8Array(b)).map(function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
function pbkdf2(pin,salt){return crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']).then(function(k){return crypto.subtle.deriveBits({name:'PBKDF2',salt:salt,iterations:200000,hash:'SHA-256'},k,256);});}
function hashPin(pin){var salt=crypto.getRandomValues(new Uint8Array(16));return pbkdf2(pin,salt).then(function(b){return {salt:hex(salt),hash:hex(b)};});}
function verify(pin){if(!settings.pin)return Promise.resolve(true);var s=new Uint8Array(settings.pin.salt.match(/../g).map(function(h){return parseInt(h,16);}));return pbkdf2(pin,s).then(function(b){return hex(b)===settings.pin.hash;});}
var unlocked=false,afterUnlock=null;
function unlock(){verify($('lockPin').value).then(function(ok){if(ok){unlocked=true;$('lock').classList.add('hidden');$('lockPin').value='';if(afterUnlock){afterUnlock();afterUnlock=null;}}else $('lockMsg').textContent='密码错误';});}
function lockNow(){if(settings.pin){unlocked=false;$('lock').classList.remove('hidden');setTimeout(function(){$('lockPin').focus();},50);}}
document.addEventListener('visibilitychange',function(){if(document.hidden&&settings.pin){lockNow();}});
function urlParams(){var q=new URLSearchParams(location.search),h=location.hash.replace(/^#\??/,'');
 if(h&&/(^|&)(add|quick|amount)=/.test(h))new URLSearchParams(h).forEach(function(v,k){if(!q.has(k))q.set(k,v);});return q;}
function handleURL(){var q=urlParams();if(!q.has('add')&&!q.has('quick'))return;
 // clean URL immediately so reload / back never re-adds
 history.replaceState(null,'',location.pathname);
 var amt=JZ.parseAmount(q.get('amount')),note=(q.get('note')||'').trim();
 var run=function(){
  if(q.get('add')==='1'){
   if(amt>0){var type=q.get('type')==='income'?'income':'expense';var cat=q.get('cat');if(JZ.CATS.indexOf(cat)<0)cat=type==='income'?'收入':JZ.categorize(note,kw());if(cat==='收入')type='income';
    var date=/^\d{4}-\d{2}-\d{2}$/.test(q.get('date')||'')?q.get('date'):JZ.fmtDate(new Date());
    var e={id:uid(),amount:amt,type:type,category:cat,note:note,date:date,source:q.get('src')||undefined};lastAdded=e.id;
    cur=new Date(date+'T00:00:00');cur.setDate(1);showTab('home');
    addEntry(e).then(function(){toast('✅ 已记一笔 ¥'+money(amt).replace(/\.00$/,'')+' '+cat+(note?' · '+note:''),true);});}
   else{openForm({note:note,category:q.get('cat')||undefined});if(q.get('amount'))toast('金额「'+q.get('amount')+'」无法识别，请手动填写',true);}}
  else if(q.get('quick')==='1'){showTab('home');var i=$('quick');if(q.get('text')){i.value=q.get('text');i.oninput();}i.focus();}};
 if(settings.pin&&!unlocked){afterUnlock=run;$('lockMsg').textContent=q.get('add')==='1'&&amt>0?'解锁后将记录 ¥'+amt:'';}else run();}
openDB().then(function(d){db=d;return Promise.all([loadAll(),getKV('budget'),getKV('kw'),getKV('pin')]);}).then(function(r){settings.budget=r[1]||0;settings.kw=r[2]||null;settings.pin=r[3]||null;
 bind();pinState();render();if(settings.pin)lockNow();else unlocked=true;handleURL();
 if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}).catch(function(e){alert('数据库打开失败：'+e);});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
window.addEventListener('resize',function(){render();});
})();
