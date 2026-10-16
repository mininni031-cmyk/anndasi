import type { Dataset } from './types';
import {parseCSV,toCSV} from './csv';
let writes:Promise<void>=Promise.resolve();
function open():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('pattern-lab',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('workspace');
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(new Error('別タブを閉じて再試行してください。'));
  request.onsuccess=()=>resolve(request.result);
 });
}
export async function restoreDataset():Promise<Dataset|null>{
 const db=await open();
 try{
  const value=await new Promise<Dataset|undefined>((resolve,reject)=>{
   const tx=db.transaction('workspace','readonly');const r=tx.objectStore('workspace').get('active');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  if(!value)return null;
  if(!['JP','US'].includes(value.market)||!['1d','1m'].includes(value.timeframe)||!['csv','demo'].includes(value.source)||typeof value.name!=='string'||typeof value.id!=='string'||value.currency!==(value.market==='JP'?'JPY':'USD')||!Array.isArray(value.candles))throw new Error('保存データの形式が不正です。');
  return {...value,candles:parseCSV(toCSV(value.candles,value.timeframe),value.timeframe)};
 }finally{db.close();}
}
function mutate(value:Dataset|null):Promise<void>{
 // Serialize writes so a slow earlier import can never resurrect deleted data.
 const operation=writes.catch(()=>{}).then(async()=>{
  const db=await open();
  try{await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('workspace','readwrite');const store=tx.objectStore('workspace');
   if(value)store.put(value,'active');else store.clear();
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
 });
 writes=operation;return operation;
}
export const saveDataset=(d:Dataset)=>mutate(d);
export const clearDataset=()=>mutate(null);
