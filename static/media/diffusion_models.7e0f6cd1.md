---
title: "Diffusion Model Study"
date: 2023-03-07
id: blog0124
tag: python, deep-learning
intro: Beginning study of diffusion model.
---

#### Reference

- [Denoising Diffusion Probabilitic Model](https://arxiv.org/pdf/2006.11239.pdf)
- [Diffusion Model：比“GAN"还要牛逼的图像生成模型！公式推导+论文精读，迪哥打你从零详解扩散模型！](https://www.bilibili.com/video/BV1pD4y1179T/?spm_id_from=333.788.recommend_more_video.11&vd_source=eaeec3286e77493a42a3dce415ee67cc)
- [Stable Diffusion: High-Resolution Image Synthesis with Latent Diffusion Models | ML Coding Series](https://www.youtube.com/watch?v=f6PtJKdey8E)

#### Introduction

<Center>
<img src="/assets/tech/124/001.png" width="100%" />
</Center>
<p/>
<center></center>

- Define $x_t$ as the image at time $t=T$ for $T\in {\mathbb N}_0$. When we travel about $t$, we add noise gradually until the image is unreadable. The noise is added by

  $$
  x_{t} = \sqrt{\alpha_{t-1}} x_{t-1} + \sqrt{1-\alpha_{t-1}}z_1,
  $$

  for $t\ge1$, where $z_t\sim \mathcal N(0,1)$ and $(0,1)\ni\alpha_t\to 0$.

- Note that started from $t=1$, we no longer consider $x_t$ as a concrete image, rather we consider $x_t$ as a random variable where only the mean and variance makes perfect sense.

- The true image depense on the instance of values that a gaussian noise provide.

- That means $x_t$ denotes a set of possibilities of images (data point). To understant $x_t$, we need to understand the density of the probability distribution $p(x_t)$.

- By direct expansion we have

  $$
  x_t = \sqrt{\alpha_t \alpha_{t-1}} x_{t-2} +\sqrt{\alpha_t(1-\alpha_{t-1})}z_2 + \sqrt{1-\alpha_t}z_1,
  $$

  where $z_1,z_2\sim \mathcal N(0,1)$.

- Since $\mathcal N(0, \sigma_1^2I) + \mathcal N(0, \sigma_2^2I)  = \mathcal N (0, (\sigma_1^2+\sigma_2^2)I)$, the last term becomes

  $$
  x_t = \sqrt{\alpha_t\alpha_{t-1}}x_{t-2}+\sqrt{1-\alpha_t\alpha_{t-1}}z_2
  $$

  for some $z_2\sim \mathcal N(0, 1)$.

- Define $\overline{\alpha}_t = \prod\limits_{0\leq i < t}\alpha_{t-i} = \prod\limits_{i=1}^{t}\alpha_{i}$ for $k\ge 1$, then
  $$x_t = \sqrt{\overline{\alpha}_t}x_0 +\sqrt{1-\overline{\alpha}_t}\cdot z_t, \tag{$*$}$$ for some $z_t\sim \mathcal N (0, 1)$.

- Note that $\alpha_{t+1}\overline{\alpha}_t = \overline{\alpha}_{t+1}$.

- The forward process of adding noise is denoted $x_t = q(x_{t-1})$

    <Center>
    <img src="/assets/tech/124/002.png" width="100%" />
    </Center>
    <p/>
    <center></center>

  We wish to calculate the reverse (denoise) process

    <Center>
    <img src="/assets/tech/124/003.png" width="100%" />
    </Center>
    <p/>
    <center></center>

- Recall the Bayse Forumla $\displaystyle P(A|B) =  P(B|A)\times \frac{P(A)}{P(B)}$.

- Given a set of images $x_t$, we wish to understand the distribution of $x_{t-1}$, i.e., we wish to calculate $p(x_{t-1}|x_t).$

- $p$ usually is used to denote known distribution.

- To emphasize we don't truly understand the distribution, we replace $p$ by $q$ to denote unknown distribution (the distribution that we are going to find or estimate, or to learn), the problem becomes estimating the distribution $q(x_{t-1}|x_t)$.

- As we know we add random noise from $t-1$ to $t$, it makes no sense to estimate the exact value of a random variable $x_{t-1}$ from $x_t$.

- Therefore what we want to estiamte is the average of $x_{t-1}$ from an instance of $x_t$.

- By Bayse formula, $\displaystyle q(x_{t-1}|x_t,x_0) = q(x_t|x_{t-1}, x_0) \frac{q(x_{t-1}|x_0)}{q(x_t|x_0)}$.

- To enable ourself to do computation, we also assume $q(x_{t-1}|x_t,x_0)$ follows Gaussian distribution.

- We now try to estimate the mean of $x_{t-1}$, name it $\hat\mu_{t-1}$.

- We have already studied the distribution of $x_t$ in $(*)$.

- Suppose that $x_t$ is given and we know that it comes from the previous distribution by adding gaussian noise with some weight (in the same way as before), then

  $$
  \begin{aligned}
  &{\color{white}=} q(x_{t-1}|x_{t}, x_0) \\
   &\propto \exp \left\{-\frac{1}{2}\left(\frac{(x_t-\sqrt{\alpha}x_{t-1})^2}{\beta_t} + \frac{(x_{t-1}-\sqrt{\overline{\alpha}_{t-1}}x_0)^2}{1-\overline{\alpha}_{t-1}}- \frac{(x_t-\sqrt{\overline{\alpha}_t} x_0)^2}{1-\overline{\alpha}_t}\right)\right\}\\
  &=\exp \Bigg\{
  -\frac{1}{2}\Bigg(\bigg(\frac{\alpha_t}{\beta_t} + \frac{1}{1-\overline{\alpha}_{t-1}}\bigg)x_{t-1}^2 - \bigg(\frac{2\sqrt{\alpha_t}}{\beta_t}x_t + \frac{2\sqrt{\overline{\alpha}_{t-1}}}{1-\overline{\alpha}_{t-1}} x_0\bigg)x_{t-1}\\
  &\qquad\qquad\qquad\qquad\qquad\qquad\qquad\qquad+C(x_t,x_0)\Bigg)
  \Bigg\}\\
  &=\exp\bigg(-\frac{(x_{t-1}-\mu)^2}{2\sigma^2}\bigg)
  \end{aligned}
  $$

  where $\beta_t=1-\alpha_t$.

- By comparing coefficients we have

  $$
  \mu =\mu(x_t,x_0) = \frac{\sqrt{\alpha_t}(1-\overline{\alpha}_{t-1})}{1-\overline{\alpha}_t}x_t + \frac{\sqrt{\overline{\alpha}_{t-1}}\beta_t}{1-\overline{\alpha}_t}x_0,
  $$

  by $(*)$ we have

  $$
  \begin{cases}
  \hat{\mu}_{t-1} = \frac{1}{\sqrt{\alpha_t}} \bigg(x_t - \frac{\beta_t}{\sqrt{1-\overline{\alpha}_t}}z_t\bigg), \\
  \sigma_{t-1}^2= \displaystyle\left(\frac{\alpha_t}{\beta_t}+ \frac{1}{1-\overline{\alpha}_{t-1}}\right)^{-1} = \frac{1-\overline{\alpha}_{t-1}}{1-\overline{\alpha}_t}\beta_t.
  \end{cases}
  $$

- $z_t$ will be what we are trying to learn.

- From $x_1$ to $x_2$ we add a noize $z_1$. We estimate (learn) $\hat z_1$ from $x_2$ to $x_1$, then $z_1$ will be our ground truth in the model. We elaborate this in the next section.

#### Training Algorithm

- <Center>
  <img src="/assets/tech/124/004.png" width="100%" />
  </Center>
  <p/>
  <center></center>

- In algorithm on the LHS:

  2. means we sample an image from our collection of image dataset ($q(x_0)$ means the distribution of the images that $x_0$ lives in, like category of dogs, cats, etc)
  3. means the timestamp is uniformly random
  4. means the noise $\epsilon$ we add from $t-1$ to $t$.
  5. $\epsilon_0$ is the estimate of $\epsilon$ from $t-1$ to $t$ (as we want to do the reverse). This $\epsilon_0$ is estimated from

     - $x_t$ (see $(*)$) and
     - timestamp $t$

     our loss function becomes $L = \|\epsilon - \epsilon_0(x_t, t)\|_2^2$.

#### Coding
