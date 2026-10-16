export type Market = 'JP' | 'US';
export type Timeframe = '1d' | '1m';
export interface Candle { time:number; open:number; high:number; low:number; close:number; volume:number }
export interface Dataset { id:string; name:string; market:Market; timeframe:Timeframe; currency:'JPY'|'USD'; source:'demo'|'csv'; candles:Candle[] }
export interface Match { startIndex:number; endIndex:number; score:number }
export const timeframeLabel = (t:Timeframe) => t==='1d'?'日足':'1分足';
export function formatTime(time:number,timeframe:Timeframe):string {
 const iso=new Date(time*1000).toISOString();
 return timeframe==='1d'?iso.slice(0,10):iso.slice(0,16).replace('T',' ')+' UTC';
}
