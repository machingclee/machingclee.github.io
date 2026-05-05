const n=`---
title: "Record Results in Optimal Transport ::::WIP::::"
date: 2021-07-31
edited: 2021-08-07
id: blog0012
tag: math
wip: true
intro: "Record the useful facts with or without proof in the course of reading the book: <a href=\\"http://math.univ-lyon1.fr/~santambrogio/OTAM-cvgmt.pdf?fbclid=IwAR2_Ijca7BjcU4Swz9XZPdx0b8MGtBAk5odBxso2ngxZYNJqjDGS-htFj0Q\\"> Optimal Transport for Applied Mathematicians – Calculus of Variations, PDEs and Modeling </a>"
---

#### Results

As I leave academia for a very long time, this blog is to record those standard results I need to digest theory in optimal transport which helps me understand the Wasserstein loss in GAN theory.

> **Proposition.** Let $X$ be normed and $Y$ be a metric space, define modulus of continuity of $f$ by
>
> $$
> \\omega(\\delta) = \\sup \\{d_Y(f(x),f(y)): \\|x-y\\|_X \\leq \\delta\\},
> $$
>
> then
>
> - $f$ is uniformly continuity if and only if $\\omega(\\delta)\\to 0$ as $\\delta \\to 0$.
> - $\\omega$ is subadditive: for any $s, t>0$, $\\omega(s+t)\\leq \\omega(s) + \\omega(t)$.\\
>
>   <proof>
>
>   **_Proof._** We drop the subscript $X$ in $\\|\\cdot \\|_X$. Suppose now $\\|x-x'\\|\\leq s+t$.
>
>   **Case 1.** If $\\|x-x'\\|\\leq t$,
>
>   $$
>   d_Y(f(x),f(x')) \\leq \\omega (t ) \\leq \\omega(s)+\\omega(t).
>   $$
>
>   **Case 2.** If $\\|x-x'\\|> t$, consider the point $u = x - t (x-x')/\\|x-x'\\|$ which satisfies $\\|u-x\\|=t$ and
>
>   $$
>   \\|u-x'\\| =\\|x-x'\\|\\frac{\\|x-x'\\|-t}{\\|x-x'\\|}\\leq s,
>   $$
>
>   therefore
>
>   $$
>   d_Y(f(x),f(x')) \\leq d_Y(f(x),f(u)) + d_Y(f(u),f(x'))\\leq  \\omega(t) + \\omega(s),
>   $$
>
>   in either case we get the same upper bound, therefore $\\omega(s+t)\\leq \\omega(s) + \\omega(t)$.
>
>   </proof>
>
> - Every continuous function $f:(X,\\|\\cdot \\|)\\to (Y,d_Y)$ restricted to a set compact in $X$ admits a **_continuous_**, **_increasing_** and **_subadditive_** modulus of continuity.\\
>   **_Proof._** Simply observe that $\\omega:[0,\\infty)\\to[0,\\infty)$ is increasing and is subadditive.

> **Proposition.** Let $M$ be a metric space, and $S\\subset M$, the following are equivalent:
>
> - $S$ is **_compact_**
> - $S$ is **_sequentially compact_**
> - $S$ is **_complete and totally bounded_**

> **Fact (Arzela-Ascoli's Theorem).** Let $M$ be a compact metric space and $S\\subseteq C(M)$, then the following are equivalent
>
> - $S$ is compact (or **_sequentially compact_** by the fact above) in $C(M)$
> - $S$ is **_closed, uniformlly bounded and uniformlly equicontinuous_**
> - $S$ is **_closed, pointwise bounded and equicontinuous_**

> **Proposition.** If $f_\\alpha$'s share the same modulus of continuity for all $\\alpha$, then so is $\\sup_\\alpha f$ and $\\inf_\\alpha f$.

**Remark.** Modulus of continuity is also known as a **_bound of a continuity_**. It provides us a method to determine equi-continuity of a set of functions (in case they come from a special kind of construction).

> **Proposition.** If $M$ is a compact metric space, then every $f\\in C(M)$ is uniformly continuous.

> **Proposition.** Let $X,Y$ be compact metric spaces and $c:X\\times Y\\to \\R$ be continuous, there is a increasing continuous function $\\omega:[0,\\infty)\\to [0,\\infty)$ such that
>
> $$
> |c(x,y)-c(x',y')|\\leq  \\omega (d_X(x,x')+d_Y(y,y')).
> $$
>
> For any $\\chi:X\\to  \\R$ and $\\zeta :Y\\to \\R$, we can define
>
> $$
> \\chi^c(y) = \\inf_{x\\in X}(c(x,y) - \\chi(x)) \\quad \\text{and}\\quad \\zeta^{\\bar{c}} =\\inf_{y\\in Y}(c(x,y) - \\zeta(y)),
> $$
>
> then both $\\chi^c$ and $\\zeta^{\\bar{c}}$ are continuous and share the same modulus of continuity $\\omega$.

> **Definition.** The (Lipschitz) function $u$ that realizes the maximum in
>
> $$
> \\min \\cbrac{\\int_{X\\times X} c(x,y)d\\gamma(x,y): \\gamma \\in \\Pi(\\mu,\\nu)} =
> \\max \\cbrac{\\int_X u \\,d(\\mu-\\nu): u\\in \\Lip_1}
> $$
>
> is called **_Kantorovich potentials_** for the transport from $\\mu$ to $\\nu$.

> **Proposition.** If $c$ is $C^1$, $\\varphi$ is a Kantorovich potential for the cost $c$ in the transport from $\\mu$ to $\\nu$ and $(x_0,y_0)$ belongs to the support of an optimal transport plan $\\gamma$, then
>
> - $\\nabla \\varphi(x_0) = \\nabla_x c(x_0,y_0)$, provided $\\varphi$ is differentiable at $x_0$.
> - In particular, the gradients of two different Kantorovich potentials conincide on every point $x_0\\in \\spt (u)$ where both the potentials are differentiable.

**Remark.** Recall that $(x, y)\\in \\spt(\\gamma)$ if and only if $\\gamma(B_{X\\times Y}((x,y),r))>0$ for any $r>0$.

> **Definition.** For $\\Omega\\subseteq \\R^d$ we say that $c:\\Omega\\times \\Omega\\to \\R$ satisfies the **_Twist condition_** whenever $c$ is differentiable w.r.t. $x$ at every point, and the map $y\\mapsto \\nabla_x c(x_0,y)$ is injective for every $x_0$.

**Remark.** This condition is also known in economic as _Spence-Mirrlees condition_. For "nice" domains and cost functions, it corresponds to $\\dis \\det\\sbrac{\\frac{\\pd^2 c}{\\pd y_i \\pd x_j}}\\neq 0$.

> **Proposition.** Given probability measures $\\mu$ and $\\nu$ on a compact domain $\\Omega \\subseteq \\R^d$, there exists an optimal transport plan $\\gamma$ for the cost $c(x,y) = h(x-y)$ with $h:\\R^d\\to \\R$ strictly convex. It is unique and of the form $(\\id, T)_{\\#}\\mu$ for some $T$, provided $\\mu$ is absolutely continuous and $|\\pd \\Omega|=0$. Moreover, there exists a Kantorovich potential $\\varphi$ such that
>
> $$
> T(x) = x- (\\nabla h)^{-1}(\\nabla \\varphi(x)).
> $$

> **Proposition.** Given a function $\\chi:\\R^d\\to \\R\\cup \\{-\\infty\\}$, we define $u_\\chi :\\R^d \\to \\R\\cup\\{+\\infty\\}$ by $u_\\chi(x)=\\frac{1}{2}|x|^2 -\\chi(x)$. Then we have $u_{\\chi^c} = (u_\\chi)^*$. In particular, a function $\\zeta$ is $c$-concave if and only if $x\\mapsto \\frac{1}{2} |x|^2-\\zeta(x)$ is convex and l.s.c..

<proof>

**_Proof._** The first part follows directly from computation. For the second part, since a function is convex and l.s.c. if and only if it is a supremum of affine transforms, but then such a supremum can again be expressed as a convex conjugate of a function $g$, therefore,

$$
\\begin{align*}
u_\\zeta \\text{ is convex and l.s.c.}
&\\iff \\frac{1}{2} \\|x\\|^2 - \\zeta (x) \\xlongequal{\\exists g} g^* = \\sup_{x'}\\inner{x,x'}-g(x') \\\\
&\\iff \\zeta(x) =  \\inf_{x'}\\bigg(\\underbrace{\\frac{1}{2}\\|x-x'\\|^2}_{c(x,x')} - \\underbrace{(\\|x'\\|^2 - g(x'))}_{\\psi(x')}\\bigg)\\\\
&\\iff \\zeta (x) = \\psi^c(x),
\\end{align*}
$$

where $\\psi = \\|\\id\\|^2 -g$, therefore the second part follows.

</proof>

**Remark.** Two gaps in the proof:

- Why a convex lsc function can be expressed as a supremum of affine transforms?
- Why a supremum of affine transforms can be expressed as a convex conjugate of some function defined on the same domain?
  We will com back and fill in these gaps. The second part requires a use of Hahn-Banach Theorem.

> **Recall.** Real-valued convex functions on $\\R^d$ are automatically continuous and locally Lipzchizs in the interior of their domain (on which $f<\\infty$).

> **Theorem.** A function $f:\\R^d\\to \\R\\cup \\{+\\infty\\}$ is convex and l.s.c. $\\iff$ there is a family of affine functions $\\{f_\\alpha\\}$ such that $f(x):=\\sup_\\alpha f_\\alpha(x)$. This family can also be chosen to be the family of all affine functions smaller than $f$.

**Remark.** One implication is trivial, for the opposide side, a precise proof requires the use of Hahn-Banach Theorem in its geometrical form. We will digest the proof from https://www.math.uh.edu/~rohop/fall_06/Chapter5.pdf.
`;export{n as default};
