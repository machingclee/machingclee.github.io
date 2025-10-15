---
title: Disable Macbook Power Button After we Logged in
date: 2025-10-15
id: blog0428
tag: mac, tech
toc: toc
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

#### Use case

I usually place a low-profile mechanical keyboard on top of my macbook for better typing experience:

<customimage src="/assets/img/2025-10-16-04-38-12.png" width="400"></customimage>


The problem is that it is ***so easy*** to mistakenly trigger the power button located at the upper right corner.


#### Objectives


By going through the processes in section *Disable Keys of Built-in Keyboard on Device Connected*, we will be 



1. Disabling all the keys in built-in keyboard after our external keyboard is connected via karabiner elements, *except for* the power button (not overridable).

2. Disabling the power button by system command (we can still login via touchID when the screen is off)

3. Retrieving the screen-lock shortcut by [BetterTouchTool](https://folivora.ai/) and apple script.



#### Disable Keys of Built-in Keyboard on Device Connected

##### Combo 1: Karabiner-Elements


Install `Karabiner-Elements`, go to `Devices` section:

<customimage src="/assets/img/2025-10-16-04-42-23.png" width="300"></customimage>


and toggle the `disable the built-in keyboard while this device is connected`:

[![](/assets/img/2025-10-16-04-41-36.png)](/assets/img/2025-10-16-04-41-36.png)


This will disable all keys ***except for*** the power button, which is not overridable by default.

##### Combo 2: Disable `DisableScreenLockImmediate` command system-wise

In terminal execute:

```bash
defaults write com.apple.loginwindow DisableScreenLockImmediate -bool yes
```

- This will disable the screen-lock globally, including the ***power button*** that triggers it and the ***system shortcut*** `ctrl + cmd + q`.

- This can be annoying as it means that we cannot turn the screen off by any means now


Instead we define apple script to turn the screen off:

##### Combo 3: BettertouchTool with Apple Script

`Claude-Sonnet-4.5` suggests that we can define `AppleScript` to tell the system to sleep:

```bash
# Apple Script

tell application "System Events" to sleep
```

All right with the help of [BetterTouchTool](https://folivora.ai/) we can define a shortcut (`Option + L`, analogous to `Win + L` in windows) to trigger this apple script:



[![](/assets/img/2025-10-16-04-53-40.png)](/assets/img/2025-10-16-04-53-40.png)

and we are done!



#### References

- r/MacOS, [*How do you turn off the lock screen when you press the Touch ID button on MacBook Pro.*](https://www.reddit.com/r/MacOS/comments/kpfzst/how_do_you_turn_off_the_lock_screen_when_you/), Reddit

- Claude-Sonnet-4.5, *for apple script provided*