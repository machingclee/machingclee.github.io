const n=`---
title: $\\LaTeX$ template
date: 2021-09-10
id: blog0028
tag: latex
intro: Record some starting template that I made in the past.
toc: false
---

### Basic Article in xeLaTeX




\`\`\`latex
\\documentclass[12pt,a4paper]{article}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage[dvipsnames]{xcolor}
\\usepackage{graphicx}
\\usepackage[left=2.4cm,right=2.4cm,top=2cm]{geometry}
\\usepackage{hyperref}
\\usepackage{array}
\\usepackage{enumitem}
\\usepackage{graphbox}
\\usepackage{float}
\\usepackage[AutoFakeSlant=0.1, AutoFakeBold=true]{xeCJK}
\\setCJKmainfont{SimSun}
\\usepackage{multicol}
\\linespread{1.4}
\\thispagestyle{empty}

\\begin{document}


\\end{document}
\`\`\`

### Math in Times with Adjusted BigOp Symbols

\`\`\`text
\\documentclass[10pt,twocolumn,landscape,a4paper]{article}

\\usepackage{xr}
\\newcommand{\\abs}[1]{\\left|#1\\right|}


\\usepackage[left=1.2cm,right=1.2cm,top=1.2cm,bottom=1.2cm]{geometry}
\\setlength{\\columnsep}{3cm}
\\setlength{\\columnseprule}{0.3pt}
\\pagestyle{empty}
\\let\\parindentt\\parindent
\\setlength{\\parindent}{20pt}




\\usepackage{marvosym}
\\usepackage{ntheorem}
\\usepackage{comment,boxedminipage,framed,color,pifont,enumitem,amsmath,amsfonts,extarrows,mathtools,color,multicol,tikz,comment,wasysym}
\\usetikzlibrary{arrows,patterns}
\\usepackage{tikz}


\\usepackage{mathptmx}

\\usepackage{bm}




\\SetSymbolFont{largesymbols}{normal}{OMX}{lmex}{m}{n}
\\SetSymbolFont{largesymbols}{bold}{OMX}{lmex}{m}{n}

\\DeclareSymbolFont{operators}{OT1}{txr}{m}{n}
\\SetSymbolFont{operators}{bold}{OT1}{txr}{bx}{n}
\\def\\operator@font{\\mathgroup\\symoperators}
\\DeclareSymbolFont{italic}{OT1}{ntxr}{m}{it}
\\SetSymbolFont{italic}{bold}{OT1}{ntxr}{bx}{it}
\\DeclareSymbolFontAlphabet{\\mathrm}{operators}
\\DeclareMathAlphabet{\\mathbf}{OT1}{ntxr}{bx}{n}
\\DeclareMathAlphabet{\\mathit}{OT1}{ntxr}{m}{it}
\\SetMathAlphabet{\\mathit}{bold}{OT1}{txr}{bx}{it}
\\DeclareSymbolFont{letters}{OML}{ntxmi}{m}{it}
\\SetSymbolFont{letters}{bold}{OML}{ntxmi}{bx}{it}
\\DeclareFontSubstitution{OML}{txmi}{m}{it}
\\DeclareSymbolFont{lettersA}{U}{txmia}{m}{it}
\\SetSymbolFont{lettersA}{bold}{U}{txmia}{bx}{it}
\\DeclareFontSubstitution{U}{txmia}{m}{it}
\\DeclareSymbolFontAlphabet{\\mathfrak}{lettersA}
\\DeclareSymbolFont{symbols}{OMS}{txsy}{m}{n}
\\SetSymbolFont{symbols}{bold}{OMS}{txsy}{bx}{n}
\\DeclareFontSubstitution{OMS}{txsy}{m}{n}





\\DeclareFontFamily{U}{MnSymbolA}{}
\\DeclareFontShape{U}{MnSymbolA}{m}{n}{
<-6> MnSymbolA5
<6-7> MnSymbolA6
<7-8> MnSymbolA7
<8-9> MnSymbolA8
<9-10> MnSymbolA9
<10-12> MnSymbolA10
<12-> MnSymbolA12}{}
\\DeclareFontShape{U}{MnSymbolA}{b}{n}{
<-6> MnSymbolA-Bold5
<6-7> MnSymbolA-Bold6
<7-8> MnSymbolA-Bold7
<8-9> MnSymbolA-Bold8
<9-10> MnSymbolA-Bold9
<10-12> MnSymbolA-Bold10
<12-> MnSymbolA-Bold12}{}
\\DeclareSymbolFont{MnSyA} {U} {MnSymbolA}{m}{n}
\\DeclareMathSymbol{\\rtar}{3}{MnSyA}{8} 
\\DeclareMathSymbol{\\ltar}{3}{MnSyA}{10} 
\\DeclareMathSymbol{\\eq}{3}{MnSyA}{212}  
\\renewcommand{\\Rightarrow}{\\rtar}
\\renewcommand{\\Leftarrow}{\\ltar}
\\renewcommand{\\implies}{\\;\\mathrel{\\eq\\!\\!\\Rightarrow}\\;}





\\makeatother
   
\\DeclareFontFamily{U}{mathx}{\\hyphenchar\\font45}
\\DeclareFontShape{U}{mathx}{m}{n}{
      <5> <6> <7> <8> <9> <10> gen * mathx
      <10.95> mathx10 <12> <14.4> <17.28> <20.74> <24.88> mathx12
      }{}
\\DeclareSymbolFont{mathx}{U}{mathx}{m}{n}
\\DeclareMathSymbol{\\summ}{\\mathop}{mathx}{"B0}
\\DeclareMathSymbol{\\prodd}{\\mathop}{mathx}{"B1}
\\renewcommand{\\sum}{\\summ}
\\renewcommand{\\prod}{\\prodd}


\\DeclareSymbolFont{lettersA}{U}{txmia}{m}{it}
\\DeclareMathSymbol{\\varv}{\\mathord}{lettersA}{51}
\\DeclareMathSymbol{\\varw}{\\mathord}{lettersA}{52}
\\mathcode\`v="8000
\\begingroup
\\makeatletter
\\lccode\`\\~=\`\\v
\\lowercase{\\gdef~{\\ifmmode \\varv\\else v \\fi}}%
\\endgroup
\\mathcode\`w="8000
\\begingroup
\\makeatletter
\\lccode\`\\~=\`\\w
\\lowercase{\\gdef~{\\ifmmode \\varw\\else w \\fi}}%
\\endgroup





\\newcommand{\\ul}[1]{\\underline{\\smash{#1}}}



\\renewcommand{\\labelenumi}{(\\alph{enumi})}
\\renewcommand{\\labelenumii}{(\\roman{enumii})}


\\newcommand{\\C}{\\mathbb{C}}
\\newcommand{\\dis}{\\displaystyle}
\\newcommand{\\N}{\\mathbb{N}}
\\newcommand{\\Q}{\\mathbb{Q}}
\\newcommand{\\R}{\\mathbb{R}}
\\newcommand{\\Z}{\\mathbb{Z}}
\\renewcommand{\\O}{\\mathcal{O}}
\\renewcommand{\\L}{\\mathcal L}
\\newcommand{\\ol}[1]{\\overline{#1}}

\\newcommand{\\LIM}{\\mathop{\\mathrm{LIM}}}
\\newcommand{\\lims}{\\mathop{\\overline{\\lim}}}
\\newcommand{\\limi}{\\mathop{\\underline{\\lim}}}
\\newcommand{\\limn}{\\lim_{n\\to\\infty}}
\\newcommand{\\limsn}{\\lims_{n\\to\\infty}}
\\newcommand{\\limin}{\\limi_{n\\to\\infty}}

\\newcommand{\\enu}[1]{\\begin{enumerate}#1\\end{enumerate}}
\\newcommand{\\alignn}[1]{\\begin{align*}#1\\end{align*}}
\\newcommand{\\brac}[1]{\\bigg(#1\\bigg)}
\\newcommand{\\toto}{\\rightrightarrows}
\\newcommand{\\upto}{\\nearrow}
\\newcommand{\\downto}{\\searrow}

\\usepackage{sansmath}

\\theoremseparator{{\\normalsize.}}
\\theoremheaderfont{\\normalfont\\sffamily\\bfseries}
\\theorembodyfont{\\upshape}
\\theoremindent=\\parindent
\\theoremheaderfont{\\kern-\\parindent\\normalfont\\sffamily\\bfseries} 

\\newtheorem{thm}{Theorem}



\\newtheorem{coro}[thm]{Corollary}


\\theorembodyfont{\\upshape}
\\theoremindent=0cm
\\theoremheaderfont{\\kern\\parindent\\sffamily\\bfseries}
\\theoremprework{
\\setlist[1]{leftmargin=1.8\\parindent}
}
\\newtheorem{pro}{\\sffamily\\hspace{-3.5pt}}
\\theoremheaderfont{\\kern0pt\\bfseries\\sffamily}

\\newtheorem{ex}{Example}
\\usepackage{xparse}
\\ExplSyntaxOn
\\NewDocumentEnvironment{exam}{o}
{\\IfNoValueTF{#1}
{\\begin{ex}\\begin{framed}}{\\begin{ex}[#1]\\begin{framed}}
\\ignorespaces
}
{\\end{framed}\\end{ex}}
\\ExplSyntaxOff

\\newtheorem{examm}[ex]{*Example}
\\theoremheaderfont{\\kern0pt\\normalfont\\sffamily\\bfseries}
\\newtheorem{exer}{Exercise}

\\theoremindent=\\parindent
\\theoremheaderfont{\\kern-\\parindent\\normalfont\\sffamily\\bfseries}
\\newtheorem{defi}[thm]{Definition}

\\theoremstyle{nonumberplain}
\\theoremindent=0cm
\\theoremheaderfont{\\kern0cm\\normalfont\\sffamily\\bfseries} 

\\newtheorem{proof}{Proof}

\\theoremseparator{}
\\theoremindent20pt
\\theorembodyfont{\\small}
\\theoremprework{\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.1in}}
\\newtheorem{sol}{\\kern -20 pt {\\normalsize \\underline{\\smash{\\normalfont Sol}}}}
\\theoremindent20pt

\\theoremseparator{{\\normalsize.}}
\\theoremindent\\parindent
\\theorembodyfont{\\upshape}
\\theoremprework{\\small\\begin{sansmath}\\sffamily}
\\theorempostwork{\\end{sansmath}}
\\newtheorem{remark}{\\kern-\\parindent{\\normalsize\\sffamily Remark}}
\\theoremindent0pt
\\theoremprework{
    \\setlength\\theorempreskipamount{0.2cm}
    \\setlength\\theorempostskipamount{0.2cm}
    \\small\\begin{sansmath}\\sffamily
}
\\theorempostwork{\\end{sansmath}}
\\newtheorem{remarkk}{{\\normalsize\\sffamily Remark}}
\\theoremseparator{}
\\theoremprework{
    \\setlength\\theorempreskipamount{0.2cm}
    \\setlength\\theorempostskipamount{0.2cm}
    \\small\\begin{sansmath}\\sffamily
}
\\theorempostwork{\\end{sansmath}}
\\newtheorem{hint}{\\normalsize\\sffamily Hint:}
\\makeatletter
\\def\\vhrulefill#1{\\leavevmode\\leaders\\hrule\\@height#1\\hfill \\kern\\z@}
\\makeatother
\\def\\headline#1{\\hbox to \\hsize{\\vhrulefill{0.8pt}\\;\\;\\lower.3em\\hbox{#1}\\;\\;\\vhrulefill{0.8pt}}}
\\setlength\\theorempreskipamount{0.5cm}
\\setlength\\theorempostskipamount{0.5cm}
\\usepackage[hang]{footmisc}
\\renewcommand{\\thempfootnote}{(\\fnsymbol{mpfootnote})}
\\renewcommand{\\thefootnote}{(\\fnsymbol{footnote})}
\\renewcommand{\\matrix}[1]{\\begin{bmatrix}#1\\end{bmatrix}}
\\newcommand{\\matrixx}[1]{\\begin{bmatrix}#1\\end{bmatrix}}
\\newcommand{\\cupp}{\\bigcup}
\\newcommand{\\capp}{\\bigcap}
\\newcommand{\\sqcupp}{\\bigsqcup}
\\theoremheaderfont{\\normalfont\\sffamily\\bfseries} 
\\theoremstyle{plain}
\\usepackage{cases}
\\usepackage{sectsty}
\\allsectionsfont{\\sffamily}
\\theoremseparator{.}
\\theoremstyle{nonumberplain}
\\theoremindent\\parindent
\\theoremheaderfont{\\kern-\\parindent\\normalfont\\sffamily\\bfseries} 
\\newtheorem{rulee}[thm]{Rules}


\\newcommand{\\sitemi}{\\stepcounter{enumi}\\item[\${}^*$\\bfseries\\sffamily\\theenumi.]}
\\newcommand{\\sitemii}{\\stepcounter{enumii}\\item[\${}^*$(\\theenumii)]}



\\newcommand{\\qed}{\\rlap{$\\qquad \\rule{0.35em}{0.7em}$}}
\`\`\``;export{n as default};
