import {it,expect} from 'vitest';
import {movingAverage} from '../src/lib/indicators';
it('computes a finite MA for large finite prices without overflowing a rolling sum',()=>{
 const candles=Array.from({length:8},(_,time)=>({time,open:1e308,high:1e308,low:1e308,close:1e308,volume:0}));
 expect(movingAverage(candles,5)).toEqual([4,5,6,7].map(time=>({time,value:1e308})));
});
it('averages only completed windows and retains timestamps',()=>{
 const candles=[2,4,6,8].map((close,time)=>({time,open:close,high:close,low:close,close,volume:0}));
 expect(movingAverage(candles,2)).toEqual([{time:1,value:3},{time:2,value:5},{time:3,value:7}]);
});
