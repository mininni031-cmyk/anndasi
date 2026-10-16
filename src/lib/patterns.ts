import type {Candle} from './types';
export interface Pattern {name:string;status:'形成中'|'成立確認'|'否定'|'判定不可';neckline?:number;reason:string;candle:string}
export function detectPattern(input:Candle[]):Pattern {
 const c=input.slice(-20),last=c.at(-1),prev=c.at(-2);
 let candle='該当なし';
 if(last){const range=last.high-last.low,body=Math.abs(last.close-last.open);if(range>0&&body/range<.1)candle='十字線';
 if(prev&&last.close>last.open&&prev.close<prev.open&&last.open<=prev.close&&last.close>=prev.open)candle='強気包み足';
 if(prev&&last.close<last.open&&prev.close>prev.open&&last.open>=prev.close&&last.close<=prev.open)candle='弱気包み足';}
 const none:Pattern={name:'特徴未検出',status:'判定不可',reason:'20本内にルールを満たす構造がありません。',candle};
 if(c.length<20)return {...none,reason:'パターン判定には20本が必要です。'};
 const max=Math.max(...c.map(x=>x.high)),p=c.map(x=>x.close/max),span=Math.max(...p)-Math.min(...p);
 if(span<1e-8)return none;
 const lows:number[]=[],highs:number[]=[];
 for(let i=1;i<19;i++){if(p[i]<p[i-1]&&p[i]<=p[i+1])lows.push(i);if(p[i]>p[i-1]&&p[i]>=p[i+1])highs.push(i);}
 const pattern=(name:string,level:number,broken:boolean,confirmed:boolean):Pattern=>({name,status:broken?'否定':confirmed?'成立確認':'形成中',neckline:level*max,reason:'終値の局所極値とネックラインによる暫定ルール。利益や反転の確率ではありません。',candle});
 for(const [indices,inverse] of [[lows,true],[highs,false]] as const){
  if(indices.length>=3){const [a,b,d]=indices.slice(-3);const head=inverse?p[b]<Math.min(p[a],p[d])-.1*span:p[b]>Math.max(p[a],p[d])+.1*span;
   if(d-a>=6&&head&&Math.abs(p[a]-p[d])<.2*span){const mids=[...p.slice(a+1,b),...p.slice(b+1,d)];const level=inverse?Math.max(...mids):Math.min(...mids);
    return pattern(inverse?'逆ヘッドアンドショルダー':'ヘッドアンドショルダー',level,inverse?p[19]<p[b]-.05*span:p[19]>p[b]+.05*span,inverse?p[19]>level:p[19]<level);}}
 }
 for(const [indices,inverse] of [[lows,true],[highs,false]] as const){
  if(indices.length>=2){const [a,b]=indices.slice(-2);if(b-a>=4&&Math.abs(p[a]-p[b])<=.15*span){const middle=p.slice(a+1,b);const level=inverse?Math.max(...middle):Math.min(...middle);const depth=inverse?level-Math.max(p[a],p[b]):Math.min(p[a],p[b])-level;
   if(depth>.2*span)return pattern(inverse?'ダブルボトム':'ダブルトップ',level,inverse?p[19]<Math.min(p[a],p[b])-.05*span:p[19]>Math.max(p[a],p[b])+.05*span,inverse?p[19]>level:p[19]<level);}}
 }
 if(lows.length>=2&&highs.length>=2){const [a,b]=lows.slice(-2),[d,e]=highs.slice(-2);if(p[b]>p[a]&&p[e]<p[d]&&Math.max(b,e)>=13){
  const upper=p[d]+(p[e]-p[d])/(e-d)*(19-d),lower=p[a]+(p[b]-p[a])/(b-a)*(19-a);
  if(lower<upper)return pattern('三角持ち合い',upper,p[19]<lower,p[19]>upper);
 }}
 return none;
}
