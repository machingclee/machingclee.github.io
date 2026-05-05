const n=`---
title: Discrete Cosine Transform and JPEG Compression Implementation in Python
date: 2022-04-16
id: blog062
tag: math, python
intro: Discrete Cosine Transform (DCT) is not only used in image processing, it is also used in signal processing of sound such as computing MFCC coefficients as a feature vector.
---

### Introduction: Why Care DCT?

We have been using **_Discrete Cosine Transform_** (DCT) without possibly awaring of it: DCT is actually the JPEG compression standard!

In audio analysis, DCT is used in computing MFCC coefficients to extract feature vector (for more on MFCCs, see **[KC]** in reference section), which makes deep learning on sound possible by

- Treating the sequence of MFCC coefficients as a time sequence of data (at each "window" of suitable "hop length", we get a float vector of fixed size) or;

- Stacking the MFCC coefficients and treat it as an image.

In the former case the use of sequence model such as LSTM or Transformer becomes possible. The later case makes it possible to use convolution layer such as \`Conv1D\` in Keras.

### Basic Knowledge to Work With

#### Definitions

In what follows for $i,j=0,1,2,\\dots, N-1$ we will denote

$$
u_j^i = \\alpha_j\\cos \\frac{(2i+1)j\\pi}{2N}\\quad\\text{and} \\quad \\alpha_j =\\begin{cases}
\\displaystyle\\frac{1}{\\sqrt{N}}& \\text{if } j = 0,\\\\
\\displaystyle\\sqrt{\\frac{2}{N}}& \\text{if } j \\neq  0.
\\end{cases}
$$

For each fixed $j$ we will consider $u_j(x):= u_j^x =\\alpha_j\\cos \\frac{(2x+1)j\\pi}{2N} $ as a function on a discrete domain. The vectors

$$
\\left\\{u_j^{:}  := \\left[\\left.u_j^i= \\alpha_j\\cos \\frac{(2i+1)j\\pi}{2N}\\quad  \\text{ for }0\\leq i<N\\right]\\in \\mathbb R^N \\right| j=0,1,\\dots,N-1\\right\\}
$$

form an orthonormal basis in $\\mathbb R^N$, by stacking all them together column by column

$$
U := \\begin{bmatrix}
| &|& &|\\\\
u_0^{:}& u_1^{:}&\\cdots  &u_{N-1}^{:} \\\\
|&|& &|
\\end{bmatrix},
$$

then $U$ is orthonormal: $U^TU = I$.

The orthogonality of $U$ and the construction of the basis $u_j^:$ will be explained in _Mathematics behind DCT_ section. For now let's enjoy the coding and see the results.

#### Computations

We make explicit calculations in order to make readers comfortable with the definition above.

First, given a gray-scale image $f:[0, N-1]\\times[0, N-1]\\to \\mathbb R$ there are always unique coefficients $F:[0, N-1]\\times[0, N-1]\\to \\mathbb R$ such that

$$
f(p,q) =\\sum_{i=0}^{N-1}\\sum_{j=0}^{N-1}\\alpha_i \\alpha_j  F(i, j)  \\cos \\bigg(\\frac{(2p+1)i\\pi}{2N}\\bigg)\\cos\\bigg( \\frac{(2q+1)j\\pi}{2N}\\bigg).\\tag*{$(*)$}
$$

In fact by using $U$ defined in the previous section. Denote also $f, F$ as the matrix with entry $f(p,q), F(p,q)$ at $p$-th row and $q$-th column, if we define $F = U^T f U$, then

$$
f=UFU^T.
$$

You can expand the RHS ($UFU^T$) to convince yourself that eventually you get the same expression as in $(*)$. On the other hand, by using this $U$ we have the reverse:

$$
F(x,y) = \\sum_{h=0}^{N-1}\\sum_{k=0}^{N-1} f(h,k) \\alpha_x\\alpha_y \\cos \\bigg( \\frac{(2h+1)x\\pi}{2N}\\bigg)\\cos \\bigg(\\frac{(2k+1)y\\pi}{2N}\\bigg),
$$

as this is not a summation of $\\cos$'s of fixed frequencies, that's why we don't define $f=U^TfU$.

Our coding will strictly follow the notation and calculation in this section.

### Implementation of JPEG Compression in Python

For readers who are more familiar with matlab, you may also follow the youtube video listed in **[ET]**. Most of the content is a translation from matlab to python based on my understanding.

Notation and definition may be different from the video.

#### Basic Import

\`\`\`python
import numpy as np
import matplotlib.pyplot as plt
from tensorflow.keras.preprocessing.image import img_to_array, load_img
%matplotlib inline
\`\`\`

#### Constants

\`\`\`python
N = 8
IMAGE_PATH = "512_512_image.jpg"
\`\`\`

#### Basis of Cosine Transform

\`\`\`python
def range2D(n):
  indexes = []
  for i in range(0, n):
    for j in range(0, n):
      indexes.append((i, j))
  return indexes

def alpha(p):
  return 1/np.sqrt(N) if p == 0 else np.sqrt(2/N)

def cos_basis(i,j):
  def cal_result(a):
    x=a[0]
    y=a[1]

    return alpha(i) * alpha(j) * np.cos((2*x+1) * i * np.pi/(2*N)) *  np.cos((2*y+1) * j * np.pi/(2*N))
  return cal_result
\`\`\`

#### Plot of the 2D Cosine Basis Functions

\`\`\`python
fig = plt.figure()
fig.set_figheight(12)
fig.set_figwidth(12)
xy_range = range2D(N)
xy_plane_NxN = (np.array(xy_range).reshape(N,N,2))

for i in range(0, N):
  for j in range(0, N):
    xy_result = np.apply_along_axis(cos_basis(i,j), -1, xy_plane_NxN)
    plt.subplot(N, N, 1 + N*i + j)
    plt.imshow(xy_result, cmap="gray")
\`\`\`

<center>
<a href="/assets/tech/037.png" target="_blank">
    <img src="/assets/tech/037.png"/ width="500">
</a>
</center>

#### Compute Coefficients for Cosine Transform

Let's prepare the following $8\\times 8$ matrix that convert the original pixels into compacted energy distribution:

\`\`\`python
U = np.zeros((N,N))

for i in range(0, N):
  for j in range(0, N):
    U[i, j] = alpha(j) * np.cos((2*i+1)*j*np.pi/(2*N))

U_t =  U.transpose()
\`\`\`

You may check that \`U\` is indeed orthonormal by:

\`\`\`python
np.matmul(U, U_t)

# Result:
# array([[ 1.00000000e+00, -1.01506949e-16, -3.78598224e-17,
#         -1.03614850e-17, -1.33831237e-16,  7.88118312e-17,
#          2.00856868e-16, -1.70562493e-16],
#        [-1.01506949e-16,  1.00000000e+00,  1.70298111e-17,
#         -1.13980777e-17,  1.37840552e-16, -2.88419699e-16,
#         -1.24636773e-16,  2.51800326e-17],
#        [-3.78598224e-17,  1.70298111e-17,  1.00000000e+00,
#         -1.61419161e-16, -2.81922100e-17, -1.25319880e-16,
#         -1.83252893e-16, -2.79432802e-17],
#        [-1.03614850e-17, -1.13980777e-17, -1.61419161e-16,
#          1.00000000e+00, -1.92659768e-17,  2.75108042e-16,
#          2.02487213e-16,  2.22263103e-18],
#        [-1.33831237e-16,  1.37840552e-16, -2.81922100e-17,
#         -1.92659768e-17,  1.00000000e+00, -8.54966705e-17,
#         -2.36183557e-17, -3.71508058e-16],
#        [ 7.88118312e-17, -2.88419699e-16, -1.25319880e-16,
#          2.75108042e-16, -8.54966705e-17,  1.00000000e+00,
#          1.21575873e-16,  8.41357861e-17],
#        [ 2.00856868e-16, -1.24636773e-16, -1.83252893e-16,
#          2.02487213e-16, -2.36183557e-17,  1.21575873e-16,
#          1.00000000e+00,  3.92417644e-16],
#        [-1.70562493e-16,  2.51800326e-17, -2.79432802e-17,
#          2.22263103e-18, -3.71508058e-16,  8.41357861e-17,
#          3.92417644e-16,  1.00000000e+00]])
\`\`\`

#### Mask or Truncate the Energy Distribution

Here we use a naive approach, we screen out the fourier coefficents by simply retaining those from the upper-left corner. For that, we create a mask:

\`\`\`python
def create_mask(closure):
  mask = np.zeros((N, N))
  for i in range(N):
    for j in range(N):
      if closure(i,j):
        mask[i, j] = 1
  return mask
\`\`\`

For example, by calling \`mask = create_mask(lambda i,j: 0<=i+j<=2)\` our mask will be like:

\`\`\`text
[[1. 1. 1. 0. 0. 0. 0. 0.]
 [1. 1. 0. 0. 0. 0. 0. 0.]
 [1. 0. 0. 0. 0. 0. 0. 0.]
 [0. 0. 0. 0. 0. 0. 0. 0.]
 [0. 0. 0. 0. 0. 0. 0. 0.]
 [0. 0. 0. 0. 0. 0. 0. 0.]
 [0. 0. 0. 0. 0. 0. 0. 0.]
 [0. 0. 0. 0. 0. 0. 0. 0.]]
\`\`\`

#### Result: Apply Cosine Transform

\`\`\`python
original = load_img(IMAGE_PATH, target_size=(512, 512), color_mode="grayscale")
original = img_to_array(original).astype("uint8")
original = np.squeeze(original)
original.shape

mask = create_mask(lambda i,j: 0<=i+j<=2)
print(mask)
steps = int(original.shape[0]/N) # we choose 512x512 image, therefore steps = 64
print(steps)
compressed = np.zeros_like(original)

for x in range(steps):
  for y in range(steps):
    sub_pixels = original[N * y: N*(y+1), N * x: N*(x+1)]
    sub_pixels = sub_pixels - 127.5
    fourier_coefficients = np.matmul(np.matmul(U_t, sub_pixels), U)
    fourier_coefficients = fourier_coefficients * mask
    reverted_pixels = np.matmul(np.matmul(U, fourier_coefficients), U_t)
    reverted_pixels = reverted_pixels + 127.5
    compressed[N * y: N*(y+1), N * x: N*(x+1)] = reverted_pixels

fig.set_figheight(20)
fig.set_figwidth(20)
plt.subplot(1, 2, 1)
plt.imshow(original, cmap="gray")
plt.subplot(1, 2, 2)
plt.imshow(compressed, cmap="gray")
plt.savefig("DCT_result", dpi=200, bbox_inches="tight")
\`\`\`

<center>
<a href="/assets/tech/038.png" target="_blank">
    <img src="/assets/tech/038.png"/ width="500">
</a>
</center>

### Mathematics behind DCT

**Notation.** Every vector will be considered as a **column vector** whenever the computation does not make sense when they are represented as a row.

#### From DFT

Let $N\\ge 1 $ be an integer and denote $w = e^{2\\pi i/N}$, define $
v_k:= (1,w^k, w^{2k},\\dots, w^{(N-1)k}),
$ then the matrix

$$
V:=\\begin{bmatrix}
|&|& & |\\\\
v_0&v_1&\\cdots & v_{N-1}\\\\
|&|& & |
\\end{bmatrix}
$$

is orthogonal simply because their inner product

$$
(v_k,v_\\ell) = \\sum_{j=0}^{N-1}(w^k)^j (\\overline{w})^j = \\frac{(w^k \\overline{w}^\\ell )^{N} - 1}{\\underbrace{w^k\\overline{w}^\\ell-1}_{\\neq 0 \\text{ if $k\\neq \\ell$}}}
$$

is $0$ when $k\\neq \\ell$, where $w^N=1$. Therefore the basis $\\mathcal V:=\\{v_0,v_1,\\dots,v_{N-1}\\}$ forms an orthogonal basis in $\\mathbb C^{N}$.

But how to find a similar basis in $\\mathbb R^n$? It is not as simple as taking the real part of the linear combination $v = V[v]_{\\mathcal V} = \\sum a_i v_i$ since the coordinate $[v]_{\\mathcal V}\\in \\mathbb C^N$ even $v\\in \\mathbb R^N$.

#### DCT-2

##### Strategy of Construction

Consider the symmetric second difference matrix:

$$
A = \\begin{bmatrix}
\\otimes=1& \\otimes'=-1 &0&0&&\\cdots&&0\\\\
-1&2&-1 &0&&\\cdots&&0\\\\
0& -1&2&-1 &&\\cdots&&0\\\\
& &&&&&&\\\\
\\vdots& &&&\\ddots&&&\\vdots \\\\
& &&&&&&\\\\
&&&&&-1&2&-1\\\\
0&0&0&0&\\cdots&0&\\boxtimes=-1&\\boxtimes'=1
\\end{bmatrix}
$$

which arises when a second derivate is approximated by the central second difference:

$$
-f''(x) = \\frac{1}{h^2}\\bigg(-f(x-h)+2f(x)-f(x+h)\\bigg) + o(h)
$$

as $h\\to 0$.

Let $u_{k,:}\\in \\mathbb R^N$ denote the values of a function evaluated on the discretized domain $[x_{0}, x_{1},\\dots,x_{N-1}]$ of $[0, \\pi-\\frac{1}{N}]$, i.e., $u_{k,:} = f_k(x_{:})$ for some $f_k:\\mathbb [0, \\pi-\\frac{1}{N}] \\to \\mathbb R$, where \`:\` means stacking values by running through all indexes at that position.

Our cosine transform is based on decomposing a function into a linear combination of cosine functions (of different frequencies) **_in discrete case_**. To find them, we will choose $u_{k,:}$ such that $Au_{k,:}=\\lambda_k u_{k,:}$. By the fact that:

> **Fact.** Eigenvectors associated to different eigenvalues are linearly independent.

<center></center>

we then obtain a set of eigenvectors (of different eigenvalues) solving the approximated problem

$$
-\\frac{1}{N^2}f_k''(x_{:})\\approx Au_k = \\lambda_k f_k(x_{:}).
$$

Which function would solve the ODE $-f''=N^2\\lambda f$? Which is the trigonometric function!

##### Why $(\\otimes, \\otimes') = (1,-1)$ and $(\\boxtimes, \\boxtimes')=(-1,1)$?

These two assignments are determined by imposing boundary conditions. More specific, we extend the domain from $[0, \\pi-\\frac{1}{N}]$ to $[-\\frac{1}{N}, \\pi]$, imagine we are solving $\\tilde u_k \\in \\mathbb R^{N+2}$ (append one point at the beginning and the tail of $x_{:}\\in \\mathbb R^N$ respectively).

We have not imposed any boundary condition to our solution $f_k$ yet. We will require our function be symmetric at $-\\frac{1}{2N}$ (or at $j=-\\frac{1}{2}$ if $j=-1,0,1,\\dots,N$, $x_j = \\frac{j\\pi}{N}$), this implies $f_k(x_{-1}) = f_k(x_0)$.

At another boundary due to the shift above, we try to require $f_k'(x_{N-\\frac{1}{2}})=0$, this implies $f_k(x_{N-1}) = f_k(x_N)$.

$$
\\left\\{
\\begin{align*}
u_{k,-1}&=f_k(x_{-1})=f_k(x_{0}) = u_{k,0}\\\\
u_{k,N-1}&=f_k(x_{N-1})= f_k(x_{N}) = u_{k,N}
\\end{align*}
\\right.
$$

and plug this condition into the second difference formula to get:

$$
\\left\\{
\\begin{align*}
-u_{k,-1}&+2u_{k,0}  -u_{k,1} = u_{k,0}  -u_{k,1} \\\\
-u_{k,N-2}&+ 2 u_{k,N-1} -u_{k,N}  = -u_{k,N-2}+ u_{k,N-1}.
\\end{align*}
\\right.
$$

These become the necessary condition and thus have determined our $(\\otimes, \\otimes') =(1,-1)$ and $(\\boxtimes, \\boxtimes')=(-1,1)$, and therefore ensure our solution is a cosine function.

Different values of $\\otimes$'s and $\\boxtimes$'s will correspond to different boundary condition imposed on $f_k$ for other combinations, see **[GS]** for a complete classification.

The solution corresponding to $(\\otimes, \\otimes') = (1,-1)$ and $(\\boxtimes, \\boxtimes')=(-1,1)$ is usally called the basis of **_DCT-2_** (or simply **_DCT_**).

#### Derivation of the Basis of Discrete Cosine Transform

We have spent many effort to determine the matrix $A$ to work with, let's start with computing the basis directly for our only candidate:

Let $\\ell(x) = ax + b$ for some $a,b\\in \\mathbb R$, denote

$$
u_{k,0:N} = (1, w^{\\ell(1)k},w^{\\ell(2)k},\\dots w^{\\ell(N-1)k}),
$$

note that we have $\\sum_{k=0}^{N-1} u_{k,:} = \\sum_{i=0}^{N-1} (\\sum_{k=0}^{N-1} w^{\\ell(i)k}) e_i = \\frac{1-w^{N\\ell(i)}}{1-w^{\\ell(i)}} = 0$ whenever $\\ell(i)\\neq 0$ for integer $i$. As we will see this is indeed the case later for $\\ell (x) =\\frac{1}{2}x+ \\frac{1}{4}$.

Since $\\ell(j\\pm 1) = \\ell(j) \\pm a$, then for $j=1,2,\\dots,N-2$, coordinate-wise:

$$
\\begin{align*}
[Au_{k,:}]_{j}  & = -w^{\\ell(j-1)k} + 2w^{\\ell(j)k} - w^{\\ell(j+1)k} \\\\
&= \\big(2-(w^{ak} + w^{-ak}) \\big)w^{\\ell(j)k}\\\\
&= \\bigg(2-2\\cos \\frac{2ak\\pi }{N}\\bigg)u_{k,j}.
\\end{align*}
$$

Therefore $Au_{k,1:N-1} = (2-2\\cos \\frac{2ak\\pi i}{N}) u_{k,1:N-1}$ for whatever linear $\\ell$ we choose (here $x_{h:k} = [x_i \\quad \\text{ for }i\\text{ s.t. } h\\leq i <k]$).

By taking real part on both sides, as $A$ is real, we have

$$
A\\left[  \\sum_{1\\leq j< N-1} \\cos \\bigg(\\frac{2\\pi  }{N}\\ell(j)k\\bigg)e_j\\right]
= \\bigg(2-2\\cos \\frac{2ak\\pi }{N}\\bigg)\\sum_{1\\leq j< N-1} \\cos \\bigg(\\frac{2\\pi  }{N}\\ell(j)k\\bigg)e_j,
$$

here $e_j$ denotes the standard basis in $\\mathbb R^N$. It remains to require $u_j := \\cos \\frac{2k\\pi}{N}\\ell(j)$ satisfies $u_{-1}=u_0$ and $u_{N-1}=u_N$, from which we can determine $a,b$ and thus $\\ell$.

The equation $u_1=u_0$ implies $\\cos \\big(\\frac{2k\\pi }{N}(-a+b)\\big) = \\cos \\big(\\frac{2k\\pi}{N}(b)\\big)$, since $\\cos$ is even, it is sufficient to require

$$
a-b = b \\iff a = 2b.
$$

The equation $u_{N-1}=u_N$ implies

$$
\\cos \\bigg( 4kb\\pi -\\frac{2kb\\pi}{N}\\bigg) = \\cos \\bigg(4kb\\pi +\\frac{2kb\\pi}{N}\\bigg),
$$

for this to hold, it is sufficient to require $4b = 1$ (as $\\cos$ is always symmetric about $x = k\\pi$ for every $k\\in \\mathbb Z$), altogether we have $a =\\frac{1}{2}$, and thus for $k=0,1,2,3,\\dots,N-1$,

$$
\\frac{2\\pi}{N}\\ell(j)k = \\frac{2\\pi}{N}\\bigg(\\frac{1}{2}j + \\frac{1}{4}\\bigg) k  = \\frac{(2j+1)k\\pi}{2N}.
$$

<p></p>

Finally, we have

$$
z_k := \\sum_{0\\leq j< N} \\alpha_j\\cos \\bigg( \\frac{(2j+1)k\\pi}{2N}\\bigg)e_j,\\quad Az_k = \\bigg(2-2\\cos \\frac{k\\pi}{N}\\bigg) z_k
$$

for suitably chosen $\\alpha_j$'s, $j=0,1,2,\\dots,N-1$.

### Reference

- **[KC]** Kartik Chaudhary, <a href="https://towardsdatascience.com/understanding-audio-data-fourier-transform-fft-spectrogram-and-speech-recognition-a4072d228520"><i>Understanding Audio data, Fourier Transform, FFT and Spectrogram features for a Speech Recognition System</i></a>,

- **[GS]** Gilbert Strang, <a href="https://www.unioviedo.es/compnum/transversal_eng/DCT5.pdf"><i>The Discrete Cosine Transform</i></a>

- **[ET]** Exploring Technologies, <a href="https://www.youtube.com/watch?v=mUKPy3r0TTI"> <i>Discrete Cosine Transform (DCT) of Images and Image Compression</i></a>
`;export{n as default};
