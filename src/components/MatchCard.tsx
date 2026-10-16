import type {HistoricalMatch} from '@/lib/research';
import {detectPattern} from '@/lib/patterns';
import type {Candle,Timeframe} from '@/lib/types';
import {formatTime} from '@/lib/types';
function MiniCandles({candles}:{candles:Candle[]}){
 const min=Math.min(...candles.map(c=>c.low)),max=Math.max(...candles.map(c=>c.high));
 const y=(p:number)=>43-(p-min)/Math.max(max-min,1e-8)*36;
 return <svg viewBox="0 0 160 50" className="sparkline" role="img" aria-label="過去20本のローソク足ミニチャート">{candles.map((c,i)=>{const color=c.close>=c.open?'#20d9bc':'#ec536c',x=i*7.7+5;return <g key={i} stroke={color} fill={color}><path d={`M${x} ${y(c.high)}V${y(c.low)}`} strokeWidth=".7"/><rect x={x-1.8} y={Math.min(y(c.open),y(c.close))} width="3.6" height={Math.max(1,Math.abs(y(c.open)-y(c.close)))}/></g>;})}</svg>;
}
export default function MatchCard({match,candles,timeframe,index,name}:{match:HistoricalMatch;candles:Candle[];timeframe:Timeframe;index:number;name:string}){
 const window=candles.slice(match.startIndex,match.endIndex+1);
 return <article className="match-card" data-testid="match-card">
  <span className="rank">{index+1}</span>
  <div className="match-score"><small>形状スコア</small><strong>{match.score.toFixed(1)}<small>/100</small></strong></div>
  <MiniCandles candles={window}/>
  <div className="match-date" title={`${name} / ${formatTime(window[0].time,timeframe)} → ${formatTime(window[19].time,timeframe)}`}><span>{formatTime(window[19].time,timeframe)}</span><b>{detectPattern(window).name}</b></div>
  <div className="match-returns">{match.returns.map((value,i)=><span key={i} className={value>=0?'positive':'negative'}><small>{[5,10,20][i]}本後</small>{value>=0?'+':''}{value.toFixed(2)}%</span>)}</div>
  <div className="match-net"><span>20本後・純損益</span><strong data-testid="match-net20" className={match.net20>=0?'positive':'negative'}>{match.net20>=0?'+':''}{match.net20.toFixed(2)}%</strong></div>
 </article>;
}
