const n=`---
title: Principal Component Analysis
date: 2022-04-30
id: blog069
tag: math
intro: Before I forget, record my basic understanding on what is Principal Component Analysis and how it works.
---

### Why do we want First Principal Component?

Suppose that the data $x_1,x_2,\\dots,x_n$ with $d$ features are represented as a row vector, denote the matrix

$$
\\hat B := \\begin{bmatrix}
-\\!\\!\\!-x_1-\\!\\!\\!-\\\\
-\\!\\!\\!-x_2-\\!\\!\\!-\\\\
\\vdots\\\\
-\\!\\!\\!-x_n -\\!\\!\\!-
\\end{bmatrix}
- \\begin{bmatrix} 1\\\\ 1 \\\\ \\vdots \\\\ 1\\end{bmatrix}
  \\underbrace{\\frac{1}{n}\\sum_{i=1}^n \\begin{bmatrix}
  -\\!\\!\\!-x_i-\\!\\!\\!-
  \\end{bmatrix}}_{=:\\mu}
   =
\\begin{bmatrix}
-\\!\\!\\!-(x_1 - \\mu)-\\!\\!\\!-\\\\
-\\!\\!\\!-(x_2 - \\mu)-\\!\\!\\!-\\\\
\\vdots\\\\
-\\!\\!\\!-(x_n - \\mu)-\\!\\!\\!-
\\end{bmatrix}.
$$

For every unit vector $\\hat n\\in \\mathbb R^d$, it is easy to see that $\\hat B \\hat n$ represents all the magnitude of $x_i-\\mu$ projected onto $\\mathrm{span} (\\hat n)$.

Next,

$$
\\|\\hat B \\hat n\\|_2 = \\left\\|
  \\begin{bmatrix}
    \\langle x_1 - \\mu, \\hat n \\rangle \\\\
    \\langle x_2 - \\mu, \\hat n \\rangle\\\\
    \\vdots\\\\
    \\langle x_n - \\mu, \\hat n \\rangle
  \\end{bmatrix}
\\right \\|_2
=\\sqrt{\\sum_{i=1}^n \\langle x_i - \\mu, \\hat n \\rangle^2}
$$

is the standard deviation of the set of values $\\{\\langle x_i-\\mu, \\hat n \\rangle\\}_{i=1}^n$ with mean $0$. Our target is now to find a direction $\\hat n $ so that the standard deviation is ***as huge as possible***, therefore along that direction our data $\\{x_1-\\mu,\\dots,x_n-\\mu\\}$ will be much more comparable and hopefully we can find clustering values for which the data can be grouped together.

Finding such a direction is the same as finding $v\\in \\mathbb R^d$ with $\\|v\\|_2=1$ such that

$$
\\sigma = \\max_{x\\in \\mathbb R\\setminus\\{0\\}} \\frac{\\|\\hat Bx\\|_2}{\\|x\\|_2} =\\| \\hat B v\\|_2.
$$

We call $v$ the **_first principal component_**.

> **Conclusion.** **_First Principal Component_** is a unit vector in $v\\in \\mathbb R^d$ that maximizes the standard deviation of $\\{\\langle x_i-\\mu, v\\rangle\\}_{i=1}^n$, where $\\mu = \\frac{1}{n}\\sum_{i=1}^n x_i$.

### In Terms of Singular Value Decomposition

$v$ is in fact the right singular vector corresponding to the largest singular value. The **_$k$-th principal component_** is accordingly the $k$-th right singular vector corresponding to the $k$-th largest singular value.

Note that by constructon $v_{k+1} \\in (\\mathrm{span} \\{v_1,v_2,\\dots,v_k\\})^\\perp$.
`;export{n as default};
