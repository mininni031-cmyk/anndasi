import type { Candle,Match } from './types';
const WINDOW=20;
function features(candles:Candle[]):number[][] {
 const base=candles[0].close;
 const relative=candles.flatMap(c=>[c.open/base-1,c.high/base-1,c.low/base-1,c.close/base-1]);
 const scale=Math.max(Math.max(...relative)-Math.min(...relative),1e-8);
 const shape=relative.map(v=>v/scale);
 const foot=(c:Candle)=>[(c.close-c.open)/base/scale,(c.high-Math.max(c.open,c.close))/base/scale,(Math.min(c.open,c.close)-c.low)/base/scale];
 const meanVolume=candles.reduce((s,c)=>s+c.volume,0)/WINDOW;
 const activity=candles.flatMap(c=>[(c.high-c.low)/base,meanVolume?c.volume/meanVolume:0]);
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
