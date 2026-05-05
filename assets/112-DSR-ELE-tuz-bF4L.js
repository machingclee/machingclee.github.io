const n=`---
title: DSR - Elemental 打法
date: 2022-11-28
id: blog0112
tag: FF14
wip: true
intro: 紀錄 elemental 野團打法以及跟固定團打法上的差異。
---

### Extra Resources

#### Elemental Strat 食用影片 (116)

- https://www.youtube.com/watch?v=tvvUALWhjaE&t=4s

#### 野團攻略一圖流 summary

<Center>
  <a href="/assets/tech/112/dsr_cheatsheet.jpg">
    <img src="/assets/tech/112/dsr_cheatsheet.jpg" width="650"/>
  </a>  
</Center>

#### Full Breakdown

- https://cutt.ly/EleDC_DSR
- nid <- 1-2-3-4-binds-ignores -> hraes

#### 招募文

\`\`\`text
P6 Wroth Flames prog, ST taken, https://cutt.ly/EleDC_DSR
\`\`\`

### P1 門神

#### P1-Macro

\`\`\`text
　Adelphel：ST　Grinnaux：MT
【Holy Bladedance】Tether → MT + invuln
【Hyperdimensional Slash】Markers S → N
【Execution】ST invulns
【Silence】ST → D3 → ST
【Playstation chains】
　　D△ T× T□
　　D〇　 　D〇　west: D1>2>3>4: east
　　D□ H× H△
【Haurchefant】
　　　cleave　cleave　　　※ cleaves towards
　　H/R AoE ★ T/M AoE　　　ring (True South)
　　　　　   party
　H1+H2 → D1+D2 → D3+D4 → MT+ST
\`\`\`

#### P1-總結

- \`MT\` Grinnaux $=$ 戰士
- \`ST\` Adelphel $=$ 騎士
- 無敵:
  - 第一次 MT，接線
  - 第二次 ST，引導騎士
- 打斷讀條:
  - ST $\\to$ D3 (playstation 後) $\\to$ ST
- 最後引導扇型:
  - H1+H2 $\\to$ D1+D2 $\\to$ D3+D4 $\\to$ MT+ST

### P2 騎神

#### P2-Macro

\`\`\`text
―《Thordan》――――――――――――――――――
【Strength of the Ward】
　　North (West)　　South (East)
　　　　 H1　　　　　　 H2
　　　D1 MT D3　　　D2 ST D4
　■ Skyward Leaps + Towers
　　※ Use Thordan as north
　　Cross tethers：
　　　MT：West tether → East of party
　　　ST：East tether → West of party
【Sanctity of the Ward】
　■ Sacred Severs (Zephirin-relative)
　　Group 1 (MTH1D1D3) → Opposite Zephirin
　　Group 2 (STH2D2D4) → Beside Zephirin
　　※ Swap between roles to resolve swords
　■ Meteors
　　　　　MT/D3　　　 ※ Fix Meteors N/S
　　　H1/D1　H2/D2　  ※ Meteors run cw
　　　　　ST/D4
　　※ Meteor group (T/H or DPS) outside
　　　　　　　　center > ccw > cw
　　※ Meteor grp → Final cardinal towers
　　※ Non-meteor grp → Clockwise from ice
\`\`\`

#### P2-總結

- 第一次 MT 吃三連劈開 20% 及特色小減
  - **Remark 1.** 戰士有可能會在此處無敵 $\\to$ 換坦 $\\to$ 兩坦 20% 拉線 $\\to$ ST 30% 擋 heel $\\to$ MT 30% 擋三連。
    - **溝通範例.**
      <Center>
        <a
          target="_blank"
          href="/assets/tech/112/006.png" 
        >
          <img 
            src="/assets/tech/112/006.png" 
          />
        </a>
      </Center>
  - **Remark 2.** 以暗騎 MT 為例，通常情況是 20% + 特色小減 吃三連$\\to$ 拉線用無敵 $\\to$ Heel 用 30% + 特色小減，換坦吃三連。
- 優先順時針交換
- 以下以 ST 為例：
  - **ST 有隕石.** 原地南邊
  - **ST 沒有隕石.**
    - **H2 有.** 跟 H2 換
    - **MTH1 都有.** 跟 H1 換

### P3 大師兄

#### P3-macro

\`\`\`text
―《Nidhogg》("Easthogg") ―――――――――――
【Dive from Grace】
　　　　　　　　　  ②↑    ②↓
　　　  ②③ 　　　　　  ① 　　　　　    ①③
　　①↑  ▲  ①↓  →  ③↑  ▲   ③↓  →  ②↑  ▲  ②↓
　　　  ① 　　　　　　 ③ 　　　　  　  ①
　　※ Face east when placing towers
【4x Towers (H/R fixed)】
　　 MT/D3 　 ST/D4 　　 Tanks/Melee adjust：
　　　　　 ● 　　　　　　 cw > ccw > across
　　 H1/D1 　 H2/D2
　※ H/R bait Geirskogul
　 ■ Soul Tethers
　　 MT → Nidhogg's tether (under boss)
　　 ST → clone's tether
\`\`\`

#### P3-總結

- 跟固定團不同， ↑ (前跳)去西邊，↓ (後跳)去東邊
- ST 無敵接幻影線 (包括 116)

### P4 龍眼

#### P4-macro

\`\`\`text
―《Eyes phase》――――――――――――――――
　　　 D1 　　 D4 　　 T/H → Red tethers
　　　 MT 　　 ST 　　 DPS → Blue tethers
　　　 H1 　　 H2 　　※ Stack on Estinien in mid
　　　 D2 　　 D3 　　　　 to swap tethers
　【Yellow+Blue Orbs】
　　　　 D1 　　 D4 　　　　※ DPS goes to T/H
　 MTH1 　　　　　 STH2 　　　 to swap tethers
　　　　 D2 　　 D3
　【Mirage Dives】
　 ■ Initial spread 　 ■ Swaps (from true North)
　　　 D1 　　  D4 　 　 1. ccw：H1>H2：cw
　　　　   T+H 　　　　  2. ccw：MT>ST：cw
　　　 D2 　　  D3 　 　 3. ccw：D1>D2>D3>D4：cw
　※ Around blue eye
\`\`\`

#### P4-總結

- 一開始坦奶紅色 debuff，撞黃球
- 撞球後，DPS 過來換 debuff
- 幻想衝換 debuff 次序為 Healer $\\to$ Tank $\\to$ DPS

### P5 風槍、死刻

#### P5-macro

\`\`\`text
―《Alternate Timeline Thordan》―――――――
【Wrath of the Heavens】
　 North：MT>ST>H1>H2>D1>D2>D3>D4：South
　　　　　 ▼ 　 ★ 　 ▼
　　(blue)　\\　 /　　　　　※ Use white dragon
　　　　　　　\\/　　(party)　　　 as North
　　　　　　 /　\\　
　　　(tether)　(tether)
【Death of the Heavens】(2-2 Dooms north)
　 ■ Initial spread
　　　　  　　  　　　※ Use Grinnaux as North
　　　　　　　　　　　　  = Dooms
　　 ① 　  　　  　 ④ 　　　　(dodge 2nd Impact)
　　　　　　　　　　　　 ① = Non-doom
　　　　 ② 　　 ③ 　　　　　　(dodge 3rd Impact)
　 ■ Playstation 2 (Anchored Dooms)
　　(△/□) × (△/□)　 ※  +  bait circles
　　　  　　　  　　　※ Doom players stay
　　　　  ×  　　　　　 non-doomed adjust
　 ■ Meteors：Caster LB2 (centered true N)
\`\`\`

#### P5-總結

- 死宣組上，無死宣下
- 無死宣組以橫的方向排隊，左邊 $\\times$ 去北
- **減傷安排.** 兩次都換坦，
  - **第 1 次 Heel.** MT 20%
  - **第 1 次 三連劈.** ST 20%
  - **第 2 次 Heel.** ST 30%
  - **第 2 次 三連劈.** MT 30%

### P6 雙龍

#### P6-macro

\`\`\`text
―《Double Dragons》 (△, DTTMR, 1-5) ―――――
　 MT → Nidhogg 　　 ST → Hraesvelgr
【Wyrmsbreath #1】
　　　 D3D4 　　　　※ H1, H2, D4 stays 　
　 H1D1 　　 H2D2 　※ D1, D2, D3 adjusts
【Akh Afah】North：MT, H1, D1, D3
　　　　　　　 South：ST, H2, D2, D4
【Hallowed Wings #1】MT → North 　 ST → South
【Mortal Vow】(pass in mid except last)
　　 DPS → MT → ST → (D1>D2) → D3
【Wroth Flames】Spread → Nidhogg 　
　　　　　　　　　 Stacks → Hraesvelgr
【Hallowed Wings #2】MT → West 　 ST → East
【Wyrmsbreath #2】(5-1) D3 south
【Cauterize】(2x invuln) MT → West, ST → East
\`\`\`

#### P6-總結

- **個人減傷安排 (非 116，非戰士無敵狂開，gunbreak 暗騎通用).** 以下 P5 是 20% 起手而不是 30%。

  - **1 回目冰火線.** 10% (GNB 的偽裝，DRK 可用 20% 魔減) + 特色小減 (需要時坦互給)
  - **1 回目聖羽.** 20% + 特色小減
  - **2 回目聖羽.** 30% + 特色小減
  - **2 回目冰火線.** 20% + 10% + 特色小減

- **第一次聖羽.** 因為聖龍在 B 點，

  \`\`\`text
  MT → North 　 ST → South
  \`\`\`

  意思是

  \`\`\`text
           聖龍           聖龍
                   or
  (A) ← MT　 ST           MT　 ST → (C)
  \`\`\`

  以聖龍為北的話，MT 左，ST 右。

- **第二次聖羽.** 聖龍在 B 點，這次 MT，ST 必定一前一後，所以

  \`\`\`text
  MT → West 　 ST → East
  \`\`\`

  意思是 ST 前 MT 後。MT 可提前往邪龍靠作準備。

  \`\`\`text
     聖龍
      ↑
      ST

      MT
      ↓
   West (D)
  \`\`\`

- **聖羽總結.** MT 左 $\\to$ 後，ST 右 $\\to$ 前

#### P6-如有西瓜 (甚麼，西瓜也有不同設定？)

從西瓜的 [教學網](https://triggevent.io/pages/Dragonsong-Triggers/) 可以看到西瓜有兩種模式

- **Alt Mode.** "1" players stack together, "2" players stack together
- **Non-Alt Mode.** "bind" players stack together, "ignore" players stack together

兩種 mode 都有人在用，不存在必定會使用某某 mode 的情況，進 P2 後要問清楚。

以下為 Non-Alt Mode 的例子

<Center>
<img src="/assets/tech/112/005.png"/>
</Center>
<p/>
<center></center>

#### P6-固定團可使用頭標 macro

##### 原理

沒有指定頭標數字，所以頭標數字會以自動遞增的方式付予玩家以達到頭標不重覆的效果。

- 散開組按 1, 2, 3, 4 分散
- 頭割跟無職 **按數字** (不是按 symbol) 貼貼，例如鎖鏈 1 跟禁止 1 貼胋。

##### 散開

<img src="/assets/tech/112/002.png"/>

\`\`\`text
/macrolock
/micon attack1 marking
/mk attack <me>
/wait 1
\`\`\`

##### 頭割

<img src="/assets/tech/112/003.png"/>

\`\`\`text
/macrolock
/micon bind1 marking
/mk bind <me>
/wait 1
\`\`\`

##### 無職

<img src="/assets/tech/112/004.png"/>
<p/>

<center></center>

英文版為 ignore，日文版為 stop。

\`\`\`text
/macrolock
/micon ignore1 marking
/mk ignore <me>
/wait 1
\`\`\`

### P7 騎龍神

#### P7-macro

\`\`\`text
―《Dragonking Thordan》―――――――――――
【Mitigations】
　   All with H2 30s, shields and:
　　 Alt. End     ：MT 90s, ST 90s, H2 120s (x2)

　　 AM(分攤)  1  ：[MT Rep], H1 120s, D1, D4
　　 Giga(遠離)1  ：[ST Rep], D2, D3

　　 AM(分攤)  2  ：[MT Rep], [MT 90s], [ST 90s], H1 180s
　　 Giga(遠離)2  ：[ST Rep], D1, D4

　　 AM(分攤)  3  ：MT Rep, H1 120s, H2 120s (x2), D2, D3
【Trinity】After Exaflare → D1, D2
　　　　　  After Akh Morn → D3, D4
　　　　　 After Gigaflare → H1, H2
【Akh Morn's Edge】(All 3-3-2)
　　 H1D1D3 　　 H2D2D4
　　　　　　 MTST
\`\`\`

#### P7-總結

##### 通用坦減傷

- Alt. End 為轉場
- 龍眼吸收到騎神體內後可立刻上 light / missionary
- **個人減傷.**
  個人減傷 (非特式小減) 只在地火後的分攤使用，其次，

  - 所有 20 秒減傷可以在 **_吃一刀後_** 使用。
  - 所有 15 秒減傷可以在 **_吃二刀後_** 使用。

  減傷可提前使用以免手忙腳亂。卡得夠準也可以分攤前一刻下減傷，順便擋後續 AA。

  **減傷分配.**

  - **第 1 次分攤.** 20% + 10% + 特色小減
  - **第 2 次分攤.** 30% + 特色小減
  - **第 3 次分攤.** 20% + 10% + 特色小減

##### GunB 特化減傷

把剛心放到所有 AA 減輕治療壓力，對下減傷時機要拿捏得比較準，不然會發生最後一次分攤只有 30% 可以開的情況。

- [影片參考](https://www.bilibili.com/video/BV1Ne4y1r7KZ/?share_source=copy_web&vd_source=86f335daec098d59080b983f2e09b1fc&t=907)

**影片總結:**

- **第一次分攤: 30%.** \\
  準備跑地火 -> 鐵壁 + 偽裝 (主要臨完結前 cover 兩刀)

  - 避地火後 -> 剛心 -> 吃 2 刀 -> 30% -> 分攤

- **每一次 AA:** 剛之心
- **第二次分攤: 鐵壁 20% + 偽裝 + 團隊 light + missionary**
  - 野隊這時候會有 light + missionary，減傷完全足夠。
  - 建議 20% 吃 一刀 / 二刀 後**立刻**開，不然第三次分攤途中才轉回來。
- **第三次分攤:** 30% + 20%

**Remark.** 這套減傷不會有減傷不小心開掉的問題，都是減傷轉回來立刻用。
`;export{n as default};
