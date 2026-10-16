'use client';
import {useEffect,useRef} from 'react';
import {createChart,CandlestickSeries,LineSeries,HistogramSeries,ColorType,type UTCTimestamp} from 'lightweight-charts';
import type {Candle,Timeframe} from '@/lib/types';
export default function PriceChart({candles,timeframe}:{candles:Candle[];timeframe:Timeframe}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!host.current)return;
  const chart=createChart(host.current,{
   autoSize:true,height:440,
   layout:{background:{type:ColorType.Solid,color:'#0e151f'},textColor:'#8190a5',fontFamily:'Arial, sans-serif',fontSize:11,attributionLogo:true},
   grid:{vertLines:{color:'#192230'},horzLines:{color:'#192230'}},
   rightPriceScale:{borderColor:'#263141',scaleMargins:{top:.12,bottom:.26}},
   timeScale:{borderColor:'#263141',timeVisible:timeframe==='1m',secondsVisible:false},
   crosshair:{vertLine:{color:'#64748b',labelBackgroundColor:'#334155'},horzLine:{color:'#64748b',labelBackgroundColor:'#334155'}},
  });
  const series=chart.addSeries(CandlestickSeries,{upColor:'#51cfaa',downColor:'#ee7c85',wickUpColor:'#51cfaa',wickDownColor:'#ee7c85',borderVisible:false,priceFormat:{type:'price',precision:2,minMove:.01}});
  series.setData(candles.map(c=>({...c,time:c.time as UTCTimestamp})));
  for(const [period,color] of [[5,'#e4b26b'],[20,'#8194f5']] as const){
   const ma=chart.addSeries(LineSeries,{color,lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
   let sum=0;ma.setData(candles.flatMap((c,i)=>{
    sum+=c.close;if(i>=period)sum-=candles[i-period].close;
    return i<period-1?[]:[{time:c.time as UTCTimestamp,value:sum/period}];
   }));
  }
  const volume=chart.addSeries(HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',priceLineVisible:false,lastValueVisible:false});
  volume.priceScale().applyOptions({scaleMargins:{top:.84,bottom:0}});
  volume.setData(candles.map(c=>({time:c.time as UTCTimestamp,value:c.volume,color:c.close>=c.open?'#51cfaa35':'#ee7c8535'})));
  chart.timeScale().setVisibleLogicalRange({from:Math.max(0,candles.length-140),to:candles.length+4});
  return ()=>chart.remove();
 },[candles,timeframe]);
 return <div className="chart" data-testid="main-chart" ref={host} aria-label="ローソク足・5本と20本移動平均・出来高チャート"/>;
}
