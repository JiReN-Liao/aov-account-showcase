# J1ReNの小舖

《傳說對決》帳號展示型個人賣場。網站只提供商品展示與外部聯絡，不包含付款、購物車、會員、站內聊天、OCR 或自動估價。

## 正式網址

- 商品牆：`https://aov-shop.pages.dev/`
- 管理後台：`https://aov-shop.pages.dev/#/admin`
- GitHub：`https://github.com/JiReN-Liao/aov-account-showcase`

## 架構

- 前端：React + Vite + Tailwind CSS
- 部署：Cloudflare Pages + Pages Functions
- 商品、設定、管理員與操作紀錄：Cloudflare D1
- 商品圖片：Cloudflare Workers KV
- 管理員密碼：PBKDF2-SHA256 加鹽雜湊
- D1 是唯一商品資料來源，不使用匯出/匯入同步

目前規模可使用 Cloudflare 免費額度，不需要啟用 R2 或綁定付款方式。圖片使用不可變 key，商品更新使用 `version` 防止不同裝置互相覆蓋。

## 本機安裝與啟動

```bash
npm install
npm run dev
```

正式打包與檢查：

```bash
npm test
npm run lint
npm run build
```

## 後台操作

1. 開啟 `https://aov-shop.pages.dev/#/admin` 並登入。
2. 點「批量上傳圖片」，可一次選取多張圖片。
3. 每張圖片會建立一筆 `draft` 商品並自動產生 `AOV-001` 類編號。
4. 在表格修改價格、狀態、備註與排序。
5. 改成「出售中」或使用「一鍵上架」後，商品才會出現在商品牆。
6. 設定頁可維護三個聯絡網址與新增其他管理員。

所有操作會直接寫入雲端；手機、電腦與買家看到同一份資料，不需要匯出或匯入。

## Codex 管理商品

Codex 可透過 `scripts/aov-admin.mjs` 呼叫同一套管理 API：

```bash
npm run admin -- list
npm run admin -- upload --file ./account.png --key image-aov-001
npm run admin -- create --code AOV-001 --status draft --image-key image-aov-001
npm run admin -- status --id PRODUCT_ID --status available
npm run admin -- patch --id PRODUCT_ID --price 2500
npm run admin -- delete --id PRODUCT_ID --delete-image image-aov-001
```

CLI 從環境變數讀取連線資訊，不把密碼或 token 寫入 Git：

```text
AOV_API_URL=https://aov-shop.pages.dev
AOV_ADMIN_TOKEN=<登入取得的短期 token>
```

所有修改會寫入 `audit_logs`，可追查是誰進行建立、修改、上架或刪除。

## 主要檔案

```text
src/App.jsx                         前台、商品詳情、後台與設定頁
src/storage.js                     前端 API client
functions/api/catalog.js           公開商品 API
functions/api/admin/               管理員登入與商品管理 API
functions/api/images/[key].js      KV 圖片讀寫 API
functions/_lib/                    驗證、商品映射、HTTP 與稽核共用程式
migrations/0001_initial.sql        D1 schema
scripts/aov-admin.mjs              Codex/命令列管理工具
wrangler.toml                      Cloudflare D1、KV 與 Pages 設定
```

## 部署

首次建立 Cloudflare 資源：

```bash
npx wrangler d1 create aov-shop
npx wrangler kv namespace create AOV_STORE
npx wrangler d1 migrations apply aov-shop --remote
```

更新正式站：

```bash
npm run build
npx wrangler pages deploy dist --project-name aov-shop --branch main --commit-dirty=true
```

目前正式 D1 與 KV binding 已寫入 `wrangler.toml`。更多部署細節見 `docs/cloudflare-d1.md`。

## 日後擴充

商品與圖片 API 已集中封裝。若之後啟用 R2，只需替換 `functions/api/images/[key].js` 與 `wrangler.toml` 的圖片 binding；前台與商品 D1 schema 不需重做。若改用 Supabase，主要替換 `src/storage.js` 與 `functions/api/`，UI 可繼續沿用。
