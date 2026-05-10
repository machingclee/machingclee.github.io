const n=`---
title: "$\\LaTeX$ Ad-Hoc Styling"
date: 2026-05-09
id: blog0493
tag: react
toc: true
intro: "Study sitemap for SEO"
indent: true
---
<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
  table td:first-child, table th:first-child {
    min-width: 120px;
  }
</style>

### Prerequisites 


Make sure you have downloaded 

- MikTeX and;
- Any \`TeX\` Editor.

The following settings in \`preamble\` may not apply to online editor such as OverLeaf.

### Style 1: \`mathptmx\` + \`mathabx\` + Borrow from \`txfonts\`

#### Preview

![](/assets/img/2026-05-10-18-52-46.png)

#### Preamble

\`\`\`tex
\\documentclass[10pt,twocolumn,landscape,a4paper]{article}

\\usepackage[left=1.5cm,right=1.5cm,top=1.2cm,bottom=1.2cm]{geometry}
\\setlength{\\columnsep}{3cm}
\\setlength{\\columnseprule}{0.3pt}
\\pagestyle{empty}
\\let\\parindentt\\parindent
\\setlength{\\parindent}{20pt}




\\usepackage{marvosym}
\\usepackage{ntheorem}
\\usepackage{boxedminipage,color,pifont,enumitem,amssymb,amsmath,amsfonts,extarrows,mathtools,color,multicol,tikz,comment,wasysym}
\\usetikzlibrary{arrows}

\\usepackage{mathptmx}


\\newcommand\\hmmax{0} % default 3
\\newcommand\\bmmax{1} % default 4
\\usepackage{bm}

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
\\newcommand{\\brac}[1]{\\left(#1\\right)}
\\newcommand{\\toto}{\\rightrightarrows}
\\newcommand{\\upto}{\\nearrow}
\\newcommand{\\downto}{\\searrow}



\\theoremseparator{{\\normalsize.}}

\\theorembodyfont{\\upshape}
\\theoremindent=\\parindent
\\theoremheaderfont{\\kern-\\parindent\\normalfont\\bfseries\\sffamily} 

\\newtheorem{thm}{Theorem}
\\newtheorem{coro}[thm]{Corollary}
\\newtheorem{remarkk}[thm]{Remark}
\\theorembodyfont{\\upshape}
\\theoremindent=0cm
\\theoremheaderfont{\\kern0pt\\bfseries\\sffamily}
\\newtheorem{pro}{Problem}

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


\\newtheorem{exx}{*Example}
\\ExplSyntaxOn
\\NewDocumentEnvironment{eexam}{o}
{\\IfNoValueTF{#1}
{\\begin{exx}\\begin{framed}}{\\begin{exx}[#1]\\begin{framed}}
\\ignorespaces
}
{\\end{framed}\\end{exx}}
\\ExplSyntaxOff



\\theoremheaderfont{\\kern0pt\\normalfont\\bfseries\\sffamily}
\\newtheorem{exer}{Exercise}

\\theoremindent=\\parindent
\\theoremheaderfont{\\kern-\\parindent\\normalfont\\bfseries\\sffamily}
\\newtheorem{defi}[thm]{Definition}

\\theoremstyle{nonumberplain}
\\theoremindent=0cm
\\theoremheaderfont{\\kern0cm\\normalfont\\bfseries\\sffamily} 

\\newtheorem{proof}{Proof}


\\theoremindent20pt
\\theorembodyfont{\\small}
\\newtheorem{sol}{\\kern -20 pt {\\normalsize Solution}}
\\newtheorem{rmk}{\\kern -20 pt {\\normalsize Remark}}


\\theoremindent0pt
\\theorembodyfont{\\upshape}
\\newtheorem{remark}{Remark}


\\makeatletter
\\def\\vhrulefill#1{\\leavevmode\\leaders\\hrule\\@height#1\\hfill \\kern\\z@}
\\makeatother
\\def\\headline#1{\\hbox to \\hsize{\\vhrulefill{0.8pt}\\;\\;\\lower.3em\\hbox{#1}\\;\\;\\vhrulefill{0.8pt}}}




\\setlength\\theorempreskipamount{0.4cm}
\\setlength\\theorempostskipamount{0.4cm}

\\setlist{listparindent=\\parindent}


\\usepackage{framed}
\\definecolor{shadecolor}{gray}{.9}
\\makeatletter

\\renewenvironment{snugshade}{%
 \\def\\FrameCommand##1{\\hskip\\@totalleftmargin \\hskip-\\fboxsep
 \\colorbox{shadecolor}{##1}\\hskip-\\fboxsep
     % There is no \\@totalrightmargin, so:
     \\hskip-\\linewidth \\hskip-\\@totalleftmargin \\hskip\\columnwidth}%
 \\MakeFramed {\\advance\\hsize-\\width
   \\@totalleftmargin\\z@ \\linewidth\\hsize
   \\@setminipage}}%
 {\\par\\unskip\\endMakeFramed}

\\makeatother


\\newcommand{\\ntitle}[2]{
\\noindent \\textbf{\\sffamily Math3033 (Fall 2013-2014)\\hfill Tutorial Note #1}

\\medskip
\\noindent  {\\sffamily #2}

\\medskip 
\\headline{\\bfseries Key Definitions and Results}

}

\\newcommand{\\ntitlee}[2]{
\\noindent \\textbf{Math3033 (Fall 2013-2014)\\hfill Tutorial Note #1}

\\medskip
\\noindent  #2
}

\\usepackage[hang]{footmisc}
\\renewcommand{\\thempfootnote}{(\\fnsymbol{mpfootnote})}
\\renewcommand{\\thefootnote}{(\\fnsymbol{footnote})}

\\renewcommand{\\matrix}[1]{\\begin{bmatrix}#1\\end{bmatrix}}
\\newcommand{\\matrixx}[1]{\\begin{bmatrix}#1\\end{bmatrix}}


\\newcommand{\\cupp}{\\bigcup}
\\newcommand{\\capp}{\\bigcap}
\\newcommand{\\sqcupp}{\\bigsqcup}



\\theoremheaderfont{\\normalfont\\bfseries\\sffamily} 
\\theoremstyle{plain}

\\newtheorem{exerr}{Exercise}
\\newtheorem{exerrr}{}
\\usepackage{cases}

\\usepackage{sectsty}
\\allsectionsfont{\\sffamily}
\`\`\`

### Style 2: \`Calibri\` (Windows font) + \`Cambria Math\`

#### Preview

![](/assets/img/2026-05-10-18-58-05.png)

#### Preamble 


\`\`\`tex
\\documentclass[12pt,a4paper]{article}
\\usepackage[left=3cm,right=3cm,top=4.5cm,bottom=4cm]{geometry}
\\usepackage{xr}
\\usepackage{ntheorem}
\\setlength\\theorempreskipamount{0.5cm}
\\setlength\\theorempostskipamount{0.5cm}
\\externaldocument[1-]{MATH3033_notes_01}
\\externaldocument[2-]{MATH3033_notes_02}
\\externaldocument[3-]{MATH3033_notes_03}
\\externaldocument[4-]{MATH3033_notes_04}
\\externaldocument[5-]{MATH3033_notes_05}
\\externaldocument[6-]{MATH3033_notes_06}
\\externaldocument[7-]{MATH3033_notes_07}
\\externaldocument[8-]{MATH3033_notes_08}
\\externaldocument[9-]{MATH3033_notes_09}
\\externaldocument[10-]{MATH3033_notes_10}
\\externaldocument[11-]{MATH3033_notes_11}
\\externaldocument[12-]{MATH3033_notes_12}

\\usepackage{xcolor}

\\usepackage{framed,boxedminipage,pifont,enumitem,amsmath,amsfonts,amssymb,extarrows,multicol,tikz,comment,cancel,mathtools}
\\newcommand{\\ul}[1]{\\underline{\\smash{#1}}}
\\setlist[1]{leftmargin=2.2\\parindent}
\\usepackage{sectsty}
\\allsectionsfont{\\sffamily}

\\let\\upto\\nearrow
\\let\\downto\\searrow

\\usetikzlibrary{calc,through,snakes,patterns}
\\usetikzlibrary{shapes,arrows,decorations.markings}
\\newcommand{\\G}{\\mathcal G}
\\newcommand{\\C}{\\mathbb{C}}
\\newcommand{\\dis}{\\displaystyle}
\\newcommand{\\N}{\\mathbb{N}}
\\newcommand{\\Q}{\\mathbb{Q}}
\\newcommand{\\R}{\\mathbb{R}}
\\newcommand{\\Z}{\\mathbb{Z}}
\\newcommand{\\F}{\\mathbb{F}}
\\renewcommand{\\O}{\\mathcal{O}}
\\renewcommand{\\L}{\\mathcal L}
\\newcommand{\\E}{\\mathcal E}
\\newcommand{\\ol}[1]{\\overline{#1}}

\\newcommand{\\enu}[1]{\\begin{enumerate}#1\\end{enumerate}}
\\newcommand{\\alignn}[1]{\\begin{align*}#1\\end{align*}}
\\newcommand{\\cupp}{\\bigcup}
\\newcommand{\\capp}{\\bigcap}
\\newcommand{\\sqcupp}{\\bigsqcup}
\\newcommand{\\id}{\\mathrm{id}}
\\newcommand{\\abs}[1]{\\left|#1\\right|}

\\newcommand{\\brac}[1]{\\left(#1\\right)}

\\theoremseparator{.}

\\theorembodyfont{\\slshape}
\\setcounter{secnumdepth}{-1} 

\\theoremstyle{plain}
\\theoremheaderfont{\\kern\\parindent\\normalfont\\bfseries\\sffamily} 

\\newtheorem{thm}{Theorem}
\\makeatletter
\\let\\c@equation\\c@thm
\\makeatother


\\newtheorem{prop}[thm]{Proposition}
\\newtheorem{coro}[thm]{Corollary}
\\newtheorem{lem}[thm]{Lemma}
\\newtheorem*{claim}{Claim}
\\theorembodyfont{\\upshape}
\\theoremstyle{plain}
\\theoremheaderfont{\\kern\\parindent\\normalfont\\bfseries\\sffamily} 
\\newtheorem{pro}{\\hspace{-3.5pt}}
\\newtheorem{defi}[thm]{Definition}
\\theoremheaderfont{\\normalfont\\bfseries\\sffamily} 

\\theoremheaderfont{\\normalfont\\bfseries\\sffamily} 
\\newtheorem{ex}[thm]{Example}

\\usepackage{xparse}
\\ExplSyntaxOn
    \\NewDocumentEnvironment{exam} { o }
     {\\IfNoValueTF{#1}
     {\\begin{ex}\\begin{oframed}}{\\begin{ex}[#1]\\begin{oframed}}
     \\ignorespaces
     }
     {\\end{oframed}\\end{ex}}
\\ExplSyntaxOff

\\newcommand{\\examqed}{\\tag*{}}
\\theoremsymbol{\\ding{122}}

\\newtheorem{exx}[thm]{Example}

\\ExplSyntaxOn
    \\NewDocumentEnvironment{examm} { o }
     {\\IfNoValueTF{#1}
     {\\begin{exx}\\begin{oframed}}{\\begin{exx}[#1]\\begin{oframed}}
     \\ignorespaces
     }
     {\\end{oframed}\\end{exx}}
\\ExplSyntaxOff

\\theoremsymbol{}
\\theoremseparator{.}

\\theoremstyle{nonumberplain}


\\newtheorem{defii}{Definition}



\\newtheorem{recall}{Recall}

\\newtheorem{conv}{Convention}

\\theoremseparator{.}
\\theoremstyle{nonumberplain}

\\theoremheaderfont{\\normalfont\\itshape\\sffamily\\bfseries} 
\\theoremsymbol{\\ding{122}}
\\makeatletter
\\newtheoremstyle{MyNonumberplain}%
  {\\item[\\theorem@headerfont\\hskip\\labelsep ##1\\theorem@separator]}%
  {\\item[\\theorem@headerfont\\hskip\\labelsep ##3\\theorem@separator]}
\\makeatother
\\theoremstyle{MyNonumberplain}
\\theorembodyfont{\\upshape}

\\newtheorem{proof}{\\indent Proof}
\\theoremprework{\\setlength\\theorempostskipamount{0pt}}
\\newtheorem{sol}{Solution}
\\newtheorem{sol1}{Solution 1}
\\newtheorem{sol2}{Solution 2}
\\newtheorem{sol3}{Solution 3}
\\theoremheaderfont{\\normalfont\\bfseries\\sffamily} 

\\theoremsymbol{}

\\theoremheaderfont{\\normalfont\\bfseries\\sffamily}
\\newtheorem{remark}{Remark}
\\theoremheaderfont{\\normalfont\\sffamily}
\\usepackage{wasysym}
\\theoremsymbol{}
\\newtheorem{idea}{{\\Large\\smiley} Idea}


\\theoremheaderfont{\\kern15pt\\normalfont\\sffamily}
\\theoremstyle{nonumberbreak}
\\theoremseparator{}
\\newtheorem{wrongg}{\\,\\, \\textbf{Wrong!}}

\\newenvironment{wrong}{
\\begin{wrongg}
\\begin{tikzpicture}[scale=.1]
\\begin{scope}
\\draw[line width =.3mm]  (0,0) ellipse (3 and 3);
\\begin{scope}[line width=.35mm]
\\draw(-1,2) arc (0:-99:1);
\\draw (1,2) arc (180:279:1);

\\draw (-2,0.8) -- (-0.8,0.8);
\\draw (-1.4,1.2) -- (-1.4,0.4);
\\draw (2,0.8) -- (0.8,0.8);
\\draw (1.4,1.2) -- (1.4,0.4);
\\draw(2.6,0)-- (2.2,0) arc (0:-180:2.2)--(-2.6,0) ;

\\clip (0,0) circle (1);
\\shade [inner color = red, outer color = white] (0,0) circle(1.1);
\\end{scope}
\\end{scope}
\\end{tikzpicture}
}{\\end{wrongg}}






\\newtheorem{cautt}{\\,\\, \\textbf{Caution!}}
\\newenvironment{caut}{
\\begin{cautt}
\\begin{tikzpicture}[scale=.1]
\\begin{scope}
\\draw[line width =.3mm]  (0,0) ellipse (3 and 3);
\\begin{scope}[line width=.35mm]
\\draw(-1,2) arc (0:-99:1);
\\draw (1,2) arc (180:279:1);

\\draw (-2,0.8) -- (-0.8,0.8);
\\draw (-1.4,1.2) -- (-1.4,0.4);
\\draw (2,0.8) -- (0.8,0.8);
\\draw (1.4,1.2) -- (1.4,0.4);
\\draw(2.6,0)-- (2.2,0) arc (0:-180:2.2)--(-2.6,0) ;

\\clip (0,0) circle (1);
\\shade [inner color = red, outer color = white] (0,0) circle(1.1);
\\end{scope}
\\end{scope}
\\end{tikzpicture}
}{\\end{cautt}}






\\theoremseparator{.}
\\theoremheaderfont{\\normalfont\\scshape\\bfseries}
\\theoremprework{\\begin{small}
\\setlength\\theorempreskipamount{\\medskipamount}
\\setlength\\theorempostskipamount{\\medskipamount}
}
\\theorempostwork{\\end{small}}
\\theoremstyle{nonumberplain}
\\newtheorem{hint}{Hint}


\\newcommand{\\lims}{\\mathop{\\overline{\\lim}}}
\\newcommand{\\limi}{\\mathop{\\underline{\\lim}}}
\\newcommand{\\limn}{\\lim_{n\\to\\infty}}
\\newcommand{\\limsn}{\\lims_{n\\to\\infty}}
\\newcommand{\\limin}{\\limi_{n\\to\\infty}}

\\newcommand{\\range}{\\mathop{\\mathrm{range}}}
\\newcommand{\\nul}{\\mathop{\\mathrm{null}}}

\\newcommand{\\B}{\\mathcal B}




\\newcommand{\\proofqed}{\\tag*{}}
\\newcommand{\\toto}{\\rightrightarrows}
 
\\renewcommand{\\matrix}[1]{\\begin{bmatrix}#1\\end{bmatrix}}
\\newcommand{\\smatrix}[1]{\\left[\\begin{smallmatrix}#1\\end{smallmatrix}\\right]}

\\usepackage{fancyhdr}
\\pagestyle{fancy}
\\fancyhead{} % 清除所有頁首設定
\\fancyfoot{} % 清除所有頁尾設定
\\fancyhead[R]{\\nouppercase{\\sffamily\\small \\leftmark}}
\\fancyfoot[C]{\\sffamily\\thepage}
\\renewcommand{\\headrulewidth}{1pt}
\\fancypagestyle{plain}{ %
  \\fancyhf{} % remove everything
  \\renewcommand{\\headrulewidth}{0pt} % remove lines as well
  \\renewcommand{\\footrulewidth}{0pt}
  \\fancyhead[l]{\\small\\sffamily Author: Ching-Cheong Lee;\\quad  Email: cclee@ust.hk/ustcclee@gmail.com}
  \\fancyfoot[C]{\\sffamily\\thepage}
}

\\usepackage{tocloft}
\\usepackage{tocstyle}
\\renewcommand\\cftsecfont{\\normalfont}
\\renewcommand\\cftsecpagefont{\\normalfont}
\\renewcommand{\\cftsecleader}{\\cftdotfill{\\cftsecdotsep}}
\\renewcommand\\cftsecdotsep{\\cftdot}
\\renewcommand\\cftsubsecdotsep{\\cftdot}
\\renewcommand{\\contentsname}{\\sffamily Contents}
\\newcommand{\\ntable}{
{\\sffamily\\tableofcontents}
}


\\newcommand{\\LIM}{\\mathop{\\mathrm{LIM}}}

\\let\\upto\\nearrow
\\let\\downto\\searrow

\\makeatletter \\def\\@makefnmark{\\hbox{\\@textsuperscript{\\normalfont\\@thefnmark}}} \\makeatother

\\usepackage[hang]{footmisc}

\\renewcommand{\\thempfootnote}{(\\fnsymbol{mpfootnote})}
\\renewcommand{\\thefootnote}{(\\fnsymbol{footnote})}
\\allowdisplaybreaks

\\newcommand{\\inner}[1]{\\langle#1\\rangle} 
\\newcommand{\\ntitle}[2]{{\\noindent \\sffamily{\\large  {\\bfseries #1}}

\\medskip 
\\noindent #2}

\\medskip
\\hrule height 1pt
}

\\usepackage{rotating}

%\\begin{comment}
\\usepackage{unicode-math}

\\usepackage{fontspec}
\\setmainfont[Ligatures=TeX,Mapping=tex-text]{Calibri}
\\setsansfont[Ligatures=TeX,Mapping=tex-text]{Calibri}

\\setmathfont{Cambria Math}
\\setmathfont[version=bold,FakeBold=3.5]{Cambria Math}
\\newcommand{\\bm}{\\boldsymbol}
%\\end{comment}
\`\`\`



### Style 3: \`mathptmx\` + \`mdbch\`

#### Preview 

![](/assets/img/2026-05-10-19-05-43.png)

#### Preamble

\`\`\`tex
\\documentclass[a4paper]{article}

\\usepackage[margin=3.5cm]{geometry}
\\usepackage[hang]{footmisc}
\\renewcommand{\\thempfootnote}{(\\fnsymbol{mpfootnote})}
\\renewcommand{\\thefootnote}{(\\fnsymbol{footnote})}
\\usepackage{xr}
\\externaldocument[1-]{MATH3033_notes_01}
\\externaldocument[2-]{MATH3033_notes_02}
\\externaldocument[3-]{MATH3033_notes_03}
\\externaldocument[4-]{MATH3033_notes_04}
\\externaldocument[5-]{MATH3033_notes_05}
\\externaldocument[6-]{MATH3033_notes_06}
\\externaldocument[7-]{MATH3033_notes_07}
\\externaldocument[8-]{MATH3033_notes_08}
\\externaldocument[9-]{MATH3033_notes_09}
\\externaldocument[10-]{MATH3033_notes_10}
\\externaldocument[11-]{MATH3033_notes_11}
\\externaldocument[12-]{MATH3033_notes_12}
\\externaldocument[s2-]{solution_2}
\\externaldocument[s3-]{solution_3}
\\externaldocument[s4-]{solution_4}
\\externaldocument[s5-]{solution_5}
\\externaldocument[s6-]{solution_6}
\\externaldocument[s7-]{solution_7}
\\externaldocument[s9-]{solution_9}
\\externaldocument[s10-]{solution_10}
\\externaldocument[s11-]{solution_11}

\\newcommand{\\inner}[1]{\\langle#1\\rangle}
\\newcommand{\\innerr}[1]{\\left\\langle#1\\right\\rangle}

\\usepackage[thmmarks]{ntheorem}
\\usepackage{pifont,enumitem,amsmath,amsfonts,amssymb,extarrows,mathtools,color,multicol,tikz,comment}
\\setlist{listparindent=\\parindent}

\\renewcommand{\\labelenumi}{(\\alph{enumi})}
\\renewcommand{\\labelenumii}{(\\roman{enumii})}


\\newcommand{\\ul}[1]{\\underline{\\smash{#1}}}




\\usetikzlibrary{calc,through,snakes,patterns}
\\usetikzlibrary{shapes,arrows,decorations.markings}
\\newcommand{\\G}{\\mathcal G}
\\newcommand{\\C}{\\mathbb{C}}
\\newcommand{\\dis}{\\displaystyle}
\\newcommand{\\N}{\\mathbb{N}}
\\newcommand{\\Q}{\\mathbb{Q}}
\\newcommand{\\R}{\\mathbb{R}}
\\newcommand{\\Z}{\\mathbb{Z}}
\\newcommand{\\F}{\\mathbb{F}}
\\renewcommand{\\O}{\\mathcal{O}}
\\renewcommand{\\L}{\\mathcal L}
\\newcommand{\\E}{\\mathcal E}
\\newcommand{\\ol}[1]{\\overline{#1}}

\\newcommand{\\enu}[1]{\\begin{enumerate}#1\\end{enumerate}}
\\newcommand{\\enur}[1]{\\begin{enumerate}[resume]#1\\end{enumerate}}
\\newcommand{\\alignn}[1]{\\begin{align*}#1\\end{align*}}
\\newcommand{\\cupp}{\\bigcup}
\\newcommand{\\capp}{\\bigcap}
\\newcommand{\\sqcupp}{\\bigsqcup}
\\newcommand{\\id}{\\mathrm{id}}
\\newcommand{\\abs}[1]{\\left|#1\\right|}

\\newcommand{\\brac}[1]{\\left(#1\\right)}
\\theoremseparator{.}
\\theoremheaderfont{\\normalfont\\bfseries}
\\theorembodyfont{}
\\setcounter{secnumdepth}{-1} 

\\newenvironment{hint}[1][\\small[Hint.]{\\begin{trivlist}
\\item[\\hskip \\labelsep {\\bfseries #1}]\\small}{\\textbf{]}\\end{trivlist}}

\\newtheorem*{claim}{Claim}
\\theorembodyfont{\\upshape}

\\usepackage{wasysym}
\\newenvironment{idea}[1][\\text{\\Large\\smiley }\\, Idea.]{\\begin{trivlist}\\small
\\item[\\hskip \\labelsep {\\bfseries #1}]}{\\end{trivlist}}

\\newenvironment{remark}[1][\\sffamily Remark.]{\\begin{trivlist}\\small
\\item[\\hskip \\labelsep {\\bfseries #1}]}{\\end{trivlist}}



\\usepackage{shadethm}
\\usepackage{xcolor}
\\definecolor{shadethmcolor}{HTML}{FFFFFF}
\\definecolor{shaderulecolor}{HTML}{000000}
\\setlength{\\shadeboxrule}{.3pt}

\\theoremsymbol{}
\\theoremseparator{.}


\\newtheorem{pro}{Problem}
\\theoremstyle{nonumberplain}
\\theoremsymbol{\\ding{122}}
\\theoremseparator{}
\\usepackage{needspace}
\\theorempostwork{\\hrule\\needspace{\\baselineskip}}
\\newtheorem{sol}{Solution.}


\\newcommand{\\LIM}{\\mathop{\\mathrm{LIM}}}
\\newcommand{\\lims}{\\mathop{\\overline{\\lim}}}
\\newcommand{\\limi}{\\mathop{\\underline{\\lim}}}
\\newcommand{\\limn}{\\lim_{n\\to\\infty}}
\\newcommand{\\limsn}{\\lims_{n\\to\\infty}}
\\newcommand{\\limin}{\\limi_{n\\to\\infty}}

\\newcommand{\\range}{\\mathop{\\mathrm{range}}}
\\newcommand{\\nul}{\\mathop{\\mathrm{null}}}

\\newcommand{\\B}{\\mathcal B}

\\newcommand{\\proofqed}{\\tag*{\\ding{122}}}
\\newcommand{\\toto}{\\rightrightarrows}
 \\renewcommand{\\matrix}[1]{\\begin{bmatrix}#1\\end{bmatrix}}
\\newcommand{\\smatrix}[1]{\\left[\\begin{smallmatrix}#1\\end{smallmatrix}\\right]}


\\usepackage{eucal}

\\usepackage{parskip}


\\newcommand{\\bu}{\\text{}\\quad $\\bullet$ }
\\date{}



\\makeatletter

\\usepackage{mathptmx}


\\DeclareSymbolFont{Symbols}{OMS}{cmm}{m}{n}
\\DeclareMathSymbol{\\infty}{\\mathord}{Symbols}{49}
\\DeclareSymbolFont{largesymbols}{OMX}{cmex}{m}{n}
\\usepackage{eucal}

\\DeclareSymbolFont{letters}{OML}{ntxmi}{m}{it}
\\SetSymbolFont{letters}{bold}{OML}{ntxmi}{bx}{it}



\\DeclareSymbolFont{parenthesis}{OT1}{ntxr}{m}{n}
\\DeclareMathDelimiter{(}{\\mathopen}{parenthesis}{"28}{largesymbols}{"00}
\\DeclareMathDelimiter{)}{\\mathclose}{parenthesis}{"29}{largesymbols}{"01}
 \\DeclareMathDelimiter{[}{\\mathopen}{parenthesis}{"5B}{largesymbols}{"02} 
 \\DeclareMathDelimiter{]}{\\mathclose}{parenthesis}{"5D}{largesymbols}{"03}



   \\newcommand\\hmmax{0} % default 3
   % \\newcommand\\bmmax{0} % default 4
   \\usepackage{bm}


\\makeatletter
\\def\\upintkern@{\\mkern-7mu\\mathchoice{\\mkern-3.5mu}{}{}{}}
\\def\\upintdots@{\\mathchoice{\\mkern-4mu\\@cdots\\mkern-4mu}%
 {{\\cdotp}\\mkern1.5mu{\\cdotp}\\mkern1.5mu{\\cdotp}}%
 {{\\cdotp}\\mkern1mu{\\cdotp}\\mkern1mu{\\cdotp}}%
 {{\\cdotp}\\mkern1mu{\\cdotp}\\mkern1mu{\\cdotp}}}
\\newcommand{\\upiint}{\\DOTSI\\protect\\UpMultiIntegral{2}}
\\newcommand{\\upiiint}{\\DOTSI\\protect\\UpMultiIntegral{3}}
\\newcommand{\\upiiiint}{\\DOTSI\\protect\\UpMultiIntegral{4}}
\\newcommand{\\upidotsint}{\\DOTSI\\protect\\UpMultiIntegral{0}}
\\newcommand{\\UpMultiIntegral}[1]{%
  \\edef\\ints@c{\\noexpand\\upintop
    \\ifnum#1=\\z@\\noexpand\\upintdots@\\else\\noexpand\\upintkern@\\fi
    \\ifnum#1>\\tw@\\noexpand\\upintop\\noexpand\\upintkern@\\fi
    \\ifnum#1>\\thr@@\\noexpand\\upintop\\noexpand\\upintkern@\\fi
    \\noexpand\\upintop
    \\noexpand\\ilimits@
  }%
  \\futurelet\\@let@token\\ints@a
}
\\makeatother
\\DeclareFontFamily{OMX}{mdbch}{}
\\DeclareFontShape{OMX}{mdbch}{m}{n}{ <->s * [0.8]  mdbchr7v }{}
\\DeclareFontShape{OMX}{mdbch}{b}{n}{ <->s * [0.8]  mdbchb7v }{}
\\DeclareFontShape{OMX}{mdbch}{bx}{n}{<->ssub * mdbch/b/n}{}
\\DeclareSymbolFont{uplargesymbols}{OMX}{mdbch}{m}{n}
\\SetSymbolFont{uplargesymbols}{bold}{OMX}{mdbch}{b}{n}
\\DeclareMathSymbol{\\upintop}{\\mathop}{uplargesymbols}{82}
\\makeatother
\\makeatletter
\\renewcommand{\\int}{\\DOTSI\\upintop\\ilimits@}
\\makeatother

\\let\\upto\\nearrow
\\let\\downto\\searrow




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
\`\`\`

`;export{n as default};
