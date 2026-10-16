import type {Candle,Match,Timeframe} from '@/lib/types';
import {formatTime} from '@/lib/types';
function Sparkline({candles}:{candles:Candle[]}){
 const min=Math.min(...candles.map(c=>c.low)),max=Math.max(...candles.map(c=>c.high));
 const points=candles.map((c,i)=>`${i*180/19},${44-(c.close-min)/Math.max(max-min,1e-8)*36}`).join(' ');
 return <svg viewBox="0 0 180 52" className="sparkline" role="img" aria-label="過去20本の終値ミニチャート"><path d="M0 44 H180" stroke="#253043" strokeDasharray="3 4"/><polyline points={points} fill="none" stroke="#65cdb2" strokeWidth="1.7" vectorEffect="non-scaling-stroke"/></svg>;
}
export default function MatchCard({match,candles,timeframe,index,name}:{match:Match;candles:Candle[];timeframe:Timeframe;index:number;name:string}){
 const window=candles.slice(match.startIndex,match.endIndex+1);
 return <article className="match-card" data-testid="match-card">
  <div className="match-head"><span className="rank">{String(index+1).padStart(2,'0')}</span><span className="match-name" title={name}>{name.split(' / ')[0]}</span><strong>{match.score.toFixed(1)}<small> / 100</small></strong></div>
  <Sparkline candles={window}/>
  <div className="match-date">{formatTime(window[0].time,timeframe)}<span>→ {formatTime(window[19].time,timeframe)}</span></div>
  <div className="match-meta"><span>20本比較</span><span>パターン名：未判定</span></div>
 </article>;
}
