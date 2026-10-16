import type {Candle} from './types';
export type OrderStatus='DRAFT'|'BLOCKED'|'ACCEPTED'|'OPEN'|'PARTIALLY_FILLED'|'FILLED'|'CANCELLED'|'EXPIRED'|'REJECTED';
export interface Ticket {id:string;side:'BUY'|'SELL';type:'MARKET'|'LIMIT'|'STOP';qty:number;price:number;stop:number;target:number;lot:number;feeBps:number;slippageBps:number;maxLoss:number;dailyLimit:number;strict:boolean;strategyReady:boolean;evidenceReady:boolean;reason:string;context?:{technical:string;statistics:string;event:string;dataset:string;timeframe:string}}
export interface Order extends Ticket {status:OrderStatus;submittedIndex:number;filled:number;filledNotional:number;fees:number;reservePrice:number;message:string;triggered?:boolean}
export interface JournalEntry {id:string;time:number;action:string;reason:string;qty:number;price:number;pnl:number;guard:string;context?:Ticket['context']}
export interface PaperAccount {version:1;datasetId:string;currency:'JPY'|'USD';initial:number;cash:number;qty:number;basis:number;realized:number;costs:number;lastIndex:number;lastPrice:number;day:string;dayStart:number;peak:number;maxDrawdown:number;slippageCosts:number;orders:Order[];journal:JournalEntry[];revision:number}
const safe=(v:bigint):number=>{const n=Number(v);if(!Number.isSafeInteger(n))throw new Error('金額が安全な計算範囲を超えています');return n;};
export function minor(price:number):number {if(!Number.isFinite(price)||price<0||price>1e12)throw new Error('価格の範囲が不正です');const [a,b='']=price.toFixed(2).split('.');return safe(BigInt(a)*100n+BigInt(b.padEnd(2,'0')));}
const mul=(p:number,q:number)=>safe(BigInt(p)*BigInt(q));
const fee=(n:number,bps:number)=>safe((BigInt(n)*BigInt(bps)+9999n)/10000n);
const open=(o:Order)=>o.status==='OPEN'||o.status==='PARTIALLY_FILLED';
export function createAccount(datasetId:string,currency:'JPY'|'USD',lastIndex:number):PaperAccount {
 const initial=minor(currency==='JPY'?1000000:10000);
 return {version:1,datasetId,currency,initial,cash:initial,qty:0,basis:0,realized:0,costs:0,lastIndex,lastPrice:0,day:'',dayStart:initial,peak:initial,maxDrawdown:0,slippageCosts:0,orders:[],journal:[],revision:0};
}
export function metrics(a:PaperAccount,price:number){
 let quote=a.lastPrice,valid=true;try{quote=minor(price);}catch{valid=false;}
 let marketValue=0;try{marketValue=mul(quote,a.qty);}catch{valid=false;marketValue=mul(a.lastPrice,a.qty);}
 const reservedCash=a.orders.filter(o=>open(o)&&o.side==='BUY').reduce((s,o)=>s+mul(o.reservePrice,o.qty-o.filled)+fee(mul(o.reservePrice,o.qty-o.filled),o.feeBps),0);
 const reservedQty=a.orders.filter(o=>open(o)&&o.side==='SELL').reduce((s,o)=>s+o.qty-o.filled,0);
 const equity=a.cash+marketValue;
 return {valid,reservedCash,reservedQty,availableCash:a.cash-reservedCash,availableQty:a.qty-reservedQty,marketValue,equity,unrealized:marketValue-a.basis,average:a.qty?a.basis/a.qty:0,dailyPnl:equity-a.dayStart};
}
export function riskGuard(a:PaperAccount,t:Ticket,candles:Candle[]){
 const errors:string[]=[],warnings=['企業イベント未確認','OHLCによる仮想約定です。実際の約定・損切りを保証しません。'];let loss=0,reservePrice=0;
 try{
  const last=candles.at(-1);if(!last||last.low<=0||![last.open,last.high,last.low,last.close,last.volume].every(Number.isFinite)||last.high<Math.max(last.open,last.close)||last.low>Math.min(last.open,last.close)||last.volume<0)throw new Error('重大なデータ異常');
  if(candles.length-1<a.lastIndex)errors.push('口座時点より過去では注文できません');
  if(!t.id||!['BUY','SELL'].includes(t.side)||!['MARKET','LIMIT','STOP'].includes(t.type))errors.push('注文データの不整合');
  if(!Number.isSafeInteger(t.qty)||t.qty<=0||t.qty>10000000||!Number.isSafeInteger(t.lot)||t.lot<=0||t.qty%t.lot!==0)errors.push('数量・売買単位が不正');
  if(!Number.isInteger(t.feeBps)||!Number.isInteger(t.slippageBps)||t.feeBps<0||t.feeBps>1000||t.slippageBps<0||t.slippageBps>1000)errors.push('コストは0〜1000bpsの整数');
  if(errors.length)return {ok:false,errors,warnings,loss,reservePrice};
  const entry=minor(t.type==='MARKET'?last.close:t.price);if(entry<=0)throw new Error('注文価格が不正');
  reservePrice=t.type==='LIMIT'?entry:safe((BigInt(entry)*BigInt(10000+t.slippageBps)+9999n)/10000n);
  const m=metrics(a,last.close);if(!m.valid)errors.push('重大な評価価格異常');
  if(t.side==='SELL'){if(t.qty>m.availableQty)errors.push('売却可能株数を超えています');}
  else{
   const notional=mul(reservePrice,t.qty),stop=minor(t.stop);
   loss=mul(Math.max(0,reservePrice-stop),t.qty)+fee(notional,t.feeBps)*2;
   if(notional+fee(notional,t.feeBps)>m.availableCash)errors.push('買付余力不足');
   if(stop<=0||stop>=entry)errors.push('損切り価格は買値未満の正数');
   if(loss>minor(t.maxLoss))errors.push('1取引の損失上限を超過');
   const pendingRisk=a.orders.filter(o=>open(o)&&o.side==='BUY').reduce((s,o)=>s+mul(Math.max(0,o.reservePrice-minor(o.stop)),o.qty-o.filled),0);
   if(Math.max(0,-m.dailyPnl)+pendingRisk+loss>minor(t.dailyLimit))errors.push('日次損失上限を超過');
   if(t.strict&&!t.strategyReady)errors.push('厳格モード：戦略条件未成立');
   if(t.strict&&!t.evidenceReady)errors.push('厳格モード：統計的根拠不足');
  }
 }catch(e){errors.push(e instanceof Error?e.message:'注文データ異常');}
 return {ok:!errors.length,errors,warnings,loss,reservePrice};
}
function log(a:PaperAccount,time:number,action:string,reason:string,qty=0,price=0,pnl=0,guard='条件内',context?:Ticket['context']){
 a.journal.push({id:`${a.revision}:${a.journal.length}`,time,action,reason,qty,price,pnl,guard,context});
}
export function submitOrder(account:PaperAccount,t:Ticket,candles:Candle[]):PaperAccount {
 if(account.orders.some(o=>o.id===t.id))return account;
 const a=structuredClone(account),guard=riskGuard(a,t,candles);a.revision++;
 const order:Order={...t,status:guard.ok?'OPEN':'BLOCKED',submittedIndex:candles.length-1,filled:0,filledNotional:0,fees:0,reservePrice:guard.reservePrice,message:guard.errors.join(' / ')||'次以降の足で約定判定'};
 a.orders.push(order);log(a,candles.at(-1)?.time??0,guard.ok?'注文受付':'注文禁止',`${t.reason} ${order.message}`,t.qty,0,0,guard.ok?'条件内':'注文禁止',t.context);return a;
}
export function cancelOrder(account:PaperAccount,id:string):PaperAccount {
 const a=structuredClone(account),o=a.orders.find(x=>x.id===id);if(!o||!open(o))return account;
 o.status='CANCELLED';o.message='取消済み';a.revision++;log(a,0,'取消',id);return a;
}
export function recordSkip(account:PaperAccount,time:number,reason:string,context?:Ticket['context']):PaperAccount {
 const a=structuredClone(account);a.revision++;log(a,time,'見送り',reason||'理由未入力',0,0,0,'取引せず',context);return a;
}
function fillPrice(o:Order,b:Candle):number|null {
 const p=o.price;
 if(o.type==='LIMIT'&&(o.side==='BUY'?b.low>p:b.high<p))return null;
 if(o.type==='STOP'&&!o.triggered&&(o.side==='BUY'?b.high<p:b.low>p))return null;
 let raw=b.open;
 if(o.type==='LIMIT')raw=o.side==='BUY'?Math.min(b.open,p):Math.max(b.open,p);
 if(o.type==='STOP'&&!o.triggered)raw=o.side==='BUY'?Math.max(b.open,p):Math.min(b.open,p);
 const base=minor(raw),adjusted=safe((BigInt(base)*BigInt(o.side==='BUY'?10000+o.slippageBps:10000-o.slippageBps)+(o.side==='BUY'?9999n:0n))/10000n);
 return o.type==='LIMIT'?(o.side==='BUY'?Math.min(adjusted,minor(p)):Math.max(adjusted,minor(p))):adjusted;
}
export function advance(account:PaperAccount,candles:Candle[],through:number,expire=false):PaperAccount {
 if(through<=account.lastIndex)return account;
 if(!Number.isInteger(through)||through>=candles.length)throw new Error('リプレイ時点が不正');
 const a=structuredClone(account);
 for(let i=a.lastIndex+1;i<=through;i++){
  const b=candles[i],day=new Date(b.time*1000).toISOString().slice(0,10);
  if(day!==a.day){a.day=day;a.dayStart=metrics(a,a.lastPrice/100).equity;}
  let capacity=Math.floor(b.volume*.1);
  for(const o of a.orders){
   if(!open(o)||i<=o.submittedIndex)continue;
   let price:number|null,basePrice:number|null;try{price=fillPrice(o,b);basePrice=fillPrice({...o,slippageBps:0},b);minor(b.close);}catch{o.status='REJECTED';o.message='重大な価格異常';continue;}
   if(price!==null&&o.type==='STOP')o.triggered=true;
   if(price===null||capacity<o.lot)continue;
   let q=Math.min(o.qty-o.filled,Math.floor(capacity/o.lot)*o.lot);
   if(o.side==='SELL')q=Math.min(q,a.qty);
   if(o.side==='BUY'){
    const other=a.orders.filter(x=>x.id!==o.id&&open(x)&&x.side==='BUY').reduce((s,x)=>s+mul(x.reservePrice,x.qty-x.filled)+fee(mul(x.reservePrice,x.qty-x.filled),x.feeBps),0);
    const affordable=price>0?safe(BigInt(Math.max(0,a.cash-other))*10000n/(BigInt(price)*BigInt(10000+o.feeBps))):0;
    q=Math.min(q,Math.floor(affordable/o.lot)*o.lot);
    while(q>0&&mul(price,q)+fee(mul(price,q),o.feeBps)>a.cash-other)q-=o.lot;
    const expectedLoss=Math.max(0,o.filledNotional-mul(minor(o.stop),o.filled))+o.fees*2+mul(Math.max(0,price-minor(o.stop)),q)+fee(mul(price,q),o.feeBps)*2;
    if(q<=0||expectedLoss>minor(o.maxLoss)||Math.max(0,-metrics(a,b.open).dailyPnl)+expectedLoss>minor(o.dailyLimit)){
     o.status='REJECTED';o.message='約定時の資金・損失条件違反';log(a,b.time,'約定拒否',o.message,0,price,0,'注文禁止');continue;
    }
   }
   if(q<=0)continue;
   let notional:number,cost:number;
   try{notional=mul(price,q);cost=fee(notional,o.feeBps);safe(BigInt(a.cash)+BigInt(notional));}catch{o.status='REJECTED';o.message='金額の計算範囲を超過';continue;}
   let realized=0;
   if(o.side==='BUY'){a.cash-=notional+cost;a.qty+=q;a.basis+=notional+cost;}
   else{
    const basis=q===a.qty?a.basis:safe(BigInt(a.basis)*BigInt(q)/BigInt(a.qty));
    realized=notional-cost-basis;a.cash+=notional-cost;a.qty-=q;a.basis-=basis;a.realized+=realized;
   }
   const slippage=mul(Math.abs(price-(basePrice??price)),q);a.slippageCosts+=slippage;a.costs+=cost+slippage;o.filled+=q;o.filledNotional+=notional;o.fees+=cost;capacity-=q;
   o.status=o.filled===o.qty?'FILLED':'PARTIALLY_FILLED';o.message='OHLC・出来高10%モデルで仮想約定';
   if(o.side==='BUY'&&metrics(a,price/100).availableCash<0){o.status='CANCELLED';o.message='一部約定後の余力不足で残数量を取消';}
   log(a,b.time,o.side==='BUY'?'買付約定':'売却約定',o.reason,q,price,realized,'条件内',o.context);
  }
  try{const close=minor(b.close);mul(close,a.qty);a.lastPrice=close;}catch{/* Keep last valid mark; guard blocks new buys on abnormal quotes. */}
  const equity=metrics(a,a.lastPrice/100).equity;a.peak=Math.max(a.peak,equity);a.maxDrawdown=Math.max(a.maxDrawdown,a.peak?1-equity/a.peak:0);
  a.lastIndex=i;
 }
 if(expire)for(const o of a.orders)if(open(o)){o.status='EXPIRED';o.message='データ末尾で失効';}
 a.revision++;return a;
}
