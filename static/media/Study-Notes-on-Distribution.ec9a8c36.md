title: Study Notes on Distribution and Latent Variable Model in Vartiaonal Auto Encoder
date: 2021-07-10
intro: Study the formulas on conditioned joint-distribution such as relation between $p(a,b|c)$ , $p(a|b,c)$ and $p(b|c)$. We also discuss the latent variable model in variational Auto Encoder.



##### Thinking in Bayesian way 
Let $\theta$ be a set of parameters that affect the outcome $x$. We call the assumption $P(\theta) = \alpha$ a **prior probability** and call, for a new outcome $x'$, 
$$
P(\theta|x') = \frac{P(x'|\theta)P(\theta)}{\sum_{i} P(x'|\theta_i)P(\theta_i)}
$$
a **posterior probability**. We also say that we **update** the prior by making use of the posterior probability as our new prior probability.


##### Formulas on distribution



* $p(a|b) = \displaystyle\int p(a,c|b)\,dc$

* $p(a|b) = \displaystyle\int p(a|b,c)p(c)\,dc$ when $b$ and $c$ are independent.

* $\displaystyle p(a|b,c) = \frac{p(b|a,c)p(a|c)}{\displaystyle \int p(b|a',c)p(a'|c)\,da'}$

* $p(a,b|c) = p(a|b,c)p(b|c)$

* $\displaystyle p(a|b) = \frac{p(a,c|b)}{p(c|a,b)}$

* $p(a|b)p(b) + p(a|\bar{b})p(\bar{b}) = p(a)$

* If $p(a,b,c) = p(a|b)p(b|c)p(c)$, we cannot conclude $a$ and $c$ are independent.

* If $p(a,b,c,d) = p(a|b)p(b)p(c|d)p(d)$, we can conclude $a$ and $c$ are independent.

* You have a kettle that boils water. You pour water up to level $L_0$ and turn the kettle on.  Over time, temperature $T$ starts to increase. At time $t$, level of water is $L$. Since water is boiling, water level slightly oscillates and so can be considered random. You also know that the height of a kettle is limited. If at some point water level exceeds this value, water will split on a table. We will denote this event as a binary random variable $O$ (overflow). Our goal is to determine the maximum allowed initial water level $L_{max}$  so that we can write it down in a kettle manual. Normally we would like to find $L_{max}$ for which, for example, $P(O|L_0 = L_{max}) = 0.001$: if you pour this amount of water, overflow will occur with a fairly low probability.

  We will construct a Bayesian network and select probability distributions needed for the model.

  Our Bayesian network is as follows.

  The graphical model

  <center>
    <img width="200" src="2021-07-18/graphical_model.png"/>
  </center>
  
  \
  can be described by the joint distribution function:

  $$
  p(O,L,L_0,T,t)=p(O|L)p(L|L_0,T)p(T|L_0,t)P(L_0)P(t)
  $$

##### Latent Variable Models
* To calculate ***posterior probability*** $P(\theta | x)$ we need to know how to compute $P(x|\theta)$ by Bayse formula. To simplify the problem we may try to assume there are hidden random variable $z$ that affects $x$, namely, $\boxed{z}\to \boxed{x}$. 

* Now we study the maximum likelihood problem: find $\theta$ that maximize:
$$
\begin{aligned}
\ln p(x|\theta)&=\ln  \int p(x,z|\theta)\,dz\\
&=\ln \left(\int \frac{p(z|x,\theta)p(x|\theta)}{q(z)}\cdot q(z)\, dz\right)\\
&\ge \underbrace{\int q(z) \ln \frac{p(z|x,\theta)p(x|\theta)}{q(z)}\,dz}_{:=\mathcal L (\theta, q)}
\end{aligned}
$$
where $q$ is any distribution of $z$ and the last line follows from Jensen's inequality. We try to maximize the lower bound $\mathcal L$ w.r.t $q$ and then $\theta$. Optimially for each optimization step, we can find $q_\theta$ such that $\mathcal L(\theta,q_\theta)$ touches our target, and move $\theta$ to attains a better maxima of $\mathcal L$ that eventually is also a maxima of our log-likelihood.

<center>
    <img width="300" src="2021-07-18/likelihood.png"/>
</center>

**Definition.** The **Kullback-Leibler divergence** (or **relatve entropy**) from $p$ to $q$ is defined by 
$$
D_{\mathrm{KL}} (q \parallel p) = \int q(x)\ln \frac{q(x)}{p(x)}\,dx
$$
or when $q$ is a discrete distribution, 
$$
D_{\mathrm{KL}} (q \parallel p) = \sum_{i=1}^\infty q(x=t_i)\ln \frac{q(x=t_i)}{p(x=t_i)}.
$$
It can be viewed as the difference of **average information** w.r.t. the probability measure $q(x)\, dx$. Namely, $D_{\mathrm{KL}} (q \parallel p) = E_q(\ln q) - E_q(\ln p)$.

KL divergence has the following properties:

* $D_{\mathrm{KL}} (q \parallel p)\neq   D_{\mathrm{KL}} (p\parallel q)$

* $D_{\mathrm{KL}} (q \parallel q) = 0$

* $D_{\mathrm{KL}} (q \parallel p) \ge 0$   (by Jensen's inequality)

Since  
$$ 
\ln p(x|\theta) - \mathcal L(\theta,q) = D_\mathrm{KL} (q\parallel p(\cdot | x,\theta)),
$$ 
it remains to minimize the KL divergence on the right. But this is the same as maximizing
$$
\begin{aligned}
\mathcal L(\theta, q)& = \int q(z) \ln \frac{p(z|x,\theta)p(x|\theta)}{q(z)}\,dz\\
& = \int q(z) \ln \frac{p(x|z,\theta)p(z|\theta)}{q(z)}\,dz\\
&= \int q(z)\ln p(x|z,\theta)\,dz + \int q(z) \ln \frac{p(z|\theta)}{q(z)}\,dz\\
&= E_{z\sim q(z)} \big(\ln p(x|z,\theta)\big) - D_{\mathrm{KL}}\big(q\parallel p(\cdot |\theta)\big)
\end{aligned}
$$
Since $q$ is arbitrary, it is much more common to choose $q(z|x)$ instead of $q(z)$ alone, we replace to get
$$
\boxed{
  \mathcal L(\theta, q(\cdot|x)) = 
  E_{z\sim q(z|x)} \big(\ln p(x|z,\theta)\big) - D_{\mathrm{KL}}\big(q(\cdot|x)\parallel p(\cdot |\theta)\big)
  }
$$  

Put in other way, we need to minimize 
$$
  - \mathcal L(\theta, q(\cdot|x)) = D_{\mathrm{KL}}\big(q(\cdot|x)\parallel p(\cdot |\theta)\big) -  E_{z\sim q(z|x)} \big(\ln p(x|z,\theta)\big)\ge 0 
$$
And this becomes our loss function in Variational Encoder.

