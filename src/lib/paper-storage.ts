import {metrics,type PaperAccount} from './paper';
function connect():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('pattern-lab',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('workspace'))r.result.createObjectStore('workspace');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('保存領域が別タブで使用中です'));});}
export function validateAccount(value:unknown,datasetId:string):PaperAccount {
 const a=value as PaperAccount;
 if(!a||a.version!==1||a.datasetId!==datasetId||!['JPY','USD'].includes(a.currency)||!Array.isArray(a.orders)||!Array.isArray(a.journal))throw new Error('仮想口座の保存形式が不正です');
 for(const k of ['initial','cash','qty','basis','costs','lastIndex','lastPrice','peak','revision','slippageCosts'] as const)if(!Number.isSafeInteger(a[k])||a[k]<0)throw new Error('仮想口座の数値が不正です');
 for(const k of ['realized','dayStart'] as const)if(!Number.isSafeInteger(a[k]))throw new Error('仮想口座の損益が不正です');
 if(!Number.isFinite(a.maxDrawdown)||typeof a.day!=='string')throw new Error('仮想口座の評価が不正です');
 const ids=new Set<string>();
 for(const o of a.orders){
  if(!o||typeof o.id!=='string'||ids.has(o.id)||!['BUY','SELL'].includes(o.side)||!['MARKET','LIMIT','STOP'].includes(o.type)||!['DRAFT','BLOCKED','ACCEPTED','OPEN','PARTIALLY_FILLED','FILLED','CANCELLED','EXPIRED','REJECTED'].includes(o.status))throw new Error('注文履歴が不正です');ids.add(o.id);
  for(const k of ['qty','filled','filledNotional','fees','reservePrice','submittedIndex'] as const)if(!Number.isSafeInteger(o[k])||o[k]<0)throw new Error('注文数量・金額が不正です');
  if(o.triggered!==undefined&&typeof o.triggered!=='boolean')throw new Error('逆指値状態が不正です');
  if(o.filled>o.qty||!Number.isInteger(o.feeBps)||o.feeBps<0||o.feeBps>1000||!Number.isInteger(o.lot)||o.lot<1)throw new Error('注文コスト・単位が不正です');
 }
 for(const j of a.journal){
  if(!j||typeof j.id!=='string'||typeof j.action!=='string'||typeof j.reason!=='string'||typeof j.guard!=='string')throw new Error('ジャーナルの保存形式が不正です');
  for(const k of ['time','qty','price','pnl'] as const)if(!Number.isSafeInteger(j[k]))throw new Error('ジャーナルの数値が不正です');
  if(j.qty<0||j.price<0)throw new Error('ジャーナルの株数・価格が不正です');
  if(j.context)for(const value of Object.values(j.context))if(typeof value!=='string')throw new Error('判断記録の保存形式が不正です');
 }
 const m=metrics(a,a.lastPrice/100);if(m.availableCash<0||m.availableQty<0||a.qty===0&&a.basis!==0)throw new Error('口座の残高が整合しません');
 return a;
}
export async function readPaper(datasetId:string):Promise<PaperAccount|null>{
 const db=await connect();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readonly'),r=tx.objectStore('workspace').get('paper:'+datasetId);r.onsuccess=()=>{try{resolve(r.result?validateAccount(r.result,datasetId):null);}catch(e){reject(e);}};r.onerror=()=>reject(r.error);});}finally{db.close();}
}
export async function updatePaper(datasetId:string,initial:()=>PaperAccount,reduce:(a:PaperAccount)=>PaperAccount):Promise<PaperAccount>{
 const db=await connect();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace'),r=store.get('paper:'+datasetId);let next:PaperAccount;
  r.onsuccess=()=>{try{const current=r.result?validateAccount(r.result,datasetId):initial();next=validateAccount(reduce(current),datasetId);store.put(next,'paper:'+datasetId);}catch(e){tx.abort();reject(e);}};
  tx.oncomplete=()=>resolve(next);tx.onabort=()=>reject(tx.error??new Error('口座の更新を中断しました'));tx.onerror=()=>reject(tx.error);
 });}finally{db.close();}
}
export async function resetPaper(account:PaperAccount):Promise<PaperAccount>{
 const db=await connect();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put(account,'paper:'+account.datasetId);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});return account;}finally{db.close();}
}
