# Phase 1 検証記録

2026-10-16 / managed Linux cloud / Node.js 24.19.0

| チェック | 結果 |
|---|---|
| `npm test` | 22件成功（CSV、日付、正規化、重複排除、再現性、巨大な有限値、移動平均） |
| `npm run typecheck` | 成功 |
| `npm run build` | 成功（Next.js 16.4.2 / Webpack） |
| `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` | 4件成功 |
| 画面確認 | デスクトップ1440px、モバイル390px横溢れなし |
| 独立コードレビュー | 重大2件を修正、軽微1件をSTATUSに記録 |

E2E対象：CSVサンプル出力・読込、ローソク足canvas、上位5件、異常CSVによる既存データ保持、IndexedDB復元と削除、US1分足、短いCSVのデータ不足表示、保存領域利用不可でも利用継続、現在データのCSV出力。

初回の失敗と対応：
- 実装前にCSVモジュール欠落・画面未実装によるテスト失敗を確認。
- ISO分足CSVのミリ秒000対応、データ切替時の古い検索結果表示、極端な数値の演算を失敗テストから修正。
- クラウドの内部プロセス制約でTurbopackが失敗。Next.jsの正式なWebpack方式へ変更してビルドを確認。
- Playwrightブラウザ配布先がネットワーク制限対象。環境にあるChromiumを指定して4件実行。ブラウザ未実行として省略していない。
- Windows実機では未実行。READMEの標準Node.js/npm手順を利用する。

実株、実市場データの正確性、利益、統計的妥当性、Phase 2以降は検証対象外。Phase 1の実装済み範囲と区別する。
