(function(root){
'use strict';
var CATS=['餐饮','交通','购物','娱乐','住房','医疗','通讯','收入','其他'];
var DEFAULT_KW={
 '餐饮':['饭','餐','早饭','早餐','午饭','午餐','晚饭','晚餐','夜宵','外卖','奶茶','咖啡','美团','饿了么','食','面','粥','水果','零食','饮料','超市','肯德基','麦当劳','星巴克','瑞幸','喜茶','火锅','烧烤','菜'],
 '交通':['打车','滴滴','地铁','公交','出租','高铁','火车','机票','航空','加油','油费','停车','过路','共享单车','哈啰','骑行','车费','高德'],
 '购物':['淘宝','京东','拼多多','天猫','衣服','鞋','购物','日用','化妆','数码','网购','唯品会','抖音商城'],
 '娱乐':['电影','游戏','ktv','KTV','演唱会','门票','旅游','会员','视频','音乐','健身','酒吧','景区'],
 '住房':['房租','租金','物业','水费','电费','燃气','煤气','房贷','宽带','维修'],
 '医疗':['医院','药','挂号','体检','诊所','牙','医保'],
 '通讯':['话费','充值','流量','手机费','移动','联通','电信'],
 '收入':['工资','收入','奖金','红包收','退款','报销','利息','分红','转入','收款','兼职']
};
function categorize(text,kw){kw=kw||DEFAULT_KW;text=String(text||'');
 for(var i=0;i<CATS.length;i++){var c=CATS[i],l=kw[c]||[];for(var j=0;j<l.length;j++)if(l[j]&&text.indexOf(l[j])>=0)return c;}return '其他';}
function pad(n){return (n<10?'0':'')+n;}
function fmtDate(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
// '午饭 35' '打车28.5' '工资 8000 收入' '昨天 奶茶 18' '3.5 早餐'
function parseQuick(input,kw,now){now=now||new Date();var s=String(input||'').trim();if(!s)return null;
 var date=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 if(/前天/.test(s)){date.setDate(date.getDate()-2);s=s.replace('前天',' ');}
 else if(/昨天|昨日/.test(s)){date.setDate(date.getDate()-1);s=s.replace(/昨天|昨日/,' ');}
 else if(/今天/.test(s))s=s.replace('今天',' ');
 var md=s.match(/(\d{1,2})[月\/.-](\d{1,2})[日号]?(?!\d)/);
 if(md&&/[月日号]/.test(md[0])){date=new Date(now.getFullYear(),+md[1]-1,+md[2]);s=s.replace(md[0],' ');}
 var type=null;
 if(/收入|进账|\+/.test(s)){type='income';s=s.replace(/收入|进账|\+/g,' ');}
 else if(/支出/.test(s)){type='expense';s=s.replace(/支出/g,' ');}
 var m=s.match(/(\d+(?:\.\d{1,2})?)\s*(?:元|块钱?|rmb|RMB|¥)?/)||s.match(/[¥￥](\d+(?:\.\d+)?)/);
 if(!m)return null;var amount=Math.round(parseFloat(m[1])*100)/100;if(!(amount>0))return null;
 var note=(s.slice(0,m.index)+' '+s.slice(m.index+m[0].length)).replace(/[¥￥]/g,'').replace(/\s+/g,' ').trim();
 var cat=categorize(note,kw);if(type==='income')cat='收入';
 if(!type)type=cat==='收入'?'income':'expense';
 return {amount:amount,type:type,category:cat,note:note,date:fmtDate(date)};}
// CSV
function parseCSV(text){var rows=[],row=[],f='',q=false;
 for(var i=0;i<text.length;i++){var ch=text[i];
  if(q){if(ch==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=ch;}
  else if(ch==='"')q=true;else if(ch===','){row.push(f);f='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f='';}
  else f+=ch;}
 if(f!==''||row.length){row.push(f);rows.push(row);}
 return rows.map(function(r){return r.map(function(c){return c.replace(/\t/g,'').trim();});});}
function parseAmount(v){if(v==null)return NaN;var s=String(v).trim().replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFEE0);}).replace(/[．。]/g,'.').replace(/[，]/g,',').replace(/[¥￥\s元]|RMB|CNY/gi,'');
 if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))s=s.replace(/,/g,'');else if(/^\d+,\d{1,2}$/.test(s))s=s.replace(',','.');else if(/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');
 if(!/^\d+(\.\d+)?$/.test(s))return NaN;return Math.round(parseFloat(s)*100)/100;}
function num(v){var n=parseFloat(String(v||'').replace(/[¥￥,\s]/g,''));return isNaN(n)?0:Math.abs(n);}
function normTime(t){t=String(t||'').trim();
 if(/^\d+(\.\d+)?$/.test(t)){var d=new Date(Math.round((parseFloat(t)-25569)*864e5));// excel serial (UTC)
  return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds());}
 var m=t.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
 if(!m)return '';return m[1]+'-'+pad(+m[2])+'-'+pad(+m[3])+' '+pad(+(m[4]||0))+':'+(m[5]||'00')+':'+(m[6]||'00');}
function findHeader(rows,keys){for(var i=0;i<Math.min(rows.length,60);i++){var r=rows[i].join('|');if(keys.every(function(k){return r.indexOf(k)>=0;}))return i;}return -1;}
function col(h,names){for(var i=0;i<names.length;i++){for(var j=0;j<h.length;j++)if(h[j]===names[i])return j;}
 for(i=0;i<names.length;i++){for(j=0;j<h.length;j++)if(h[j].indexOf(names[i])>=0)return j;}return -1;}
function detectSource(rows){var t=rows.slice(0,30).map(function(r){return r.join(',');}).join('\n');
 if(/微信支付账单|微信昵称|交易单号/.test(t)&&/交易时间/.test(t)&&/当前状态/.test(t))return 'wechat';
 if(/支付宝|交易号|交易创建时间|交易订单号|收\/支/.test(t))return 'alipay';return null;}
function parseBillRows(rows,kw){var src=detectSource(rows);var out=[],skipped=0;
 if(src==='wechat'){var hi=findHeader(rows,['交易时间','收/支']);if(hi<0)throw new Error('未找到微信账单表头');var h=rows[hi];
  var cT=col(h,['交易时间']),cTy=col(h,['交易类型']),cP=col(h,['交易对方']),cG=col(h,['商品']),cIO=col(h,['收/支']),cA=col(h,['金额(元)','金额']),cS=col(h,['当前状态']),cId=col(h,['交易单号']);
  for(var i=hi+1;i<rows.length;i++){var r=rows[i];if(!r||r.length<5||!r[cT])continue;var io=r[cIO]||'';var st=r[cS]||'';
   if(io!=='收入'&&io!=='支出'){skipped++;continue;}
   if(/已全额退款|已退款|失败|关闭/.test(st)&&!/部分/.test(st)){skipped++;continue;}
   var amt=num(r[cA]);if(!amt){skipped++;continue;}
   var note=[r[cP],r[cG]].filter(function(x){return x&&x!=='/';}).join(' · ');var time=normTime(r[cT]);
   out.push({amount:amt,type:io==='收入'?'income':'expense',category:io==='收入'?'收入':categorize(note+' '+(r[cTy]||''),kw),note:note,date:time.slice(0,10),time:time,source:'wechat',txid:(r[cId]||'').trim()});}}
 else if(src==='alipay'){var hi2=findHeader(rows,['收/支','金额']);if(hi2<0)throw new Error('未找到支付宝账单表头');var h2=rows[hi2];
  var aT=col(h2,['交易时间','交易创建时间','付款时间']),aP=col(h2,['交易对方']),aG=col(h2,['商品说明','商品名称']),aIO=col(h2,['收/支']),aA=col(h2,['金额','金额（元）']),aS=col(h2,['交易状态']),aId=col(h2,['交易订单号','交易号']),aC=col(h2,['交易分类']);
  for(var k=hi2+1;k<rows.length;k++){var q=rows[k];if(!q||q.length<5||!q[aT]||!/\d{4}/.test(q[aT]))continue;var io2=q[aIO]||'';var st2=aS>=0?q[aS]||'':'';
   if(io2!=='收入'&&io2!=='支出'){skipped++;continue;}
   if(/关闭|失败|退款成功/.test(st2)){skipped++;continue;}
   var a2=num(q[aA]);if(!a2){skipped++;continue;}
   var n2=[q[aP],q[aG]].filter(function(x){return x&&x!=='/';}).join(' · ');var t2=normTime(q[aT]);
   out.push({amount:a2,type:io2==='收入'?'income':'expense',category:io2==='收入'?'收入':categorize(n2+' '+(aC>=0?q[aC]:''),kw),note:n2,date:t2.slice(0,10),time:t2,source:'alipay',txid:(q[aId]||'').trim()});}}
 else throw new Error('无法识别账单格式（仅支持微信/支付宝导出账单）');
 return {source:src,items:out,skipped:skipped};}
function dedupeKey(e){return e.txid?(e.source+':'+e.txid):('t:'+(e.time||e.date)+':'+e.amount+':'+e.type);}
function dedupe(items,existing){var seen={};(existing||[]).forEach(function(e){seen[dedupeKey(e)]=1;if(e.time)seen['t:'+e.time+':'+e.amount+':'+e.type]=1;});
 return items.map(function(it){var k=dedupeKey(it),k2='t:'+(it.time||it.date)+':'+it.amount+':'+it.type;var dup=!!(seen[k]||(it.time&&seen[k2]));seen[k]=1;if(it.time)seen[k2]=1;return Object.assign({},it,{dup:dup});});}
function decodeBytes(buf){var u=new Uint8Array(buf);
 if(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF)return new TextDecoder('utf-8').decode(u.subarray(3));
 try{return new TextDecoder('utf-8',{fatal:true}).decode(u);}catch(e){return new TextDecoder('gbk').decode(u);}}
// minimal xlsx reader (zip + DecompressionStream deflate-raw)
async function inflateRaw(data){if(typeof DecompressionStream==='undefined'){var z=require('zlib');return new Uint8Array(z.inflateRawSync(data));}
 var ds=new DecompressionStream('deflate-raw');var s=new Blob([data]).stream().pipeThrough(ds);return new Uint8Array(await new Response(s).arrayBuffer());}
async function unzip(buf){var u=new Uint8Array(buf),dv=new DataView(u.buffer,u.byteOffset,u.byteLength),files={};
 var e=u.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('不是有效的xlsx文件');
 var n=dv.getUint16(e+10,true),off=dv.getUint32(e+16,true);
 for(var i=0;i<n;i++){var comp=dv.getUint16(off+10,true),csz=dv.getUint32(off+20,true),nl=dv.getUint16(off+28,true),el=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),lo=dv.getUint32(off+42,true);
  var name=new TextDecoder().decode(u.subarray(off+46,off+46+nl));var lnl=dv.getUint16(lo+26,true),lel=dv.getUint16(lo+28,true);var d=u.subarray(lo+30+lnl+lel,lo+30+lnl+lel+csz);
  files[name]=comp===0?d:await inflateRaw(d);off+=46+nl+el+cl;}return files;}
function xmlUnesc(s){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,function(_,d){return String.fromCharCode(+d);}).replace(/&amp;/g,'&');}
async function parseXlsx(buf){var f=await unzip(buf),td=new TextDecoder();var ss=[];
 if(f['xl/sharedStrings.xml']){var sx=td.decode(f['xl/sharedStrings.xml']);var re=/<si>([\s\S]*?)<\/si>/g,m;while((m=re.exec(sx))){var t='',r2=/<t[^>]*>([\s\S]*?)<\/t>/g,mm;while((mm=r2.exec(m[1])))t+=mm[1];ss.push(xmlUnesc(t));}}
 var sheet=Object.keys(f).filter(function(k){return /^xl\/worksheets\/sheet\d*\.xml$/.test(k);}).sort()[0];if(!sheet)throw new Error('xlsx中无工作表');
 var x=td.decode(f[sheet]),rows=[];var rr=/<row[^>]*>([\s\S]*?)<\/row>/g,rm;
 while((rm=rr.exec(x))){var row=[];var cr=/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,cm;
  while((cm=cr.exec(rm[1]))){var attrs=cm[1],inner=cm[2]||'';var ref=(attrs.match(/r="([A-Z]+)\d+"/)||[])[1];var t2=(attrs.match(/t="(\w+)"/)||[])[1];var v=(inner.match(/<v>([\s\S]*?)<\/v>/)||[])[1];var val='';
   if(t2==='s')val=ss[+v]||'';else if(t2==='inlineStr'){val=xmlUnesc((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)||[])[1]||'');}else val=v!=null?xmlUnesc(v):'';
   var ci=row.length;if(ref){ci=0;for(var q=0;q<ref.length;q++)ci=ci*26+ref.charCodeAt(q)-64;ci--;}while(row.length<ci)row.push('');row[ci]=String(val).trim();}
  rows.push(row);}return rows;}
async function parseBillFile(name,buf,kw){var rows;if(/\.xlsx$/i.test(name))rows=await parseXlsx(buf);else rows=parseCSV(decodeBytes(buf));return parseBillRows(rows,kw);}
var api={parseAmount:parseAmount,CATS:CATS,DEFAULT_KW:DEFAULT_KW,categorize:categorize,parseQuick:parseQuick,parseCSV:parseCSV,parseBillRows:parseBillRows,dedupe:dedupe,decodeBytes:decodeBytes,parseXlsx:parseXlsx,parseBillFile:parseBillFile,fmtDate:fmtDate,normTime:normTime};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JZ=api;
})(this);
