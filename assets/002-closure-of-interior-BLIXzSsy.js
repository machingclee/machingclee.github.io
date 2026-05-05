const e=`---
title: The Set Equality $\\overline{C} = \\overline{C^\\circ}$ for Convex Set $C$
date: 2021-08-20
id: math002
tag: math
intro: Record a proof to this result in convex analysis.
toc: false
---

Follow the idea of user04651 in <a href="https://math.stackexchange.com/questions/2287213/closure-of-interior-of-closed-convex-set">this post</a> to prove this statement.

> **Lemma.** Let $X$ be a normed space, $U\\subseteq X$ open and $x_0\\in U$. If $x\\not\\in U$, then the line segment
>
> $$
> [x_0,x)\\subseteq (\\mathrm{conv}(U\\cup \\{x\\}))^\\circ .
> $$

<proof>

**_Proof._** For every $x_1\\in [x_0,x)$, there is a $\\delta>1$ such that $x = x_0 + \\delta(x_1-x_0)$. Let $\\rho>0$ be such that $B(x_0,\\rho)\\subseteq U$.

Now for every $x' \\in B(x_1, (1-\\frac{1}{\\delta})\\rho)$ (we have discussed the intuition of this radius in <a href="/blog/Convex-Analysis-More-on-Convex-Functions-and-Characterize-Convex-lsc-Functions-by-Biconjugate-Functionals">this post</a>), we have for some $z\\in B(0,\\rho)$,

$$
\\begin{aligned}
x'
&= x_1 + \\left(1-\\frac{1}{\\delta}\\right)z \\\\
&= \\frac{1}{\\delta}(x_0+\\delta(x_1-x_0)) + \\left(1-\\frac{1}{\\delta}\\right)(x_0+z).\\\\
&= \\frac{1}{\\delta} x + \\left(1-\\frac{1}{\\delta}\\right)\\underbrace{(x_0+z)}_{\\in U}\\\\
&\\in \\mathrm{conv}(U\\cup \\{x\\}).
\\end{aligned}
$$

As this is true for every $x' \\in B(x_1, (1-\\frac{1}{\\delta})\\rho)$, we conclude $x_1\\in (\\mathrm{conv}(U\\cup \\{x\\}))^\\circ$.

</proof>

> **Proposition.** Let $X$ be a normed space and $C\\subseteq X$ a convex set, then $\\overline{C} = \\overline{C^\\circ}$.

<proof>

**_Proof._** The direction $\\overline{C^\\circ}\\subseteq \\overline C$ is clear.

Let $x\\in \\overline C$, for the sake of contradiction suppose $x\\not\\in \\overline{C^\\circ}$, then there is an open neighborhood $V$ of $x$ such that $V\\cap C^\\circ=\\emptyset$. Since $x\\in \\overline C$, there is an $x'\\in C$ such that $x'\\in V$.

Now $x'$ being an element in $V$, $x'\\not\\in C^\\circ$, fix an $x_0\\in C^\\circ$, by the lemma above the segment

$$
[x_0,x')\\subseteq (\\mathrm{conv}(C^\\circ\\cup \\underbrace{\\{x'\\}}_{\\subseteq C}))^\\circ\\subseteq  (\\mathrm{conv}(C))^\\circ = C^\\circ.
$$

We can pick an $x''\\in [x_0,x')$ that is close enough to $x'$, so that $x''\\in V$, but then $x''\\in V\\cap C^\\circ$, a contradiction.

</proof>
`;export{e as default};
