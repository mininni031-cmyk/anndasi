import {describe,it,expect} from 'vitest';
import {createAccount,submitOrder,advance,cancelOrder,riskGuard,minor,metrics, type Ticket} from '../src/lib/paper';
import type {Candle} from '../src/lib/types';
const bar=(time:number,open=100,high=110,low=90,close=100,volume=10000):Candle=>({time,open,high,low,close,volume});
const bars=Array.from({length:20},(_,i)=>bar(i));
const ticket=(patch:Partial<Ticket>={}):Ticket=>({id:'b1',side:'BUY',type:'MARKET',qty:100,price:100,stop:95,target:110,lot:100,feeBps:0,slippageBps:0,maxLoss:10000,dailyLimit:30000,strict:false,strategyReady:false,evidenceReady:false,reason:'test',...patch});
describe('paper broker',()=>{
 it('uses integer cents and buys then partially and fully sells with exact PnL',()=>{
  let a=createAccount('d','JPY',19);
  a=submitOrder(a,ticket(),bars);expect(a.cash).toBe(minor(1000000));
  expect(a.orders[0].status).toBe('OPEN');
  a=advance(a,[...bars,bar(20)],20);expect(a.qty).toBe(100);expect(a.cash).toBe(minor(990000));
  a=submitOrder(a,ticket({id:'s1',side:'SELL',qty:50,lot:1}),[...bars,bar(20)]);
  a=advance(a,[...bars,bar(20),bar(21,110)],21);expect(a.qty).toBe(50);expect(a.realized).toBe(minor(500));
  a=submitOrder(a,ticket({id:'s2',side:'SELL',qty:50,lot:1}),[...bars,bar(20),bar(21,110)]);
  a=advance(a,[...bars,bar(20),bar(21,110),bar(22,90)],22);
  expect(a.qty).toBe(0);expect(a.basis).toBe(0);expect(a.realized).toBe(0);expect(a.cash).toBe(minor(1000000));
 });
 it('blocks insufficient cash, invalid lots and uncovered selling',()=>{
  const a=createAccount('d','JPY',19);
  expect(riskGuard(a,ticket({qty:20000}),bars).ok).toBe(false);
  expect(riskGuard(a,ticket({qty:1}),bars).ok).toBe(false);
  expect(riskGuard(a,ticket({side:'SELL'}),bars).ok).toBe(false);
 });
 it('reserves open buy cash and releases it on cancellation',()=>{
  let a=createAccount('d','JPY',19);a=submitOrder(a,ticket({type:'LIMIT',price:90,stop:85}),bars);
  expect(metrics(a,100).reservedCash).toBe(minor(9000));
  a=cancelOrder(a,'b1');expect(metrics(a,100).reservedCash).toBe(0);
 });
 it('is idempotent for order ids and already processed bars',()=>{
  let a=createAccount('d','JPY',19);a=submitOrder(a,ticket(),bars);
  expect(submitOrder(a,ticket(),bars)).toEqual(a);
  expect(advance(a,bars,19)).toEqual(a);
  a=advance(a,[...bars,bar(20)],20);expect(advance(a,[...bars,bar(20)],20)).toEqual(a);
 });
 it('partially fills only within available volume and completes on later bar',()=>{
  let a=submitOrder(createAccount('d','JPY',19),ticket(),bars);
  a=advance(a,[...bars,bar(20,100,110,90,100,500)],20);
  expect(a.qty).toBe(0); // 10% volume=50 below one JP lot.
  a=advance(a,[...bars,bar(20),bar(21,100,110,90,100,1000)],21);
  expect(a.qty).toBe(100);
  let b=submitOrder(createAccount('e','USD',19),ticket({lot:1,qty:100}),bars);
  b=advance(b,[...bars,bar(20,100,110,90,100,500)],20);
  expect(b.qty).toBe(50);expect(b.orders[0].status).toBe('PARTIALLY_FILLED');
 });
 it('allows risk-reducing sale despite strict evidence restrictions',()=>{
  let a=submitOrder(createAccount('d','JPY',19),ticket(),bars);a=advance(a,[...bars,bar(20)],20);
  expect(riskGuard(a,ticket({side:'SELL',strict:true,maxLoss:0,dailyLimit:0,stop:200}),[...bars,bar(20)]).ok).toBe(true);
  expect(riskGuard(a,ticket({id:'b2',strict:true}),[...bars,bar(20)]).ok).toBe(false);
 });
 it('keeps limits despite slippage and triggers gap stops conservatively',()=>{
  let a=submitOrder(createAccount('d','JPY',19),ticket({type:'LIMIT',price:95,stop:90,slippageBps:100}),bars);
  a=advance(a,[...bars,bar(20,90,100,85)],20);
  expect(a.orders[0].filledNotional/a.qty).toBeLessThanOrEqual(minor(95));
  let b=submitOrder(createAccount('d','JPY',19),ticket({type:'STOP',price:105,stop:95}),bars);
  b=advance(b,[...bars,bar(20,110,120,108)],20);expect(b.orders[0].filledNotional/b.qty).toBe(minor(110));
 });
 it('deducts fees once and never spends another order reservation',()=>{
  let a=submitOrder(createAccount('d','JPY',19),ticket({feeBps:10}),bars);
  a=advance(a,[...bars,bar(20)],20);expect(a.cash).toBe(minor(989990));expect(a.costs).toBe(minor(10));
  expect(a.cash).toBeGreaterThanOrEqual(0);
 });
});
it('maintains reservations after a large opening gap and rejects corrupted books',()=>{
 let a=submitOrder(createAccount('d','USD',19),ticket({qty:100,lot:1,stop:1,maxLoss:100000,dailyLimit:100000}),bars);
 a=advance(a,[...bars,bar(20,150,160,140,150,500)],20);
 expect(a.cash).toBeGreaterThanOrEqual(0);expect(metrics(a,150).availableCash).toBeGreaterThanOrEqual(0);
});
it('retains decision context and reports model slippage without charging it twice',()=>{
 const context={technical:'W / 形成中',statistics:'根拠不足',event:'未確認',dataset:'TEST',timeframe:'1d'};
 let a=submitOrder(createAccount('d','JPY',19),ticket({slippageBps:10,context}),bars);
 a=advance(a,[...bars,bar(20)],20);
 expect(a.slippageCosts).toBe(minor(10));expect(a.costs).toBe(minor(10));
 expect(a.cash).toBe(minor(989990));expect(a.journal.at(-1)?.context).toEqual(context);
});
it('keeps a partially-filled buy stop triggered on later bars below its original threshold',()=>{
 let a=submitOrder(createAccount('d','JPY',19),ticket({type:'STOP',price:105,stop:90,lot:1}),bars);
 a=advance(a,[...bars,bar(20,110,115,108,110,500)],20);expect(a.qty).toBe(50);
 a=advance(a,[...bars,bar(20,110,115,108,110,500),bar(21,100,104,95)],21);
 expect(a.qty).toBe(100);expect(a.orders[0].status).toBe('FILLED');
});
it('keeps a partially-filled sell stop triggered after a rebound',()=>{
 let a=submitOrder(createAccount('d','JPY',19),ticket({lot:1}),bars);
 a=advance(a,[...bars,bar(20)],20);
 a=submitOrder(a,ticket({id:'s1',side:'SELL',type:'STOP',price:95,lot:1}),[...bars,bar(20)]);
 const next=[...bars,bar(20),bar(21,90,94,85,90,500),bar(22,105,110,100,105)];
 a=advance(a,next,21);expect(a.qty).toBe(50);a=advance(a,next,22);expect(a.qty).toBe(0);
});
