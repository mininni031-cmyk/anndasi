import { describe,it,expect } from 'vitest';
import { parseCSV,toCSV } from '../src/lib/csv';
import { generateDemo } from '../src/lib/demo';
import { findSimilar } from '../src/lib/similarity';
const header='time,open,high,low,close,volume\n';
const row='2026-01-01,100,110,90,105,1000';
describe('CSV',()=>{
 it('reads BOM, CRLF, quotes and sorts dates',()=>{
  const c=parseCSV('\uFEFF'+header+'"2026-01-02",100,110,90,105,0\r\n'+row,'1d');
  expect(c).toHaveLength(2); expect(c[0].time).toBe(Date.UTC(2026,0,1)/1000);
 });
 it.each([
  ['missing column','time,open\n2026-01-01,100'],
  ['missing number',header+row.replace(',100,',',,')],
  ['OHLC',header+row.replace(',110,',',99,')],
  ['nonfinite',header+row.replace(',100,',',Infinity,')],
  ['negative volume',header+row.replace(',1000',',-1')],
  ['duplicate',header+row+'\n'+row],
  ['invalid date',header+row.replace('2026-01-01','2026-02-30')],
  ['extra fields',header+row+',extra'],
  ['unclosed quote',header+'"'+row],
  ['empty',header]
 ])('rejects %s',(_,csv)=>expect(()=>parseCSV(csv,'1d')).toThrow());
 it('requires timezone for minutes and rejects invalid calendar dates',()=>{
  expect(()=>parseCSV(header+row.replace('2026-01-01','2026-01-01T12:00:00'),'1m')).toThrow();
  expect(()=>parseCSV(header+row.replace('2026-01-01','2026-02-30T12:00:00Z'),'1m')).toThrow();
  expect(parseCSV(header+row.replace('2026-01-01','2026-01-01T09:30:00-05:00'),'1m')[0].time).toBe(Date.UTC(2026,0,1,14,30)/1000);
 });
 it('enforces byte and row limits',()=>{
  expect(()=>parseCSV(' '.repeat(10*1024*1024+1),'1d')).toThrow(/10/);
  expect(()=>parseCSV(header+Array(100001).fill(row).join('\n'),'1d')).toThrow(/100000/);
 });
 it.each(['JP','US'] as const)('round-trips deterministic %s demos',market=>{
  const d=generateDemo(market);expect(d.candles).toEqual(generateDemo(market).candles);
  expect(parseCSV(toCSV(d.candles,d.timeframe),d.timeframe)).toEqual(d.candles);
 });
});
describe('similarity',()=>{
 it('is deterministic, finite and excludes query and result overlaps',()=>{
  const c=generateDemo('JP').candles;const a=findSimilar(c);
  expect(a).toEqual(findSimilar(c)); expect(a).toHaveLength(5);
  for(const m of a){expect(m.endIndex).toBeLessThan(c.length-20);expect(m.score).toBeGreaterThan(0);expect(m.score).toBeLessThanOrEqual(100);}
  for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)expect(Math.abs(a[i].startIndex-a[j].startIndex)).toBeGreaterThanOrEqual(20);
 });
 it('finds a scaled identical shape at 100',()=>{
  const base=generateDemo('JP').candles.slice(0,20);
  const c=[...base,...base.map(x=>({...x,time:x.time+10000000,open:x.open*2,high:x.high*2,low:x.low*2,close:x.close*2}))];
  expect(findSimilar(c)[0].score).toBeCloseTo(100,8);
 });
 it('handles flat prices and zero volumes',()=>{
  const c=Array.from({length:140},(_,i)=>({time:i,open:100,high:100,low:100,close:100,volume:0}));
  expect(findSimilar(c).map(x=>x.score)).toEqual([100,100,100,100,100]);
 });
 it('returns no candidates for insufficient history',()=>{
  expect(findSimilar(generateDemo('US').candles.slice(0,19))).toEqual([]);
  expect(findSimilar(generateDemo('US').candles.slice(0,39))).toEqual([]);
 });
});
describe('numeric boundaries',()=>{
 it('returns finite exact-match scores for accepted extreme finite prices and volumes',()=>{
  const candles=Array.from({length:40},(_,i)=>{const price=i%20===0?1e-308:1e308;return {time:i,open:price,high:price,low:price,close:price,volume:1e308};});
  expect(findSimilar(candles)[0].score).toBe(100);
 });
});
