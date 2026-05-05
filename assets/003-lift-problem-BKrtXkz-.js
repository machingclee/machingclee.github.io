const n=`---
title: First to Leave Problem of Elevator
date: 2021-10-01
id: math003
tag: math
intro: Simple problem inspired by my life.
toc: false
---

When taking elevator one is possible to calculate the probability of being the first one to leave the lift.

In my situation, assume that:

- An elevator can just stop from floor $22$ to floor $40$.
- Infinite capacity.
- We start from ground floor.

Given that I will leave at floor $n$, where $22\\leq n < 40$, then the average probability of taking the first leave at floor $n$ is $\\displaystyle \\frac{1}{n-21}.$

**Reason.** Denote $E_k$, $k\\ge 2$, the event that floor $n$ is the first one to stop with $k$ buttons on the elevator control panel being pressed.

We discard the case $k=1$ as $\\mathbb P(E_1)=1$ is too big that pollutes our average value.

We have (for $k\\ge 2$)

$$
\\mathbb P(E_k) =\\displaystyle \\binom{40-n}{k-1} \\bigg/\\binom{18}{k-1}.
$$

- Note that we are just considering choosing $k-1$ buttons because floor $n$ being the first to stop has conditioned our sample space to combintations of selected buttons that contain $n$.

- Here the numerator $\\binom{40-n}{k-1}$ represents the combinations of buttons that is bigger than $n$.

- The demoninator $\\binom{18}{k-1}$ represents the available combinations of buttons apart from $n$.

Note that the edge case of $k$ is $k=2$ and $k= |\\mathbb N \\cap [n, 40]|=40-n +1$. Our average probability will be

$$
\\frac{1}{\\underbrace{40-n+1-2+1}_{\\text{number of summands}}}
\\sum_{k=2}^{40-n+1} \\mathbb P(E_k) = \\frac{1}{40-n}
\\sum_{k=2}^{41-n} \\frac{\\displaystyle \\binom{40-n}{k-1}}{\\displaystyle \\binom{18}{k-1}} \\xlongequal{(*)}\\frac{1}{n-21}.
$$

Here $(*)$ follows from the following lemma:

> **Lemma.** Let $X, Y$ be positive integers and $X\\leq Y$, then
>
> $$
> \\sum_{k=1}^X \\frac{\\binom{X}{k}}{\\binom{Y}{k}} = \\frac{X}{Y-X+1}.
> $$

<details>
<summary> <strong>Proof.</strong> [In case you want to try, don't unfold it]</summary>

---

Denote $A_k =\\binom{X}{k} / \\binom{Y}{k}$ and $S = \\sum_{k=1}^X A_k$. We note that

$$
\\begin{aligned}
A_k& = \\frac{\\binom{X}{k}}{\\binom{Y}{k}}\\\\
&= \\frac{\\binom{X+1}{k+1} - \\binom{X}{k+1}}{\\binom{Y}{k}} \\\\
&= \\frac{\\frac{X+1}{k+1}\\binom{X}{k}}{\\binom{Y}{k}} - \\frac{\\binom{X}{k+1}}{\\binom{Y}{k}} \\\\
&=  \\frac{\\frac{X+1}{k+1}\\binom{X}{k}}{\\binom{Y}{k}} - \\frac{\\binom{X}{k+1}}{\\frac{k+1}{Y-k}\\binom{Y}{k+1}} \\\\
&= \\frac{X+1}{k+1} A_k - \\frac{Y-k}{k+1}A_{k+1}.
\\end{aligned}\\\\
$$

We rearrange to conclude

$$
\\begin{aligned}
(Y+1)A_{k+1}-XA_k &= (k+1)A_{k+1} - kA_k\\\\
\\sum_{k=1}^{X-1} \\big((Y+1)A_{k+1}-XA_k \\big) &= \\sum_{k=1}^{X-1}\\big((k+1)A_{k+1} - kA_k\\big)\\\\
(Y+1) (S-A_1) - X(S-A_X)&=XA_X - A_1\\\\
(Y-X+1)S &= YA_1\\\\
S &= \\frac{Y}{Y-X+1}A_1\\\\
&=\\frac{Y}{Y-X+1} \\cdot \\frac{X}{Y} \\\\
&= \\frac{X}{Y-X+1},
\\end{aligned}
$$

as desired. $\\qquad \\blacksquare$

</details>

I am at floor $n=34$, therefore on average I just have

$$
\\frac{1}{34-21} = \\frac{1}{13} \\approx 7.69\\%
$$

chance of being the first one to leave if there are at least 2 buttons pressed in control panel.
`;export{n as default};
