title: DSR - Elemental 打法
date: 2022-11-27
id: blog0112
tag: FF14
intro: 紀錄 elemental 野團打法以及跟固定團打法上的差異。

#### Elemental Strat 食用影片 (116)

- https://www.youtube.com/watch?v=tvvUALWhjaE&t=4s

#### P1

##### P1-Macro

```text
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
```

##### P1-總結

- `MT` Grinnaux $=$ 戰士
- `ST` Adelphel $=$ 騎士
- 無敵:
  - 第一次 MT，接線
  - 第二次 ST，引導騎士
- 打斷讀條:
  - ST $\to$ D3 $\to$ ST
- 最後引導扇型:
  - H1+H2 $\to$ D1+D2 $\to$ D3+D4 $\to$ MT+ST

#### P2

##### P2-Macro

```text
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
```

##### P2-總結

- 第一次三連劈只開小減，ST 交小減
- 一樣交叉接線，交 20% + 30% 減傷
- 接線後 MT 無敵，ST 全程待機。
- 優先順時針交換
- **ST 有隕石.** 原地南邊
- **ST 沒有隕石.**
  - **H2 有.** 跟 H2 換
  - **MTH1 都有.** 跟 H1 換

#### P3

##### P3-macro

```text
―《Nidhogg》("Easthogg") ―――――――――――
【Dive from Grace】
　　　　　　　　　 ②↑ ②↓
　　　 ②③ 　　　　　 ① 　　　　　 ①③
　　 ①↑▲ ①↓ → ③↑▲ ③↓ → ②↑▲ ②↓
　　　　 ① 　　　　　　 ③ 　　　　　　 ①
　　※ Face east when placing towers
【4x Towers (H/R fixed)】
　　 MT/D3 　 ST/D4 　　 Tanks/Melee adjust：
　　　　　 ● 　　　　　　 cw > ccw > across
　　 H1/D1 　 H2/D2
　※ H/R bait Geirskogul
　 ■ Soul Tethers
　　 MT → Nidhogg's tether (under boss)
　　 ST → clone's tether
```

##### P3-總結

- 跟固定團不同， ↑ 去西邊，↓ 去東邊
- ST 無敵接幻影線 (包括 116)

#### P4

##### P4-macro

```text
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
```

##### P4-總結

- 一開始坦奶紅色 debuff，撞黃球
- 撞球後，DPS 過來換 debuff

#### P5

##### P5-macro

```text
―《Alternate Timeline Thordan》―――――――
【Wrath of the Heavens】
　 North：MT>ST>H1>H2>D1>D2>D3>D4：South
　　　　　 ▼ 　 ★ 　 ▼
　　(blue)　\　 /　　　　　※ Use white dragon
　　　　　　　\/　　(party)　　　 as North
　　　　　　 /　\　
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
```

##### P5-總結

- 死宣組上，無死宣下
- 無死宣組打橫排，左邊 $\times$ 去北

#### P6

##### P6-macro

```text
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
```

##### P6-總結

- **第一次死刑.** 換坦食
- **第二次死刑.** 依然換坦

#### P7

##### P7-macro

```text
―《Dragonking Thordan》―――――――――――
【Mitigations】
　 All with H2 30s, shields and:
　　 Alt. End：MT 90s, ST 90s, H2 120s (x2)
　　 AM1：MT Rep, H1 120s, D1, D4
　　 Giga1： ST Rep, D2, D3
　　 AM2：MT Rep, MT 90s, ST 90s, H1 180s
　　 Giga2：ST Rep, D1, D4
　　 AM3：MT Rep, H1 120s, H2 120s (x2), D2, D3
【Trinity】After Exaflare → D1, D2
　　　　　 After Akh Morn → D3, D4
　　　　　 After Gigaflare → H1, H2
【Akh Morn's Edge】(All 3-3-2)
　　 H1D1D3 　　 H2D2D4
　　　　　　 MTST
```
