const e=`---
title: Pandoc
date: 2022-04-29
id: blog067
tag: latex
intro: Write latex document using markdown in vscode.
toc: false
---

Traditonal $\\LaTeX$ software compiles our \`.tex\` file into \`.div\`, \`.log\`, \`.out\`, \`aux\`, etc, files along with our target file \`.pdf\`, if we were to generate several separated reports it will be an headache seeing all these files in the same directory.

With pandoc + markdown, it results in only one single pdf file. Most importantly, everyone can change the md file and preview the change in the previewer without converting it into a pdf.

To enable this feature, install \`vscode-pandoc\` extension in vscode, install \`pandoc\` as in the instruction, then we can try to compile the following!

\`\`\`text
---
documentclass: article
fontsize: 11pt
header-includes: |
    \\usepackage{amsmath}
    \\usepackage{amsfonts}
    \\usepackage{amssymb}
    \\usepackage{color}
    \\usepackage{graphicx}
    \\usepackage[left=2cm,right=2cm,top=2cm,bottom=2cm]{geometry}
    \\usepackage{hyperref}
    \\usepackage{array}
    \\usepackage{enumitem}
    \\usepackage{graphbox}
    \\usepackage{float}
    \\usepackage{multicol}
    \\thispagestyle{empty}
    \\usepackage[htt]{hyphenat}
    \\usepackage{fancyvrb}
    \\RecustomVerbatimEnvironment{verbatim}{Verbatim}{fontsize=\\footnotesize}
---

# I am

James! $\\int_a^b f(x)\\,dx$.
\`\`\`

Finally by pressing F1 -> Pandoc Render -> pdf, we are done! A single \`.pdf\` file will be generated in the same directory.

In case we want a beamer presentation:

\`\`\`text
---
documentclass: beamer
fontsize: 12pt
header-includes: |
    \\usetheme{Boadilla}
    \\usepackage{amsmath}
    \\usepackage{amsfonts}
    \\usepackage{listings}
    \\usepackage{amssymb}
    \\usepackage{color}
    \\usepackage{graphicx}
    \\usepackage{hyperref}
    \\usepackage{array}
    \\usepackage{enumitem}
    \\usepackage{graphbox}
    \\usepackage{float}
    \\usepackage{multicol}
    \\usepackage[htt]{hyphenat}
    \\usepackage{pifont}
    \\usepackage{fancyvrb}
    \\RecustomVerbatimEnvironment{verbatim}{Verbatim}{fontsize=\\footnotesize}
---
\`\`\`

with beamer tutorial: https://www.overleaf.com/learn/latex/Beamer
`;export{e as default};
