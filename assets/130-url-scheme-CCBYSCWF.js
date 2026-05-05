const e=`---
title: "Register URL Scheme for an Application"
date: 2023-04-06
id: blog0130
tag: C++
intro: "We study how to register a custom url protocol to launch our desktop application."
toc: true
---

### Library we Use

- [WinReg v6.1.0](https://github.com/GiovanniDicanio/WinReg)

### Code Implementation

In fact we just need the header file in \`WinReg/WinReg.hpp\`, we can create a cmake project and simply include this file.

Now to register the application to a url scheme:

\`\`\`cpp
// header

#pragma once
#include "WinReg.h"
#include <string>

namespace RegisterProtocol
{
    inline std::wstring to_wide_string(const std::string& input);
    inline std::string to_byte_string(const std::wstring& input);
    void register_protocol(std::string app_path);
} // namespace RegisterProtocol
\`\`\`

\`\`\`cpp
// source

namespace RegisterProtocol
{

    inline std::wstring to_wide_string(const std::string& input)
    {
        std::wstring_convert<std::codecvt_utf8<wchar_t>> converter;
        return converter.from_bytes(input);
    }

    inline std::string to_byte_string(const std::wstring& input)
    {
        // std::wstring_convert<std::codecvt_utf8_utf16<wchar_t>> converter;
        std::wstring_convert<std::codecvt_utf8<wchar_t>> converter;
        return converter.to_bytes(input);
    }

    void register_protocol(std::string exe_path)
    {
        std::wstring w_app_path = to_wide_string(exe_path);
        RegKey key;
        key.Create(HKEY_CURRENT_USER, L"Software\\\\Classes\\\\eyecatcher", KEY_CREATE_SUB_KEY);
        key.Open(HKEY_CURRENT_USER, L"Software\\\\Classes\\\\eyecatcher", KEY_SET_VALUE);
        key.SetStringValue(L"URL Protocol", L"");

        key.Create(HKEY_CURRENT_USER, L"Software\\\\Classes\\\\eyecatcher\\\\shell\\\\open\\\\command", KEY_CREATE_SUB_KEY);
        key.Open(HKEY_CURRENT_USER, L"Software\\\\Classes\\\\eyecatcher\\\\shell\\\\open\\\\command", KEY_SET_VALUE);
        key.SetStringValue(L"", w_app_path);
    }
} // namespace RegisterProtocol
\`\`\`

### What is it Doing

- \`\`\`cpp
  key.Create(HKEY_CURRENT_USER, L"Software\\\\Classes\\\\eyecatcher\\\\shell\\\\open\\\\command")
  \`\`\`

  means that at the folder \`HKEY_CURRENT_USER\`, we create a nested folder structure as instructed.

- \`\`\`cpp
  key.Open(HKEY_CURRENT_USER, L"Software\\\\Classes\\\\eyecatcher", KEY_SET_VALUE);
  \`\`\`

  simply changes the current working "directory" to

  - \`HKEY_CURRENT_USER\\Software\\Classes\\eyecatcher\`

  and grant the desired access right: \`KEY_SET_VALUE\`.

- \`\`\`cpp
  key.SetStringValue(std::wstring key, std::wstring value)
  \`\`\`

  is the same as setting key-value pair at the current working registry folder. We use \`wstring\` instead of \`string\` for non-ascii characters.

  For example, what

  \`\`\`cpp
  key.Open(HKEY_CURRENT_USER, L"Software\\\\Classes\\\\eyecatcher", KEY_SET_VALUE);
  key.SetStringValue(L"URL Protocol", L"")
  \`\`\`

  does is to create a new key-value pair at the directory:

  - \`HKEY_CURRENT_USER\\Software\\Classes\\eyecatcher\`

  In the GUI of registry editor we have:

  <Center>
  <img src="/assets/tech/130/registry.png" width="600"/>
  </Center>
  <p></p>
  <center></center>

  Here \`exe_path\` is the path of the executable that we want to launch.

- Now an anchor element
  \`\`\`html
  <a href="eyecatcher://">eye-catcher protocol</a>
  \`\`\`
  can trigger the execution of our target \`.exe\` file.
`;export{e as default};
