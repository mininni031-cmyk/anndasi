import {it,expect} from 'vitest';
import {detectPattern} from '../src/lib/patterns';
import {research} from '../src/lib/research';
import {generateDemo} from '../src/lib/demo';
const candles=(values:number[])=>values.map((close,time)=>({time,open:close,high:close+.1,low:close-.1,close,volume:10}));
it('detects confirmed W and inverted M structures',()=>{
 const w=[12,11,10,9,8,9,10,11,10,9,8,9,10,11,12,13,14,15,16,17];
 expect(detectPattern(candles(w)).name).toBe('ダブルボトム');
 expect(detectPattern(candles(w)).status).toBe('成立確認');
 expect(detectPattern(candles(w.map(x=>30-x))).name).toBe('ダブルトップ');
});
it('rejects insufficient structure',()=>expect(detectPattern(candles([1,2])).status).toBe('判定不可'));
it('research cannot see suffix after cursor and outcomes end before query',()=>{
 const d=generateDemo('JP').candles;const a=research(d.slice(0,400),10);
 const changed=d.map((c,i)=>i<400?c:{...c,close:c.close*2});
 expect(research(changed.slice(0,400),10)).toEqual(a);
 for(const m of a.matches)expect(m.endIndex+20).toBeLessThan(380);
 expect(a).toEqual(research(d.slice(0,400),10));
});
it('subtracts round-trip costs and exposes sample insufficiency',()=>{
 const d=generateDemo('JP').candles;const a=research(d,0),b=research(d,10);
 expect(a.matches.length).toBe(5);
 expect(a.matches[0].net20-b.matches[0].net20).toBeCloseTo(.2);
 expect(b.periods[2].status).toBe('根拠不足');
});
it('distinguishes forming and invalidated W from confirmed W',()=>{
 const values=[12,11,10,9,8,9,10,11,10,9,8,9,10,10.2,10.3,10.4,10.5,10.6,10.7,10.8];
 expect(detectPattern(candles(values)).status).toBe('形成中');
 expect(detectPattern(candles([...values.slice(0,19),7])).status).toBe('否定');
});
it('cost input remains bounded and every period respects its outcome boundary',()=>{
 const d=generateDemo('US').candles;
 expect(research(d,Infinity).costBps).toBe(0);
 expect(research(d,5000).costBps).toBe(1000);
 expect(research(d.slice(0,20),10).matches).toEqual([]);
});
it('detects inverse head and shoulders, shoulders and converging triangle',()=>{
 const ihs=[12,11,10,11,12,10,8,10,12,11,10,11,12,13,14,15,16,17,18,19];
 expect(detectPattern(candles(ihs)).name).toBe('逆ヘッドアンドショルダー');
 expect(detectPattern(candles(ihs.map(x=>30-x))).name).toBe('ヘッドアンドショルダー');
 const triangle=[10,15,8,14,9,13,10,12.5,10.5,12.1,11,11.9,11.3,11.7,11.4,11.6,11.45,11.55,11.48,11.52];
 expect(detectPattern(candles(triangle)).name).toBe('三角持ち合い');
});
