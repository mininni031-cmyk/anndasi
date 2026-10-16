import type {Candle,Match} from './types';
import {similarityCandidates} from './similarity';
import {detectPattern} from './patterns';
export interface HistoricalMatch extends Match {returns:number[];net20:number}
export interface Summary {count:number;mean:number|null;losses:number;interval:[number,number]|null;status:string}
function summarize(values:number[]):Summary {
 const count=values.length;if(!count)return {count,mean:null,losses:0,interval:null,status:'根拠不足'};
 const mean=values.reduce((s,x)=>s+x/count,0);
 const variance=count>1?values.reduce((s,x)=>s+(x-mean)**2/(count-1),0):0;
 const margin=1.96*Math.sqrt(variance/count);
 return {count,mean,losses:values.filter(x=>x<0).length,interval:count>=30?[mean-margin,mean+margin]:null,status:count>=30?'記述評価のみ':'根拠不足'};
}
export function research(candles:Candle[],costBps:number){
 const cost=Number.isFinite(costBps)?Math.max(0,Math.min(1000,costBps)):0;
 const candidates=similarityCandidates(candles,20);
 const outcome=(m:Match):HistoricalMatch=>{
  const returns=[5,10,20].map(h=>Math.max(-100,Math.min(1e12,(candles[m.endIndex+h].close/candles[m.endIndex].close-1)*100)));
  return {...m,returns,net20:returns[2]-cost/50};
 };
 const chosen:HistoricalMatch[]=[];
 for(const m of candidates){if(chosen.every(x=>m.endIndex+20<x.startIndex||m.startIndex>x.endIndex+20))chosen.push(outcome(m));if(chosen.length===5)break;}
 const queryStart=Math.max(0,candles.length-20),bounds=[0,Math.floor(queryStart*.6),Math.floor(queryStart*.8),queryStart];
 const periods=['開発60%','調整20%','最終20%'].map((label,i)=>{
  // Chronological non-overlapping windows, including their 20-bar outcome horizon.
  const eligible=candidates.filter(m=>m.startIndex>=bounds[i]&&m.endIndex+20<bounds[i+1]).sort((a,b)=>a.startIndex-b.startIndex);
  const baseline:HistoricalMatch[]=[];let next=bounds[i];
  for(const m of eligible){if(m.startIndex>=next){baseline.push(outcome(m));next=m.endIndex+21;}}
  return {label,start:bounds[i],end:bounds[i+1],...summarize(baseline.filter(m=>m.score>=80).map(m=>m.net20)),baseline:summarize(baseline.map(m=>m.net20))};
 });
 return {matches:chosen,pattern:detectPattern(candles),summary:summarize(chosen.map(m=>m.net20)),periods,costBps:cost};
}
export type Research=ReturnType<typeof research>;
