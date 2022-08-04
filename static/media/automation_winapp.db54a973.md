title: Auto Hotkey Record
date: 2021-10-17
id: blog033
tag: coding
intro: A record of my latest autohotkey setup for different applications.
toc: no

```autohotkey
KeyWait, Shift
KeyWait, LWin
KeyWait, RWin

#NoEnv
#SingleInstance
#MaxHotkeysPerInterval 120

;Process, Priority, , H
SendMode Input

; Show scroll velocity as a tooltip while scrolling. 1 or 0.
tooltips := 0

; The length of a scrolling session.
; Keep scrolling within this time to accumulate boost.
; Default: 500. Recommended between 400 and 1000.
timeout := 500

; If you scroll a long distance in one session, apply additional boost factor.
; The higher the value, the longer it takes to activate, and the slower it accumulates.
; Set to zero to disable completely. Default: 30.
boost := 30

; Spamming applications with hundreds of individual scroll events can slow them down.
; This sets the maximum number of scrolls sent per click, i.e. max velocity. Default: 60.
limit := 60

; Runtime variables. Do not modify.
distance := 0
vmax := 1

; Key bindings
WheelUp:: Goto Scroll
WheelDown:: Goto Scroll
#WheelUp:: Suspend
#WheelDown:: Goto Quit

Scroll:
  t := A_TimeSincePriorHotkey
  if (A_PriorHotkey = A_ThisHotkey && t < timeout)
  {
    ; Remember how many times we've scrolled in the current direction
    distance++

    ; Calculate acceleration factor using a 1/x curve
    v := (t < 80 && t > 1) ? (150.0 / t) - 1 : 1

    ; Apply boost
    if (boost > 1 && distance > boost)
    {
      ; Hold onto the highest speed we've achieved during this boost
      if (v > vmax)
        vmax := v
      else
        v := vmax

      v *= distance / boost
    }

    ; Validate
    v := (v > 1) ? ((v > limit) ? limit : Floor(v)) : 1

    if (v > 1 && tooltips)
      QuickToolTip("×"v, timeout)

    MouseClick, %A_ThisHotkey%, , , v
  }
  else
  {
    ; Combo broken, so reset session variables
    distance := 0
    vmax := 1

    MouseClick %A_ThisHotkey%
  }
return

Quit:
  QuickToolTip("Exiting Accelerated Scrolling...", 1000)
  Sleep 1000
ExitApp

QuickToolTip(text, delay)
{
  ToolTip, %text%
  SetTimer ToolTipOff, %delay%
return

ToolTipOff:
  SetTimer ToolTipOff, Off
  ToolTip
return
}

+#s:: ;Win+Shift+s
  ^space::#space
  +WheelDown::WheelLeft
  +WheelUp::WheelRight

  #up:: Send #{Tab}
  ^#A:: Winset, Alwaysontop, , A
  F12:: Send ^{PrintScreen}
  F11:: Send {PrintScreen}

#5:: 
  Send {ctrl down}{shift down}{alt down}{5}
  KeyWait, 5

  Send {ctrl up}{shift up}{alt up}
Return

#4:: 
  Send {ctrl down}{shift down}{alt down}{4}
  KeyWait, 4

  Send {ctrl up}{shift up}{alt up}
Return

#3:: 
  Send {ctrl down}{shift down}{alt down}{3}
  KeyWait, 3

  Send {ctrl up}{shift up}{alt up}
Return

#2:: 
  Send {ctrl down}{shift down}{alt down}{2}
  KeyWait, 2

  Send {ctrl up}{shift up}{alt up}
Return

#1:: 
  Send {ctrl down}{shift down}{alt down}{1}
  KeyWait, 1

  Send {ctrl up}{shift up}{alt up}
Return

#0:: 
  Send {ctrl down}{shift down}{alt down}{0}
  KeyWait, 0

  Send {ctrl up}{shift up}{alt up}
Return

#If !(WinActive("TwitchUI.exe"))
^q:: 
Send !{f4}

Return

#If !(WinActive("ahk_exe ffxiv_dx11.exe") or WinActive("ahk_exe Photoshop.exe") or WinActive("ahk_exe chrome.exe") or WinActive("ahk_exe Code.exe") or WinActive("TwitchUI.exe"))
  ^w:: 
  Send !{Space}n

Return

#IfWinActive ahk_exe Unity.exe
  !MButton:: !LButton
Return

#IfWinActive ahk_exe Substance Painter.exe
#!LButton::
  Send {Ctrl down}{RButton down}
  KeyWait, LButton
  Send {Ctrl up}{RButton up}
Return

#IfWinActive ahk_exe Substance Painter.exe
MButton::
  Send {Ctrl down}{Alt down}{Lbutton down}
  KeyWait, MButton
  Send {Ctrl up}{Alt up}{Lbutton up} 
Return

#IfWinActive ahk_exe Substance Painter.exe
!MButton::
  Send {Alt down}{Lbutton down}
  KeyWait, MButton
  Send {Alt up}{Lbutton up} 
Return

#IfWinActive ahk_exe Substance Painter.exe
  WheelUp::Send {WheelDown}
  WheelDown::Send {WheelUp}
Return

#IfWinActive ahk_exe Photoshop.exe
  ; #=window, !=alt, ^=ctrl
  #!LButton::#!RButton
  !^RButton::!^LButton

MButton::
  Send {Space down}{LButton down}
  KeyWait, MButton

  Send {Space up}{LButton up}
Return

#IfWinActive ahk_exe sai2.exe
  #!LButton::^!LButton
  Esc::Send +{Home}

^LButton::
  Send {Shift down}{Ctrl down}{LButton down}
  KeyWait, LButton

  Send {Shift up}{Ctrl up}{LButton up}
Return

#IfWinActive ahk_exe sai2.exe
MButton::
  Send {Space down}{LButton down}
  KeyWait, MButton

  Send {Space up}{LButton up}
Return

#IfWinActive ahk_exe ZBrush.exe
MButton:: 
  Loop{
    GetKeyState, state, Alt
    If state = D
      Break

    else

    Send {Alt down}{Rbutton down}
    KeyWait, MButton

    Send {RButton Up}
    Sleep, 1
    Send {alt up}
    Return
  }
Return

#IfWinActive ahk_exe ZBrush.exe
!MButton:: 
  Send {Rbutton down}
  KeyWait, MButton
  Send {RButton Up}
Return

#IfWinActive ahk_exe maya.exe
  Mbutton::!MButton
  !Mbutton:: !LButton
Return

#IfWinActive ahk_exe Photoshop.exe
$^z::
  while(GetKeyState("CTRL", "p") && GetKeyState("z", "p"))
  {
    If (A_TimeSinceThisHotkey < 250)
    {
      Sendinput ^z
      sleep, 250
    }
    else
    {
      SendInput ^z
      Sleep, 100
    }
  }
Return

#IfWinActive ahk_exe Photoshop.exe
$^y::
  While (GetKeyState("CTRL", "p") && GetKeyState("y", "p"))
  {
    If (A_TimeSinceThisHotkey < 250)
    {
      Sendinput ^y
      sleep, 250
    }
    else
    {
      SendInput ^y
      Sleep, 100
    }
  }
Return

#IfWinActive ahk_exe InDesign.exe
MButton::
  Send {Space down}{LButton down}
  KeyWait, MButton

  Send {Space up}{LButton up}
Return

#IfWinActive ahk_exe ffxiv_dx11.exe
NumpadEnd::l


NumpadAdd:: 
  Send {CtrlDown}{F1}
  KeyWait, NumpadAdd
  Send {CtrlUp}
Return

+NumpadAdd::
  Send {CtrlDown}{F4}
  KeyWait, NumpadAdd
  Send {CtrlUp}
Return

NumpadEnter::
  Send {CtrlDown}{F2}
  KeyWait, NumpadEnter
  Send {CtrlUp}
Return

NumLock::Return

NumpadSub::
  Send {CtrlDown}{F3}
  KeyWait, NumpadSub
  Send {CtrlUp}
Return

+NumpadSub::
  Send {CtrlDown}{F5}
  KeyWait, NumpadSub
  Send {CtrlUp}
Return

NumpadMult::
  Send {CtrlDown}{F6}
  KeyWait, NumpadMult
  Send {CtrlUp}
Return

Numpad0::
  Send {CtrlDown}{F7}
  KeyWait, Numpad0
  Send {CtrlUp}
Return

NumpadDot::
  Send {CtrlDown}{F8}
  KeyWait, NumpadDot
  Send {CtrlUp}
Return 

#G::
  Send {AltDown}{F12}
  KeyWait, G
  Send {AltUp}
Return

NumpadDel::
  SendInput, {Shift Up}={Shift Down}
Return

Return

```