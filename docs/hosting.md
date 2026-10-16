# 閲覧用URL

https://pattern-lab.minikun130.chatgpt.site

2026-10-16、Sitesでowner-privateの公開成功を確認。利用時は同じChatGPTアカウントでログインする。

公開元コミット：0b2340af7886917436e014675551b73d03e34aac
サイトIDは .openai/hosting.json に保存。秘密の認証トークンはソースに保存しない。

通常のローカルビルドと起動は従来どおり。配信用の静的出力は PATTERN_LAB_STATIC_EXPORT=1 を付けた npm run build で out/ に生成する。ローカルビルドと同じUI・分析ロジックを使用する。

公開先はSites、コードの持ち運び先はGitHub。ホストしたサイトでも、CSV・保存データはブラウザごとに独立している。
