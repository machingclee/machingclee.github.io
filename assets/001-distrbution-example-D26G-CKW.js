const n=`---
title: Computational Example on Probability Distribution
date: 2021-08-19
id: math001
tag: math
intro: Given $(X,Y,Z)$ and its (joint) distribution on $\\mathbb R^3$, we try to find the distribution of $W=X+Y+Z$ on $\\mathbb R$.
toc: false
---

As a review of statistics I try to work on this problem:

> **Problem.** Let $(X,Y,Z)$ be a 3-dimensional random variable which follows the distribution (i.e., the probability density function is)
>
> $$
>  f(x,y,z) = \\begin{cases}
> \\displaystyle\\frac{24}{(1+x+y+z)^5}, & x>0,y>0,z>0,\\\\
> 0, &\\text{otherwise.}
> \\end{cases}
> $$
>
> Find the probability density function of $W:=X+Y+Z$.

I start off by guessing the answer to be $24/(1+w)^5$ very sloppily, which is of course wrong and I tried to figure out how I can relate $W$ with $f(x,y,z)$.

<details>
<summary> Solution </summary>

---

Let us start from the definition, what does $f$ tell us? In view of a distribution it tells us how are $(X,Y,Z)$'s spreaded in $\\mathbb R^3$. In other words, for every given $A\\subseteq \\mathbb R^3$, we have

$$
\\mathbb P\\big((X,Y,Z)\\in A\\big) = \\int_A f(x)\\,dV(x)
$$

which is the proportion of $(X,Y,Z)$'s lying within $A$ and $dV$ denotes the Lebesgue measure on $\\mathbb R^3$. From that recall also that to find the probability density function $p_W$ of $W$, it is sufficient to find its cummulative distribution $\\int_0^t p_W(x)\\,dx$ (since then we can differentiate pointwise).

From this, consider the relation $W\\leq t$, which is

$$
\\begin{aligned}
W\\leq t
&\\iff X+Y+Z\\leq t,X,Y,Z>0\\\\
&\\iff 0< Z\\leq t-X-Y, 0< t-X-Y, X,Y>0\\\\
&\\iff 0< Z\\leq T-X-Y, 0<Y < t-X, 0<t-X, X>0\\\\
&\\iff 0< Z\\leq T-X-Y, 0<Y < t-X, 0< X<t,
\\end{aligned}
$$

we conclude that $w=x+y+z\\leq t$ ($x,y,z>0$) if and only if $(x,y,z)$ lies in the set

$$
A_t := \\{(x,y,z): x\\in (0,t), y\\in (0, t-x), z\\in (t-x-y)\\},
$$

therefore

$$
\\begin{aligned}
\\int_0^tp_W(x)\\,dx
&=\\mathbb P(W\\leq t)\\\\
&=\\mathbb P\\big((X,Y,Z)\\in  A_t\\big)\\\\
&=\\int_{A_t}f(u)\\,dV(u)\\\\
&=\\int_0^t \\int_0^{t-x}\\int_0^{t-x-y} f(x,y,z) \\,dzdydx.
\\end{aligned}
$$

The answer is

$$
p_W(t)=\\frac{d}{dt}\\left(\\int_0^t\\int_0^{t-x}\\int_0^{t-x-y} \\frac{24}{(1+x+y+z)^5}\\,dzdydx\\right).
$$

$\\qed$

</details>
`;export{n as default};
