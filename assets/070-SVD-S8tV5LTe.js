const n=`---
title: Singular Value Decomposition
date: 2022-04-30
id: blog070
tag: math
toc: false
intro: We discuss the rigorous proof of Singular Value Decomposition.
---

**Convention.** $\\mathcal O$ denotes a zero matrix of appropriate size.

> **Theorem (Singular Value Decomposition).**
>
> 1.  Every matrix $A\\in \\mathbb C^{m\\times n}$ has a SVD:
>
>     $$
>     A=U\\Sigma V^*
>     $$
>
>     where $U\\in \\mathbb C^{m\\times m}, V\\in \\mathbb C^{n\\times n}$ are unitary and $\\Sigma\\in \\mathbb R^{m\\times n}$ is "diagonal".
>
>     Furthermore, The singular values $\\sigma_j$'s
>
>     $$
>     \\sigma_1\\ge\\sigma_2\\ge\\dots\\ge \\sigma_{\\min\\{m,n\\}}\\ge 0
>     $$
>
>     are **_uniquely determined_**.
>
> 2.  If $A$ is **_square_** and $\\sigma_j$'s are **_distinct_**, the left and right singular vectors $\\{u_j\\}$ and $\\{v_j\\}$ are **_unique up to a multiplicative constant with modulus 1_**.

<center></center>

**Remark.** The technique in the proof below remains valid when all $\\mathbb C$ is replaced by $\\mathbb R$.

<proof>

**Proof of Part (1).** The case that $m=1$ or $n=1$ is simple, let's assume $m,n\\ge 2$. Let $\\sigma_1=\\|A\\|_2$, then due to compactness of $\\{x\\in \\mathbb C^n:\\|x\\|_2=1\\}$ in $\\mathbb C^n$ and the continuity of the map $x\\mapsto \\|Ax\\|_2$, there must be $v_1\\in \\mathbb C^n$ with $\\|v_1\\|_2=1$ s.t. $\\|Av_1\\|_2=\\sigma_1$, so there is $u_1\\in \\mathbb C^m$, $\\|u_1\\|_2=1$, $Av_1=\\sigma_1 u_1$. Hence $\\|A\\|_2$ is our first singular value.

Extend $u_1$ to an o.n. basis $\\{u_1,\\dots,u_m\\}$ of $\\mathbb C^m$ and $v_1$ to an o.n. basis $\\{v_1,\\dots,v_n\\}$ of $\\mathbb C^n$. Let $U_1$ be the matrix with columns $u_i$ and $V_1$ be that with columns $v_i$, then (see remark next page for the explanation of $B$)

$$
\\begin{align}
  U_1^* AV_1
  &=[A]_{(v_1,\\dots,v_n)}^{(u_1,\\dots,u_m)} \\nonumber  \\\\
  &=
  \\begin{array}{c c}
    & \\begin{array} {@{} c c c c @{}}
      Av_1  \\hspace{1.5cm}& Av_2 \\hspace{1.6cm} &  \\cdots &\\hspace{0.6cm}  Av_n \\hspace{0.6cm}
    \\end{array} \\\\
    \\begin{array}{c}
      u_1 \\\\[0.6cm] u_2 \\\\ \\vdots \\\\ u_m
    \\end{array}\\hspace{-1em} &
    \\left(
      \\begin{array}{@{} c | c c c @{}}
      \\sigma_1   &  & \\hspace{1.5cm} w^*\\text{(to be proved $\\mathcal O$)}& \\\\
      \\hline
        &           &           &                                                         \\\\
        &           &           &                                                          & \\\\
       \\mathcal O  &           & \\hspace{1.5cm} B:=[A]_{(v_2,\\dots,v_n)}^{\\normalsize(u_2,\\dots,u_m)}     & \\\\

      \\hspace{1.5cm} & & &&
      \\end{array}
    \\right) \\\\
    \\mbox{} % Blank line to match column names so as to align the = vertically
  \\end{array} =:S.\\tag*{(1)} \\\\
 \\\\[-12pt]
\\end{align}
$$

Now

$$
\\sigma_1^2=\\|A\\|_2^2\\ge \\|S\\|_2^2 \\ge \\left\\|S \\begin{bmatrix}\\sigma_1\\\\ w\\end{bmatrix}\\right\\|_2^2 \\ge \\sigma_1^2 + w^*w,
$$

this implies $w=\\mathcal O$. Note that we have $x\\perp v_1\\implies Ax \\perp Av_1$, and the only assumption to derive this result is $\\|Av_1\\|_2=\\|A\\|_2$, with $\\|v_1\\|_2=1$. We extract this as a technical corollary.

> **Corollary.** Let $A\\in \\mathbb C^{m\\times n}$, $v\\in \\mathbb C^n$ with $\\|v\\|_2=1$. Then if $\\|Av\\|_2 = \\|A\\|_2$,
>
> $$
> w\\perp v \\implies Aw\\perp Av.
> $$
>
> The same is true when $\\mathbb C$ is replaced by $\\mathbb R$.

<proof>

**Proof.**
Repeat what we have done so far, i.e., replace $v$ by $v_1$ and $\\frac{Av_1}{\\|Av_1\\|_2}$ by $u_1$ in the argument preceding the corollary. Then once $w\\perp v$, one has $Aw\\perp Av_1=Av$.

</proof>

To finish the proof let's induct on $k \\ge 4$, where $m+n=k$. Suppose any $m\\times n$ matrix with $m+n = 4,5,\\dots, k-1$ has SVD with uniquely determined singular values in descending order. Then for $m+n=k$, by induction hypothesis and according to equation (1), $B= U_2\\Sigma V_2^*$ with unique $\\Sigma$, and the existence of SVD follows from the formula:

$$
U_1^* A V_1=
\\left[
  \\begin{array}{c|c}
  \\sigma_1 & \\mathcal O\\\\
  \\hline
  \\mathcal O& U_2\\Sigma V_2^*
  \\end{array}
\\right]
=
\\left[
  \\begin{array}{c|c}
  1 & \\mathcal O\\\\
  \\hline
  \\mathcal O& U_2
  \\end{array}
\\right]
\\left[
  \\begin{array}{c|c}
  \\sigma_1 & \\mathcal O\\\\
  \\hline
  \\mathcal O& \\Sigma
  \\end{array}
\\right]
\\left[
  \\begin{array}{c|c}
  1 & \\mathcal O\\\\
  \\hline
  \\mathcal O& V_2^*
  \\end{array}
\\right].
$$

Although $\\Sigma$ is unique, it is dependent on $B$, while $B$ is dependent on the choice of basis. Fortunately under any changes of $(u_2,\\dots,u_m)$ and $(v_2,\\dots,v_n)$ to other o.n. bases, $U_2$ and $V_2$ will be replaced by other unitary matrices and $\\Sigma$ remains unchanged, hence singular values of $A$ are unique. The proof is almost completed by induction, except for the base case $m+n=4$, which is obvious by (1).

</proof>

<proof>

**Proof of Part (2).**
Let's assume $A\\in \\mathbb C^{n\\times n}$ is square. It is clear that $\\sigma_1=\\|A\\|_2$ since $\\|A\\|_2$ is the largest possible singular value of $A$. We first prove that if the right singular vector of $\\sigma_1$ is not \`\`unique", then $\\sigma_1$ is not simple, i.e., $\\sigma_1$ is repeated in $\\Sigma$.

Let $Av_1=\\sigma_1u_1$, $\\|v_1\\|_2=\\|u_1\\|_2=1$. Suppose there are other vectors $w,w'\\in \\mathbb C^n$, with $\\|w\\|_2=\\|w'\\|_2=1$ s.t. $Aw=\\sigma_1 w'$. For the sake of contradiction, let's assume $w\\not\\in \\mathbb C v_1$, then the unit vector $v_2 := \\frac{w-\\langle v_1,w\\rangle v_1}{\\|w-\\langle v_1,w\\rangle v_1\\|_2}$ is orthogonal to $v_1$. Now $\\|Av_2\\|_2\\leq \\|A\\|_2 = \\sigma_1$, the inequality cannot be strict, otherwise since $w = c v_1 + sv_2$ with $|c|^2+|s|^2=1$, we have

$$
\\sigma_1^2=\\|Aw\\|_2^2 = \\|c \\sigma_1 u_1 + s Av_2\\|_2^2= |c|^2|\\sigma_1|^2 + |s|^2 \\|Av_2\\|_2^2< \\sigma_1^2,
$$

absurd. We conclude $Av_2=\\sigma_1 u_2$, for some unit vector $u_2\\in (\\mathbb C u_1)^\\perp$. Now by the corollary one observes that

$$
A|_{(\\mathrm{span}_\\mathbb C(v_1,v_2))^\\perp}:(\\mathrm{span}_\\mathbb C(v_1,v_2))^\\perp\\to (\\mathrm{span}_\\mathbb C(u_1,u_2))^\\perp,
$$

and thus we can get a complete list of singular values with $\\sigma_1$ appears twice, a contradiction. Hence if $\\sigma_j$'s are distinct, $w\\in \\mathbb C v_1$, i.e., $w$ and $v_1$ differ by a multiplicative constant with modulus 1. It follows that $u_1$ is unique up to a complex sign. Finally since $A|_{(\\mathbb C v_1)^\\perp} : (\\mathbb C v_1)^\\perp\\to (\\mathbb C u_1)^\\perp$, by choosing the bases of these two spaces, the uniqueness follows from induction on dimension of the square matrix.

</proof>
`;export{n as default};
