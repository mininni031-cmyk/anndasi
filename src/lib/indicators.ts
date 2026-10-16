import type {Candle} from './types';
export function movingAverage(candles:Candle[],period:number):{time:number;value:number}[]{
 if(!Number.isInteger(period)||period<1)throw new Error('period must be a positive integer');
 const result:{time:number;value:number}[]=[];
 for(let i=period-1;i<candles.length;i++){
  const window=candles.slice(i-period+1,i+1);
  const scale=Math.max(...window.map(c=>c.close));
  const fraction=window.reduce((sum,c)=>sum+c.close/scale/period,0);
  result.push({time:candles[i].time,value:Math.min(1,fraction)*scale});
 }
 return result;
}
