const n=`---
title: Auto Hotkey Record
date: 2021-10-17
id: blog033
tag: coding, autohotkey
intro: A record of my latest autohotkey setup for different applications.
toc: false
---

### Modifier Keys

- \`^\` Control Key
- \`#\` Windows Key
- \`+\` Shift
- \`!\` Alt

### My Usages

\`\`\`autohotkey
KeyWait, Shift
KeyWait, LWin
KeyWait, RWin

#NoEnv
#SingleInstance
#MaxHotkeysPerInterval 3000

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

^space::#space
+WheelDown::WheelLeft
+WheelUp::WheelRight


#If !(WinActive("ahk_exe ffxiv_dx11.exe"))
!1::
Run %comspec% /k code "C:\\Users\\machingclee\\Repos\\wonderbricks\\2024-02-03-wb-billie-mobile",, Hide
return
!2::
Run %comspec% /k code "C:\\Users\\machingclee\\Repos\\wonderbricks\\2024-02-03-wb-billie-web",, Hide
return
!3::
Run %comspec% /k code "C:\\Users\\machingclee\\Repos\\wonderbricks\\2024-02-03-wonderbricks-wiki",, Hide
return
!4::
Run %comspec% /k code "C:\\Users\\machingclee\\Repos\\wonderbricks\\2024-02-03-wb-backend-node",, Hide
return
!9::
Run %comspec% /k code "C:\\Users\\machingclee\\Repos\\freelance\\2024-07-30-Alice-Timetable-System-Frontend" && code "C:\\Users\\machingclee\\Repos\\freelance\\2024-07-30-Alice-Timetable-System-Backend",, Hide
return
!0::
Run %comspec% /k code "C:\\Users\\machingclee\\Repos\\2024-02-18-blogs\\machingclee.github.io.source\\app",, Hide
return
!-::
Run %comspec% /k code "C:\\Users\\machingclee\\Repos\\javascript\\2024-03-18-react-pdf-rerender-CV-generation",, Hide
!Numpad1::
Run %comspec% /k code "C:\\Users\\machingclee\\Repos\\freelance\\2024-07-30-Alice-Timetable-System-Frontend",, Hide
return
!Numpad2::
Run %comspec% /k idea "C:\\Users\\machingclee\\Repos\\freelance\\2024-11-23-Alice-Tiemtable-System-Kotlin",, Hide
return
#If





#Up::
  Send {LWin down}{Tab down}
  KeyWait, Up
  Send {LWin up}{Tab up}
return

^#A:: Winset, Alwaysontop, , A

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

#If !(WinActive("ahk_exe ffxiv_dx11.exe") or WinActive("ahk_exe Photoshop.exe") or WinActive("ahk_exe chrome.exe") or WinActive("ahk_exe Code.exe") or WinActive("ahk_exe idea64.exe") or WinActive("ahk_exe TablePlus.exe"))
^w::
Send !{Space}n
Return
#If




#IfWinActive ahk_exe Unity.exe
  !MButton:: !LButton
  Return
#ifWinActive

#IfWinActive ahk_exe Substance Painter.exe
  #!LButton::
    Send {Ctrl down}{RButton down}
    KeyWait, LButton
    Send {Ctrl up}{RButton up}
  Return

  MButton::
    Send {Ctrl down}{Alt down}{Lbutton down}
    KeyWait, MButton
    Send {Ctrl up}{Alt up}{Lbutton up}
  Return

  !MButton::
    Send {Alt down}{Lbutton down}
    KeyWait, MButton
    Send {Alt up}{Lbutton up}
  Return

  WheelUp::Send {WheelDown}
  WheelDown::Send {WheelUp}
  Return
#ifWinActive

#IfWinActive ahk_exe sai2.exe
  #!LButton::^!LButton
  Esc::Send +{Home}

  ^LButton::
    Send {Shift down}{Ctrl down}{LButton down}
    KeyWait, LButton

    Send {Shift up}{Ctrl up}{LButton up}
  Return

  MButton::
    Send {Space down}{LButton down}
    KeyWait, MButton

    Send {Space up}{LButton up}
  Return
#ifWinActive

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

  !MButton::
    Send {Rbutton down}
    KeyWait, MButton
    Send {RButton Up}
  Return
#ifWinActive

#IfWinActive ahk_exe maya.exe
  Mbutton::!MButton
  !Mbutton:: !LButton
  Return
#IfWinActive

#IfWinActive ahk_exe Photoshop.exe
  MButton::
    Send {Space Down}
    Send {LButton Down}
    KeyWait, MButton
    Send {LButton Up}
    Send {Space Up}
  Return
#IfWinActive

#IfWinActive ahk_exe Photoshop.exe
  #!LButton::#!RButton
  !^RButton::!^LButton
#IfWinActive

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
#IfWinActive

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
#ifWinActive

#IfWinActive ahk_exe InDesign.exe
  MButton::
    Send {Space down}{LButton down}
    KeyWait, MButton

    Send {Space up}{LButton up}
  Return
#ifWinActive

#IfWinActive ahk_exe ffxiv_dx11.exe
  NumpadEnd::l


  NumpadSub::
    Send {CtrlDown}{F1}
    KeyWait, NumpadSub
    Send {CtrlUp}
  Return

  NumpadEnter::
    Send {CtrlDown}{F2}
    KeyWait, NumpadEnter
    Send {CtrlUp}
  Return

  NumpadMult::
    Send {CtrlDown}{F3}
    KeyWait, NumpadMult
    Send {CtrlUp}
  Return


  NumpadAdd::
    Send {CtrlDown}{F4}
    KeyWait, NumpadAdd
    Send {CtrlUp}
  Return

  NumLock::Return

  Numpad0::
    Send {CtrlDown}{F7}
    KeyWait, Numpad0
    Send {CtrlUp}
  Return

  NumpadDiv::
    Send {CtrlDown}{F6}
    KeyWait, NumpadDiv
    Send {CtrlUp}
  Return


  NumpadDot::
    Send {CtrlDown}{F5}
    KeyWait, NumpadDot
    Send {CtrlUp}
  Return

  #G::
    Send {AltDown}{F12}
    KeyWait, G
    Send {AltUp}
  Return

  NumpadDel::
    SendInput, {Shift Down}={Shift Up}
  Return
#ifWinActive
\`\`\`
`;export{n as default};
