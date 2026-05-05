const n=`---
title: Cycle-GAN in Tensorflow
date: 2022-03-25
id: blog053
tag: tensorflow, deep-learning
intro: Implement custom training loop in tensorflow for Cycle-GAN without the use of *trick* that sets \`Model.training = False\`.
---

### Results

<center>
<a href="/assets/tech/032.png">
<img src="/assets/tech/032.png" width="300" style="margin-right:20px"/>
</a>
<a href="/assets/tech/033.png">
<img src="/assets/tech/033.png" width="300"/>
</a>
</center>
<p/>

### With Gradient Tape, We Don't Need Model.training = False

I create this whole model following the video in reference 1) of Reference section, however, I never get the training work for any algorithm that involves \`train_on_batch\` (I am suspicious about that after certain version of tensorflow, the call \`Model.training = False\` before compiling models fails).

Nevertheless it is a very good exercise for me to write down the formula and implement the update of parameter by gradient tape because I have to know what's happening behind the scene clearly.

Hope you also enjoy writing down the explicit formula of the losses and updating the parameters to have the feeling of "training separately" (the reason for \`Model.training = False\`).

### Preparation

#### For Cuda

In order to enable cuda for traininig using GPU some special script needs to be run at the beginning.

\`\`\`python
os.environ['TF_XLA_FLAGS'] = '--tf_xla_enable_xla_devices'

config = tf.compat.v1.ConfigProto(
  gpu_options=tf.compat.v1.GPUOptions(per_process_gpu_memory_fraction=0.8
))
config.gpu_options.allow_growth = True
session = tf.compat.v1.Session(config=config)
tf.compat.v1.keras.backend.set_session(session)
\`\`\`

#### Preliminary Import

\`\`\`python
%matplotlib inline

from tensorflow.keras.models import Model
import os
import matplotlib.pyplot as plt
import tensorflow as tf
import numpy as np
from tensorflow_addons.layers import InstanceNormalization
from tensorflow.keras.layers import Input, Conv2D, Conv2DTranspose, LeakyReLU, Activation, Concatenate
from tensorflow.keras.preprocessing.image import img_to_array, load_img
from tensorflow.keras.initializers import RandomNormal
from tensorflow.keras.losses import MeanAbsoluteError, MeanSquaredError
from tensorflow.keras.optimizers import Adam
from numpy.random import randint
from numpy import load
from numpy import zeros, ones, asarray
from sklearn.utils import resample
from random import random

dataset_name = "horse2zebra"
n_sample = 1000
\`\`\`

#### Source of Training Data

https://people.eecs.berkeley.edu/~taesung_park/CycleGAN/datasets/

### Formulas and Explanation

In cycle-GAN we have 4 models:

- $g_{AB}:A \\to B$, a generator from domain $A$ to domain $B$
- $g_{BA}:B\\to A$, a generator from domain $B$ to domain $A$
- $d_A:A\\to [0,1]$, a discriminator model to discriminate images in domain $A$
- $d_B:B\\to [0,1]$, a discriminator model to discriminate images in domain $B$

Here by "domain" we mean a category/class of images. For each training loop we will be training each of the models separately.

Denote $p_A$ the distribution of data in domain $A$, and $p_B$ that in $B$. In each loop mathematically we wish to minimize the loss:

$$
\\begin{align*}
\\mathcal L_{g_{AB}}  &= \\mathbb E_{a\\sim p_A, b\\sim p_B} \\bigg(
5\\cdot \\mathcal L_{\\mathrm{id}} +
10\\cdot  \\mathcal L_{\\mathrm{cycle}}  +
\\mathcal L_{g\\text{-}d}
\\bigg)(a, b) \\\\
\\mathcal L_{d_A}(a,b) &= \\mathbb E_{a\\sim p_A, b\\sim p_B}  \\frac{1}{2}\\bigg(\\|d_A(a) - 1\\|_2^2 + \\|d_A(g_{BA}(b)) - 0\\|_2^2\\bigg)
\\end{align*}
$$

Here

$$
\\begin{align*}
\\mathcal L_{\\mathrm{id}}(a, b) &= \\|b - g_{AB}(b)\\|_1\\\\
\\mathcal L_{\\mathrm{cycle}}(a,b) &= \\|a - g_{BA}(g_{AB}(a))\\|_1\\\\
\\mathcal L_{g\\text{-}d}(a, b)&= \\|d_B(g_{AB}(a)) - 1\\|_2^2
\\end{align*}
$$

$\\mathcal L_\\mathrm{id}$ is called **_identitiy loss_**, $\\mathcal L_{\\mathrm{cycle}}$ is called **_cycle loss_** and $\\mathcal L_{g\\text{-}d}$ is called **generator's discriminator loss**.

Unlike the simplest GANs, the result of discriminator is not a single value in $[0,1]$ any more, instead in this implementation we use a matrix of shape \`(None, 16, 16, 1)\`. The negative logarithmic penality is replaced by mean-square loss (without taking root).

$\\mathcal L_{g_{BA}}$ and $\\mathcal L_{d_B}(a,b)$ are similarly defined, the code implementation of the $\\mathcal L_{g_{AB}}$ can be found in implementation section of this article:

\`\`\`python
5 * mae(X_realA, same_inA) + 10 * mae(X_realA, cycle_A) + g_BtoA_disc_loss
\`\`\`

### Implementation

#### Helper Functions

\`\`\`python
def load_img_from_path(image_path):
  pixels = load_img(image_path, target_size=(256, 256))
  pixels = img_to_array(pixels)
  pixels = pixels/127.5 - 1
  return pixels

def generate_real_samples(path, n_samples=n_sample, patch_shape=16):
  image_paths = np.array(get_image_paths(path))
  indexes = randint(0, len(image_paths), n_samples)
  X = np.array([load_img_from_path(path) for path in image_paths[indexes]])
  y = ones((n_samples, patch_shape, patch_shape, 1))
  return X, y

def generate_fake_samples(g_model, dataset, patch_shape=16):
  X = g_model.predict(dataset)
  y = zeros((len(X), patch_shape, patch_shape, 1))
  return X, y

def gen_dataset(n_sample=500):
  train_A_paths = get_image_paths(f"{dataset_name}/trainA")
  train_B_paths = get_image_paths(f"{dataset_name}/trainB")

  random_state = np.random.randint(0, 100)
  print("random_state", random_state)
  shuffle_indexes = resample(range(len(train_A_paths)), replace=False, n_samples=500, random_state=random_state)
  shuffled_trainA_img = (load_img_from_path(train_A_paths[index]) for index in shuffle_indexes)
  shuffled_trainB_img = (load_img_from_path(train_B_paths[index]) for index in shuffle_indexes)
  dataset = zip(shuffled_trainA_img, shuffled_trainB_img)
  return dataset

def update_fake_img_pool(pool, images, max_size=50):
  selected = []

  for image in images:
    if len(pool) < max_size:
      pool.append(image)
      selected.append(image)
    elif random() < 0.5:
      selected.append(image)
    else:
      # take one from the pool and and update the pool
      # the pool may contain new image that we never
      index = randint(0, len(pool))
      selected.append(pool[index])
      pool[index] = image

  return asarray(selected)

def check_dataset():
  dataset_ = gen_dataset()
  for i in range(3):
    img_A, img_B = next(dataset_)
    img_A = (img_A + 1) * 127.5
    img_B = (img_B + 1) * 127.5
    plt.subplot(2, 3, 1+i)
    plt.axis("off")
    plt.imshow(img_A.astype("uint8"))

    plt.subplot(2, 3, 4+i)
    plt.axis("off")
    plt.imshow(img_B.astype("uint8"))
\`\`\`

#### Generators

\`\`\`python
def resnet_block(n_filters, input_layer):
  init = RandomNormal(stddev=0.02)
  # as strides = 1, the shape is invariant
  g = Conv2D(n_filters, (3, 3), padding="same", kernel_initializer=init)(input_layer)
  g = InstanceNormalization(axis=-1)(g)
  g = Activation("relu")(g)
  g = Conv2D(n_filters, (3, 3), padding="same", kernel_initializer=init)(g)
  g = InstanceNormalization(axis=-1)(g)
  g = Concatenate()([g, input_layer])
  return g

def define_generator(image_shape, n_resnet=9):
  init = RandomNormal(stddev=0.02)
  x = Input(shape=image_shape)
  g = Conv2D(64, (7, 7), padding="same", kernel_initializer=init)(x)
  g = InstanceNormalization(axis=-1)(g)
  g = Activation("relu")(g)

  g = Conv2D(128, (3, 3), strides=(2, 2), padding="same", kernel_initializer=init)(g)
  g = InstanceNormalization(axis=-1)(g)
  g = Activation("relu")(g)

  g = Conv2D(256, (3, 3), strides=(2, 2), padding="same", kernel_initializer=init)(g)
  g = InstanceNormalization(axis=-1)(g)
  g = Activation("relu")(g)

  for _ in range(n_resnet):
    g = resnet_block(256, g)

  g = Conv2DTranspose(128, (3, 3), strides=(2, 2), padding="same", kernel_initializer=init)(g)
  g = InstanceNormalization(axis=-1)(g)
  g = Activation("relu")(g)

  g = Conv2DTranspose(64, (3, 3), strides=(2, 2), padding="same", kernel_initializer=init)(g)
  g = InstanceNormalization(axis=-1)(g)
  g = Activation("relu")(g)

  g = Conv2D(3, (7, 7), padding="same", kernel_initializer=init)(g)
  g = InstanceNormalization(axis=-1)(g)
  y = Activation("tanh")(g)

  model = Model(x, y)

  return model
\`\`\`

#### Discriminators

\`\`\`python
def define_discriminator(image_shape):
  init = RandomNormal(stddev=0.02)
  x = Input(shape=image_shape)
  d = Conv2D(64, (4, 4), strides=2, padding="same", kernel_initializer=init)(x)
  d = LeakyReLU(alpha=0.2)(d)

  d = Conv2D(128, (4, 4), strides=(2, 2), padding="same", kernel_initializer=init)(d)
  d = InstanceNormalization(axis=-1)(d)
  d = LeakyReLU(alpha=0.2)(d)

  d = Conv2D(256, (4, 4), strides=(2, 2), padding="same", kernel_initializer=init)(d)
  d = InstanceNormalization(axis=-1)(d)
  d = LeakyReLU(alpha=0.2)(d)

  d = Conv2D(512, (4, 4), strides=(2, 2), padding="same", kernel_initializer=init)(d)
  d = InstanceNormalization(axis=-1)(d)
  d = LeakyReLU(alpha=0.2)(d)

  d = Conv2D(512, (4, 4), padding="same", kernel_initializer=init)(d)
  d = InstanceNormalization(axis=-1)(d)
  d = LeakyReLU(alpha=0.2)(d)

  y = Conv2D(1, (4, 4), padding="same", kernel_initializer=init)(d)
  model = Model(x, y)
  return model
\`\`\`

#### Custom Training Loop with Gradient Tape

##### Create Models

\`\`\`python
def update_fake_image_pool(pool, images, max_size=50):
  selected = []

  for image in images:
    if len(pool) < max_size:
      pool.append(image)
      selected.append(image)
    elif random() < 0.5:
      selected.append(image)
    else:
      # take one from the pool and and update the pool
      # the pool may contain new image that we never
      index = randint(0, len(pool))
      selected.append(pool[index])
      pool[index] = image

  return asarray(selected)

g_model_AtoB = define_generator(image_shape)
g_model_BtoA = define_generator(image_shape)
d_model_A = define_discriminator(image_shape)
d_model_B = define_discriminator(image_shape)

n_epochs, n_batch, = 100, 1
n_patch = d_model_A.output_shape[1]

batch_per_epoch = int(n_sample/n_epochs)
n_steps = batch_per_epoch * n_epochs


def show_result(step):
  dataset_ = gen_dataset()
  fig = plt.figure()
  fig.set_figheight(10)
  fig.set_figwidth(10)

  for i in range(3):
    img_A, _ = next(dataset_)
    fake_B = g_model_AtoB.predict(np.array([img_A]))
    cycle_A = g_model_BtoA.predict(fake_B)
    img_A = (img_A + 1) * 127.5
    fake_B = (fake_B[0] + 1) * 127.5
    cycle_A = (cycle_A[0] + 1) * 127.5

    plt.subplot(3, 3, 1+i)
    plt.axis("off")
    plt.imshow(img_A.astype("uint8"))

    plt.subplot(3, 3, 4+i)
    plt.axis("off")
    plt.imshow(fake_B.astype("uint8"))

    plt.subplot(3, 3, 7+i)
    plt.axis("off")
    plt.imshow(cycle_A.astype("uint8"))
    plt.savefig(f'result_{str(step).zfill(2)}.png')

  plt.show()
\`\`\`

##### Start Training Loop

Note that in gradient tape we pass an option \`persistent=True\` because we need to calculate the gradient several times using the same tape (record of calculations).

\`\`\`python
mse = MeanSquaredError()
mae = MeanAbsoluteError()

g_AB_opt = Adam(learning_rate=0.0002, beta_1 = 0.5)
g_BA_opt = Adam(learning_rate=0.0002, beta_1=0.5)

d_A_opt = Adam(learning_rate = 0.0002, beta_1 = 0.5)
d_B_opt = Adam(learning_rate=0.0002, beta_1=0.5)

poolA = list()
poolB = list()

for i in range(2000):
  shfted_index = i + 4880
  print(f"step {shfted_index}", end="\\r")
  if shfted_index % 10 == 0:
    show_result(shfted_index)

  X_realA, y_realA = generate_real_samples(f"./{dataset_name}/trainA", n_batch, n_patch)
  X_realB, y_realB = generate_real_samples(f"./{dataset_name}/trainB", n_batch, n_patch)
  X_fakeA, y_fakeA = generate_fake_samples(g_model_BtoA, X_realB, n_patch)
  X_fakeB, y_fakeB = generate_fake_samples(g_model_AtoB, X_realA, n_patch)

  X_fakeA = update_fake_img_pool(poolA, X_fakeA)
  X_fakeB = update_fake_img_pool(poolB, X_fakeB)


  X_realA = tf.convert_to_tensor(X_realA)
  y_realA = tf.convert_to_tensor(y_realA)
  X_realB = tf.convert_to_tensor(X_realB)
  y_realB = tf.convert_to_tensor(y_realB)
  X_fakeA = tf.convert_to_tensor(X_fakeA)
  y_fakeA = tf.convert_to_tensor(y_fakeA)
  X_fakeB = tf.convert_to_tensor(X_fakeB)
  y_fakeB = tf.convert_to_tensor(y_fakeB)

  with tf.GradientTape(persistent=True) as tape:
    fake_B = g_model_AtoB(X_realA, training=True)
    cycle_A = g_model_BtoA(fake_B, training=True)

    fake_A =  g_model_BtoA(X_realB, training=True)
    cycle_B = g_model_AtoB(fake_A, training =True)

    same_inB = g_model_AtoB(X_realB)
    same_inA = g_model_BtoA(X_realA)

    disc_real_A = d_model_A(X_realA)
    disc_fake_A = d_model_A(fake_A)

    disc_real_B = d_model_B(X_realB)
    disc_fake_B = d_model_B(fake_B)

    g_AtoB_disc_loss = mse(y_realB, disc_fake_B)
    g_BtoA_disc_loss = mse(y_realA, disc_fake_A)

    total_g_AtoB_loss = 5 * mae(X_realB, same_inB) + 10 * mae(X_realB, cycle_B) + g_AtoB_disc_loss
    total_g_BtoA_loss = 5 * mae(X_realA, same_inA) + 10 * mae(X_realA, cycle_A) + g_BtoA_disc_loss

    # train discriminator and generator separately:
    disc_B_loss = 0.5 * (mse(y_realB, disc_real_B) + mse(y_fakeB, disc_fake_B))
    disc_A_loss = 0.5 * (mse(y_realA, disc_real_A) + mse(y_fakeA, disc_fake_A))

  # derivatives
  grad_d_A = tape.gradient(disc_A_loss, d_model_A.trainable_variables)
  grad_d_B = tape.gradient(disc_B_loss, d_model_B.trainable_variables)

  grad_g_AtoB = tape.gradient(total_g_AtoB_loss, g_model_AtoB.trainable_variables)
  grad_g_BtoA = tape.gradient(total_g_BtoA_loss, g_model_BtoA.trainable_variables)

  # back-propagate
  d_A_opt.apply_gradients(zip(grad_d_A, d_model_A.trainable_variables))
  d_B_opt.apply_gradients(zip(grad_d_B, d_model_B.trainable_variables))

  g_AB_opt.apply_gradients(zip(grad_g_AtoB, g_model_AtoB.trainable_variables))
  g_BA_opt.apply_gradients(zip(grad_g_BtoA, g_model_BtoA.trainable_variables))
\`\`\`

### Reference

- Unpaired image to image translation​ using cycleGAN in keras, <br/>
  https://www.youtube.com/watch?v=2MSGnkir9ew

- Tensoflow's guide to CycleGAN, <br/>
  https://www.tensorflow.org/tutorials/generative/cyclegan

- Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks, <br/>
  https://arxiv.org/abs/1703.10593
`;export{n as default};
