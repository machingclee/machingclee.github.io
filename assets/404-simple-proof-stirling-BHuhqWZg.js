const n=`---
title: A Simple Proof to Stirling's Formula $n!\\sim \\sqrt{2\\pi n} \\left(\\frac{n}{e}\\right)^n$
date: 2025-07-01
id: blog0404
tag: math
toc: true
intro: We study the asymptotic behaviour of n!
---

### The Stirling's Formula

> **Theorem.** We have
>
> $$
> n!\\sim \\sqrt{2\\pi n} \\left(\\frac{n}{e}\\right)^n\\quad  \\text{as $n\\to \\infty$}
> $$

### Preliminary Results as Simple Exercises in Mathematical Analysis

<box>

**Fact 1.** Show that for each $n\\in \\mathbb N$,

$$
\\left( \\frac{n+1}{e}\\right)^n < n!
$$

</box>

<box>

**Fact 2.** Show that the function

$$
f(x) = \\left(1+\\frac{1}{x}\\right)^{x+\\alpha}
$$

is decreasing on $(0,\\infty)$ when $\\alpha \\ge \\frac{1}{2}$.

</box>

<box>

**Fact 3.** If $f:(a,b)\\to \\mathbb R$ is convex, then show that for every $x_1,x_2\\in (a,b)$ with $x_1<x_2$, one has

$$
f\\left(\\frac{x_1+x_2}{2}\\right)\\leq \\frac{1}{x_2-x_1}\\int_{x_1}^{x_2}f(t)\\,dt\\leq \\frac{f(x_1)+f(x_2)}{2}.
$$

</box>

<box>

**Fact 4 (Walli's Formula).** Define $I_n=\\int_0^{\\pi/2}\\sin^n x\\,dx$ for integer $n\\ge0$. Prove that for every $n\\ge1, $

$$
I_{2n}=\\frac{(2n-1)!!}{(2n)!!}\\cdot \\frac{\\pi}{2}\\quad\\text{and}\\quad I_{2n+1}=\\frac{(2n)!!}{(2n+1)!!}.
$$

Hence by considering $I_{2n}/I_{2n+1}$, show that

$$
\\lim_{n\\to\\infty} \\frac{1}{2n+1}\\left(\\frac{(2n)!!}{(2n-1)!!}\\right)^2=\\frac{\\pi}{2}.
$$

</box>

### Proof of the Statement

#### Motivation

By **Fact 1** we have

$$
\\left(1+\\frac{1}{n}\\right)^n<\\frac{e^nn!}{n^n}.
$$

We note that LHS increases to $e$, thus if $\\displaystyle b_n:=\\frac{e^nn!}{n^n}$ also converges, we should get at least a nonzero limit. To study this, consider the quotient

$$
\\frac{b_{n+1}}{b_n}=e\\left(\\frac{n}{n+1}\\right)^n\\iff \\frac{b_{n}}{b_{n+1}}=\\frac{1}{e}\\left(1+\\frac{1}{n}\\right)^n<1.
$$

Therefore $\\{b_n\\}$ is increasing, however this limit is possibly unbounded.

Next by **Fact 2** we can obtain a decreasing sequence by multiplying $\\frac{b_n}{b_{n+1}}=\\frac{1}{e}\\left(1+\\frac{1}{n}\\right)^n$ a factor $(1+\\frac{1}{n})^{1/2}$:

$$
\\frac{b_n}{b_{n+1}} \\times \\left(1+\\frac{1}{n}\\right)^{1/2}  =\\frac{1}{e}\\left(1+\\frac{1}{n}\\right)^{n+1/2}>1.
\\tag*{$(*)$}
$$

Observe that LHS of $(*)$ is the sams as $\\displaystyle \\frac{b_n/\\sqrt{n}}{b_{n+1}/\\sqrt{n+1}}$, so instead we try to study the limit of

$$
\\boxed{a_n:= \\frac{b_n}{\\sqrt{n}} = \\frac{e^n n!}{n^{n+1/2}}}
$$

#### Proof to Stirling's Formula

Let $\\{a_n\\}$ be defined as above, now observe that

$$
\\begin{align*}
1&<\\frac{a_n}{a_{n+1}}=e^{-1}\\left(1+\\frac{1}{n}\\right)^{n+1/2}=\\exp\\bigg(-1+\\Big(n+\\frac{1}{2}\\Big) \\int_{n}^{n+1}\\frac{1}{x}\\,dx\\bigg),
\\end{align*}
$$

by **Fact 3** we have $\\int_{n}^{n+1}\\frac{1}{x}\\,dx\\leq\\frac{1}{2}(\\frac{1}{n}+\\frac{1}{n+1})$, therefore a simple computation yields

$$
1<\\frac{a_n}{a_{n+1}}<e^{\\frac{1}{4}\\left(\\frac{1}{n}-\\frac{1}{n+1}\\right)}.\\tag{$**$}
$$

- The first inequality in $(**)$ tells us $\\{a_n\\}$ decreases to a limit $\\alpha \\ge 0$;
- The second inequality in $(**)$ tells us $\\{a_ne^{-\\frac{1}{4n}}\\}$ increases to $\\alpha$, so $\\alpha >0$.

By using the following form of Walli's formula (modified from **Fact 4**)

$$
\\frac{(n!)^2 2^{2n}}{(2n)!}\\sim \\sqrt{\\pi n}
$$

and using $n!=a_nn^{n+1/2}e^{-n}$ we get

$$
\\sqrt{\\pi}\\leftarrow \\frac{(n!)^22^{2n}}{\\sqrt{n}(2n)!}=\\frac{1}{\\sqrt{2}} \\frac{a_n^2}{a_{2n}}\\to \\frac{\\alpha}{\\sqrt{2}}.
$$

Therefore we conclude that

$$
\\lim_{n\\to\\infty} \\frac{n!}{n^{n+1/2} e^{-n}}=\\lim_{n\\to\\infty}a_n=\\alpha =\\sqrt{2\\pi}.
$$

<qed>

For the ease of memorization this result is usually written as $\\boxed{\\displaystyle n!\\sim \\sqrt{2\\pi n} \\left(\\frac{n}{e}\\right)^n}$.

</qed>
`;export{n as default};
