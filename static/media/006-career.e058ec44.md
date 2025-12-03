---
title: 下一站，中國銀行
date: 2025-12-03
id: personal0006
tag: personal
intro: What I have done in these two years
---

![](/assets/img/2025-12-04-04-31-03.png)

### 談談現在公司

#### 剛加入公司的時候 


大概二年半前，我剛加入現在的公司的時候，剛好是當時公司主力項目的尾聲，我主要都在修他們已有的 feature，加加功能，扭扭螺絲。那個時段正好是人力交替周期，辭職的辭職，各有不同的出路。IT 相關的職員只剩下一個 senior 的 "Tech Lead" 跟一個 ai engineer。

不到三個月，公司開展一個新的手機項目。這領域對這位 "Tech Lead" 來說非常陌生。其一，在他帶領同事幹活的這二年，他都只專注後端的工作，二年來從不讓雙手沾染任何 nodejs。其二，他也沒有幹過 native mobile application 的項目，以致他沒有任何基礎在新項目上作出任何技術上的決策。而作為 react developer 的我，理所當然決定使用 react-native 來開發新項目了。

#### 對 Tech Lead 的不信任

因為我有參與舊 project 的一些短期維護，所以看到這位 Lead 帶領下 project 的一些慘況以及令我對他抱有負面看法。

1. 後端用的 Spring Boot，原本是使用 MySQL，然後有一半已經改為 MongoDB。查問轉換原因，tech lead 認為 business 經常改變，所以 mongoDB 這種沒有 schema 的 persistence solution 更適合，因為 schema 更具彈性，沒有 schema ! (蛤?)。

    我新 project 直接 Prisma 加 PostgreSQL 來給他一個打臉，這個新 project 跑了兩年，還是走得好好的，business 還一直改，用的是 Spring Boot。

2. 簡單的一個 react application，原來是在 ec2 上跟 spring boot backend 綁在一起，順便在 ec2 上 host 的。Deployment 方法是使用純手工的精美 shell script，連到 ec2 上作一輪精彩的操作 (打斷 spring，上傳 zip，unzip，啟動，...)。這是我第一家公司沒在用 ci/cd 的，也是太精彩了。

3. 這位 Tech Lead 沒有使用 middleware 的經驗，所以不理解這個字是甚麼。在寫後端這個 context 下，跟我爭論 middleware 這個字可以有***很多***意思。可是有後端知識的人，但凡寫過 C#，寫過 nodejs，寫過 golang，都不會覺得 middleware 這個字有任何歧義。

4. 這個 Spring Boot Project 有一個絕妙的點，整個項目 ***完全沒有*** repository。你都使用 mongo 了，不是有 `spring-data-mongodb` 可以用嗎？難道所有簡單的 "query" 都要自己手擼出來嗎。

    這個 Spring Boot Project 在轉 MongoDB 之前是用 iBatis 的，這我沒甚麼意見，純 sql-based 跟 jpa-based 都看過。但可以肯定長期走下去，sql-based 的 backend 會更難維護。

5. 抱有過份的階級觀念。他技術不行，但又死愛面子。在我這些認真好學，經常鑽研技術的 developer 眼中，根本沒辦法跟這種不好好做學問的人相處。我記得我進公司第 4 個月吧，我差點要鬧辭職了。

    後來如我所料，它在自己的 Linkedin 加上跟他完全沒關係的工作經驗，甚麼 React Native，甚麼 Lambda function，其實沒有一項跟他有關的。我早已看清這個人沒甚麼學術誠信，我從直覺上就覺得跟這種人合不來。


#### Tech Lead 的離去 

這位 teah lead 既然覺得用 mysql 太複雜，而且更愛 mongodb，所以理所當然沒甚麼阻力之下我們都用上 express 加 mongodb 作後端 (這個 nodejs 後來被 spring boot 所取代，這又是這位 tech lead 離開後的一個故事了)。

這位 tech lead 愛加 table，加一些奇怪的 design，我又沒甚麼經驗去否定就隨他，以致寫着寫着整個 backend 愈來愈亂。他覺得自己可以做的貢獻太少，所以離職了。而我作為新人，沒甚麼從零自己弄後端的經驗，也只好邊學邊做。



#### 得來不易的機會
##### 我獨自升級，從後端，Schema Design，上 Cloud，走 Lambda，CI/CD，一手包辦

這是一個很好的機會，從 deployment，backend architecture，schema design，你在哪一間公司在有一位比你 senior 的人存在下可以隨便做決策的？

正好這位 tech lead 的離去，令我有隨意發揮的機會 (而 9 個月後有新 lead 上任，帶來了一些正面的改變)。同時我的發揮令到公司的原型產品能如期推出。

沒錯，在小公司，當公司缺人的時候，你就可以得到這種中等或以上規模的公司得不到的機會。託賴公司對我的信任，加上我自己私人時間的研究，我在公司建立了

1. 所有 backend (spring boot, nestjs) 的  CI/CD，其 `deployment.yml`，以及提倡 github action 作為 CI/CD 工具 (後來才宣佈 gitlab 不再支援香港)。

2. Deployment 分了兩種模式，一種是 lambda function，一種是 ecs。

    Lambda function 也有很多種類，有 python 的；有 express 的；有 spring boot 的；有 unzipped size 超過 250 mb，經 docker image 跑的。每一種都經過很多時間研究。


3. 所有的 cloud infrastructure。以致後來使用 infrastructure as code via terraform 來達成 infrastructure 的可重覆性。

以上都是比較成功，至今一直沿用。同時也有一些比較失敗的，到了產品一年多就被迫重寫︰

##### 失敗的 Nodejs Backend


###### 寶貴的失敗經驗


雖然我花了很多很多時間去研究，力求做到最好。可是我也是第一次從 0 去建立後端，包括 table design 和後端架構完全憑直覺，加上我沒有參與過好 project 的經驗，歷時一年的 nodejs backend 在新 lead 帶領下用 spring boot 重寫。

這個 nodejs 發生甚麼事呢？

1. db 交互主要用一種名為 kysely 的 query builder。儘管 architecture 走的時 controller service，但沒有 repository。

2. 所有 domain logic 都是用 query builder 來描寫。有時候甚至在 controller level 就擼 query 了。

3. 開始有很長的 sql，無數的 left join，複雜的 pgsql-specific 語句。


4. 承上，domain logic 開始不能維護了

5. 基本上是一個大泥球，service 也沒有按 domain 劃分好。

看着這個後端變成這個樣子，自己也有一點心痛。

是不是用 spring boot 上面的問題就解決了？答案是***否定***的。Spring boot 充其量是多了一個 JPA，可以幫你自動建立 Repository。但沒有走對正確的方法論，最後其實用甚麼語言都會變成一托 $*$。胡亂建立的 services (都跟 util 沒差別了)，互相引用導致的 cycle dependencies，logics of the same domain  spread to multiple services，等等，都是沒有方法論的通病。
###### 學習系統設計的方法論

所以為免重蹈覆轍，開始學習後端的一些方法論。其中一個方向是 domain driven design。從戰略層面 (design system by context 以及 event storming)，到戰術層面 (domain behaviour, value object, aggregate, etc)，我都花了不少時間去研究。

![](/assets/img/2025-12-04-04-29-09.png)

我覺得 domain driven design 對我最大影響是 schema design 的一些思維改變。例如所有 table 被設計時都一定需要思考它在一個 domain 裏的哪個 ***Context*** (context-first)。這些設計不管你後端走不走 domain driven design 的戰術路線都通用的。

關於 domain driven design 的戰術部分，其實戰可參考我的文章 (第 5.1.1 開始)︰
- [Timetable System for an Art School::Invoke the command from controller](/portfolio/Commercial-Timetable-System-for-an-Art-School#5.1.1.-step-1.-invoke-the-command-from-controller)







#### 離職念頭的萌芽


##### 失去很多想要的機會

原型建立好後，老闆便開始持續招聘，把整個團隊擴展到 5 個 developer + 1 個 ai developer。其中有些人是幾乎在前端幫不上忙的，就被派去做後端。而我這種甚麼都做得好的，就被迫做更多前端的工作。久而久之，我變成主力做 cloud 加前端，都不是我想要做的工作。


##### LovableUI 之亂，"No Code Manager" 變本加厲

以前這位 no code manager 會在 figma 畫原型，當半個 ui designer。會用 lovable UI 後，直接整個生成出來。但是需求不停變，他也沒辦法用咒語把它 "想要的" 的呈現到 lovable UI 的預覽中，導致需求跟預覽沒辦法統一，根本不知道要不要再參考這個***預覽***。

其次，他想要我們從 lovableUI 的原碼開始改，要做到跟他一模一樣，可是 lovableUI 的 code 動輒 4000 行.....。

後來他索性 ui 都不弄了，要我們通靈，我們做好後他再想怎麼改。所以我們要以 "會被改掉" 前提下去做新的 UI。這算是這公司的一大特色了。


##### 同事的離職
今年 8 月底一位前端同事離職，因為他找到了一份銀行（mox bank）的前端工作；二來現在公司一年多沒有薪金調整 ，也促使我想嘗試找找更好的機會。




### 兩個 Offers

最後工作找了一個多月，因為我一路以來都不斷思考和不斷作新的嘗試，展示這些"作品"後面試機會還挺多的。我的方向是全端 / 純後端，技術棧方面後端找的是 spring boot, nodejs 或者是 rust，前端找的是 react / react-native，且拒絕所有純前端的工作，因為這與我的職涯規劃相沖。

最後得到兩個 offer。

1. 一個是 I-Charge Solutions International (ICS) 的 Analyst Progammer；
2. 另一個是中國銀行的 System Analyst。

I-Charge 如其說是一個 offer，他更像是一個 rejection。其實我薪金加幅寫了 5000，是留一個空間讓對方壓價，你但凡加個 3000 到 4000 我都會立刻接受，畢竟我真的很想轉環境。I-Charge 出 offer 的時候直接把加幅壓到只剩 1000。這就像跟我開一個玩笑，我花時間請個假去面試，但對 對方 來說原來我就像一個小丑一樣，用來打發他的時間，用來浪費我的 annual leave。

收到電話通知後從有 offer 到 reject offer 整個過程不到 1 分鐘，心裏只道：「好傢伙。」

另一邊廂，面試中國銀行後，過了兩個禮拜我才收到中國銀行對我有興趣的消息，並從獵頭那邊知道他們想給我 offer。再 3 個禮拜後才正式告訊我可以去簽約 ...，整個過程非常的煎熬。






