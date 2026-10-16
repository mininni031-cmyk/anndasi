/// <reference lib="webworker" />
import {research} from '../lib/research';
import type {Candle} from '../lib/types';
self.onmessage=(event:MessageEvent<{id:string;candles:Candle[];costBps:number}>)=>{
 try{self.postMessage({id:event.data.id,research:research(event.data.candles,event.data.costBps)});}
 catch{self.postMessage({id:event.data.id,error:'検索処理に失敗しました。データを確認してください。'});}
};
