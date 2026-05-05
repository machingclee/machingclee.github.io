const e=`---
title: "Diffusion Model Study"
date: 2023-03-07
id: blog0124
tag: python, deep-learning
intro: Beginning study of diffusion model.
---

### Result on Local Machine

<Center>
<img src="/assets/tech/124/005.png" width="100%" />
</Center>
<p/>

<center></center>

Due to time constraint I didn't wait the model to train for long enough time as It is convincing to me that the model is trying to converge.

### Reference

Main reference for coding part:

- [Diffusion models from scratch in PyTorch](https://www.youtube.com/watch?v=a4Yfz2FxXiY&fbclid=IwAR14YaOBTAwTp_mmp_Q5MALMRuecTxDLUwcTAESifcB8IlqpmFYDy_IlnV4)

Other references for theory:

- [Denoising Diffusion Probabilitic Model](https://arxiv.org/pdf/2006.11239.pdf)
- [Diffusion Model：比“GAN"还要牛逼的图像生成模型！公式推导+论文精读，迪哥打你从零详解扩散模型！](https://www.bilibili.com/video/BV1pD4y1179T/?spm_id_from=333.788.recommend_more_video.11&vd_source=eaeec3286e77493a42a3dce415ee67cc)
- [Stable Diffusion: High-Resolution Image Synthesis with Latent Diffusion Models | ML Coding Series](https://www.youtube.com/watch?v=f6PtJKdey8E)

### Introduction

<Center>
<img src="/assets/tech/124/001.png" width="100%" />
</Center>
<p/>
<center></center>

- Define $x_t$ as the image at time $t=T$ for $T\\in {\\mathbb N}_0$. When we travel about $t$, we add noise gradually until the image is unreadable. The noise is added by

  $$
  x_{t} = \\sqrt{\\alpha_{t-1}} x_{t-1} + \\sqrt{1-\\alpha_{t-1}}z_1,
  $$

  for $t\\ge1$, where $z_t\\sim \\mathcal N(0,1)$ and $(0,1)\\ni\\alpha_t\\searrow 0$.

- In practice (coding) $\\alpha_t$ will go from $1-0.0001$ to $1-0.02$, $\\alpha_t$ needs not be very small when the noise is enough.

- Note that started from $t=1$, we no longer consider $x_t$ as a concrete image, rather we consider $x_t$ as a random variable where only the mean and variance makes perfect sense.

- The true image depense on the instance of values that a gaussian noise provide.

- That means $x_t$ denotes a set of possibilities of images (data point). To understant $x_t$, we need to understand the density of the probability distribution $p(x_t)$.

- By direct expansion we have

  $$
  x_t = \\sqrt{\\alpha_t \\alpha_{t-1}} x_{t-2} +\\sqrt{\\alpha_t(1-\\alpha_{t-1})}z_2 + \\sqrt{1-\\alpha_t}z_1,
  $$

  where $z_1,z_2\\sim \\mathcal N(0,1)$.

- Since $\\mathcal N(0, \\sigma_1^2I) + \\mathcal N(0, \\sigma_2^2I)  = \\mathcal N (0, (\\sigma_1^2+\\sigma_2^2)I)$, the last term becomes

  $$
  x_t = \\sqrt{\\alpha_t\\alpha_{t-1}}x_{t-2}+\\sqrt{1-\\alpha_t\\alpha_{t-1}}z_2
  $$

  for some $z_2\\sim \\mathcal N(0, 1)$.

- Define $\\overline{\\alpha}_t = \\prod\\limits_{0\\leq i < t}\\alpha_{t-i} = \\prod\\limits_{i=1}^{t}\\alpha_{i}$ for $k\\ge 1$, then
  $$x_t = \\sqrt{\\overline{\\alpha}_t}x_0 +\\sqrt{1-\\overline{\\alpha}_t}\\cdot z_t, \\tag{$*$}$$ for some $z_t\\sim \\mathcal N (0, 1)$.

- Note that $\\alpha_{t+1}\\overline{\\alpha}_t = \\overline{\\alpha}_{t+1}$.

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

- Recall the Bayse Forumla $\\displaystyle P(A|B) =  P(B|A)\\times \\frac{P(A)}{P(B)}$.

- Given a set of images $x_t$, we wish to understand the distribution of $x_{t-1}$, i.e., we wish to calculate $p(x_{t-1}|x_t).$

- $p$ usually is used to denote known distribution.

- To emphasize we don't truly understand the distribution, we replace $p$ by $q$ to denote unknown distribution (the distribution that we are going to find or estimate, or to learn), the problem becomes estimating the distribution $q(x_{t-1}|x_t)$.

- As we know we add random noise from $t-1$ to $t$, it makes no sense to estimate the exact value of a random variable $x_{t-1}$ from $x_t$.

- Therefore what we want to estiamte is the average of $x_{t-1}$ from an instance of $x_t$.

- By Bayse formula, $\\displaystyle q(x_{t-1}|x_t,x_0) = q(x_t|x_{t-1}, x_0) \\frac{q(x_{t-1}|x_0)}{q(x_t|x_0)}$.

- To enable ourself to do computation, we also assume $q(x_{t-1}|x_t,x_0)$ follows Gaussian distribution.

- We now try to estimate the mean of $x_{t-1}$, name it $\\tilde\\mu_{t-1}$.

- We have already studied the distribution of $x_t$ in $(*)$.

- Suppose that $x_t$ is given and we know that it comes from the previous distribution by adding gaussian noise with some weight (in the same way as before), then

  $$
  \\begin{aligned}
  &{\\color{white}=} q(x_{t-1}|x_{t}, x_0) \\\\
   &\\propto \\exp \\left\\{-\\frac{1}{2}\\left(\\frac{(x_t-\\sqrt{\\alpha}x_{t-1})^2}{\\beta_t} + \\frac{(x_{t-1}-\\sqrt{\\overline{\\alpha}_{t-1}}x_0)^2}{1-\\overline{\\alpha}_{t-1}}- \\frac{(x_t-\\sqrt{\\overline{\\alpha}_t} x_0)^2}{1-\\overline{\\alpha}_t}\\right)\\right\\}\\\\
  &=\\exp \\Bigg\\{
  -\\frac{1}{2}\\Bigg(\\bigg(\\frac{\\alpha_t}{\\beta_t} + \\frac{1}{1-\\overline{\\alpha}_{t-1}}\\bigg)x_{t-1}^2 - \\bigg(\\frac{2\\sqrt{\\alpha_t}}{\\beta_t}x_t + \\frac{2\\sqrt{\\overline{\\alpha}_{t-1}}}{1-\\overline{\\alpha}_{t-1}} x_0\\bigg)x_{t-1}\\\\
  &\\qquad\\qquad\\qquad\\qquad\\qquad\\qquad\\qquad\\qquad\\qquad\\qquad\\qquad\\qquad\\qquad+C(x_t,x_0)\\Bigg)
  \\Bigg\\}\\\\
  &=\\exp\\bigg(-\\frac{(x_{t-1}-\\mu)^2}{2\\sigma^2}\\bigg)
  \\end{aligned}
  $$

  where $\\beta_t=1-\\alpha_t$.

- By comparing coefficients we have

  $$
  \\mu =\\mu(x_t,x_0) = \\frac{\\sqrt{\\alpha_t}(1-\\overline{\\alpha}_{t-1})}{1-\\overline{\\alpha}_t}x_t + \\frac{\\sqrt{\\overline{\\alpha}_{t-1}}\\beta_t}{1-\\overline{\\alpha}_t}x_0,
  $$

  by $(*)$ we have

  $$
  \\begin{cases}
  \\displaystyle\\tilde{\\mu}_{t-1} = \\frac{1}{\\sqrt{\\alpha_t}} \\bigg(x_t - \\frac{\\beta_t}{\\sqrt{1-\\overline{\\alpha}_t}}z_t\\bigg), \\\\
  \\sigma_{t-1}^2= \\displaystyle\\left(\\frac{\\alpha_t}{\\beta_t}+ \\frac{1}{1-\\overline{\\alpha}_{t-1}}\\right)^{-1} = \\frac{1-\\overline{\\alpha}_{t-1}}{1-\\overline{\\alpha}_t}\\beta_t.
  \\end{cases}
  $$

- $z_t$ will be what we are trying to learn.

- When we predict image in reverse timesteps, we iteratively predict image by

  $$
  \\boxed{
    x_{t-1} = \\frac{1}{\\sqrt{\\alpha_t}} \\bigg(x_t - \\frac{\\beta_t}{\\sqrt{1-\\overline{\\alpha}_t}}\\mathrm{model}(x_t)\\bigg) + \\sqrt{\\frac{1-\\overline{\\alpha}_{t-1}}{1-\\overline{\\alpha}_t}\\beta_t} \\cdot \\epsilon
  }
  $$

  for some $\\epsilon$ sampled from normal distribution. In code it is implemented as follows:

  \`\`\`python
  @torch.no_grad()
  def sample_timestep(model, x, t):
      """
      Calls the model to predict the noise in the image and returns
      the denoised image.
      Applies noise to this image, if we are not in the last step yet.
      """
      betas_t = get_index_from_list(betas, t, x.shape)
      sqrt_one_minus_alphas_cumprod_t = get_index_from_list(
          sqrt_one_minus_alphas_cumprod, t, x.shape
      )
      sqrt_recip_alphas_t = get_index_from_list(sqrt_recip_alphas, t, x.shape)

      # Call model (current image - noise prediction)
      model_mean = sqrt_recip_alphas_t * (
          x - betas_t * model(x, t) / sqrt_one_minus_alphas_cumprod_t
      )
      posterior_variance_t = get_index_from_list(posterior_variance, t, x.shape)

      if t == 0:
          return model_mean
      else:
          noise = torch.randn_like(x)
          return model_mean + torch.sqrt(posterior_variance_t) * noise
  \`\`\`

- From $x_1$ to $x_2$ we add a noize $z_1$. We estimate (learn) $\\tilde z_1$ from $x_2$ to $x_1$, then $z_1$ will be our ground truth in the model. We elaborate this in the next section.

  In code it is implemented as follows:

  \`\`\`python
  def get_loss(model, x_0, times):
    # times is of shape (128, )
    x_noisy, noise = forward_diffusion_sample(x_0, times, device)
    # 128 time times, therefore 128 images, x_noisy is of shape [128, 3, 64, 64]
    noise_pred = model(x_noisy, times)

    return F.l1_loss(noise, noise_pred)
  \`\`\`

### Training Algorithm

- <Center>
  <img src="/assets/tech/124/004.png" width="100%" />
  </Center>
  <p/>
  <center></center>

- In algorithm on the LHS:

  2. means we sample an image from our collection of image dataset ($q(x_0)$ means the distribution of the images that $x_0$ lives in, like category of dogs, cats, etc)
  3. means the timestamp is uniformly random
  4. means the noise $\\epsilon$ we add from $t-1$ to $t$.
  5. $\\epsilon_0$ is the estimate of $\\epsilon$ from $t-1$ to $t$ (as we want to do the reverse). This $\\epsilon_0$ is estimated from

     - $x_t$ (see $(*)$) and
     - timestamp $t$

     our loss function becomes $L = \\|\\epsilon - \\epsilon_0(x_t, t)\\|_2^2$.

### Coding

#### Constants

\`\`\`python
def linear_beta_schedule(timesteps, start=0.0001, end=0.02):
    return torch.linspace(start, end, timesteps)

def get_index_from_list(vals, t, x_shape):
    """
    Returns a specific index t of a passed list of values vals
    while considering the batch dimension.
    """
    batch_size = t.shape[0]
    out = vals.gather(-1, t.cpu())
    # same as .reshape( (batch_size,) + ((1,) * (len(x_shape) - 1)) )
    result = out.reshape(batch_size, *((1,) * (len(x_shape) - 1))).to(t.device)
    return result

# Define beta schedule
T = 300
IMG_SIZE = 64
TIMESTEPS_BATCH_SIZE = 128
betas = linear_beta_schedule(timesteps=T)

# Pre-calculate different terms for closed form
alphas = 1. - betas
alphas_cumprod = torch.cumprod(alphas, axis=0)
alphas_cumprod_prev = F.pad(alphas_cumprod[:-1], (1, 0), value=1.0)
sqrt_recip_alphas = torch.sqrt(1.0 / alphas)
sqrt_alphas_cumprod = torch.sqrt(alphas_cumprod)
sqrt_one_minus_alphas_cumprod = torch.sqrt(1. - alphas_cumprod)
posterior_variance = betas * (1. - alphas_cumprod_prev) / (1. - alphas_cumprod)
\`\`\`

#### SinusoidalPositionEmbeddings

This is exactly the same as the one we use in transformer, which basically takes a time $t\\in\\mathbb N$ to a vector of size \`(32,)\`.

To recall, positional encoding takes the following form: for each fixed $\\texttt{pos}\\in \\mathbb N$,

$$
\\begin{aligned}
\\mathrm{PE}{(\\texttt{pos},2i)} & = \\sin(\\texttt{pos}  / 10000^{i/d_{0.5\\times \\text{model}}}) \\\\
\\mathrm{PE}{(\\texttt{pos},2i+1)} & = \\cos(\\texttt{pos} / 10000^{i/d_{0.5\\times\\text{model}}})
\\end{aligned}
$$

where $i=0,1,2,\\dots, \\frac{1}{2}d_\\text{model} - 1$.

\`\`\`python-1
class SinusoidalPositionEmbeddings(nn.Module):
    def __init__(self, dim):
        super().__init__()
        # dim = 32
        self.dim = dim

    def forward(self, times):
        half_dim = self.dim // 2
        embeddings = math.log(10000) / (half_dim - 1)
        embeddings = torch.exp(torch.arange(half_dim, device=device) * -embeddings)

        # a_i = 1/10000^(i/half_dim)
        # embeddings above = [a_1, a_2, a_3, ..., a_16]
        embeddings = times[:, None] * embeddings[None, :]
        # embeddings above <=>
        # t |-> ( sin t*a_1, cos t*a_1, sin t*a_2, cos t*a_2, sin t*a_3, cos t*a_3, ... )
        # for each t, therefore the final dimension will be (128, 32)
        embeddings = torch.cat((embeddings.sin(), embeddings.cos()), dim=-1)
        # TODO: Double check the ordering here
        return embeddings
\`\`\`

The variable \`embeddings\` in line 14 above is exactly

$$
\\left[
\\texttt{timestep} \\times
\\left[ \\frac{1}{10000^{i/d_{\\text{half_dim}}}}: 0\\leq i<32\\right]:
 \\texttt{timestep} \\in \\texttt{times}
\\right]
$$

with \`timestep\` in place of \`pos\` above.

#### UNet that Predicts Noise

\`\`\`python
class SimpleUnet(nn.Module):
    """
    A simplified variant of the Unet architecture.
    """

    def __init__(self):
        super().__init__()
        image_channels = 3
        down_channels = (64, 128, 256, 512, 1024)
        up_channels = (1024, 512, 256, 128, 64)
        out_dim = 1
        time_emb_dim = 32

        # Time embedding
        self.time_mlp = nn.Sequential(
            SinusoidalPositionEmbeddings(time_emb_dim),
            nn.Linear(time_emb_dim, time_emb_dim),
            nn.ReLU()
        ).to(device)

        # Initial projection
        # stride = 1, padding = 1, no change in spatial dimension
        self.conv0 = nn.Conv2d(image_channels, down_channels[0], 3, padding=1).to(device)

        # Downsample
        self.downs = nn.ModuleList([Block(down_channels[i], down_channels[i + 1],
                                    time_emb_dim).to(device)
                                    for i in range(len(down_channels) - 1)])
        # Upsample
        self.ups = nn.ModuleList([Block(up_channels[i], up_channels[i + 1],
                                        time_emb_dim, up=True).to(device)
                                  for i in range(len(up_channels) - 1)])

        self.output = nn.Conv2d(up_channels[-1], 3, out_dim).to(device)

    def forward(self, x, times):
        # Embedd time
        t = self.time_mlp(times)
        # Initial conv
        x = self.conv0(x)
        # Unet
        residual_inputs = []
        for down in self.downs:
            x = down(x, t)
            residual_inputs.append(x)
        for up in self.ups:
            # for the bottom block the x adds an identical copy of x (just poped out) for unity of coding.
            residual_x = residual_inputs.pop()
            # Add residual x as additional channels
            x = torch.cat((x, residual_x), dim=1)
            x = up(x, t)
        return self.output(x)
\`\`\`

#### Sampling / Prediction

\`\`\`python
@torch.no_grad()
def sample_timestep(model, x, t):
    """
    Calls the model to predict the noise in the image and returns
    the denoised image.
    Applies noise to this image, if we are not in the last step yet.
    """
    betas_t = get_index_from_list(betas, t, x.shape)
    sqrt_one_minus_alphas_cumprod_t = get_index_from_list(
        sqrt_one_minus_alphas_cumprod, t, x.shape
    )
    sqrt_recip_alphas_t = get_index_from_list(sqrt_recip_alphas, t, x.shape)

    # Call model (current image - noise prediction)
    model_mean = sqrt_recip_alphas_t * (
        x - betas_t * model(x, t) / sqrt_one_minus_alphas_cumprod_t
    )
    posterior_variance_t = get_index_from_list(posterior_variance, t, x.shape)

    if t == 0:
        return model_mean
    else:
        noise = torch.randn_like(x)
        return model_mean + torch.sqrt(posterior_variance_t) * noise


@torch.no_grad()
def sample_plot_image(model, img_path):
    # Sample noise
    img_size = IMG_SIZE
    img = torch.randn((1, 3, img_size, img_size), device=device)
    plt.figure(figsize=(15, 15))
    plt.axis('off')
    num_images = 10
    stepsize = int(T / num_images)

    for i in range(0, T)[::-1]:
        # just create a tensor t of shape (1,), the result is [1], [2], ..., etc
        times = torch.full((1,), i, device=device, dtype=torch.long)
        img = sample_timestep(model, img, times)
        if i % stepsize == 0:
            plt.subplot(1, num_images, i // stepsize + 1)
            show_tensor_image(img.detach().cpu())

    plt.savefig(img_path)
\`\`\`
`;export{e as default};
