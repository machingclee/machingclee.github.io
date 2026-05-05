const n=`---
title: 停用 mac 的 power button
date: 2025-10-15
id: personal0004
tag: mac, tech, personal
toc: true
intro: Get rid of the hassle of hitting the power button mistakenly.
---


<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 600px !important;
  }
</style>

### 停用 power button 的動機

我喜歡在 mac 上外放一個 lower-profile 的 mechanical keyboard，因為這能夠提昇我碼字的手感跟速度︰

<customimage src="/assets/img/2025-10-16-04-38-12.png" width="400"></customimage>


問題是右上角的 power button 容易被誤碰，造成我明明登入了，太用力按鍵盤就觸碰到 power button 直接把我登出。

這在 nuphy v3 問題不大，直到我試用 lofree （如圖，它沒有針對這種用法來設計鍵盤機身）。這誤碰變得太頻繁了。所以我不得不找個方法停用這 power button。




### 步驟概述


在章節 [#disable] 中我們將



1. 在 [#combo1] 我們透過 karabiner elements 當連接 external keyboard 時停用 macbook 內建的 keyboard。這方式沒辦法停用 power button，我們透過餘下兩個步驟停用它。

2. 在 [#combo2] 我們透過 mac 的 system command 停用 \`screenLock\` 功能。

    但這也同時廢除了 \`ctrl + shift + q\`。這顯然是不方便的，我們失去了任何回到 lockscreen 的手段。我們在最後一步把這個補回來。

3. 在 [#combo3] 我們透過 [BetterTouchTool](https://folivora.ai/) 設置快捷鍵來運行 \`AppleScript\` 來命令 mac 進入 lock screen.



### 當 external keyboard 接上時停用原生 keyboard 所有按鍵 {#disable}
 
#### Combo 1: Karabiner-Elements {#combo1}


安裝 \`Karabiner-Elements\`, 然後到 \`Devices\` 那邊︰

<customimage src="/assets/img/2025-10-16-04-42-23.png" width="300"></customimage>


啟用 \`disable the built-in keyboard while this device is connected\`︰

[![](/assets/img/2025-10-16-04-41-36.png)](/assets/img/2025-10-16-04-41-36.png)


這會停用 mac 原生 keyboard 的一切按鍵，除了 power button 外。

#### Combo 2: 停用系統指令 \`DisableScreenLockImmediate\` {#combo2}

在 \`cmd\` 中運行指令

\`\`\`bash
defaults write com.apple.loginwindow DisableScreenLockImmediate -bool yes
\`\`\`

- 這會停用 "回到 lock screen" 這個功能，***包括 power button*** 以及 \`ctrl + cmd + q\`。

- 這顯然需要被解決的，我們沒有了任何回到 lock screen 的手段。

#### Combo 3: \`BettertouchTool\` 跟 \`Apple Script\` {#combo3}

\`Claude-Sonnet-4.5\` 提供了以下 \`AppleScript\` 來回到 lock screen

\`\`\`bash
# Apple Script
tell application "System Events" to sleep
\`\`\`

我們再透過 [BetterTouchTool](https://folivora.ai/) 定義 shortcut （\`Option + L\`，對標 Windows 中的 \`Win + L\`）來觸發這個 script︰



[![](/assets/img/2025-10-16-04-53-40.png)](/assets/img/2025-10-16-04-53-40.png)

完成！



### References

- r/MacOS, [*How do you turn off the lock screen when you press the Touch ID button on MacBook Pro.*](https://www.reddit.com/r/MacOS/comments/kpfzst/how_do_you_turn_off_the_lock_screen_when_you/), Reddit

- Claude-Sonnet-4.5, *for apple script provided*`;export{n as default};
