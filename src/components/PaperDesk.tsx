'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Dataset,Candle} from '@/lib/types';
import {formatTime} from '@/lib/types';
import type {Research} from '@/lib/research';
import type {Pattern} from '@/lib/patterns';
import {advance,cancelOrder,createAccount,metrics,recordSkip,riskGuard,submitOrder,type PaperAccount,type Ticket} from '@/lib/paper';
import {readPaper,resetPaper,updatePaper} from '@/lib/paper-storage';
const money=(n:number,currency:string)=>new Intl.NumberFormat('ja-JP',{style:'currency',currency,maximumFractionDigits:2}).format(n/100);
export default function PaperDesk({dataset,candles,cursor,analysis,pattern,reason,onRestore}:{dataset:Dataset;candles:Candle[];cursor:number;analysis:Research|null;pattern:Pattern;reason:string;onRestore:(count:number)=>void}){
 const [account,setAccount]=useState<PaperAccount|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('PAPER / 仮想取引のみ'),[locked,setLocked]=useState(false);
 const [syncFailed,setSyncFailed]=useState(false),[retryNonce,setRetryNonce]=useState(0);
 const retries=useRef(0);
 const current=useRef({dataset,cursor,candles,onRestore});current.current={dataset,cursor,candles,onRestore};
 const mounted=useRef(true),inFlight=useRef(false),dirty=useRef(false),ticketId=useRef('');
 const lot=dataset.market==='JP'?100:1,quote=candles.at(-1)?.close??0;
 const [form,setForm]=useState({side:'BUY' as Ticket['side'],type:'MARKET' as Ticket['type'],qty:lot,lot,price:quote,stop:Number((quote*.98).toFixed(2)),target:Number((quote*1.04).toFixed(2)),feeBps:5,slippageBps:5,maxLoss:dataset.currency==='JPY'?10000:100,dailyLimit:dataset.currency==='JPY'?30000:300,strict:false});
 const [resetRequested,setResetRequested]=useState(false);
 const stamp=useRef('');
 useEffect(()=>{mounted.current=true;ticketId.current=crypto.randomUUID();readPaper(dataset.id).then(saved=>{
  if(!mounted.current)return;setAccount(saved??createAccount(dataset.id,dataset.currency,current.current.cursor-1));
  if(saved)current.current.onRestore(Math.min(saved.lastIndex+1,dataset.candles.length));
 }).catch(e=>{if(mounted.current){setError(e.message);setSyncFailed(true);setAccount(createAccount(dataset.id,dataset.currency,current.current.cursor-1));}}).finally(()=>{if(mounted.current)setReady(true);});return()=>{mounted.current=false;};},[dataset.id,dataset.currency,dataset.candles.length]);
 useEffect(()=>{if(!dirty.current)setForm(f=>({...f,price:quote,stop:Number((quote*.98).toFixed(2)),target:Number((quote*1.04).toFixed(2))}));},[quote]);
 const past=!!account&&cursor-1<account.lastIndex&&(account.orders.length>0||account.journal.length>0||account.qty>0);
 async function execute(reduce:(a:PaperAccount)=>PaperAccount){
  if(inFlight.current||!ready)return;inFlight.current=true;setBusy(true);setError('');
  try{const next=await updatePaper(dataset.id,()=>createAccount(dataset.id,dataset.currency,cursor-1),a=>{
   let base=a;
   if(base.lastIndex>cursor-1){
    if(!base.orders.length&&!base.journal.length&&!base.qty)base=createAccount(dataset.id,dataset.currency,cursor-1);
    else throw new Error('別タブで口座が進みました。再読み込みして再開してください');
   }
   if(base.lastIndex<cursor-1)base=advance(base,candles,cursor-1,cursor===dataset.candles.length);
   return reduce(base);
  });if(mounted.current){setAccount(next);setSyncFailed(false);retries.current=0;}return next;}
  catch(e){if(mounted.current){setError(e instanceof Error?e.message:'口座を保存できませんでした');setSyncFailed(true);}}
  finally{inFlight.current=false;if(mounted.current)setBusy(false);}
 }
 useEffect(()=>{
  if(!ready||!account||busy||past)return;
  const key=`${dataset.id}:${cursor}:${account.revision}`;
  if(stamp.current===key)return;stamp.current=key;
  if(cursor-1!==account.lastIndex){
   if(!account.orders.length&&!account.journal.length&&!account.qty){setAccount(createAccount(dataset.id,dataset.currency,cursor-1));return;}
   if(cursor-1>account.lastIndex)void execute(a=>advance(a,candles,cursor-1,cursor===dataset.candles.length));
  }
 },[cursor,account,ready,busy,past,dataset.id,dataset.currency,dataset.candles.length,candles,retryNonce]);
 useEffect(()=>{
  if(!syncFailed||!account||account.lastIndex>=cursor-1||retries.current>=1||busy)return;
  const timer=setTimeout(()=>{retries.current++;stamp.current='';setRetryNonce(v=>v+1);},750);
  return()=>clearTimeout(timer);
 },[syncFailed,account,cursor,busy]);
 const synchronized=!!account&&account.lastIndex===cursor-1;
 async function resync(){try{const saved=await readPaper(dataset.id);setAccount(saved??createAccount(dataset.id,dataset.currency,cursor-1));setSyncFailed(false);setError('');stamp.current='';retries.current=0;setRetryNonce(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'口座を復元できませんでした');}}
 const context={technical:`${pattern.name} / ${pattern.status}`,statistics:analysis?.periods[2].status??'未検証',event:'未確認',dataset:dataset.name,timeframe:dataset.timeframe};
 const ticket:Ticket={...form,context,id:ticketId.current||'draft',reason,strategyReady:pattern.status==='成立確認'&&['ダブルボトム','逆ヘッドアンドショルダー','三角持ち合い'].includes(pattern.name),evidenceReady:!!analysis&&analysis.periods[2].count>=30&&(analysis.periods[2].mean??0)>0};
 const guard=useMemo(()=>account?riskGuard(account,ticket,candles):null,[account,form,reason,analysis,pattern,candles]);
 const m=account?metrics(account,quote):null;
 function edit<K extends keyof typeof form>(key:K,value:(typeof form)[K]){dirty.current=true;setLocked(false);ticketId.current=crypto.randomUUID();setForm(f=>({...f,[key]:value}));}
 async function place(){
  if(!account||past||cursor>=dataset.candles.length||locked)return;
  const next=await execute(a=>submitOrder(a,ticket,candles));if(next){setLocked(true);setMessage(next.orders.at(-1)?.message??'注文を記録しました');}
 }
 async function reset(){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);
  try{const next=await resetPaper(createAccount(dataset.id,dataset.currency,cursor-1));if(mounted.current){setAccount(next);setLocked(false);setSyncFailed(false);retries.current=0;setError('');setResetRequested(false);setMessage('仮想口座をリセットしました');}}
  catch(e){setError(e instanceof Error?e.message:'リセット失敗');}finally{inFlight.current=false;setBusy(false);}
 }
 const canOrder=ready&&!busy&&!past&&!syncFailed&&synchronized&&cursor<dataset.candles.length&&!locked&&!!guard?.ok;
 const accountView=account&&m&&!past&&!syncFailed&&synchronized;
 const assessment=[['A','テクニカル',pattern.status==='成立確認'?'成立確認':pattern.status==='形成中'?'形成中':'方向不明',pattern.name],['B','統計',analysis?.periods[2].status??'未検証','固定クエリの記述評価'],['C','イベント','未確認','企業イベントデータ未接続'],['D','リスク管理',past?'時点制限':syncFailed||!synchronized?'同期待ち':guard?.ok?'条件内':'注文禁止',past?'過去の口座情報は非表示':guard?.errors[0]??'注文内容を検査']];
 return <>
 <section className="trade-check" id="trade-check"><h3><span>取引判断</span><small>TRADE CHECK · 多数決で注文しません</small></h3><div>{assessment.map(([key,label,status,detail])=><div className={`assessment assessment-${key}`} key={key}><b>{key}</b><strong>{label}</strong><span>{detail}</span><em>{status}</em></div>)}</div></section>
 <section className="risk-guard" id="risk-guard"><h3>RISK GUARD <small>無理なトレードを防ぐ / PAPER</small></h3>
  {past?<div className="paper-past" data-testid="paper-past"><strong>この時点の口座情報は非表示</strong><p>口座は{account!.lastIndex+1}本時点まで進んでいます。未来の残高・履歴を隠しています。</p><button className="button secondary" onClick={()=>onRestore(account!.lastIndex+1)}>口座の時点へ戻る</button></div>:<>
  <div className="ticket-mode"><button className={`button ${form.side==='BUY'?'primary':'secondary'}`} onClick={()=>edit('side','BUY')}>買付</button><button className={`button ${form.side==='SELL'?'sell-selected':'secondary'}`} onClick={()=>edit('side','SELL')}>売却</button><label><input type="checkbox" checked={form.strict} onChange={e=>edit('strict',e.target.checked)}/> 厳格練習</label></div>
  <div className="ticket-grid"><label>注文種別<select aria-label="注文種別" value={form.type} onChange={e=>edit('type',e.target.value as Ticket['type'])}><option value="MARKET">成行</option><option value="LIMIT">指値</option><option value="STOP">逆指値</option></select></label><label>数量（株）<input aria-label="注文数量" type="number" min="1" value={form.qty} onChange={e=>edit('qty',Number(e.target.value))}/></label><label>注文価格<input aria-label="注文価格" type="number" min="0.01" step="0.01" disabled={form.type==='MARKET'} value={form.type==='MARKET'?quote:form.price} onChange={e=>edit('price',Number(e.target.value))}/></label><label>ストップロス（計画）<input aria-label="損切り価格" type="number" min="0.01" step="0.01" value={form.stop} onChange={e=>edit('stop',Number(e.target.value))}/></label><label>目標価格（計画）<input aria-label="目標価格" type="number" step="0.01" value={form.target} onChange={e=>edit('target',Number(e.target.value))}/></label><label>売買単位<input aria-label="売買単位" type="number" min="1" value={form.lot} onChange={e=>edit('lot',Number(e.target.value))}/></label></div>
  <div className="guard-metrics"><div><small>想定損失 / {dataset.currency}</small><strong>{money(guard?.loss??0,dataset.currency)}</strong></div><div><small>計画リスクリワード</small><strong>{quote>form.stop&&form.target>quote?`1 : ${((form.target-quote)/(quote-form.stop)).toFixed(1)}`:'—'}</strong></div><div className={`guard-result ${guard?.ok?'clear':'blocked'}`}><small>注文検査</small><strong>{guard?.ok?'条件内':'注文禁止'}</strong></div></div>
  <ul className="guard-reasons">{guard?.errors.map(e=><li key={e}>{e}</li>)}</ul>
  {cursor>=dataset.candles.length&&<p className="paper-hint">次の足がありません。「先頭」へ戻ってから練習してください。 <button className="text-button" onClick={()=>onRestore(Math.min(20,dataset.candles.length))}>リプレイ先頭へ</button></p>}
  <div className="order-actions"><button className={`button ${form.side==='BUY'?'primary':'sell-selected'}`} disabled={!canOrder} onClick={()=>void place()}>{locked?'受付済み / 入力変更で次の注文':form.side==='BUY'?'仮想買付を注文':'仮想売却を注文'}</button>{form.side==='SELL'&&<button className="button secondary" disabled={!m?.availableQty} onClick={()=>{edit('qty',m!.availableQty);edit('lot',1);}}>全株数を入力</button>}<button className="button secondary" disabled={!ready||busy||syncFailed||!synchronized} onClick={()=>void execute(a=>recordSkip(a,candles.at(-1)?.time??0,reason,context)).then(a=>{if(a)setMessage('見送りを記録しました');})}>見送りを記録</button></div>
  <p className="paper-hint">計画の損切り・目標価格では自動売却しません。必要なら別途「売却・逆指値」を注文してください。イベント未確認／約定精度に限界があります。</p>
  <details className="paper-settings"><summary>取引コスト・損失上限の設定</summary><div className="ticket-grid">{([['feeBps','手数料bps'],['slippageBps','スリッページbps'],['maxLoss','1取引損失上限'],['dailyLimit','日次損失上限']] as const).map(([key,label])=><label key={key}>{label}<input aria-label={label} type="number" min="0" value={form[key]} onChange={e=>edit(key,Number(e.target.value))}/></label>)}</div></details>
  </>}
  <p className="paper-message" role="status" aria-label="仮想口座状態">{busy?'仮想口座を保存中…':message}</p>{error&&<p className="error-message" role="alert" aria-label="仮想口座エラー">{error}（リセットで復旧できます） <button className="text-button" disabled={busy} onClick={()=>void resync()}>口座を再同期</button></p>}
  <div className="reset-line">{resetRequested?<><span>口座と取引履歴を削除します。</span><button className="text-button" disabled={busy} onClick={()=>void reset()}>リセットを確定</button><button className="text-button" onClick={()=>setResetRequested(false)}>戻る</button></>:<button className="text-button" onClick={()=>setResetRequested(true)}>仮想口座をリセット</button>}</div>
 </section>
 <section className="paper-ledger" id="journal"><h3>仮想口座 <small>PAPER ACCOUNT · {dataset.currency} / {dataset.name}</small></h3>
 {accountView?<>
  <div className="account-grid" data-testid="paper-account"><div><small>現金残高</small><strong data-testid="paper-cash">{money(account.cash,dataset.currency)}</strong></div><div><small>買付余力</small><strong>{money(m.availableCash,dataset.currency)}</strong></div><div><small>注文拘束資金</small><strong>{money(m.reservedCash,dataset.currency)}</strong></div><div><small>保有 / 売却可能（株）</small><strong data-testid="paper-quantity">{account.qty} / {m.availableQty}</strong></div><div><small>平均取得単価</small><strong>{money(m.average,dataset.currency)}</strong></div><div><small>実現損益</small><strong className={account.realized>=0?'positive':'negative'} data-testid="paper-realized">{money(account.realized,dataset.currency)}</strong></div><div><small>評価損益</small><strong className={m.unrealized>=0?'positive':'negative'}>{money(m.unrealized,dataset.currency)}</strong></div><div><small>総資産</small><strong>{money(m.equity,dataset.currency)}</strong></div><div><small>日次損益（UTC）</small><strong>{money(m.dailyPnl,dataset.currency)}</strong></div><div><small>最大ドローダウン</small><strong>{(account.maxDrawdown*100).toFixed(2)}%</strong></div><div><small>累計取引コスト</small><strong>{money(account.costs,dataset.currency)}</strong></div></div>
  <details open className="ledger-details"><summary>注文履歴 <span>{account.orders.length}件</span></summary><div className="stats-table"><table><thead><tr><th>注文</th><th>種別</th><th>数量 / 約定</th><th>状態</th><th>約定平均</th><th>操作</th></tr></thead><tbody>{account.orders.slice().reverse().map(o=><tr key={o.id}><td>{o.side==='BUY'?'買付':'売却'}</td><td>{o.type}</td><td>{o.qty} / {o.filled}</td><td title={o.message}>{o.status}</td><td>{o.filled?money(o.filledNotional/o.filled,dataset.currency):'—'}</td><td>{['OPEN','PARTIALLY_FILLED'].includes(o.status)&&<button className="text-button" disabled={busy} onClick={()=>void execute(a=>cancelOrder(a,o.id))}>取消</button>}</td></tr>)}</tbody></table>{!account.orders.length&&<p className="paper-hint">注文はまだありません。</p>}</div></details>
  <details open className="ledger-details"><summary>トレードジャーナル <span>{account.journal.length}件</span></summary><div className="stats-table"><table><thead><tr><th>日時</th><th>判断・操作</th><th>株数</th><th>価格</th><th>実現損益</th><th>理由 / ガード</th></tr></thead><tbody>{account.journal.slice().reverse().map(j=><tr key={j.id}><td>{j.time?formatTime(j.time,dataset.timeframe):'—'}</td><td>{j.action}</td><td>{j.qty||'—'}</td><td>{j.price?money(j.price,dataset.currency):'—'}</td><td>{money(j.pnl,dataset.currency)}</td><td className="journal-reason">{j.reason} / {j.guard}{j.context&&<small className="journal-context">A: {j.context.technical} · B: {j.context.statistics} · C: {j.context.event} · {j.context.timeframe}</small>}</td></tr>)}</tbody></table>{!account.journal.length&&<p className="paper-hint">買付・売却・見送りを理由とともに記録します。</p>}</div></details>
 </>:<p className="paper-hint">{past?'過去のリプレイ中は未来の残高と履歴を隠します。':'仮想口座を読み込んでいます…'}</p>}
 </section>
 </>;
}
