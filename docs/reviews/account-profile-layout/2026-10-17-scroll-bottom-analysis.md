# Account 頁尾留白與手機滑不到底：補充分析

日期：2026-10-17（Asia/Taipei）。追加到既有layout計劃；只分析／更新文件，未修改產品程式。這次由主代理做source＋synthetic browser probe，沒有新增顧問席次；使用者截圖未送往外部顧問。

## 觀察與結論

使用者提供桌面Account個人化截圖，說明已滑到底：最後一張card幾乎貼住畫面下緣；另反映手機經常感覺無法滑到底。兩者要分開記錄，不先假定是同一個實機bug。

使用者後續明確補充：手機在「個人化」頁(`/profile`)就會出現滑不到底。因此首要重現案例是一般設定頁本身，不是小家表格；不以開關overlay或鍵盤作為必要前置。是否曾先操作overlay/鍵盤仍未確認，不能把這項回報寫成已排除相關因素或已完成實機重現。

**已重現的問題：不是缺少padding宣告，而是主內容在受限grid row內溢出，底部padding沒有形成內容之後可捲到的留白。**

以account-fe `b66d6bcd401380ce3e141ed74c26c5815fbad111` 的完整`src/index.css`，在Chromium載入相同shell/layout/content/main/document DOM結構，使用假header/notice/固定680px設定card，量測內層`scrollTop=scrollHeight`後的幾何。沒有登入、讀取真實會員資料或啟動Account/API服務。

| Probe | content clientHeight／scrollHeight | main計算padding-bottom | card到scrollport底緣 |
| --- | --- | --- | --- |
| 原CSS，1440×820 | 696／800px | 72px | **0px** |
| 只將main設align-self:start | 696／872px | 72px | **72px** |
| 原CSS，390×780 mobile layout | 656／800px | 72px | **0px** |

桌面原CSS：main border box到底716px，card內容卻延伸到820px；padding仍在被壓縮的main box內，不在最後card之後。單變數probe使main intrinsic高度872px進入ancestor的scrollable overflow，scrollHeight恰增加72px，原本宣告的留白才出現。

這是同source CSS的結構性重現，不是完整React/shared Card渲染或當時production artifact驗證；足以說明截圖症狀的可行機制，不能據此宣稱已確認所有生產裝置的根因。`align-self:start`只用於定位原因，不是已選定產品patch；直接全域套用可能破壞小家高度受限的表格。

## 對應來源

| Source | 作用 |
| --- | --- |
| `src/index.css:166–169,217–245` | body/app/layout以100vh為高度下限；sidebar固定viewport高度。 |
| `src/index.css:457–465` | main實際已有`padding:32px 0 72px`。 |
| `src/index.css:1626–1633` | app固定100dvh/overflow:hidden；layout裁切；content overflow:auto；main在`minmax(0,1fr)`第二row。 |
| `src/index.css:41–50` | 小家另有main overflow:auto、flex表格與280px最小高度；不能用一般profile的單一對齊修正覆蓋。 |
| `src/index.css:754–770` | 最後settings-row padding-bottom=0屬card內列規則，不能用它解釋card外留白消失。 |
| `src/App.tsx:303–329` | content→main→頁面結構；header/statement位於外部topbar，不在content捲動區。 |

## 手機「滑不到底」的另一個風險

同一`.app-shell`既有`min-height:100vh`又有較晚宣告的`height:100dvh`，後者不會移除前者；當前者的解析高度較大，min-height會勝出。outer body/layout與inner content又有不同scroll/clipping邊界，可能出現「inner已到底，但其底緣仍在visual viewport以外」的二階段捲動。

受控模型（**不是iOS實機重現**）：viewport390×660，將app min-height明確設780px模擬兩種viewport解析高度不同；app及content底緣均為780px，inner content已達scrollTop144px極限，document也變成780px可捲內容。只將該min-height歸零，兩者底緣即回660px。這證明CSS約束本身能產生雙層scroll範圍，尚未證明使用者手機當時真的出現vh/dvh差值。

手機症狀仍需補證據：

- 先以手機直接進入`/profile`，不先操作dialog/menu/鍵盤，從頁首滑到最後會員資料row；記錄真正scroll target、最大scrollTop、最後card與可視底緣位置。若仍發生，優先檢查一般頁面grid/viewport/scroll範圍，不歸因於小家table或假定scroll lock殘留。
- URL列展開／收合、橫直向、軟鍵盤關閉後，記錄layout/visual viewport與各scroll容器的clientHeight、scrollHeight、scrollTop、overflow；不記帳號或表單值。
- 分別測一般頁面滑動，以及開關暱稱／頭像／語言／avatar等overlay後滑動，區分viewport問題與未釋放的scroll lock。現在沒有證據能宣稱是React Aria cleanup bug。
- Profile目前主要由account-content捲動；小家另有main/table捲動。不可把「多層捲動」籠統當作每個頁面的同一結構。
- Chromium的mobile metrics只驗layout，不代表iOS Safari的瀏覽器工具列、touch scroll或鍵盤已驗收。

## 對既有計劃的必要修正

1. **一般設定頁的main按內容intrinsic高度排版**，讓末端留白確實在最後card後、並計入實際scroll range；不靠加更大的padding、dummy空白div或只設scroll-padding掩蓋。
2. **內容留白、footer間隔、fixed nav遮擋預留分開處理。** 新版建議內容末端到footer至少desktop32px/mobile24px；這是可見距離，不是只驗computed CSS。若沿用既有72px，也須證明實際可見；不要把72px、footer間距、safe-area反覆累加成大空洞。
3. **手機文件捲動方案必須清掉完整高度約束。** 不只改overflow：同步檢查body/app/layout/content/main的height、min-height、grid row與舊overflow override，避免100vh下限仍壓過dynamic viewport。保留table局部橫捲，取消手機table的viewport高度上限／垂直第二捲動區。
4. **桌面小家保留可用高度內的table捲動**；一般profile的intrinsic修正不可全域壓壞1440×620＋50rows的既有能力。
5. **增加真正到底的幾何／操作測試**：使用者手勢或鍵盤捲到底後，最後控制項與footer法律連結可見、可點且有間隔；不只assert scrollTop已達最大值。新nav存在時，以它的實際top及visual viewport邊界判定未被遮擋，不能只看window.innerHeight。

實作與驗收落入[計劃Tasks3/7](../../superpowers/plans/2026-10-17-account-profile-layout.md)。本補充沒有重跑前輪六席審查，也未驗證手機實機。
