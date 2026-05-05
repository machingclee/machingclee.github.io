const n=`---
title: Convex Analysis - Characterization of Convex lsc Functions
date: 2021-08-08
edited: 2021-08-10
id: blog0013
tag: math
intro: Start the journey of convex analysis in an attempt to fully understand the technical tools needed in optimal transport. In this article we digest the material from <a href="https://www.math.uh.edu/~rohop/fall_06/Chapter5.pdf?fbclid=IwAR1PSKAw9-0H5ziYna8UXqIuXgyAvuAIUsMu8TXb-EqbIILBuXpHUZwUoVA">Chapter 5 Convex Optimization in Function Space</a>, I also fill in the important missing detail in the proof (the author is a bit rushing).
---

#### Geometric Version of Hahn-Banach Theorem and its Consequence

<!-- > **Theorem.** In a reflexive Banach space $X$ a bounded sequence $\\{x_n\\}$ contains a weakly convergent subsequence. -->

> **Definition.** Let $\\mu\\in V^*\\setminus\\{0\\}$ and $\\alpha\\in \\R$, thet set of elements
>
> $$
> H :=\\{v\\in V : \\mu(v)=\\alpha\\}
> $$
>
> is called an affine hyperplane.
>
> - The convex sets $\\{v\\in V: \\mu(v)<\\alpha\\}$ and $\\{v\\in V: \\mu(v)>\\alpha\\}$ are called **_open half spaces_**;
> - The convex sets $\\{v\\in V: \\mu(v)\\leq \\alpha\\}$ and $\\{v\\in V: \\mu(v)\\ge\\alpha\\}$ are called **_closed half spaces_**.
>   Let $S\\subseteq V$, a **_supporting hyperplane_** is a hyperplane $H$ such that $H\\cap \\pd S \\neq \\emptyset$ and $S$ is contained in one of the closed half-spaces induced by $H$.

The following proposition is taken from https://www.imsc.res.in/~kesh/hahn.pdf with the premise that Hahn-Banach Theorem has already been proved in the form of semi-linear functional $p$. i.e., suppose $p$ is sub-linear and has homogenity for non-negative constant. When $W\\subseteq V$ is a subspace, and $g:W\\to \\R$ satisfies $g\\leq p$ on $W$, then $g$ can be extended to $f:V\\to \\R$ such that $f\\leq p$ on $V$.

> **Proposition.**. Let $C$ be an open and convex set in a real topological vector space $V$ such that $0\\in C$. For $x\\in V$, define
>
> $$
> p(x) =\\inf\\cbrac{\\frac{1}{\\alpha} : \\alpha x\\in C,\\alpha > 0}.
> $$
>
> We have
>
> $$
> C=\\{x\\in V:p(x)<1\\}.
> $$
>
> Further, $p$ satisfies
>
> $$
> \\left\\{\\begin{aligned}
> p(\\alpha x) &= \\alpha p(x),  \\\\
> p(x+y)&\\leq  p(x)+p(y)
> \\end{aligned}\\right.
> $$
>
> for $\\alpha>0$ and $x,y\\in V$.

<proof>

**_Sketch of Proof._**

- ($\\Rightarrow$) Let $x\\in C$, then by openness there will be $\\epsilon>0$, $(1+\\epsilon) x\\in C$, therefore $p(x) \\leq \\frac{1}{1+\\epsilon} < 1$.

  ($\\Leftarrow$) Conversely, if $p(x)<1$, we can choose $\\frac{1}{t}$ approaching to $p(x)$ such that $\\frac{1}{t}< 1$ and $ tx\\in C$. Take $s=\\frac{1}{t}$, then $s<1$ and $x/s\\in C$, by convexity $s\\cdot (x/s) + (1-s)0\\in C$.

- "Scaling property" is straightfoward, for subadditivity observe that for any $\\epsilon >0$ and $x,y\\in V$,
  $$
    x':=\\frac{x}{p(x)+\\epsilon}\\in C\\quad \\text{and}\\quad  y':=\\frac{y}{p(y)+\\epsilon} \\in C.
  $$
  Take $t=(p(x)+\\epsilon )/(p(x)+p(y)+2\\epsilon)$, we have
  $$
  tx' + (1-t)y' = \\frac{x+y}{p(x)+p(y)+2\\epsilon} \\in C,
  $$
  therefore $p(x+y)< p(x)+p(y)+2\\epsilon$.

</proof>

> **Corollary.** Let $C$ be a nonempty open convex set in a real topological vector space $V$. Let $0\\in C$ and $x_0\\not\\in C$, there is a linear functional $f:V\\to \\R$ such that $f(x_0) = 1$ and
>
> $$
> x\\in C \\implies f(x)<1.
> $$

<proof>

**_Proof._** We keep using the same $p$ as the above proposition. Let $W = \\R x_0$, define $g:W\\to \\R$ by $g(tx_0) = t$. For any $t>0$, since $\\frac{1}{t} (tx_0)=x_0\\not\\in C$, by the proposition right above we have $ g(tx_0)=t\\leq p(tx_0) $, therefore $g\\leq p$ on $W$. This inequality also holds for $t<0$ since $p$ is always nonnegative.

Therefore by Hahn-Banach Theorem we can extend $g:W\\to \\R$ to $f:V\\to \\R$ with $f\\leq p$ on $V$. Hence if $x\\in C$, by the proposition right above again we have

$$
f(x) \\leq p(x)<1 = g(x_0)=f(x_0).
$$

</proof>

Here comes our geometric version of Hahn-Banach Theorem by using this corollary:

> **Theorem (Hahn-Banach).** Let $A$ and $B$ with $A\\cap B=\\emptyset$ be two nonempty **_convex_** subsets of a real topological vector space $V$.
>
> 1. Assume that $A$ is open. Then there is a closed hyperplane which separates $A$ and $B$, i.e., there is $\\phi\\in V^*$ and $\\alpha\\in \\R$ such that
>
>    $$
>    \\phi(x)< \\alpha \\leq \\phi(y)
>    $$
>
>    for all $x\\in A$ and $y\\in B$.
>
> 2. Assume that $A$ is compact, $B$ is closed, and that $V$ is locally convex, then there are $\\alpha,\\beta\\in \\R$ and $\\phi\\in V^*$ such that
>    $$
>    \\phi(x) \\leq \\alpha< \\beta \\leq \\phi(y)
>    $$
>    for all $x\\in A$ and $y\\in B$.

<proof>

**_Proof of 1._** Fix $a_0\\in A$ and $b_0\\in B$, define the set $C$ by

$$
C = A-B+b_0-a_0,
$$

it is clear that $C$ is convex, $0\\in C$ and that $C$ is open since $C=\\bigcup_{b\\in B}(A-b+b_0-a_0)$.

Write $x_0=b_0-a_0$, then $x_0\\not\\in C$ (as $A\\cap B=\\emptyset$), we apply the corollary above to find a $\\phi :V\\to \\R$ such that $\\phi(x_0)=1$ and $\\phi (x)<1$. Therefore for every $a\\in A, b \\in B$,

$$
\\phi(a-b+x_0) < 1 \\iff \\phi(a)-\\phi(b)+ 1 < 1 \\iff \\phi(a)<\\phi(b).
$$

We can therefore choose $\\alpha =\\inf_{b\\in B} \\phi(b)$ to conclude
$
\\phi(a)\\leq \\alpha \\leq \\phi(b)
$
for all $a\\in A$ and $b\\in B$.

It remains to show that the leftmost inequality is strict. Assume not, i.e., there is an $a\\in A$ such that $\\phi(a) = \\alpha$. Since $A$ is open, there is an $\\epsilon>0$ such that $a+\\epsilon x_0 \\in A$. Then

$$
\\phi(a+\\epsilon x_0) \\leq  \\alpha \\iff \\alpha +\\epsilon \\leq \\alpha,
$$

which is absurd.

</proof>

<proof>

**_Proof of 2._** Now $A\\subseteq V\\setminus B$. Since $V\\setminus B$ is open, for every $a\\in A$ there is a convex neighborhood $U_a$ of $0$ such that $a+U_a\\subseteq V\\setminus B$. Since $\\{a+\\frac{1}{2}U_a\\}\\supseteq A$, by compactness, there are $a_1,\\dots,a_n\\in A$ so that $\\{a+\\frac{1}{2}U_a\\}_{i=1}^n\\supseteq A$. Take $U = \\bigcap_{i=1}^n \\frac{1}{2} U_{a_i}$, we arrive to

$$
A+U
\\subseteq \\bigcup_{i=1}^n \\brac{ a_i + \\frac{1}{2}U_{a_i} + U}
\\subseteq \\bigcup_{i=1}^n \\brac{a_i+U_{a_i}}
\\subseteq V\\setminus B.
$$

Now $A+U$ is an open convex subset disjoint from $B$, by 1) there are $\\phi \\in V^*$ and $\\beta\\in \\R$ such that $\\phi(a)< \\beta \\leq \\phi(b)$ for all $a\\in A$ and $b\\in B$. Since $A$ is compact, so is $\\phi(A)$, therefore we may take $\\alpha=\\sup \\phi(A)$.

</proof>

> **Corollary.** Suppose $C$ is a convex subset of a locally convex space $X$, then the weak closure of $C$ is the same as the original closure of $C$.

We introduce the notation $\\olw{C}$ to denote weak closure and $\\ol{C}$ the original closure.

<proof>

**_Proof._** One direction is trivial. To show that $\\olw{C}\\subseteq \\ol{C}$, pick an $x_0\\not\\in \\ol{C}$, we aim to show there is a weak neighborhood of $x_0$ that is disjoint from $\\ol{C}$ (and thus $C$). To this end, apply the second part of Hahn-Banach theorem above, take $A=\\{x_0\\}$ and $B=\\ol{C}$, then $A$ is compact and $B$ is closed, and we can find $\\gamma\\in \\R$ and $\\Lambda\\in X^*$ so that $\\Lambda(x_0) < \\gamma < \\Lambda(c)$ for all $c\\in \\ol{C}$. Now $U:=\\{v:\\Lambda(v)<\\gamma\\}$ defines a weak neighborhood of $x_0$ that is disjoint from $\\ol{C}$ (and hence $C$), thus $x_0\\not\\in \\olw{C}$.

</proof>

The following is known as **_Mazur's Lemma_**, but it is a direct consequence of the corollary above:

> **Theorem.** Suppose $X$ is a metrizable locally convex space, if $\\{x_n\\}$ in $X$ converges weakly to some $x\\in X$, then there is a sequence $\\{y_n\\}$ in $X$ such that
>
> - each $y_n$ is a convex combination of finitely many $x_n$'s and
> - $y_n\\to x$ originally.

<proof>

**_Proof._** Apply the corollary right above to the convex hull of $\\{x_n\\}$.

</proof>

> **Corollary.** Let $C\\subseteq X$ be convex, then $C$ is norm closed if and only if $C$ is weakly sequentially closed.

<proof>

**_Proof._** Suppose $C$ is weakly sequentially closed. If $C\\ni x_n\\to x$, then $x_n \\wto x$, but then $x\\in C$, proving that $C$ is norm closed. Assume on the contrary that $C$ is norm closed, let $C\\ni x_n \\wto x$. By the previous theorem, $x$ will be a norm limit of some other $y_k = \\sum \\lambda_{ki}x_i \\in C$, thus $x \\in \\ol{C} = C$, hence $C$ is also weakly sequentially closed.

</proof>

#### Convex Analysis

Unless otherwise specified, $V$ denotes a real normed vector space.

> **Definition.** Denote $\\ol{\\R}$ the extended real line. If $f:A\\to \\ol{\\R}$ is convex, the convex set
>
> $$
> \\dom f : = \\{u\\in A: f(u)<\\infty\\}
> $$
>
> is called the **_effective domain_** of $f$. $f$ is said to be **_proper_** if $\\dom f \\neq \\emptyset$ and $f>-\\infty$ everywhere.

> **Proposition.** Let $f:X\\to \\ol \\R$ be a convex function in a topological vector space $X$. If $x$ has a neighborhood on which $f$ is bounded above by a constant, then $f$ is continuous at $x$.

<proof>

**_Proof._** We defer the proof to <a href="#/blog/Convex-Analysis-More-on-Convex-Functions-and-Characterize-Convex-lsc-Functions-by-Biconjugate-Functionals"> this post</a>.

</proof>

> **Theorem.** Let $X$ be normed and $f:X\\to \\ol{\\R}$ be a convex function, then the following statements are equivalent:
>
> 1. There is a nonempty open set $\\mathcal O$ on which $f\\not\\equiv -\\infty$ and is bounded above by a constant $c<\\infty$.
> 2. $f$ is a proper function and it is continuous over $\\brac{\\dom f}^\\circ \\neq \\emptyset$.

<proof>

**_Proof._** We defer the proof to <a href="#/blog/Convex-Analysis-More-on-Convex-Functions-and-Characterize-Convex-lsc-Functions-by-Biconjugate-Functionals"> this post</a>.

</proof>

> **Proposition.** Let $X$ be a normed space, $f$ convex and continuous at $x_0\\in (\\dom f)^\\circ$, then $f$ is locally lipschitz at $x_0$.

<proof>

**_Proof._** We defer the proof to <a href="#/blog/Convex-Analysis-More-on-Convex-Functions-and-Characterize-Convex-lsc-Functions-by-Biconjugate-Functionals"> this post</a>.

</proof>

> **Definition.** Let $f:V\\to \\ol{\\R}$, the set
>
> $$
> \\epi f := \\{(u,a)\\in V\\times \\R: f(u)\\leq a\\}
> $$
>
> is called the **epigraph of** $\\bf{f}$. The projection of $\\epi f$ onto $V$ is the effective domain of $f$.

<center>
 <img width="540" src="/assets/maths/epigraph.png"/>
</center>
<br/>

> **Theorem.** A function $f:V\\to \\ol{\\R}$ is convex if and only if its epigrpah is convex.

> **Definition.** A function $f:V\\to \\ol{\\R}$ is called **_lower semi-continuous_** on $V$ if there holds
>
> - $\\{u\\in V: f(u)\\leq a\\}$ is closed for any $a\\in \\R$
> - $f(u)\\leq \\limi\\limits_{v\\to u} f(v)$ for any $u \\in V$.
>   A function $f:V\\to \\ol{\\R}$ is called **_weakly lower semi-continuous_** on $V$ if there holds
> - $\\{u\\in V: f(u)\\leq a\\}$ is weakly closed for any $a\\in \\R$
> - $f(u)\\leq \\w\\limi\\limits_{v\\to u} f(v)$ for any $u \\in V$.

> **Theorem (Characterization of lower semi-continuosu functions).** Let $X$ be a real normed space, a function $f:X\\to \\ol{\\R}$ is lower semi-continuous if and only if its epigraph $\\epi f$ is closed.

<proof>

**_Proof._** Suppose $f$ is lower semi-continuous, let $(x_0, a_0)\\in \\ol{\\epi f}$, then there is a sequence $\\{(x_n,a_n)\\}$ in $\\epi f$ such that $(x_n,a_n)\\to (x_0,a_0)$. Now $f(x_n)\\leq a_n$, by taking $\\limi$ on both sides we have

$$
f(x_0)\\leq \\limi  f(x_n) \\leq \\limi a_n = a_0,
$$

therefore $(x_0,a_0)\\in \\epi f$, and thus $\\epi f$ is closed.

On the opp side suppose $\\epi f$ is closed. Fix an $x_0\\in V$, then for any $\\epsilon >0$, we have $f(x_0)>f(x_0)-\\epsilon=:M$. Therefore $(x_0,M)\\not\\in \\epi f$. As $(V\\times \\R)\\setminus \\epi f$ is open, we can find open neighborhood $U$ of $x_0$ and $\\delta<\\epsilon$ such that

$$
(x, a) \\in \\underbrace{U\\times (M-\\delta,M+\\delta)}_{\\subseteq (V\\times \\R)\\setminus \\epi f}\\implies f(x) > a > M-\\delta>M-\\epsilon = f(x_0)-2\\epsilon.
$$

As this holds for any $x\\in U$, we take $\\limi$ on both sides to get $\\limi_{x\\to x_0} f(x)\\ge f(x_0)-2\\epsilon$.

</proof>

> **Corollary.** Let $f:X\\to \\ol \\R$ be convex, then $f$ is lower semi-continuous if and only if it is weakly sequentially lower semi-continuous.

<proof>

**_Proof._** Observe that

$$
\\begin{aligned}
\\text{$f$ is lower semi-continuous}
& \\iff \\text{$\\epi f$ is norm closed} \\\\
& \\iff \\text{$\\epi f$ is weakly sequentially closed (by convexity of $\\epi f$)}\\\\
& \\iff \\text{$f$ is weakly sequentially lower semi-continuous,}
\\end{aligned}
$$

it remains to prove the last $\\iff$.

$(\\Rightarrow)$ Suppose that $\\epi f$ is weakly sequentially closed, let $x_n\\wto x$ and passing to subsequence if necessary, let $x_n\\to \\limi f(x_n)$ as well, then $(x_n,f(x_n))\\wto (x,\\limi f(x_n))$. But $\\epi f$ is weakly sequentially closed, therefore $(x,\\limi f(x_n))\\in \\epi f$, i.e., $f(x)\\leq \\limi f(x_n)$, hence $f$ is weakly sequentially lower semi-continuous.

$(\\Leftarrow)$ Suppose that $f$ is weakly sequentially lower semi-continuous. Let $\\epi f\\ni (x_n,\\alpha_n)\\wto (x,\\alpha)$, we want to show that $(x,\\alpha)\\in \\epi f$. Observe that

$$
(0, 1)\\in X^*\\times \\R = (X\\times \\R)^*\\implies \\alpha_n\\to \\alpha,\\\\
\\forall x^*\\in X^*, (x^*,0)\\in  X^*\\times \\R = (X\\times \\R)^* \\implies \\inner{x^*,x_n}\\to x,
$$

therefore $x_n\\wto x$ and $f(x_n)\\leq \\alpha_n,\\forall n\\implies \\limi f(x_n)\\leq \\alpha$. By assumption, $f$ is weakly sequentially lower semi-continuous, therefore $f(x)\\leq \\alpha$, we conclude $\\epi f$ is closed.

</proof>

> **Definition.** The largest lower semi-continuous minorant $\\ol{f}$ of $f$ is said to be the **_lower semi-continuous regularization of_** $\\bf{f}$.

**Remark.** Let $\\{f_i\\}_{i\\in I}$ be a family of lower semi-continuous functions, then $f(x):=\\sup_{i\\in I} f_i(x)$ is also lower semi-continuous. Therefore the largest lower semi-continuous minorant exists and the above definition makes sense.

> **Proposition.** If $f:V\\to \\ol {\\R}$ and $\\ol{f}$ is its lower semi-continuous regularization, there holds
>
> $$
> \\epi \\ol{f} = \\ol{\\epi f} \\quad \\text{and}\\quad
> \\ol  f(u)   =\\limi_{v\\to u} f(v).
> $$

<proof>

**_Proof._** By definition $f\\ge \\ol f$, therefore $\\epi \\ol f\\supseteq \\epi f$. Since $\\ol f$ is lower semi-continuous, $\\epi \\ol f$ is closed, therefore
$\\epi \\ol f \\supseteq \\ol{\\epi f}$.

On the opposite side, by looking at the graph of $\\ol{\\epi f}$ we wish to find a $g:V\\to \\ol{\\R}$ such that $\\epi g \\xlongequal{(*)}\\ol{\\epi f}$, such $g$ can be explicited constructed by defining $g(x') = \\limi_{x\\to x'}f(x)$ for $x'\\in V$. We first show that the set equality $(*)$ holds for our choice of $g$.

Let $(x_0,a_0)\\in \\ol{\\epi f}$, there are $\\{(x_n,a_n)\\}$ such that $x_n\\to x_0, a_n\\to a_0$, with $f(x_n)\\leq a_n$. By taking $\\limi$ on both sides, we have

$$
g(x_0)= \\limi_{x\\to x_0} f(x)\\leq \\limi f(x_n)\\leq \\limi a_n = a_0,
$$

proving $\\ol{\\epi f}\\subseteq \\epi g$. Moreover, if there is $(x',a')\\in \\epi g\\setminus \\ol{\\epi f}$, then there is an open neighborhood $U$ of $x'$ and $\\delta>0$ such that $f(x) > a'+\\delta$ for every $x\\in U$. Since there is $\\{x_n\\}$ in $X\\setminus \\{x'\\}$, $x_n\\to x'$ and $f(x_n)\\to \\limi_{x\\to x'} f(x) = g(x')$, it follows that

$$
a'+\\delta\\leq \\lim f(x_n) =g(x')\\leq a',
$$

which is impossible. We conclude that $ \\epi g=\\ol{\\epi f}$.

Now $g$ is lower semi-continuous (as its epigraph is closed), and $\\ol{f}$ is the biggest minorant, $g\\leq \\ol f$, and thus $\\ol{\\epi f}=\\epi g \\supseteq \\epi \\ol f$, we have thereby shown that $\\ol {\\epi f} = \\epi \\ol f$.

Since we have also shown that $\\epi g = \\epi \\ol f$, it follows that $g=\\ol f$ (why?).

</proof>

> **Theorem.** A lower semi-continuous convex function $f : V\\to \\ol{\\R}$ equals the pointwise supremum of all its affine minorants.

<proof>

**_Proof._** If $f$ is a pointwise supremum of affine minorants, then $f$ is a lsc function that is convex.

Assume that $f$ is lsc and convex. If $f\\equiv \\infty$ then we are done. Suppose that $\\dom f \\neq \\emptyset$. For every $x\\in V$ and $a\\in \\R$ such that $a<f(x)$, we try to find an affine transform $S:V\\to \\R$ with $S\\leq f$ on $V$ such that $a<S(x)<f(x)$, which thereby completes the proof.

Lete $a_0<f(x_0)$, for some $a_0\\in \\R$ and $x_0\\in X$, then $(x_0, a_0)\\not\\in \\epi f$, therefore by Hahn-Banach theorem there is a $\\Lambda \\in (V\\times \\R)^*$ such that for some $\\beta\\in \\R$,

$$
\\Lambda(x_0,a_0) < \\beta < \\Lambda (x,a)
$$

for all $(x,a)\\in \\epi f$. We write $\\Lambda = T \\oplus \\alpha$ for some $T\\in V^*$ and $\\alpha\\in \\R$, then we get

$$
(*)\\qquad \\begin{aligned}
Tx_0 + \\alpha a_0 &< \\beta,\\\\
Tx + \\alpha a &>\\beta  \\qquad \\text{for $(x,a)\\in \\epi f$}.
\\end{aligned}
$$

**Case 1 ($f(x_0)\\neq \\infty$).**
We choose $x=x_0$ and $a=f(x_0)+k$ for any $k\\ge 0$, then subtracting these two inequalities gives

$$
\\alpha(a_0 - f(x_0) - k) < 0,
$$

therefore by choosing $k$ big enough at the beginning, we must have $\\alpha>0$. Now we set $a=f(x)$ and rearrange the above two inequalities in $(*)$ to get

$$
a_0 < \\frac{\\beta}{\\alpha} - \\frac{1}{\\alpha} Tx_0\\quad \\text{and}\\quad \\frac{\\beta}{\\alpha} - \\frac{1}{\\alpha} Tx < f(x)\\quad \\text{for all $x\\in V$}.
$$

Thefore our affine functional $S(x) = \\frac{\\beta}{\\alpha} - \\frac{1}{\\alpha} Tx$ will do.

**Case 2 ($f(x_0)=+\\infty$).** In this case, if $\\alpha \\neq  0$, we note that $\\alpha <0$ is impossible. Suppose that is the case, then the second inequality of $(*)$ will push $\\beta$ to $-\\infty$ (for $x\\in \\dom f$ we may take $a\\to+\\infty$), which is impossible. Therefore $\\alpha>0$ and we can still choose $S(x) = \\frac{\\beta}{\\alpha} - \\frac{1}{\\alpha} Tx$ and use the first inequality in $(*)$ to complete the proof.

Suppose now $\\alpha= 0$. Then there holds from the second inequality of $(*)$, that for every $x\\in \\dom f$,

$$
 \\psi(x):=\\beta -Tx < 0.\\tag*{($**$)}
$$

and that $\\psi(x_0)>0$. Then we pick $x_1\\in \\dom f$, the point $(x_1, f(x_1)-1)\\not\\in \\epi f$ and therefore by Hahn-Banach theorem again there is a $T'\\in V^*,\\alpha'\\in \\R$ and $\\beta'\\in \\R$ such that

$$
(***) \\qquad
\\left\\{
\\begin{aligned}
T'x_1 + \\alpha'(f(x_1)-1) &< \\beta',\\\\
T'x + \\alpha'a & > \\beta' \\quad \\text{for  $(x,a)\\in \\epi f$.}
\\end{aligned}
\\right.
$$

Put $x=x_1$ and $a=f(x_1)$, then subtracting these two inequalities we have $\\alpha'>0$. On the other hand, if we set $a=f(x)$, then the second inequality of $(***)$ becomes

$$
\\frac{\\beta'-T'x}{\\alpha'}< f(x)\\qquad \\text{for all $x\\in V$.}
$$

We can further conclude for any $k>0$,

$$
\\phi_k(x):=\\frac{\\beta'-T'x}{\\alpha'} + k\\cdot \\psi(x) < f(x)\\qquad \\text{for all $x\\in V$}
$$

since the inequality becomes trivial if $x\\in V\\setminus \\dom f$, and surely holds for $x\\in \\dom f$ by $(**)$. Finally, since $\\psi(x_0)>0$, we can choose $k$ large at the beginning such that $\\phi_k(x_0) > a_0$.

</proof>

#### More on Properties of Convex Functions

The following are useful facts that are usually treated as exercises:

1.  If $f_1,\\dots,f_n$ are proper convex functions ($f$ proper means $f>-\\infty$ everywhere), then their **_infimal convolution_**

    $$
      f(x):=\\inf\\limits_{x_1+\\dots+x_n = x} (f_1(x_1)+\\cdots + f_n(x_n))
    $$

    is also convex.

2.  If $f$ is convex, then so is $\\dom f$.

3.  Let $f,g:X\\to \\ol{\\R}$, if $\\epi f = \\epi g$, then $f=g$.

    Because otherwise if $f(x)\\neq g(x)$, let's say $f(x)>g(x)$, then $f(x)\\leq g(x)$ becomes impossible, therefore $(x,g(x))\\not\\in \\epi f=\\epi g$, which by definition says that $g(x)<g(x)$, a contradiction.

4.  Let $f:\\R\\to \\ol{\\R}$ be convex, fix an $x_0\\in \\R$, then

    $$
      \\frac{f(x_0+\\epsilon)-f(x_0)}{\\epsilon}
    $$

    is an increasing function in $\\epsilon$ on $\\R\\setminus \\{0\\}$. Similarly, if $f:\\R^n\\to \\ol \\R$ is convex, then for every $x\\in \\R^n$, the function

    $$
      \\frac{f(x_0+\\epsilon x )-f(x_0)}{\\epsilon}
    $$

    is also increasing in $\\epsilon$ on $\\R\\setminus\\{0\\}$ as well.

    The proof is simple, let $\\epsilon_1<\\epsilon_2$, then apply convexity to the points $\\frac{\\epsilon_1}{\\epsilon_2}(x_0+\\epsilon_2 x)$ and $(1-\\frac{\\epsilon_1}{\\epsilon_2})x_0$.

5.  Let $f:V\\to \\ol\\R$ be convex and $x_0\\in V$, if $f(x_0)=-\\infty$, then for every $x\\in C$,

    $$
    f(x+ \\lambda(x_0-x))=-\\infty \\qquad \\text{for all $\\lambda\\in (0,1]$.}
    $$

    Therefore if a convex function takes $-\\infty$ at $x_0$, it causes every point in the straight line $[x_0,x)$ in $V$ to take $-\\infty$ as well, where $x\\in V$ and $[x_0,x)$ denotes a straight line connecting $x_0$ and $x$ with $x$ being excluded.

6.  Let $f:V\\to \\ol\\R$ be convex and $x_0\\in V$. Since $x_0 = \\frac{1}{2} (x_0+ x) + \\frac{1}{2} (x_0-x)$, if

    $$
    f|_{x_0+U} <\\infty \\qquad \\text{for some $U$ a symmetric neighborhood of $0$},
    $$

    then by $f(x_0)\\leq \\frac{1}{2}f(x_0+x)+\\frac{1}{2}f(x_0-x)$ it also holds that $f>-\\infty$ on $x_0+U$. By property 5), <br/>

    $$
    f(x)>-\\infty\\qquad \\text{for every $x\\in V$},
    $$

    **_otherwise_** if $f(x)=-\\infty$, then $f|_{[x,x_0)}\\equiv-\\infty$, which courses $f$ to take $-\\infty$ at a point in $x_0+U$, a contradiction.

#### References

- https://www.imsc.res.in/~kesh/hahn.pdf
- https://www.math.ksu.edu/~nagy/real-an/ap-e-h-b.pdf
- https://www.math.uh.edu/~rohop/fall_06/Chapter5.pdf?fbclid=IwAR36PwC2XrRdLLk0knEJLK6gE-gwbTqGfG-SmBbOxP3prOkOJ_mec_EP_h4
- https://www.math.ust.hk/~makyli/4063/2018-19_Spring/MATH%204063%20fanotes_20190301.pdf
- https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.591.6898&rep=rep1&type=pdf
- https://people.math.ethz.ch/~patrickc/CA2013.pdf
`;export{n as default};
