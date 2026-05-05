const n=`---
title: Variadic Version of Print in C++
date: 2022-12-09
id: blog0115
tag: C++
toc: false
intro: Record a useful print function which behaves like \`console.log\` in javascript and \`print\` in python.
---

\`\`\`cpp
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
    }, args...);
}
\`\`\`
`;export{n as default};
