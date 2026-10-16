/// <reference lib="webworker" />
import {findSimilar} from '../lib/similarity';
import type {Candle} from '../lib/types';
self.onmessage=(event:MessageEvent<{id:string;candles:Candle[]}>)=>{
 try{self.postMessage({id:event.data.id,matches:findSimilar(event.data.candles)});}
 catch{self.postMessage({id:event.data.id,error:'検索処理に失敗しました。データを確認してください。'});}
};
