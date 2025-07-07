# 中國用語雷達 Chinese Vocabulary Radar

近幾年，中國用語大肆出現在台灣人的日常生活中。雖然語言的融合與混用為正常現象，但帶有政治意涵的文化入侵仍值得關注。

[中國用語雷達 (Chinese Vocabulary Radar)](https://chromewebstore.google.com/detail/lecgchakaccigfbbaeialhjplbmgipge?utm_source=item-share-cb)是一款Google Chrome擴充功能，可以掃描網頁中的中國用語，並以黃色標示。這個專案的程式碼與對照表已經在[GitHub上開源](https://github.com/aronhack/Chinese-Vocabulary-Radar)，你可以自行分享、改寫或用於商業用途，不需要取得任何授權。

這個工具的目的是提升台灣民眾對語言使用的敏感度，並非製造衝突與對立，因此，此工具命名為「中國用語雷達」，而不是帶有貶義的「支語雷達」。

## 使用畫面
1. 當安裝完成後，在瀏覽器右上角會出現一個雷達小圖示，點擊即可掃描網頁中的中國用語。
2. 勾選「自動掃描」後，仍需手動點擊雷達小圖示，才能掃描網頁中的中國用語。
![usage.jpg](screenshots/chinese-vocabulary-radar-usage.jpg)

## 進階用法 - 搭配AI使用
你可以在chrome-extension的資料夾中找到`taiwan_china_vocabs.json`，這個檔案包含了所有台灣與中國用語的資料。點擊下圖的按鈕就可以取得這個檔案的連結。

![get_json.jpg](screenshots/chinese-vocabulary-radar-get-json.jpg)

接著再將連結提供給AI，請AI根據這份對照表，將以下文字中的中國用語轉換為台灣用語。範例如下：
```
請根據這份對照表，將以下文字中的中國用語轉換為台灣用語 
https://raw.githubusercontent.com/aronhack/Chinese-Vocabulary-Radar/refs/heads/main/chrome-extension/taiwan_china_vocabs.json 

#新说唱晋级标准# 选手们的表现太卷了！有人挑战高难度技巧，有人打造记忆点旋律。这些不同方向的“高光”，在晋级规则里占比如何？
```

![integrate-with-LLM.jpg](screenshots/chinese-vocabulary-radar-integrate-with-llm.jpg)

## 內容授權
中國用語雷達的原始碼授權為 [MIT](https://github.com/aronhack/Chinese-Vocabulary-Radar/blob/main/LICENSE.txt)，文字段落以 [CC 0 公眾領域](https://creativecommons.org/publicdomain/zero/1.0/deed.zh-hant)釋出，你可以盡情分享、改寫或用作商業用途。

## 版本更新紀錄

v1.2.0
- 新增「移動至上一個/下一個標示處」按鈕
- 新增按鈕與狀態訊息翻譯

v1.3.0
- 新增小視窗，顯示中國與台灣用語對照表
- 修正計數器顯示錯誤

V1.3.1
- 增加循環功能到「上一個/下一個」按鈕

v1.4.0
- 新增「自動更新字典」功能

v1.4.1
- 新增「新增字詞」功能
- 新增「搭配AI使用 - 複製提示詞」功能
- 新增GitHub連結