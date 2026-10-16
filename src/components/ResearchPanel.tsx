import type {Research} from '@/lib/research';
const pct=(n:number|null)=>n===null?'—':`${n>=0?'+':''}${n.toFixed(2)}%`;
export default function ResearchPanel({data}:{data:Research}){
 return <section className="research-stats" aria-label="期間別研究結果"><p className="eyebrow">RESEARCH / COST ADJUSTED</p><h4>期間を分けて、結果を比べる</h4><p className="research-warning">現在の20本を固定した期間別の検索評価です。戦略のウォークフォワード検証ではありません。標本30件未満は根拠不足と表示します。</p>
 <div className="selected-summary" data-testid="selected-summary"><strong>上位5件の記述集計</strong><span>{data.summary.count}件 · 平均純損益 {pct(data.summary.mean)} · 損失 {data.summary.losses}件</span><small>選択バイアスがあるため、この集計から上昇確率や投資成績を推定しません。</small></div>
 <div className="stats-table"><table><thead><tr><th>期間</th><th>事例数</th><th>平均損益</th><th>損失件数</th><th>全時点の基準</th><th>評価</th></tr></thead><tbody>{data.periods.map(p=><tr key={p.label}><td>{p.label}</td><td>{p.count}</td><td className={(p.mean??0)>=0?'positive':'negative'}>{pct(p.mean)}</td><td>{p.losses}</td><td>{pct(p.baseline.mean)} <small>n={p.baseline.count}</small></td><td>{p.status}</td></tr>)}</tbody></table></div>
 <p className="research-warning">固定条件：スコア80以上・20本後決済・現物買い想定・往復{data.costBps*2}bps控除。各期間内の40本区間を時系列に間引いて比較します。基準は全候補時点の平均（ランダム時点を選ぶ場合の期待値）です。</p>
 {data.periods.map(p=>p.interval&&<p key={p.label} className="research-warning">{p.label} 平均の95%近似区間：{pct(p.interval[0])} ～ {pct(p.interval[1])}。独立・正規近似の仮定が必要です。</p>)}
 <p className="research-warning">選択した銘柄だけの検証です。生存者バイアスは除去できません。上位5件は選択された事例であり、利益や上昇確率の根拠にはできません。</p></section>;
}
