import type { Candle,Timeframe } from './types';
export const MAX_BYTES=10*1024*1024;
export const MAX_ROWS=100000;
const columns=['time','open','high','low','close','volume'] as const;
interface Row { fields:string[]; line:number }
function rows(text:string):Row[] {
 const result:Row[]=[]; let fields:string[]=[],value='',quoted=false,closed=false,line=1,start=1;
 const field=()=>{fields.push(value);value='';closed=false;};
 const row=()=>{field();if(fields.some(x=>x.trim()!==''))result.push({fields,line:start});fields=[];start=line+1;};
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){
   if(ch==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}
   else {value+=ch;if(ch==='\n')line++;}
  }else if(ch==='"'){
   if(value!==''||closed)throw new Error(`${line}行目: 引用符の形式が不正です。`);
   quoted=true;
  }else if(ch===',')field();
  else if(ch==='\n'||ch==='\r'){
   row();if(ch==='\r'&&text[i+1]==='\n')i++;line++;start=line;
  }else{
   if(closed)throw new Error(`${line}行目: 引用符の後に不正な文字があります。`);
   value+=ch;
  }
 }
 if(quoted)throw new Error(`${start}行目: 引用符が閉じていません。`);
 if(value!==''||fields.length||closed)row();
 return result;
}
function timeValue(value:string,t:Timeframe,line:number):number {
 const fail=()=>{throw new Error(`${line}行目: timeは${t==='1d'?'YYYY-MM-DD':'タイムゾーン付きISO日時'}で指定してください。`);};
 const datePattern=/^\d{4}-\d{2}-\d{2}$/;
 const minutePattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.000)?)?(?:Z|[+-]\d{2}:\d{2})$/;
 if(!(t==='1d'?datePattern:minutePattern).test(value))return fail();
 const date=value.slice(0,10),midnight=Date.parse(date+'T00:00:00Z');
 if(!Number.isFinite(midnight)||new Date(midnight).toISOString().slice(0,10)!==date)return fail();
 if(t==='1m'){
  const hh=Number(value.slice(11,13)),mm=Number(value.slice(14,16));
  const seconds=value[16]===':'?Number(value.slice(17,19)):0;
  if(hh>23||mm>59||seconds!==0)return fail();
 }
 const ms=Date.parse(t==='1d'?date+'T00:00:00Z':value);
 if(!Number.isFinite(ms))return fail();
 return ms/1000;
}
export function parseCSV(text:string,timeframe:Timeframe):Candle[] {
 if(new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('CSVは10 MiB以下にしてください。');
 const parsed=rows(text.replace(/^\uFEFF/,''));
 if(!parsed.length)throw new Error('CSVが空です。');
 const header=parsed[0].fields.map(x=>x.trim());
 if(columns.some(x=>!header.includes(x))||new Set(header).size!==header.length)throw new Error('必須列: time,open,high,low,close,volume を一意に指定してください。');
 if(parsed.length-1>MAX_ROWS)throw new Error('CSVは100000本以下にしてください。');
 if(parsed.length===1)throw new Error('ローソク足データがありません。');
 const indexes=columns.map(x=>header.indexOf(x));const seen=new Set<number>();
 const candles=parsed.slice(1).map(({fields,line})=>{
  if(fields.length!==header.length)throw new Error(`${line}行目: 列数が一致しません。`);
  const vals=indexes.map(i=>fields[i].trim());
  const time=timeValue(vals[0],timeframe,line);
  if(seen.has(time))throw new Error(`${line}行目: timeが重複しています。`);seen.add(time);
  const nums=vals.slice(1).map(v=>v!==''&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v)?Number(v):NaN);
  if(nums.some(n=>!Number.isFinite(n))||nums.slice(0,4).some(n=>n<=0)||nums[4]<0)throw new Error(`${line}行目: 価格は有限の正数、出来高は有限の非負数が必要です。`);
  const [open,high,low,close,volume]=nums;
  if(low>Math.min(open,close)||high<Math.max(open,close)||low>high)throw new Error(`${line}行目: OHLCの高値・安値に不整合があります。`);
  return {time,open,high,low,close,volume};
 });
 return candles.sort((a,b)=>a.time-b.time);
}
export function toCSV(candles:Candle[],timeframe:Timeframe):string {
 return columns.join(',')+'\n'+candles.map(c=>[new Date(c.time*1000).toISOString().slice(0,timeframe==='1d'?10:24),c.open,c.high,c.low,c.close,c.volume].join(',')).join('\n');
}
