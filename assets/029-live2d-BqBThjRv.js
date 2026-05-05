const n=`---
title: Live2D 心得
date: 2021-09-18
id: blog0029
tag: live2D
intro: 紀錄一些坑跟還有記憶的步驟
---

### 原畫處理

看處理流程，可以預先把線稿拆開再局部地把作品完成。如果像我一樣最終彩圖的上色圖層只有一層的話，便要再細心把最終成品拆開。

因為修圖基本上必須，作畫也不用對線稿太執着。作品整體遠比最終的線條精緻性重要。最後我們還得用厚塗的方式把對 live2D 來把不完整的部分補完，那時候再把線磨精細一點也不晚。

<p>例如這張角色原本長這樣：</p>
<img width="600" src="/assets/tech/019.png"/>
<p/>

<center></center>

在完成 live2D 後長這樣：

<img width="600" src="/assets/tech/018.png"/>
<p/>

<center></center>

因為第一次會踩不少坑，而且在製作過程不可能避免回頭去修原本的 psd 檔案，因此必須懂得如何在 live2D 導入更改過的 psd 檔案：

### 更改過的 psd 檔案導入

例如我的 \`.cmo3\` 檔 (live2D 儲存檔案的格式) 從一開始就使用了名為 \`14.psd\` 的檔案。當我們修改 \`14.psd\` 後，可以把 \`psd\` 檔直接拉到 live2D 的工作視窗進行更新。

<img  width="600" src="/assets/tech/020.png"/>
<p/><p/>
<img  src="/assets/tech/021.png"/>
<p/>
<img  src="/assets/tech/022.png"/>
<br/><br/>

### Live2D 局部的注意事項

五官的處理手法，\`Angle X\` \`Angle Y\` \`Angle Z\` 的角度處理，等等等等，都非常推薦看「參考」部分的 **Live2D 超入門講座系列**。

五官中有些部分不容易有坑可以踩，像頭髮，耳啊，鼻之類的都是非常安全的部分。以下紀錄我覺得有必要記住的地方：

#### 頭髮

除非跟我的例子一樣角色帶有帽子，不然正常情況下頭髮需分為

- 複數 (或一) 個前髮
- 耳朵前的兩條側髮
- 放在最後面的**後髮**

頭部分最理想是完整的禿頭頭型。但不一定是禿頭，雖然很多時看不到但可以把**髮根給畫出來**。

#### 眼

新手的第一個坑。通常 CG 少女都帶有

- 睫毛；
- 孤度向上的上半部；
- 孤度向下的下半部；
- 眼珠 (請保留完整的橢圓型)。

這些在 live2D 製作過程都必須被分拆出來。

<img src="/assets/tech/023.png"/>

#### 口

口分為上唇跟下唇，看風格可使用兩排牙齒：

<img src="/assets/tech/024.png"/>
<p/>
<center></center>

我們利用上唇跟下唇的形狀來做出不同的情感。

另外因為口部變型尤為複雜，外加上我們有需要時刻更改 mesh 的形狀來遮檔有機會露出的口腔內部。因此推薦這種 mesh 的分佈方法：

<img width="600" src="/assets/tech/025.png"/>
<img width="600" src="/assets/tech/026.png"/>

<p/><p/>
<center></center>

好處：

> 在 live2D 裏 mesh 以外的區域會被自動刪除並不顯示在畫面上。當我們逼不得已需要 增加 / 刪減 作為遮擋的色塊區域的時候，我們可以調整最外周的節點而不影響最內層經由 deformer 造成的變化。


### 成品

<center>
  <video controls width="500">
    <source  src="/assets/videos/001.mp4" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  </video>
</center>
<p/><p/>

### 參考/教學

- Live2D 超入門講座系列：
  https://www.youtube.com/watch?v=rl3XFoLf3XA&list=PL_B-UPbBHi7TY2K-Wah40rlX3FvD7Expp

- <a href="https://www.youtube.com/watch?v=LXV4Q4e1RbU">
  用Live2D Cubism & FaceRig成為VTuber或遙距上學吧!
  </a>

  一些 facerig 跟 obs 的基本觀念，重點是此影片 description 中的連結：

- <a href="https://www.cg-method.com/live2d-facerig-parameters/"> live2D 裏哪些預設參數可直接在 facerig 中使用
  </a>

  如果不幸使用了自定義參數造出很漂亮的效果，那對不起了你要學習如何把自定義參數取代 facerig 默認的參數 (有好幾個地方我因此要砍掉重做)：

- <a href="https://www.cg-method.com/facerig-custom-parameter/"> カスタムパラメーター＆Live2D のアニメーション（モーション）の設定方法まとめ
  </a>

  這些默認參數不但限制了可使用的參數名稱，還限制了他們可使用的**_值域_**。例如自定義參數送給你 -30 到 30 這個區域，經過努力搜尋現在還沒有方法把它 scale 成 0 到 1 間的參數，必須重做！所以還是乖乖用預設參數吧！
`;export{n as default};
