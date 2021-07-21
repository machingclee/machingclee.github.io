title: WGAN-GP (WIP)
date: 2021-07-20
intro: Understand the paper: <a href="https://arxiv.org/abs/1701.07875" target="_blank">Wasserstein GAN paper</a>

##### On Gradient Penalty
Give $p_\theta$, MLE objective in GAN is to solve 
$$
\argmax_{\theta\in\R^d} \frac{1}{m} \sum_{i=1}^m \log p_\theta(x^{(i)}).
$$
Since 
$$
\begin{aligned}
    &\quad \,\lim_{m \to \infty}
    \argmax_{\theta \in \mathbb{R}^d} \frac{1}{m}\sum_{i=1}^m \log p_\theta(x^{(i)})\\
    &= \argmax_{\theta \in \mathbb{R}^d} \int_x p_r(x) \log p_\theta(x) \, dx \\
    &= \argmin_{\theta \in \mathbb{R}^d} -\int_x p_r(x) \log p_\theta(x) \, dx \\
    &= \argmin_{\theta \in \mathbb{R}^d} \left(\int_x p_r(x) \log p_r(x) \, dx -\int_x p_r(x) \log p_\theta(x) \, dx \right) \\
    &= \argmin_{\theta \in \mathbb{R}^d} \KL(p_r \,\|\, p_\theta),
    \end{aligned}
$$
maximization in MLE is the same as minimizing the KL-divergence. The first equality holds because for finer and finer partition $\{a_{m,j}\}_{j=0}^\infty$, we have 
$$
\frac{1}{m} \sum_{i=1}^m f(x^{(i)}) = \sum_{j} f(a_{m,j}) \underbrace{\frac{N(X\in[a_{m,j}, a_{m,j+1}])}{m}}_{\approx\int_{[a_{m,j}, a_{m,j+1}]}p_r(x)\,dx}.
$$
Recall that the measure $(p_r(x)dx)(A)$ represents the fraction of data lying within $A\subseteq \R$.


##### Earth Mover (EM) or Wasserstein distance
Let $\prod(p_r,p_g)$ be the set of all joint distributions $\gamma$ whose marginal distributions are $p_r$ and $p_g$. Then then **Wasserstein distance** between $p_r,p_g$ is defined by
$$
W(P_r, P_g) = \inf_{\gamma \in \Pi(p_r ,p_g)} \mathbb{E}_{(x, y) \sim \gamma}\big[\|x-y\|\big]
$$

**Motivation.** Every $\gamma$ is considered as a transportation plan, for which we move $\gamma(x,y)$ amounts of mass at $x$ to $y$. Mass at $x$ will be used up when we have transported all mass at $x$ to all $y$, the quantity is $\int_y \gamma(x,y)\,dy$. And by "use up" we mean 
$$
p_r(x) = \int_y \gamma(x,y)\,dy.
$$ 

Similarly if we do it reversely, 
$$
p_g(y) = \int_x \gamma(x,y)\,dx.
$$
These are the necessary conditions in our Wasserstein distance.

Now $\gamma(x,y)dxdy$ denotes the fraction of mass transported from a neighborhood of $x$ to a neighborhood of $y$. The work done to move an object of mass $m$ to a distance $d$ is $ma\times d$. Assuming $a\equiv 1$, then $\gamma(x,y)dxdy\times \|x-y\|$ is the total  work done to move $x$ to a neighborhood of $y$. Therefore the total work to move $p_r$ to $p_g$ is 
$$
\int_x \int_y \gamma(x,y) \|x-y \| \,dxdy = \E_{(x,y) \sim \gamma}\big[\|x - y\|\big].
$$


By Kantorovich-Rubinstein duality, $W$ is equivalent to 
$$
W(P_r, P_\theta) = \sup_{\|f\|_L \leq 1}\left(
\E_{x \sim p_r}[f(x)] - \E_{x \sim p_\theta}[f(x)]\right). \tag*{$(*)$}
$$
We would like to train $g_\theta(Z)\sim p_\theta$ (i.e., we let $p_\theta$ be the distribution of $g_\theta(Z)$) as close to $p_r$ as possible. But before that, we first show that when $Z\sim p$, 
$$
\E_{x \sim p_\theta}[f(x)]=\E_{z\sim p(z)}[f(g_\theta(z))] \tag*{$(**)$}.
$$
\
***Proof.*** Since $g_\theta(Z)\sim p_\theta$, this is equivalent to for any $A$ in the ambient space of $X$,
$$
\P(g_\theta(Z)\in A) = (p_\theta(x)dx)(A)=\int \chi_A(x)p_\theta(x)\,dx.
$$
But
$$
\text{LHS} = \P(Z\in g_\theta^{-1}(A))=\int\chi_{ g_\theta^{-1}(A)}(z) p(z)\,dz = \int \chi_A(g_\theta(z))p(z)\,dz,
$$
combining two equalities we have 
$$
\E_{z\sim p(z)}[f(g_\theta(z))]=\int f(g_\theta(z))p(z)\,dz = \int f(x)p_\theta(x)\,dx = \E_{x\sim p_\theta} [f(x)].\qed
$$

From $(*)$ and $(**)$ our Wasserstein distance becomes 
$$
W(p_r, p_\theta) = \sup_{\|f\|_L\leq 1} \left(\E_{x\sim p_r}[f(x)] - \E_{z\sim p(z)}[f(g_\theta(z))]\right),
$$
this explains line 5 in the algorithm:
<center>
<img width="560" src="gradient-penality/algorithm.png"/>
</center>



##### Reference
* <a href="https://www.alexirpan.com/2017/02/22/wasserstein-gan.html?fbclid=IwAR2Os2xxsh6cvOXGdrpifdDCFBa9vLwUXhXO1oPV6y4BJaTq0obv2ikrlzo" target="_blank">Read-through: Wasserstein GAN</a>