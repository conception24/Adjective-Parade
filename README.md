# Adjective Parade（形容詞パレード）

英語の形容詞の順番を、神経衰弱を通して学ぶゲームです。現在のカード画像は猫をテーマにしています。テーマやルール説明は今後変更する可能性があります。

## 遊び方

20枚のカードから2枚をめくります。2枚に同じ形容詞が1つでもあればペア成立です。10ペアを取るとクリアになります。カードの英文には、opinion（印象）→ size（大きさ）→ age（年齢）→ shape（形）→ color（色）→ origin（出身）の順序を使っています。

一人用モードはPCのブラウザ1画面で遊べます。二人用モードは現在トップページから選択できません。

## 開発

Node.js 22.13以上が必要です。

```sh
npm ci
npm run dev
```

ブラウザで表示されたローカルURLを開いてください。公開用のビルドは `npm run build` です。ホスト環境では `.openai/hosting.json` の設定を使います。

## Cloudflare Workersで公開する場合

Cloudflare Pagesの静的ファイル公開では、このアプリのサーバー用ビルドは動きません。Cloudflare Workersのプロジェクトとして公開してください。

```sh
npm ci
npm run build:cloudflare
npx wrangler deploy
```

GitHub連携のWorkers Buildsを使う場合は、リポジトリをこのプロジェクトに接続し、ビルドコマンドを `npm run build:cloudflare`、デプロイコマンドを `npx wrangler deploy`、ルートディレクトリをリポジトリの最上位に設定します。`wrangler.jsonc` がWorkerの設定です。デプロイ後は発行された `workers.dev` のURLでトップページと一人用モードを確認してください。

現在トップページで停止中の二人用モードにはD1データベースが必要です。応募用の一人用モードはブラウザ内で動作するためD1を使いません。二人用モードを再公開する際には、別途 `DB` というD1バインディングの設定と `drizzle/` のマイグレーション適用が必要です。

## 素材

`public/cards/` の猫画像はこのゲーム用に生成したものです。画像の利用や再配布条件は、別途ライセンス表示が確定するまで確認してください。
