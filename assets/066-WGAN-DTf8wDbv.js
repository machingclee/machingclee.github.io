const n=`---
title: WGAN and WGAN-GP
date: 2022-04-22
id: blog066
tag: deep-learning
intro: We modify from DCGAN from <a href="/blog/article/GAN-and-DCGAN-in-Tensorflow"><i>this post</i></a> to experiment on WGAN by weight-clipping, then we try to experiment WGAN-GP using gradient penality.
---

### Results

After the implementation and the results I was amazed by the horrible performance of WGAN-GP compared to that of WGAN.

Although mnist is a toy dataset, but among all the GANs I have implemented none of them can converge that quickly even without tuning parameters for many times.

#### By WGAN Using 4000 Batches

<center>
<img src="/assets/tech/043-01.png" width="170"/>
<img src="/assets/tech/043-02.png" width="170"/>
<img src="/assets/tech/043-03.png" width="170"/>
<img src="/assets/tech/043-04.png" width="170"/>
<img src="/assets/tech/043-05.png" width="170"/>
<img src="/assets/tech/043-06.png" width="170"/>
<img src="/assets/tech/043-07.png" width="170"/>
<img src="/assets/tech/043-09.png" width="170"/>
</center>

#### By WGAN-GP Using less than 1000 Batches

<center>
<img src="/assets/tech/046-01.png" width="170"/>
<img src="/assets/tech/046-02.png" width="170"/>
<img src="/assets/tech/046-03.png" width="170"/>
</center>

### Wasserstein Metric

#### Definitions, Basic Examples and some Mathematics

Given the real distribution $P_r$ of real data, we try to approximate it by a distribution $P_\\theta$, such that $g_\\theta(Z)\\sim P_\\theta $ for some network $g_\\theta$ with $Z$ being an unknown random variable (usually this is constructed from Gaussian distribution $\\mathcal N(0,1)$).

From **[MA]** the **_Wasserstein metric_** behaves the best from experiment and theoretical observations:

$$
W(P_r, P_\\theta) := \\inf_{\\gamma\\in \\Pi (P_r, P_\\theta) } \\mathbb E(\\|x-y\\|),
$$

where for any probability measures $\\mu, \\nu $ on $X$, $\\Pi (\\mu, \\nu)$ denotes the set of all **_transportation plans_** form $\\mu$ to $\\nu$ such that $\\pi^1\\# \\gamma = P_r$ and $\\pi^2\\#\\gamma = P_\\theta$. Here $\\pi^i:X\\times X\\to X$'s are canonical projections.

By an abuse of notation, for any probability measure $\\rho$ that is absolutely continuous w.r.t. Lebesuge measure $dx$ on $\\mathbb R^n$ we refer $\\rho$ also the density function $\\rho\\in L^1(\\mathbb R^n)$ and write $\\rho = \\rho\\,dx$ interchangeably, therefore $P_r=P_r\\,dx$ and $P_\\theta = P_\\theta\\,dx$ in our case, and thus the notation $W(P_r, P_\\theta)$ makes sense.

The following example is taken from **[MA]**, let's fill in the detail:

<example>

**Example.** Let $Z\\sim U[0,1]$ be a random variable sampled from uniform distribution on $[0,1]$, the sets $X_0 := \\{0\\} \\times [0,1]$ and $X_\\theta := \\{\\theta\\} \\times[0,1]$ form a disjoint subsets in $\\mathbb R^2$.

Consider $X = X_0\\sqcup X_\\theta$, denote $P_0$ the distribution of $(0, Z)$ in $X$ and $P_\\theta$ that of $(\\theta, Z)$ in $X$, then $P_0$ and $P_\\theta$ obviously have no nonempty common support.

<center>
<img src="/assets/tech/045.png"/>
</center>

<p><p/>

We consider the following metrics among these two distributions:

- $W(P_0,P_\\theta) = |\\theta|$

  **Reason.** $W(P_0,P_\\theta)\\ge |\\theta|$ is obvious, for equality define the map $t:(0,x)\\mapsto (\\theta, x)$ on $X_0$ and $(\\theta,x)\\mapsto (\\theta,x)$ on $X_\\theta$, then $t:X\\to X$ satisfies $t\\# P_0 = P_\\theta$.

  From standard result in optimal transport, the map $(\\mathrm{id}, t):X\\to X\\times X$ induces a transportation plan $\\gamma := t\\# P_0\\in \\Pi(P_0, P_\\theta)$ which is a measure on $X\\times X$.

  Denote $d(x,y)=\\|x-y\\|$, we have

  $$
  \\begin{aligned}
    \\int_{X\\times X} d(x,y)\\, d\\gamma(x,y)
    &= \\int_{X\\times X}\\,d(x,y) \\,d \\big((\\mathrm{id}, t)\\# P_0\\big)(x,y)\\\\
    &= \\int_X d\\big((\\mathrm{id},t) (x)\\big)) \\,d P_0(x)\\\\
    &= \\int_X d(x, t(x))\\,dP_0(x)\\\\
    &= \\int_X |\\theta| \\,dP_0(x) \\\\
    &= |\\theta|,
  \\end{aligned}
  $$

  therefore $W(P_0,P_\\theta)=|\\theta|$.

- $JS(P_0,P_\\theta) = \\frac{1}{2}(KL(P_0\\|P_m)  + KL(P_\\theta\\|P_m)) = \\log 2$, where $P_m = \\frac{P_0+P_\\theta}{2}$

  **Reason.** $KL(P_0\\|P_m)=\\int_{X} \\log (\\frac{P_0}{P_m}) P_0\\,dx$, since $X=X_0\\sqcup X_\\theta$ on which $P_0$ and $P_\\theta$ have no common support, therefore

  $$
    KL(P_0\\|P_m) = \\int_{X_0} \\log \\frac{P_0}{\\frac{P_0 + 0}{2}}P_0\\,dx = \\log 2\\int_{X_0} P_0(x)\\,dx = \\log 2.
  $$

  Similarly, $KL(P_\\theta\\|P_m) = \\log 2$, and the result follows.

- $KL(P_0\\|P_\\theta) = KL(P_\\theta\\|P_0) = \\infty$

  **Reason.** Demoninator 0 on a set of positive measure.

</example>

#### The Usual form of Wasserstein Metric for Coding

A remarkable result named **_Kantorovich-Rubinstein duality_** from optimal transport states that

$$
W(P_r,P_\\theta)  = \\sup_{\\|f\\|_L \\leq 1} (\\mathbb E_{x\\sim P_r}[f(x)] - \\mathbb E_{x\\sim P_\\theta}[f(x)])
$$

Since $g_\\theta(Z) \\sim P_\\theta$, we can further write

$$
W(P_r,P_\\theta)  = \\sup_{\\|f\\|_L \\leq 1} (\\mathbb E_{x\\sim P_r}[f(x)] - \\mathbb E_{z\\sim p(z)}[f(g_\\theta(z))]),
$$

where we assume that $Z\\sim p$, for some density $p\\in L^1(\\mathbb R^{\\texttt{z_dim}})$ with $\\texttt{z_dim}$ being the latent dimension which we need to search by experiment (rigorously the **_equality holds_** by a standard real analysis trick: prove it for first characteristic functions, second simple functions, finally use monotone convergence etc).

##### WGAN Version

In coding we transform the last equality into an approximated form in $(*)$

$$
\\begin{align*}
  W(P_r,P_\\theta) &\\approx \\sup_{w} \\bigg(\\,\\,\\,\\mathbb E_{x\\sim P_r}[
    f_w(\\!\\!\\!\\!\\underbrace{x}_{\\text{real sample}}\\!\\!\\!\\!)] -
    \\mathbb E_{z\\sim p(z)}[f_w(\\!\\!\\!\\!\\!\\!\\!\\!\\!\\underbrace{g_\\theta(z)}_{\\text{generated sample}}\\!\\!\\!\\!\\!\\!\\!\\!\\!)
  ]\\quad \\bigg)
 \\tag*{$(*)$}\\\\
&=- \\inf_{w} \\bigg(\\mathbb E_{z\\sim p(z)}[f_w(g_\\theta(z))] - \\mathbb E_{x\\sim P_r}[f_w(x)]\\bigg). \\tag*{$(**)$}
\\end{align*}
$$

We will be replacing the set of 1-Lipschitz functions $f$ by a parametrized family $\\{f_w\\}$ and perform the following in train loop:

<center>
<a href="/assets/tech/044.png">
<img src="/assets/tech/044.png" width="600"/>
</a>
</center>
<p></p>

- **Line 6 in Algorithm.**

  - We minimize the term

    $$
      \\mathcal L_c:=\\mathbb E_{z\\sim p(z)}[f_w(g_\\theta(z))] - \\mathbb E_{x\\sim P_r}[f_w(x)]
    $$

    in the RHS of $(**)$ w.r.t. $w = \\texttt{critic.trainable_variables}$ to get a result that is hopefully close to $W(P_r,P_\\theta)$. <br/>

  - We update critic by $\\partial \\mathcal L_c/\\partial w$.

- **Line 11 in Algorithm.**
  - We minimize
    $$
      \\mathcal L_g := -\\mathbb E_{z\\sim p(z)}[f_w(g_\\theta(z))]
    $$
    in the RHS of $(*)$ w.r.t. $\\theta=\\texttt{gen.trainable_variables}$ to get smaller $W(P_r,P_\\theta)$.
  - We update generator by $\\partial \\mathcal L_g/\\partial \\theta$.
- Usually the candidates of $\\{f_w\\}$ are modified from our discriminator.

- (cont'd) As we will not use signmoid output any more, usually we call $f_w$ a **_critic_** which replaces the role played by the usual $\\log D$ trick. Then we can modify our discriminator to output any tensor of shape $(\\texttt{batch_size}, 1)$.

##### WGAN-GP Version

As discussed in **[IG]** the weight clipping causes our critics to learn very simple functions, therefore we remove the constraint on the norm of $\\nabla_x f_w(x)$ for $x\\sim P_r$ and force the norms to be bounded by introducing a loss term in the following:

$$
\\mathcal L = \\underbrace{ \\mathbb E_{z\\sim p(z)}[f_w(g_\\theta(z))] - \\mathbb E_{x\\sim P_r}[f_w(x)]}_{\\text{original critic loss}} + \\lambda\\times  \\underbrace{\\mathbb E_{\\hat x \\sim P_{\\hat x}} \\big[(\\|\\nabla f_w(\\hat x)\\|_2 - 1)^2\\big]}_{\\text{gradient penality}}.
$$

Where $P_{\\hat x}$ denotes the uniform distribution of points along straight lines between any pair of points from $P_r$ and $P_\\theta$,

- The first term is the old critic term that we need to minimize in order to approximate the Wasserstein distance.
- The second term will be mininized w.r.t. $w$ to control the growth of the gradients of $\\{f_w\\}$.

<center>
<img src="/assets/tech/047.png" width="640"/>
</center>

<p></p>

- **Line 7 in Algorithm.** We minimize
  $$
    \\mathcal L_c := \\mathbb E_{x\\sim P_\\theta}[D_w(x)] - \\mathbb E_{x\\sim P_r}[D_w(x)] + \\lambda \\cdot \\mathbb E_{\\hat x \\sim P_{\\hat x}} \\big[(\\|\\nabla_x D_w(\\hat x)\\|_2 - 1)^2\\big]
  $$
  w.r.t. $w = \\texttt{critic.trainable_variables}$, where $D_w$ denotes critic, we will take $\\lambda = 10$.
- (cont'd) We update the critic by $\\partial \\mathcal L_c/\\partial w$.
- **Line 12 in Algorithm.** Update of generator remains the same, we still minimize
  $$
    \\mathcal L_g:=-\\mathbb E_{z\\sim p(z)}[D_w(g_\\theta(z))]
  $$
  w.r.t. $\\theta = \\texttt{gen.trainable_variables}$.
- (cont'd) We update the generator by $\\partial \\mathcal L_g/\\partial \\theta$.
- No \`BatchNormalization\` in critic, instead we use \`LayerNormalization\`.
- Remove weight-clipping.
- We use smaller learning rate.
- Anything else remain the same.

### Implementation of WGAN

#### Constants

With exactly the same setup as in <a href="/blog/article/GAN-and-DCGAN-in-Tensorflow"><i>DCGAN</i></a>, we edit the following constants:

\`\`\`python
img_rows = 28
img_cols = 28
channels = 1
weight_clip = 0.01
batch_size = 64
critic_iteration = 5
img_shape = (img_rows, img_cols, channels)
learning_rate = 1e-5
z_dim = 128
\`\`\`

#### Critic

We have the same generator, but different discriminator, which we call critic as it no longer output a number in $[0,1]$:

\`\`\`python
gen = build_generator()
critic = build_critic()

def build_critic():
    model = Sequential()
    model.add(
        Conv2D(32,
               kernel_size=3,
               strides=2,
               input_shape=img_shape,
               padding='same')
        )
    model.add(LeakyReLU(alpha=0.01))
    model.add(
        Conv2D(64,
               kernel_size=3,
               strides=2,
               input_shape=img_shape,
               padding='same'))
    model.add(BatchNormalization())
    model.add(LeakyReLU(alpha=0.01))
    model.add(
        Conv2D(128,
               kernel_size=3,
               strides=2,
               input_shape=img_shape,
               padding='same'))
    model.add(BatchNormalization())
    model.add(LeakyReLU(alpha=0.01))
    model.add(Flatten())
    model.add(Dense(1))

    return model
\`\`\`

#### Train Loop with Wasserstein Metric in Place of the Adversarial Loss

\`\`\`python
def train(iterations, batch_size, sample_interval):
  (x_train, _), (_, _) = mnist.load_data()
  x_train = x_train/127.5 - 1.0
  # np.shape(x_train) = (60000, 28, 28), for conv2D we need the channel dimension at the last axis
  x_train = np.expand_dims(x_train, axis=3)

  gen_opt = RMSprop(lr=learning_rate)
  critic_opt = RMSprop(lr=learning_rate)

  for i in range(iterations):
    print(f"iteration: {i+1}", end = "\\r")

    for j in range(critic_iteration):
      z = tf.random.normal((batch_size, z_dim), 0, 1)

      update_gen = ((j+1) % (critic_iteration)) == 0

      with tf.GradientTape() as critic_tape, tf.GradientTape() as gen_tape:
        idxs = np.random.randint(0, x_train.shape[0], batch_size)
        imgs = x_train[idxs]
        gen_imgs = gen(z, training=True)

        critic_fake = critic(gen_imgs)
        critic_real = critic(imgs)
        loss_critic = -(tf.math.reduce_mean(critic_real) - tf.math.reduce_mean(critic_fake))

        if update_gen:
          loss_gen = - tf.math.reduce_mean(critic_fake)

      grad_of_critic = critic_tape.gradient(loss_critic, critic.trainable_variables)
      critic_opt.apply_gradients(zip(grad_of_critic, critic.trainable_variables))

      weights = critic.get_weights()
      weights = [tf.clip_by_value(w, -weight_clip, weight_clip) for w in weights]
      critic.set_weights(weights)

      if update_gen:
        grad_of_gen = gen_tape.gradient(loss_gen, gen.trainable_variables)
        gen_opt.apply_gradients(zip(grad_of_gen, gen.trainable_variables))

    if (i+1) % sample_interval == 0:
      iteration_checkpoints.append(i+1)
      sample_images(gen)
\`\`\`

Finally:

\`\`\`python
iterations = 20000
sample_interval = 100

train(iterations, batch_size, sample_interval)
\`\`\`

### Implementation of WGAN-GP

There are just few modifications from WGAN, first for the constants:

#### New Constants

\`\`\`python
img_rows = 28
img_cols = 28
channels = 1
batch_size = 64
critic_iteration = 5
img_shape = (img_rows, img_cols, channels)
learning_rate = 1e-4
z_dim = 128
\`\`\`

We just decrease \`learning_rate\` and remove \`critic_iteration\`.

#### New Critic

We replace all \`BatchNormalization\` by \`LayerNormalization\`:

\`\`\`python
def build_critic():
    model = Sequential()
    model.add(
        Conv2D(32,
               kernel_size=3,
               strides=2,
               input_shape=img_shape,
               padding='same')
        )
    model.add(LeakyReLU(alpha=0.01))
    model.add(
        Conv2D(64,
               kernel_size=3,
               strides=2,
               input_shape=img_shape,
               padding='same'))
    model.add(LayerNormalization())
    model.add(LeakyReLU(alpha=0.01))
    model.add(
        Conv2D(128,
               kernel_size=3,
               strides=2,
               input_shape=img_shape,
               padding='same'))
    model.add(LayerNormalization())
    model.add(LeakyReLU(alpha=0.01))
    model.add(Flatten())
    model.add(Dense(1))

    return model
\`\`\`

#### Gradient Penality

Next we define function to compute gradient penality:

\`\`\`python
def gradient_penality(critic, real_sample, fake_sample):
    epsilon = tf.random.normal([batch_size, 1, 1, 1], 0.0, 1.0)
    interpolated = epsilon * real_sample + (1 - epsilon) * fake_sample

    with tf.GradientTape() as gp_tape:
      gp_tape.watch(interpolated)
      critic_inter = critic(interpolated, training=True)

    grads = gp_tape.gradient(critic_inter, [interpolated])[0]
    norm = tf.sqrt(tf.reduce_sum(tf.square(grads), axis=[1, 2, 3]))
    penality = tf.reduce_mean((norm - 1.0) ** 2)
    return penality
\`\`\`

#### New Train Loop

We remove weight-clipping and modify the weight update of critic by adding gradient penality:

\`\`\`python
def train(iterations, batch_size, sample_interval):
  (x_train, _), (_, _) = mnist.load_data()
  x_train = x_train/127.5 - 1.0
  # np.shape(x_train) = (60000, 28, 28), for conv2D we need the channel dimension at the last axis
  x_train = np.expand_dims(x_train, axis=3)

  gen_opt = RMSprop(lr=learning_rate)
  critic_opt = RMSprop(lr=learning_rate)

  for i in range(iterations):
    print(f"iteration: {i+1}", end = "\\r")

    for j in range(critic_iteration):
      z = tf.random.normal((batch_size, z_dim), 0, 1)

      update_gen = ((j+1) % (critic_iteration)) == 0

      with tf.GradientTape() as critic_tape, tf.GradientTape() as gen_tape:
        idxs = np.random.randint(0, x_train.shape[0], batch_size)
        imgs = x_train[idxs]
        gen_imgs = gen(z, training=True)

        critic_fake = critic(gen_imgs, training=True)
        critic_real = critic(imgs, training=True)
        gp = gradient_penality(critic, imgs, gen_imgs)

        loss_critic = tf.math.reduce_mean(critic_fake) \\
                      - tf.math.reduce_mean(critic_real) + 10 * gp

        if update_gen:
          loss_gen = - tf.math.reduce_mean(critic_fake)

      grad_of_critic = critic_tape.gradient(loss_critic, critic.trainable_variables)
      critic_opt.apply_gradients(zip(grad_of_critic, critic.trainable_variables))

      if update_gen:
        grad_of_gen = gen_tape.gradient(loss_gen, gen.trainable_variables)
        gen_opt.apply_gradients(zip(grad_of_gen, gen.trainable_variables))

    if (i+1) % sample_interval == 0:
      iteration_checkpoints.append(i+1)
      # print("%d [D loss: %f] [G loss: %f]" % (i + 1, loss_critic, loss_gen))
      sample_images(gen)
\`\`\`

### Reference

- **[MA]** Martin Arjovsky, Soumith Chintala, and Leon Bottou, <a href="https://arxiv.org/pdf/1701.07875.pdf"><i>Wasserstein GAN</i></a>

- **[IG]** Ishaan Gulrajani, Faruk Ahmed, Martin Arjovsky, Vincent Dumoulin, Aaron Courville, <a href="https://arxiv.org/pdf/1704.00028.pdf"><i>Improved Training of Wasserstein GANs</i></a>
`;export{n as default};
