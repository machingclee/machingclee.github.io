title: Review of Basic Statistics
date: 2021-07-19
intro: Review the definition of distribution, multivariable normal distribution, and some concrete examples.


##### Multinormal Distribution


Suppose $X:\Omega\to\mathbb R^d$ is a  random variable defined on $(\Omega,\mathcal F,\mathbb P)$, the measure $\mu_X:A\mapsto \mathbb P(X^{-1}(A))$ defines a measure on $\mathbb R^d$, called the **distribution of $X$**. 

**Definition.** A random variable $X:(\Omega, \mathcal F, \mathbb P)\to \mathbb R^d$ is said to be **discrete** if there is a countable set $C$ such that 
$$
\mathbb P(X\in C)=1.
$$

**Definition.** A randome variable $X:(\Omega, \mathcal F, \mathbb P)\to \mathbb R^d$ is said to be **continous** if $\mu_X$ is **absolutely continuous** w.r.t. the Lebesgue measure $\mathcal L^d$ on $\mathbb R^d$, in that case, there is a unique integrable function $f_X$ such that 
$$
\mathbb P(X\in A) = \int_A f_X(x)\,d\mathcal L^d(x)\qquad \text{for every measurable $A$}.
$$
$f_X$ is called the **probability density function** of $X$.

For example, when $d=1$, if we assume a set of data on $\mathbb R$ follow a normal distribution, then the point where data accumulate most obviously should be the center, the mean, of our distribution.

When $d=2$, we  use such an $X$  to fit data in $\mathbb R^2$ whose "distribution/separation/density" spreads like a normal distribution in a radial fashion.


<center>
  <img width="350" src="./2021-07-18/image_02.png" style="margin-bottom:20px">
</center>



Here the value $f(x_1,x_2)$ in $z$-axis denotes the "fraction of data" appear if we draw a small circle around $(x_1,x_2)$. If $f(x_1,x_2)$ is the peak, that means the data points cluster most rapidly near $(x_1,x_2)$.

It also makes sense to say that a list of integers follow a normal distribution if the integer-frequency table plots like a normal distribution. Just think of a set of points in $\mathbb R$ now collapse into a bin of length $1$ by taking floor function.

**Definition.** For $d$-dimensional case, the pdf of a **multinormal distribution** $X$ evaluted at $x\in \mathbb R^d$ is defined by 
$$
\mathcal N(x;\mu, \Sigma) = \frac{1}{(2\pi)^{d/2}\sqrt{\det \Sigma}} \exp \left(-\frac{1}{2}(x-\mu)^T\Sigma^{-1}(x-\mu)\right).
$$

Where $\Sigma$ is a positive definite variance-covariance matix of the Gaussian, with $\Sigma_{ij}=\mathrm{Conv}(X_i,X_j)$.



**Example.** Suppose that $X_i \sim \mathcal N(\mu_i,\sigma_i)$ for $i=1,2$, then define $X=[X_1, X_2]$. Now their pdf are respectively
$$
f_{X_1}(x_1) = \frac{1}{Z_1} \exp \left\{-\frac{1}{2\sigma_1^2}(x_1-\mu_1)^2 \right\} \quad \text{and}\quad f_{X_2}(x_2) = \frac{1}{Z_2} \exp \left\{-\frac{1}{2\sigma_1^2}(x_2-\mu_2)^2 \right\},
$$
where $Z_i = \sigma_i\sqrt{2\pi}$. The pdf of $X$ is the joint pdf of $X_1$ and $X_2$,  given by 
$$
f_X(x)=f_X(x_1,x_2) = f_{X_1}(x_1)f_{X_2}(x_2) = \frac{1}{Z_1Z_2} \exp \left\{-\frac{1}{2}(x-\mu)^T \Sigma^{-1} (x-\mu) \right\}
$$
where $x=[x_1,x_2],\mu=[\mu_1,\mu_2]$ and $\Sigma = \mathrm{diag}(\sigma_1^2, \sigma_2^2)$. Interpret the vector as column when necessary.

##### Conditional Expectation

Assume that $X$ and $Y$ are discrete random variable, we will have all the same result for continuous ones.

* $$
  P(X=x|Y=y) = \frac{P(X=x\,\text{ and }\,Y=y)}{P(Y=y)}
  $$

* $$
  f_{X|Y} (x|y) = P(X=x| Y=y)
  $$
  Here for the moment $X|Y$ is simply a notation that carries no specific meaning. Later we will treat it as a parametrized family of random variables.

* $$
  \mu_{X|Y=y} = E(X|Y=y) = \sum_x xf_{X|Y}(x|y)
  $$

* $E(X|Y=y)$ is a number depending on $y$, and indeed if we let $y$ varies, we get a new random variable:
  $$
  E(X|Y) : y\mapsto E(X|Y=y)
  $$

    Suppose 
    $$
    Y = \begin{cases} 
    1 & \text{with probability $1/8$}\\
    2 & \text{with probability $7/8$}.
    \end{cases}
    $$
    We can define a $y$-parametrized random variable by 
    $$ 
    X|Y =  \begin{cases} 
    2Y & \text{with probability $3/4$}\\
    3Y & \text{with probability $1/4$}
    \end{cases}
    $$

  * If $Y=1$, 
    $$
    X|(Y=1) = \begin{cases} 
    2 & \text{with probability $3/4$}\\
    3 & \text{with probability $1/4$}
    \end{cases}\quad 
    $$ 
    and hence 
    $$
    E(X|Y=1) = 2\times \frac{3}{4} + 3\times \frac{1}{4} = \frac{9}{4}.
    $$
    
   * If $Y=2$, 
     $$
     X|(Y=2) = \begin{cases} 
     4 & \text{with probability $3/4$}\\
     6 & \text{with probability $1/4$}
     \end{cases}
     $$ 
     and hence 
     $$
     E(X|Y=2) = 4\times \frac{3}{4} + 6\times \frac{1}{4} = \frac{18}{4}.
     $$
    
    * $X|Y$ is nothing but a **family of random variables** and $h(Y):=E(X|Y)$ is a new random variable.

    * Similarly, $\mathrm{Var}(X|Y)$ is also a random variable and 
    $$
    h(Y):=\boxed{\mathrm{Var}(X|Y) = E(X^2|Y) - (E(X|Y))^2 = E[(X-\mu_{X|Y})^2|Y]}
    $$

    * $E(g(X)) = E_Y(E(g(X)|Y))$ because 
    $$
    E_Y(E(g(X)|Y)) 
    = E_Y\left[\sum_x g(x)P(X=x | Y)\right]
    = \sum_y\left[\sum_x g(x)P(X=x | Y=y)\right]P(Y=y)
    $$

    The RHS above becomes $\sum_x g(x)P(X=x) = E(g(X))$.

**Example.** Fraser runs a dolphin-watch business. Every day, he is unable to run the trip due to bad weather with probability $p$, independently of all other days. Fraser works every day except the bad-weather days, which he takes as holiday


Let $Y$ be the number of consecutive days Fraser has to work between badweather days. Let $X$ be the total number of customers who go on Fraser's trip in this period of $Y$ days. Conditional on $Y$, the distribution of $X$ is
$$(X | Y ) \sim \mathrm{Poisson}(\mu Y).$$

* $Y\sim \mathrm{Geometric}(p)$, because "bad weather" can be treated as a "success" trial that the "experiment" must be stopped. In this case, $E(Y) =(1-p)/p$ and $\mathrm{Var}(Y)= (1-p)/p^2$.

* It is given that $(X | Y ) \sim \mathrm{Poisson}(\mu Y)$, therefore 
$$
E(X|Y) = \mathrm{Var}(X|Y) = \mu Y.
$$
By the Law of Total Expectation, 
$$
E(X) = E_Y(E(X|Y)) = E_Y(\mu Y) = \mu E_Y(Y) = \frac{\mu(1-p)}{p}.
$$
By the law of Tatal Variance,
$$
\begin{aligned}
\mathrm{Var}(X) &= E_Y[\mathrm{Var}(X|Y)] + \mathrm{Var}_Y(E(X|Y))\\
&= E_Y(\mu Y) + \mathrm{Var}_Y(\mu Y)\\
&=\mu\frac{1-p}{p} +\mu^2\frac{1-p}{p^2} \\
&= \frac{\mu(1-p)(1+p)}{p^2}\\
&= E_Y(\mu Y) + \mathrm{Var}_Y(\mu Y) \\
&=\mu\frac{1-p}{p} +\mu^2\frac{1-p}{p^2} \\
&= \frac{\mu(1-p)(1+p)}{p^2}
\end{aligned}
$$