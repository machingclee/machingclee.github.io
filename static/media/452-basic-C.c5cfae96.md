---
title: "C Fundamentals"
date: 2026-01-09
id: blog0452
tag: C
toc: true
intro: "Fundamentals of C Programming"
---
<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>


### Permissions via Bitwise Flags

First we need to know the meaning of the following ***bitwise flags***:

```text
4 = read (r)
2 = write (w)
1 = execute (x)
```
So a number `6 = 4 + 2` means READ and WRITE, which is also represented by `O_RDWR` in C.


Usually a permission to a file is represented by the combination `owner-group-usr` format, for example:

```text
0644  // rw-r--r--  (files: owner writes, everyone reads)
0755  // rwxr-xr-x  (executables: owner full, others read+execute)
0600  // rw-------  (private files: only owner can access)
0777  // rwxrwxrwx  (everyone can do everything - rarely used)
```
In mac this number is actually `owner-staff-others`, we can check all the groups in our system via command `groups`, by which I get 

```text
staff everyone localaccounts _appserverusr admin _appserveradm 
_lpadmin _appstore _lpoperator _developer _analyticsusers 
com.apple.access_ftp com.apple.access_screensharing 
com.apple.access_ssh com.apple.access_remote_ae
```
All the users that can log into this mac machine are classified into `staff`. The following are not of group `staff`:


- `root` (superuser) - in wheel group
- `nobody` - unprivileged account
- `_www` - web server user
- `_mysql` - database user
- `_spotlight` - spotlight indexing
- `_windowserver` - window server process
- And many other `_` prefixed system accounts


### `ls -l`

Now an `ls -l` (`l` stands for long format) command to a file gives 

```text
-rw-r--r--  1 chingcheonglee  staff  1024 Jan 9 12:00 main.c
│          │ │                │      │    │         │
│          │ │                │      │    │         └─ filename
│          │ │                │      │    └─────────── timestamp
│          │ │                │      └──────────────── size (bytes)
│          │ │                └─────────────────────── group
│          │ └──────────────────────────────────────── owner
│          └───────────────────────────────────────── number of links
└──────────────────────────────────────────────────── permissions
```

Which shows that this file has mode number `0644`, with staff being `4` and with other mata data.

In C we cannot omit `0` as it tells the compiler this number is in octal format. 

But in other linux command such as `chmod 644 some_file.sh` the omission is ***acceptable*** because the command is written smart enough to assume octal when you give it a 3-digit number.

Files downloaded from the internet are by default `0644`. That's why sometimes we need to explicitly execute `chmod 0744` to make a script executable.

### Formatting in VSCode

In `settings.json`:

```json
    "C_Cpp.clang_format_fallbackStyle": "{ BasedOnStyle: LLVM, UseTab: Never, IndentWidth: 4, TabWidth: 4, BreakBeforeBraces: Attach, AllowShortIfStatementsOnASingleLine: false, IndentCaseLabels: false, ColumnLimit: 0, AccessModifierOffset: -4, PointerAlignment: Left, SortIncludes: false, Cpp11BracedListStyle: false, NamespaceIndentation: All, AlignAfterOpenBracket: DontAlign, AlignConsecutiveAssignments: Consecutive}",
```
