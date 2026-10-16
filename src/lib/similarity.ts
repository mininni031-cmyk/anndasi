import type { Candle,Match } from './types';
const WINDOW=20;
function features(candles:Candle[]):number[][] {
 // Algebraically equivalent price normalization, scaled before subtraction/division.
 // Avoids overflowing price/base when both input prices are individually finite.
 const maxPrice=Math.max(...candles.map(c=>c.high));
 const base=candles[0].close/maxPrice;
 const prices=candles.flatMap(c=>[c.open/maxPrice,c.high/maxPrice,c.low/maxPrice,c.close/maxPrice]);
 const scale=Math.max(Math.max(...prices)-Math.min(...prices),1e-8*base,Number.MIN_VALUE);
 const shape=prices.map(v=>(v-base)/scale);
 const foot=(c:Candle)=>[(c.close/maxPrice-c.open/maxPrice)/scale,(c.high/maxPrice-Math.max(c.open,c.close)/maxPrice)/scale,(Math.min(c.open,c.close)/maxPrice-c.low/maxPrice)/scale];
 const maxVolume=Math.max(...candles.map(c=>c.volume));
 const meanVolume=maxVolume?candles.reduce((s,c)=>s+c.volume/maxVolume/WINDOW,0):0;
 // Only astronomically large relative ranges saturate; all emitted features stay finite.
 const activity=candles.flatMap(c=>[Math.min(1e12,(c.high/maxPrice-c.low/maxPrice)/Math.max(base,Number.MIN_VALUE)),meanVolume?(c.volume/maxVolume)/meanVolume:0]);
 return [shape,foot(candles[19]),candles.slice(-3).flatMap(foot),activity];
}
export function findSimilar(candles:Candle[]):Match[] {
 if(candles.length<40)return [];
 const queryStart=candles.length-WINDOW;
 const query=features(candles.slice(queryStart));
 const weights=[.5,.25,.15,.1];const candidates:Match[]=[];
 for(let start=0;start+WINDOW<=queryStart;start++){
  const f=features(candles.slice(start,start+WINDOW));
  const distance=f.reduce((sum,group,i)=>sum+weights[i]*group.reduce((s,v,j)=>s+Math.abs(v-query[i][j]),0)/group.length,0);
  candidates.push({startIndex:start,endIndex:start+WINDOW-1,score:100/(1+distance)});
 }
 candidates.sort((a,b)=>b.score-a.score||candles[a.startIndex].time-candles[b.startIndex].time);
 const selected:Match[]=[];
 for(const c of candidates){
  if(selected.every(m=>c.endIndex<m.startIndex||c.startIndex>m.endIndex))selected.push(c);
  if(selected.length===5)break;
 }
 return selected;
}
