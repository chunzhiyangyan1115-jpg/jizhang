(function(){'use strict';
var $=function(id){return document.getElementById(id);};
var COLORS=['#e8684a','#5b8ff9','#f6bd16','#9270ca','#5d7092','#ff9d4d','#269a99','#1f8a5b','#aaaaaa'];
var db,entries=[],settings={budget:0,kw:null,pin:null},cur=new Date();cur.setDate(1);
function openDB(){return new Promise(function(res,rej){var r=indexedDB.open('jizhang',1);
 r.onupgradeneeded=function(){var d=r.result;d.createObjectStore('entries',{keyPath:'id'});d.createObjectStore('kv');};
 r.onsuccess=function(){res(r.result);};r.onerror=function(){rej(r.error);};});}
function tx(store,mode,fn){return new Promise(function(res,rej){var t=db.transaction(store,mode),s=t.objectStore(store),out=fn(s);t.oncomplete=function(){res(out instanceof IDBRequest?out.result:undefined);};t.onerror=function(){rej(t.error);};});}
function loadAll(){return tx('entries','readonly',function(s){return s.getAll();}).then(function(a){entries=a;});}
function putEntries(list){return tx('entries','readwrite',function(s){list.forEach(function(e){s.put(e);});});}
function delEntry(id){return tx('entries','readwrite',function(s){s.delete(id);});}
function getKV(k){return tx('kv','readonly',function(s){return s.get(k);});}
function setKV(k,v){return tx('kv','readwrite',function(s){s.put(v,k);});}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function kw(){return settings.kw||JZ.DEFAULT_KW;}
function toast(m){var t=$('toast');t.textContent=m;t.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(function(){t.classList.add('hidden');},1800);}
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
 fixStyles();$('list').innerHTML=m.length?m.map(function(e){return '<li data-id="'+esc(e.id)+'"><div><div>'+esc(e.category)+' '+esc(e.note)+'</div><div class="n">'+esc(e.time||e.date)+(e.source?' · '+(e.source==='wechat'?'微信':'支付宝'):'')+'</div></div><b class="'+(e.type==='income'?'inc':'exp')+'">'+(e.type==='income'?'+':'-')+money(e.amount)+'</b></li>';}).join(''):'<li class="muted">本月暂无记录</li>';}
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
 $('formTitle').textContent=e.id?'编辑':'记一笔';$('fDel').classList.toggle('hidden',!e.id);}
function bind(){
 $('fCat').innerHTML=JZ.CATS.map(function(c){return '<option>'+c+'</option>';}).join('');
 document.querySelectorAll('nav button').forEach(function(b){b.onclick=function(){if(b.dataset.tab==='add')openForm();else showTab(b.dataset.tab);};});
 $('mPrev').onclick=function(){cur.setMonth(cur.getMonth()-1);render();};$('mNext').onclick=function(){cur.setMonth(cur.getMonth()+1);render();};
 $('quick').oninput=function(){var p=JZ.parseQuick(this.value,kw());$('quickHint').textContent=p?('→ '+(p.type==='income'?'收入':'支出')+' ¥'+p.amount+' · '+p.category+' · '+(p.note||'无备注')+' · '+p.date):'';};
 $('quickForm').onsubmit=function(ev){ev.preventDefault();var p=JZ.parseQuick($('quick').value,kw());if(!p){toast('未识别到金额');return;}addEntry(p).then(function(){$('quick').value='';$('quickHint').textContent='';toast('已记录 ¥'+p.amount+' '+p.category);});};
 $('entryForm').onsubmit=function(ev){ev.preventDefault();var id=$('fId').value,old=entries.find(function(e){return e.id===id;})||{};
  var e=Object.assign({},old,{id:id||undefined,amount:Math.abs(parseFloat($('fAmount').value)),type:document.querySelector('input[name=fType]:checked').value,category:$('fCat').value,note:$('fNote').value.trim(),date:$('fDate').value});
  if(!(e.amount>0)){toast('金额无效');return;}if(old.time&&old.date!==e.date)e.time=e.date+old.time.slice(10);
  addEntry(e).then(function(){toast('已保存');showTab('home');});};
document.querySelectorAll('input[name=fType]').forEach(function(r){r.onchange=function(){if(r.value==='income')$('fCat').value='收入';else if($('fCat').value==='收入')$('fCat').value=JZ.categorize($('fNote').value,kw());};});
 $('fNote').onchange=function(){if(!$('fId').value&&document.querySelector('input[name=fType]:checked').value==='expense')$('fCat').value=JZ.categorize(this.value,kw());};
 $('fDel').onclick=function(){if(confirm('确定删除这条记录？'))delEntry($('fId').value).then(loadAll).then(function(){render();showTab('home');toast('已删除');});};
 $('fCancel').onclick=function(){showTab('home');};
 $('list').onclick=function(ev){var li=ev.target.closest('li[data-id]');if(li)openForm(entries.find(function(e){return e.id===li.dataset.id;}));};
 // import
 var pending=[];
 $('billFile').onchange=function(){var f=this.files[0];if(!f)return;$('impMsg').textContent='解析中…';
  f.arrayBuffer().then(function(b){return JZ.parseBillFile(f.name,b,kw());}).then(function(r){pending=JZ.dedupe(r.items,entries);var nd=pending.filter(function(p){return !p.dup;}).length;
   $('impMsg').textContent=(r.source==='wechat'?'微信':'支付宝')+'账单：共'+r.items.length+'条，新'+nd+'条，重复'+(r.items.length-nd)+'条，跳过(中性/退款/关闭)'+r.skipped+'条';
   $('impPreview').innerHTML=(nd?'<button id="doImport">导入 '+nd+' 条新记录</button> ':'')+'<table>'+pending.map(function(p,i){return '<tr class="'+(p.dup?'dup':'')+'"><td>'+esc(p.time)+'</td><td>'+esc(p.note)+'</td><td><select data-i="'+i+'">'+JZ.CATS.map(function(c){return '<option'+(c===p.category?' selected':'')+'>'+c+'</option>';}).join('')+'</select></td><td class="'+(p.type==='income'?'inc':'exp')+'">'+(p.type==='income'?'+':'-')+money(p.amount)+(p.dup?' 重复':'')+'</td></tr>';}).join('')+'</table>';
   $('impPreview').onchange=function(ev){var i=ev.target.dataset.i;if(i!=null)pending[i].category=ev.target.value;};
   var d=$('doImport');if(d)d.onclick=function(){var list=pending.filter(function(p){return !p.dup;}).map(function(p){var e=Object.assign({},p);delete e.dup;e.id=uid();e.created=Date.now();return e;});
    putEntries(list).then(loadAll).then(function(){render();$('impPreview').innerHTML='';$('impMsg').textContent='已导入 '+list.length+' 条';$('billFile').value='';});};
  }).catch(function(err){$('impMsg').textContent='解析失败：'+err.message;});};
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
function handleURL(){var q=new URLSearchParams(location.search);if(![...q.keys()].length)return;
 var run=function(){
  if(q.get('add')==='1'){var amt=parseFloat(q.get('amount'));var note=(q.get('note')||'').trim();
   if(amt>0){var type=q.get('type')==='income'?'income':'expense';var cat=q.get('cat');if(JZ.CATS.indexOf(cat)<0)cat=type==='income'?'收入':JZ.categorize(note,kw());if(cat==='收入')type='income';
    var date=/^\d{4}-\d{2}-\d{2}$/.test(q.get('date')||'')?q.get('date'):JZ.fmtDate(new Date());
    addEntry({amount:Math.round(amt*100)/100,type:type,category:cat,note:note,date:date,source:q.get('src')||undefined}).then(function(){toast('已通过快捷指令记录 ¥'+amt+' '+cat);});}
   else{openForm({note:note,category:q.get('cat')||undefined});}}
  else if(q.get('quick')==='1'){showTab('home');var i=$('quick');if(q.get('text')){i.value=q.get('text');i.oninput();}i.focus();}
  history.replaceState(null,'',location.pathname);};
 if(settings.pin&&!unlocked)afterUnlock=run;else run();}
openDB().then(function(d){db=d;return Promise.all([loadAll(),getKV('budget'),getKV('kw'),getKV('pin')]);}).then(function(r){settings.budget=r[1]||0;settings.kw=r[2]||null;settings.pin=r[3]||null;
 bind();pinState();render();if(settings.pin)lockNow();else unlocked=true;handleURL();
 if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}).catch(function(e){alert('数据库打开失败：'+e);});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
window.addEventListener('resize',function(){render();});
})();
