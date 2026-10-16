'use client';
import {useEffect,useRef,useState} from 'react';
import type {ChangeEvent} from 'react';
import type {Dataset,Market,Match,Timeframe} from '@/lib/types';
import {formatTime,timeframeLabel} from '@/lib/types';
import {generateDemo} from '@/lib/demo';
import {MAX_BYTES,parseCSV,toCSV} from '@/lib/csv';
import {clearDataset,restoreDataset,saveDataset} from '@/lib/storage';
import PriceChart from './PriceChart';
import MatchCard from './MatchCard';
export default function Workspace(){
 const [dataset,setDataset]=useState<Dataset|null>(null);
 const [market,setMarket]=useState<Market>('JP');
 const [timeframe,setTimeframe]=useState<Timeframe>('1d');
 const [name,setName]=useState('MY-JP');
 const [result,setResult]=useState<{id:string;matches:Match[]}>({id:'',matches:[]});
 const matches=result.id===dataset?.id?result.matches:[];
 const [searching,setSearching]=useState(false);
 const [loading,setLoading]=useState(false);
 const [ready,setReady]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('ローカルデータで、自分の判断を研究する。');
 const [saveState,setSaveState]=useState('未保存 / 架空データ');
 const action=useRef(0);
 useEffect(()=>{
  let active=true;
  restoreDataset().then(saved=>{
   if(!active)return;
   setDataset(saved??generateDemo('JP'));
   if(saved){setMarket(saved.market);setTimeframe(saved.timeframe);setName(saved.name);setSaveState('ブラウザ内から復元');setNotice('保存したデータを復元しました。');}
  }).catch(()=>{
   if(active){setDataset(generateDemo('JP'));setNotice('保存データを復元できませんでした。架空データで利用できます。');setSaveState('保存領域を利用できません');}
  }).finally(()=>{if(active)setReady(true);});
  return ()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(!dataset)return;
  setResult({id:dataset.id,matches:[]});setSearching(true);
  let worker:Worker;
  try{worker=new Worker(new URL('../workers/search.worker.ts',import.meta.url),{type:'module'});}
  catch{setSearching(false);setError('検索用Workerを起動できませんでした。ブラウザの設定を確認してください。');return;}
  const id=dataset.id;
  worker.onmessage=(e:MessageEvent<{id:string;matches?:Match[];error?:string}>)=>{
   if(e.data.id!==id)return;
   setSearching(false);if(e.data.error)setError(e.data.error);else setResult({id,matches:e.data.matches??[]});
  };
  worker.onerror=()=>{setSearching(false);setError('類似検索に失敗しました。再読み込みしてください。');};
  worker.postMessage({id,candles:dataset.candles});
  return ()=>{worker.onmessage=null;worker.onerror=null;worker.terminate();};
 },[dataset]);
 async function persist(d:Dataset,token:number){
  setSaveState('保存中…');
  try{await saveDataset(d);if(action.current===token)setSaveState('ブラウザ内に保存済み');}
  catch{if(action.current===token){setSaveState('保存失敗 / メモリで利用中');setNotice('保存できませんでした。この画面では利用できますが、再読み込みすると失われます。');}}
 }
 async function importFile(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const token=++action.current;setLoading(true);setError('');
  try{
   if(file.size>MAX_BYTES)throw new Error('CSVは10 MiB以下にしてください。');
   const text=await file.text();if(token!==action.current)return;
   const candles=parseCSV(text,timeframe);
   const d:Dataset={id:crypto.randomUUID(),name:name.trim()||file.name.replace(/\.csv$/i,''),market,timeframe,currency:market==='JP'?'JPY':'USD',source:'csv',candles};
   setDataset(d);setNotice(`${candles.length.toLocaleString()}本のCSVを読み込みました。外部への送信はありません。`);
   await persist(d,token);
  }catch(e){if(token===action.current)setError(e instanceof Error?e.message:'CSVを読み込めませんでした。');}
  finally{if(token===action.current)setLoading(false);}
 }
 function showDemo(){
  const token=++action.current;setLoading(false);setError('');
  const d=generateDemo(market);setTimeframe(d.timeframe);setDataset(d);setNotice('架空データを表示しています。実際の相場・投資成績ではありません。');void persist(d,token);
 }
 async function clear(){
  const token=++action.current;setLoading(false);setError('');setSaveState('削除中…');
  setDataset(generateDemo('JP'));setMarket('JP');setTimeframe('1d');setName('MY-JP');
  try{await clearDataset();if(action.current===token){setSaveState('未保存 / 架空データ');setNotice('保存データを削除しました。架空日本株に戻しました。');}}
  catch{if(action.current===token){setSaveState('削除失敗');setError('保存データを削除できませんでした。ブラウザのサイトデータ設定を確認してください。');}}
 }
 function download(sample=false){
  if(!dataset)return;
  const exportData=sample?generateDemo(market):dataset;
  const url=URL.createObjectURL(new Blob([toCSV(exportData.candles,exportData.timeframe)],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`pattern-lab-${exportData.market}-${exportData.timeframe}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const last=dataset?.candles.at(-1),prev=dataset?.candles.at(-2);
 const change=last&&prev?(last.close/prev.close-1)*100:0;
 const query=dataset?.candles.slice(-20);
 return <main className="workspace">
  <header className="app-header"><a className="brand" href="/" aria-label="PATTERN LAB ホーム"><span className="brand-icon">▥</span><div><h1>PATTERN <b>LAB</b></h1><span>CHART RESEARCH WORKSPACE</span></div></a><div className="header-right"><span className="phase-badge">PHASE 01</span><span className="local-badge"><i/> LOCAL WORKSPACE</span></div></header>
  <section className="intro"><div><p className="eyebrow">OBSERVE. COMPARE. UNDERSTAND.</p><h2>形を見つけ、<span>判断を磨く。</span></h2><p>似ている、その先を考えるためのチャート研究室。</p></div><div className="principle"><span>RESEARCH PRINCIPLE</span><p>取引しない判断も、<br/>正しい行動として扱う。</p></div></section>
  <section className="import-panel" aria-label="データの選択"><div className="panel-label"><span className="step">01</span><div><strong>データを選ぶ</strong><small>CSVはこのブラウザ内だけで処理</small></div></div>
   <div className="controls"><label>市場<select aria-label="市場" value={market} disabled={!ready} onChange={e=>setMarket(e.target.value as Market)}><option value="JP">日本株 / JPY</option><option value="US">米国株 / USD</option></select></label><label>時間足<select aria-label="時間足" value={timeframe} disabled={!ready} onChange={e=>setTimeframe(e.target.value as Timeframe)}><option value="1d">日足</option><option value="1m">1分足</option><option disabled>5分足 · 未実装</option><option disabled>週足 · 未実装</option></select></label><label className="symbol-control">銘柄名<input aria-label="銘柄名" value={name} maxLength={80} disabled={!ready} onChange={e=>setName(e.target.value)} placeholder="例：MY-JP"/></label></div>
   <div className="import-actions"><button className="button secondary" disabled={!ready} onClick={showDemo}>架空データを表示</button><label className={`button primary file-button ${!ready||loading?'disabled':''}`}><span>↥</span> {loading?'読み込み中…':'CSVを読み込む'}<input aria-label="CSVファイル" type="file" accept=".csv,text/csv" disabled={!ready||loading} onChange={importFile}/></label></div>
  </section>
  {error&&<div className="error-message" role="alert" aria-label="CSV読込エラー"><strong>データを確認してください</strong><span>{error}</span></div>}
  <div className="notice" role="status"><span className="notice-dot"/>{notice}</div>
  {!dataset?<div className="loading-panel">ローカルワークスペースを準備しています…</div>:<>
  <div className="research-grid">
   <section className="chart-panel"><div className="chart-top"><div><div className="section-caption">MARKET OVERVIEW <span data-testid="data-source">{dataset.source==='demo'?'DEMO / 架空データ':'CSV / ローカル'}</span></div><h3 data-testid="dataset-name">{dataset.name}</h3><p className="dataset-details">{dataset.market==='JP'?'日本株':'米国株'} <span>·</span> {dataset.currency} <span>·</span> <b data-testid="dataset-timeframe">{timeframeLabel(dataset.timeframe)}</b> <span>·</span> {dataset.candles.length.toLocaleString()}本</p></div><div className="price"><strong>{last?.close.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><span className={change>=0?'positive':'negative'}>{change>=0?'+':''}{change.toFixed(2)}% <small>前の足比</small></span></div></div>
   <div className="chart-toolbar"><div><span className="legend candle-legend">OHLC</span><span className="legend ma5">MA 5</span><span className="legend ma20">MA 20</span><span className="legend volume">出来高</span></div><span className="query-badge">QUERY / 直近20本</span></div>
   <PriceChart candles={dataset.candles} timeframe={dataset.timeframe}/>
   <div className="chart-caption"><span>横スクロール・拡大縮小で過去の足を確認</span><span>{last&&formatTime(last.time,dataset.timeframe)}</span></div>
   <div className="query-summary"><div><span className="step">02</span><div><strong>検索対象の20本</strong><p>{query&&formatTime(query[0].time,dataset.timeframe)} → {last&&formatTime(last.time,dataset.timeframe)}</p></div></div><span className="outline-tag">終値基準で正規化</span></div>
   <div className="method-panel"><p className="eyebrow">HOW WE COMPARE</p><h4>価格の違いをならして、形状を比較。</h4><div className="weight-grid">{[['全体の形状','50%'],['最後の足','25%'],['直近3本','15%'],['値幅・出来高','10%']].map(([label,weight])=><div key={label}><span>{label}</span><strong>{weight}</strong></div>)}</div><p className="muted">重みは暫定値です。同じデータ・条件から、同じ検索結果を返します。</p></div>
   </section>
   <aside className="matches-panel"><div className="matches-title"><div><p className="eyebrow">HISTORICAL MATCHES</p><h3>過去の類似チャート</h3></div><span className="count-badge">TOP 5</span></div><p className="matches-description">同じ銘柄・時間足の過去区間を比較。<br/>スコアは形の近さを示します。</p>
    {searching?<div className="empty-state">過去の20本区間を検索中…</div>:matches.length?matches.map((match,i)=><MatchCard key={match.startIndex} match={match} candles={dataset.candles} timeframe={dataset.timeframe} index={i} name={dataset.name}/>):<div className="empty-state">{dataset.candles.length<20?'分析には20本以上のローソク足が必要です。':'重複しない過去20本の候補がありません。40本以上のデータを読み込んでください。'}</div>}
    <div className="score-note"><span>ⓘ</span><p><strong>類似度 ≠ 上昇確率</strong>将来の値動きを予測するものではありません。結果の区間同士と現在の20本は重複させません。</p></div>
   </aside>
  </div>
  <section className="session-panel"><div><p className="eyebrow">YOUR LOCAL SESSION</p><strong>{saveState}</strong><p>保存先はこのブラウザのIndexedDB。別のPCへはCSVで持ち運べます。</p></div><div className="session-actions"><button className="button secondary" onClick={()=>download()}>CSVを書き出す</button><button className="button secondary" onClick={()=>download(true)}>サンプルCSV</button><button className="text-button" onClick={()=>void clear()}>保存データを削除</button></div></section>
  <section className="roadmap"><p className="eyebrow">BUILDING THE RESEARCH FLOW</p><div><span className="current">01 チャート・類似検索</span><span>02 パターン・統計検証 <small>未実装</small></span><span>03 PAPER売買 <small>未実装</small></span><span>04 A〜D評価 <small>未実装</small></span></div></section>
  </>}
  <footer><span>PATTERN LAB <small>個人の投資研究・練習用 / 利益を保証しません</small></span><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Charts powered by TradingView Lightweight Charts™ ↗</a></footer>
 </main>;
}
