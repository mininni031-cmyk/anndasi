import type { Dataset,Market,Candle } from './types';
export function generateDemo(market:Market):Dataset {
 let seed=market==='JP'?1729:2718;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const candles:Candle[]=[];let previous=market==='JP'?2400:180;
 const round=(n:number)=>Math.round(n*100)/100;
 let time=Date.UTC(2024,0,4,market==='JP'?0:14,market==='JP'?0:30)/1000;
 for(let i=0;i<760;i++){
  const open=round(previous*(1+(random()-.5)*.006));
  const wave=Math.sin(i/18)*.004+Math.sin(i/57)*.003;
  const close=round(open*(1+wave+(random()-.47)*.018));
  const high=round(Math.max(open,close)*(1+random()*.012));
  const low=round(Math.min(open,close)*(1-random()*.012));
  candles.push({time,open,high,low,close,volume:Math.round(80000+random()*600000)});previous=close;
  time+=market==='JP'?86400:60;
  if(market==='JP')while([0,6].includes(new Date(time*1000).getUTCDay()))time+=86400;
 }
 return {id:'demo-'+market,name:market==='JP'?'DEMO-JP / 架空日本株':'DEMO-US / 架空米国株',market,timeframe:market==='JP'?'1d':'1m',currency:market==='JP'?'JPY':'USD',source:'demo',candles};
}
