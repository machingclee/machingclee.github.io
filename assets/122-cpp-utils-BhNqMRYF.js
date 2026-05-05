const n=`---
title: "C++ Useful Util Functions Mimiced from Python, Regular Expression"
date: 2023-02-09
id: blog0122
tag: C++
intro: "Record useful utility functions that I have found during my project on desktop app in C++."
---

### Python's \`print\`

\`\`\`cpp
#include <string>
#include <vector>
#include <iostream>

std::vector<std::string> split(std::string text, std::string space_delimiter = " ");

template <class F, class First, class... Rest>
void do_for(F f, First first, Rest... rest) {
    f(first);
    do_for(f, rest...);
}
template <class F>

void do_for(F f) {
    std::cout << "\\n";
}

template <class... Args>
void print(Args... args) {
    do_for([](auto& arg) {
        std::cout << arg;
    },
           args...);
}
\`\`\`

### Python's \`os.sep\`

\`\`\`cpp
std::string get_os_sep() {
#ifdef _WIN32
    return '\\\\';
#else
    return '/';
#endif
}
\`\`\`

### Python's \`z_fill\`

\`\`\`cpp
#include <sstream>
#include <iomanip>

std::string z_fill(int n, int numberOfLeadingZeros) {
    std::ostringstream s;
    s << std::setw(numberOfLeadingZeros) << std::setfill('0') << n;
    return s.str();
}
\`\`\`

### Python's \`os.listdir\`

\`\`\`cpp
#include <string>
#include <iostream>
#include <filesystem>
#include <vector>

std::vector<std::string> list_dir(std::string directory_path) {
    std::vector<std::string> file_paths;
    for (const auto& entry : fs::directory_iterator(directory_path)) {
        file_paths.push_back(entry.path());
    }
    return file_paths;
}
\`\`\`

### Python's \`String.split()\`

\`\`\`cpp
#include <string>
#include <vector>

std::vector<std::string> split(std::string text, std::string space_delimiter) {
    bool hasNext = false;
    std::vector<std::string> words{};
    do {
        size_t nextPos = text.find(space_delimiter);
        hasNext = (nextPos != std::string::npos);
        words.push_back(text.substr(0, nextPos));
        text.erase(0, nextPos + space_delimiter.length());
    } while (hasNext);
    return words;
}
\`\`\`

### Regular Expression and Exhaust all Possible Matchings

**Situation.** There will be files called \`recording000001.avi\`, \`recording000002.avi\` among a list of files inside a directory. We need to find out all these \`avi\` files, sort the digits, and produce \`000003\` as a counter for the next \`.avi\` file.

\`\`\`cpp
#include <regex>
#include <algorithm>

std::string get_file_next_digit(std::string dir, std::string file_ext) {
    std::string sep = get_os_sep();
    std::regex number_regex("(\\\\d+)(?=\\\\." + file_ext + ")");
    std::vector<std::string> file_paths = list_dir(dir);
    std::vector<int> integers;

    // for each file_path, we split them by sep, get the last string,
    // then exhaust all the matchings
    for (std::string& file_path : file_paths) {
        std::vector<std::string> results = split(file_path, sep);
        std::string file_name = results.back();

        std::sregex_iterator current_match(file_name.begin(), file_name.end(), \\
          number_regex);
        std::sregex_iterator lastMatch;

        while (current_match != lastMatch) {
            std::smatch match = *current_match;
            int num = std::stoi(match.str());
            integers.push_back(num);
            current_match++;
        }
    }

    if (integers.size() > 0) {
        std::sort(integers.begin(), integers.end());
        std::string next_number = z_fill(integers[integers.size() - 1] + 1, 6);
        return next_number;
    } else {
        return z_fill(0, 6);
    }
}
\`\`\`
`;export{n as default};
