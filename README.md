# AOV帳號展示所 MVP

傳說對決帳號展示型個人賣場 MVP。這是純前端靜態網站，不提供付款、購物車、會員、站內聊天、OCR、自動估價，也不保管帳號資料。

## 技術架構

- React + Vite
- Tailwind CSS
- 商品文字資料：`localStorage`
- 商品圖片：`IndexedDB`
- 路由：Hash route，方便部署到免費靜態網站空間
- 第一版不接後端、不接 Supabase

## 安裝

```bash
npm install
```

## 啟動開發環境

```bash
npm run dev
```

打開 Vite 顯示的網址，通常是 `http://localhost:5173/`。

## 管理員入口

客人預設只會看到商品牆，不會看到後台或設定入口。

管理員請直接開：

```text
#/admin
```

第一次進入會要求建立管理員帳號與密碼。登入後才會看到「後台」「設定」「登出」。

注意：這是純前端本機 MVP 的簡單保護，帳密存在瀏覽器 localStorage。正式公開管理後台建議改用 Supabase Auth 或後端登入。

## 打包部署

```bash
npm run build
```

打包結果在 `dist/`。可以部署到 Cloudflare Pages、GitHub Pages、Netlify 或 Vercel 免費層。

建議 0 成本部署方式：

- Cloudflare Pages：連 GitHub repo，Build command 填 `npm run build`，Output directory 填 `dist`
- GitHub Pages：上傳 `dist/` 或用 GitHub Actions 發布
- Netlify / Vercel：同樣使用 `npm run build` 與 `dist`

注意：目前資料存在每個瀏覽器本機。換電腦、換瀏覽器、清除瀏覽資料後，商品資料不會自動同步。

更重要的是：純本機 MVP 部署成公開網站後，訪客不會看到你在自己瀏覽器後台上傳的商品，因為那些資料沒有伺服器同步。這一版適合先驗證操作流程與版型。若要讓所有買家都看到同一份商品資料，需要接 Supabase、其他後端，或改成靜態商品資料發布流程。

## 主要檔案結構

```text
src/
  App.jsx       前台商品牆、詳情頁、管理後台、設定頁
  storage.js   localStorage 與 IndexedDB 資料存取
  index.css    Tailwind 與全域樣式
tailwind.config.js
index.html
```

## 修改聯絡購買網址

管理員登入後進入「設定」頁，填入三個聯絡方式，例如 LINE、Facebook、Instagram。

買家點擊「聯絡購買」後，會先看到三個聯絡選項，再選擇想用的平台聯絡。

聯絡按鈕會自動在網址加上 `text=你好，我想詢問商品 AOV-001` 這類商品編號文字。部分平台若不支援 `text` 參數，仍會正常跳轉到原網址。

設定頁也可以修改管理員帳號。密碼欄位留空代表不變更密碼。

## 批量上傳圖片

1. 進入「後台」
2. 點擊「批量上傳圖片」
3. 一次選多張圖片
4. 系統會把每張圖片存入 IndexedDB
5. 每張圖片會自動建立一筆商品
6. 商品編號會自動生成，例如 `AOV-001`
7. 新商品預設狀態是 `草稿`

草稿商品不會顯示在前台。

## 修改商品價格與狀態

進入「後台」表格，可以直接編輯：

- 標題
- 價格
- 狀態
- 備註
- 排序
- 匯出備份 / 匯入備份

將狀態改成「出售中」「洽談中」或「已售出」後，前台才會顯示。狀態為「草稿」或「隱藏」不會顯示在前台。

後台也有「一鍵上架」按鈕，可以把所有草稿商品一次改成「出售中」。已售出、洽談中、隱藏的商品不會被變更。

## 備份與還原

後台提供「匯出備份」與「匯入備份」：

- 匯出備份會產生 JSON 檔，包含商品文字資料、設定與圖片 base64
- 匯入備份會覆蓋目前瀏覽器內的商品、設定與圖片
- 建議每次大量更新商品後都匯出一份備份，避免瀏覽器清除資料或換電腦時遺失

## 後續接 Supabase 時需要改哪裡

主要改 `src/storage.js`：

- `loadProducts` / `saveProducts` 改成讀寫 Supabase products table
- `putImage` / `getImage` / `deleteImage` / `clearImages` 改成 Supabase Storage
- 商品 `imageKey` 可改成 storage path 或 public URL
- 設定資料可改成 settings table

`src/App.jsx` 的 UI 可以大多保留，只需要把同步方式從即時 localStorage 改成 async API 呼叫，並加上 loading/error 狀態。

## 維護注意

- 這版適合個人展示與本機管理，部署成本低，也不需要伺服器維護。
- 若商品要跨裝置同步、多人管理、公開後台登入、備份資料，就應該進入 Supabase 或其他後端版本。
- 不要把帳號密碼、OTP、付款資訊或完整個資放進商品備註。
