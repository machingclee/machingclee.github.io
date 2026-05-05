const n=`---
title: Countability of a kind of Discontinuity
date: 2022-04-04
id: math004
tag: math
intro: Record a mathematical problem from facebook.
toc: false
---

> **Problem.** Given a function $f:\\mathbb R\\to \\mathbb R$, show that the following set $E$ is at most countable:
>
> $$
> E=\\left\\{ a\\in\\mathbb R: \\lim_{x\\to a}f(x) \\text{ exists and } \\lim_{x\\to a}f(x)\\neq f(a) \\right\\}
> $$

<proof>

**_My Solution._** Denote

$$
\\begin{align*}
E&=\\left\\{a\\in \\mathbb R :\\lim_{x\\to a}f(x)\\text{ exists and }\\lim_{x\\to a}|f(x)-f(a)|>0\\right\\}\\\\
&= \\bigcup_{k\\ge 1}\\underbrace{\\left\\{a\\in \\mathbb R :\\lim_{x\\to a}f(x)\\text{ exists and }\\lim_{x\\to a}|f(x)-f(a)|>\\frac{1}{k}\\right\\}}_{=:E_k},
\\end{align*}
$$

then it remains to show that each of $E_k$'s is countable.

We prove this by showing that each $a\\in E_k$ is in fact isolated by an open interval (and hence each point can be identified with a rational number).

> **Fact.** For every $k\\in \\mathbb N$, each of points in $E_k$ is isolated.

By **_isolated_** we mean for every $a\\in E_k$, there is a $\\delta>0$ such that

$$
\\big((a-\\delta, a+\\delta)\\setminus \\{a\\}\\big) \\cap E_k = \\emptyset.
$$

In other words, the derived set of $E_k$, $E_k'$, satisfies $E_k'\\cap E_k=\\emptyset$.

**_Proof._** Suppose not, i.e., $a\\in E_k$ and $a$ can't be isolated, i.e., $a\\in E_k'$. Then for every $n\\ge 1$, we can find an $a_n\\in B(a, \\frac{1}{n})\\setminus\\{a\\}$, such that $a_n\\in E_k$.

But $a_n\\in E_k$ means that $\\lim_{x\\to a_n}f(x)$ exists with $\\lim_{x\\to a_n}|f(x)-f(a_n)|>1/k$, there will be a $b_n\\in B(a_n,1/n)$ with

$$
|f(b_n)-f(a_n)| >\\frac{1}{k}.
$$

Since both $a_n, b_n\\to a\\in E_k$, as $\\lim_{x\\to a}f(x)$ exists, we have $0\\ge \\frac{1}{k}$, which is absurd.

</proof>

### Reference

- <a>https://www.facebook.com/photo?fbid=10223732659676781&set=gm.10159856304916489</a>
`;export{n as default};
