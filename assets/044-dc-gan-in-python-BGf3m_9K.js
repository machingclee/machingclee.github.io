const n=`---
title: GAN and DCGAN in Tensorflow
date: 2022-02-15
id: blog044
tag: tensorflow, deep-learning
intro: In the past I have learnt the most basic GAN and DCGAN using pytorch, but I am more familiar with tensorflow. I attempt to understand gradient tape using by using these two GAN again with mnist dataset.
---

### GAN

#### Import

\`\`\`python
%matplotlib inline
from numpy.random import randint
from tensorflow.keras.datasets import mnist
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.losses import BinaryCrossentropy
from tensorflow.keras.layers import Input, Conv2D, Dense, Reshape, Flatten
from tensorflow.keras.models import Model

import numpy as np
import cv2
import tensorflow as tf
import matplotlib.pyplot as plt
import os
\`\`\`

#### For GPU Training

\`\`\`python
os.environ['TF_XLA_FLAGS'] = '--tf_xla_enable_xla_devices'

config = tf.compat.v1.ConfigProto(
  gpu_options=tf.compat.v1.GPUOptions(per_process_gpu_memory_fraction=0.8)
)
config.gpu_options.allow_growth = True
session = tf.compat.v1.Session(config=config)
tf.compat.v1.keras.backend.set_session(session)
\`\`\`

#### Constants

\`\`\`python
batch_size = 128
img_shape = (28, 28, 1)
\`\`\`

#### Models

##### Generator

\`\`\`python
def get_generator(img_shape=img_shape, z_dim=100):
  input = Input(shape=(z_dim,))
  x = Dense(128)(input)
  x = LeakyReLU(alpha=0.01)(x)
  x = Dense(28*28, activation="tanh")(x)
  x = Reshape(img_shape)(x)
  model = Model(input, x)
  return model
\`\`\`

##### Discriminator

\`\`\`python
def build_discriminator(img_shape=(28,28,1)):
  input = Input(shape=img_shape)
  x = Flatten()(input)
  x = Dense(128)(x)
  x = LeakyReLU(alpha=0.01)(x)
  x = Dense(1, activation="sigmoid")(x)
  model = Model(input, x)
  return model
\`\`\`

#### Dataset Generator Using tf.data.Dataset

\`\`\`python
def get_dataset_gen(batch_size = batch_size):
  (x_train, _), (_, _) = mnist.load_data()
  x_train = x_train/127.5 - 1
  x_train = np.expand_dims(x_train, axis=-1)
  dataset = tf.data.Dataset.from_tensor_slices(x_train).shuffle(1000).batch(batch_size)
  return iter(dataset)
\`\`\`

**Remark.** Sometimes we want dataset to be images mapped by image filepaths. Apart from \`tf.data.Dataset.list_files(target/dir/*.jpg)\`, we can also save the list of imagepaths in notebook and apply \`.from_tensor_slices()\` as above, we then use \`.map\` to get the images.

#### Training

##### On Gradient Tapes

Since generator and discriminator are two separate models, they are not trained at the same time. Namely, the update on weights inside generator and update on that in discriminator are independent of each other.

Here we use two \`tf.GradientTape\`'s to record calculations, and do the differentation separately.

##### On Model.fit

We can still train a GAN by tricky use of \`Model.fit\` (by setting \`discrimnator.trainable\` to \`False\` before the compilation of the model).

In my opinion using gradient tape is much more straight-foward once we get the idea.

##### Start the Training Loop

\`\`\`python
gen_opt = Adam(learning_rate=0.0002, beta_1=0.5, beta_2=0.999)
disc_opt = Adam(learning_rate=0.0002, beta_1=0.5, beta_2=0.999)
fig = plt.figure()
fig.set_figheight(20)
fig.set_figwidth(20)

for epoch in range(10):
  dataset_gen = get_dataset_gen()

  for batch_num, batch_of_num_imgs in enumerate(dataset_gen):
    batch_of_num_imgs_tensor = tf.convert_to_tensor(batch_of_num_imgs)
    noise = tf.random.normal((batch_size, 100), mean=0.0, stddev=1.0)

    with tf.GradientTape(persistent=True) as tape:
      faked_imgs = gen(noise)
      critic_on_reals = disc(batch_of_num_imgs_tensor)
      critic_on_fakeds = disc(faked_imgs)

      disc_loss_on_real_imgs = bcentropy(tf.ones_like(critic_on_reals), critic_on_reals)
      disc_loss_on_faked_imgs = bcentropy(tf.zeros_like(critic_on_fakeds), critic_on_fakeds)

      disc_loss = 0.5*disc_loss_on_real_imgs + 0.5*disc_loss_on_faked_imgs
      gen_loss = bcentropy(tf.ones_like(critic_on_fakeds), critic_on_fakeds)

    grad_disc = tape.gradient(disc_loss, disc.trainable_variables)
    grad_gen = tape.gradient(gen_loss, gen.trainable_variables)

    gen_opt.apply_gradients(zip(grad_gen, gen.trainable_variables))
    disc_opt.apply_gradients(zip(grad_disc, disc.trainable_variables))

    print(f"epoch{epoch}, processing batch {batch_num}", end="\\r")
    if batch_num % 10 == 0:
      noise = np.random.normal(0, 1.0, (batch_size, 100))
      imgs = gen.predict(noise)
      for i in range(0,4):
        for j in range(0, 4):
          index = 4*i + j
          img = imgs[index]
          plt.subplot(4, 4, 1 + 4*i + j)
          plt.imshow(img, cmap="gray")
      plt.savefig(f"epoch-{str(epoch).zfill(3)}_batch-{str(batch_num).zfill(3)}", dpi=80, bbox_inches="tight")
\`\`\`

#### Results at 5-th Epoch and 380-th Batch, batch_size = 128

Each epoch has 460 batches, that means we have run through $460 * 4 + 380 = 2220$ batches.

<center>
<a href="/assets/tech/039.png">
<img src="/assets/tech/039.png" width="550"/>
</a>
</center>

### DCGAN

#### Import

\`\`\`python
%matplotlib inline
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf

from tensorflow.keras.datasets import mnist
from tensorflow.keras.layers import  BatchNormalization, Dense, Flatten, Reshape
from tensorflow.keras.layers import LeakyReLU
from tensorflow.keras.layers import Conv2D, Conv2DTranspose
from tensorflow.keras.models import Sequential
from tensorflow.keras.optimizers import Adam
\`\`\`

#### Constants

\`\`\`python
img_rows = 28
img_cols = 28
channels = 1

img_shape = (img_rows, img_cols, channels)

z_dim = 100
\`\`\`

#### Models

##### Generator

\`\`\`python
def build_generator():
    model = tf.keras.Sequential()
    model.add(Dense(7*7*256, use_bias=False, input_shape=(100,)))
    model.add(BatchNormalization())
    model.add(LeakyReLU())

    model.add(Reshape((7, 7, 256)))
    assert model.output_shape == (None, 7, 7, 256)  # Note: None is the batch size

    model.add(Conv2DTranspose(128, (5, 5), strides=(1, 1), padding='same', use_bias=False))
    assert model.output_shape == (None, 7, 7, 128)
    model.add(BatchNormalization())
    model.add(LeakyReLU())

    model.add(Conv2DTranspose(64, (5, 5), strides=(2, 2), padding='same', use_bias=False))
    assert model.output_shape == (None, 14, 14, 64)
    model.add(BatchNormalization())
    model.add(LeakyReLU())

    model.add(Conv2DTranspose(1, (5, 5), strides=(2, 2), padding='same', use_bias=False, activation='tanh'))
    assert model.output_shape == (None, 28, 28, 1)

    return model
\`\`\`

##### Discriminator

\`\`\`python
def build_discriminator():
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
    model.add(Dense(1, activation='sigmoid'))

    return model
\`\`\`

#### Auxilary Function: sample_images

\`\`\`python
def sample_images(generator, image_grid_rows=4, image_grid_columns=4):
  z = np.random.normal(0, 1, (image_grid_rows * image_grid_columns, z_dim))
  gen_imgs = generator.predict(z)
  gen_imgs = 0.5*gen_imgs + 0.5
  fig, axs = plt.subplots(image_grid_rows,
                          image_grid_columns,
                          figsize=(4, 4),
                          sharey=True,
                          sharex=True
                         )
  count = 0
  for i in range(image_grid_rows):
    for j in range(image_grid_columns):
      axs[i, j].imshow(gen_imgs[count, :, :, 0], cmap="gray")
      axs[i, j].axis("off")
      count += 1

  plt.show()
\`\`\`

#### Define Custom Training using Gradient Tape and Start

#### Start the Training

\`\`\`python
generator = build_generator()
discriminator = build_discriminator()

losses = []
accuracies = []
iteration_checkpoints = []

cross_entropy = tf.keras.losses.BinaryCrossentropy(from_logits=True)

def train(iterations, batch_size, sample_interval):
  (x_train, _), (_, _) = mnist.load_data()
  x_train = x_train/127.5 - 1.0
  """
  np.shape(x_train) = (60000, 28, 28)
  for conv2D we need the channel dimension at the last axis
  """
  x_train = np.expand_dims(x_train, axis=3)
  real = np.ones((batch_size, 1))
  fake = np.zeros((batch_size, 1))
  gen_opt = Adam(1e-4)
  disc_opt = Adam(1e-4)

  for i in range(iterations):
    print(f"iteration: {i}", end = "\\r")
    idxs = np.random.randint(0, x_train.shape[0], batch_size)
    imgs = x_train[idxs]
    """
    We define tf.Variable(n) outside gradient tape,
    in gradient tape we record the calculation done on our training input (in tensor).
    When we use tape.gradient outside the tape,
    we are doing differentiation evaluated at the variable n.
    """
    z = tf.random.normal((batch_size, z_dim), 0, 1)

    with tf.GradientTape() as gen_tape, tf.GradientTape() as disc_tape:
      gen_imgs = generator(z, training=True)
      decisions_for_gen = discriminator(gen_imgs, training=True)
      decisions_for_real = discriminator(imgs, training=True)

      gen_loss = cross_entropy(real, decisions_for_gen)

      disc_fake_loss = cross_entropy(fake, decisions_for_gen)
      disc_real_loss = cross_entropy(real, decisions_for_real)
      disc_loss = 0.5*(disc_fake_loss + disc_real_loss)

    grad_of_gen = gen_tape.gradient(gen_loss, generator.trainable_variables)
    grad_of_disc = disc_tape.gradient(disc_loss, discriminator.trainable_variables)

    gen_opt.apply_gradients(zip(grad_of_gen, generator.trainable_variables))
    disc_opt.apply_gradients(zip(grad_of_disc, discriminator.trainable_variables))

    if (i+1) % sample_interval == 0:
      iteration_checkpoints.append(i+1)
      print("%d [D loss: %f] [G loss: %f]" % (i + 1, disc_loss, gen_loss))
      sample_images(generator)
\`\`\`

Finally we start the training

\`\`\`python
iterations = 20000
batch_size = 128
sample_interval = 1000

train(iterations, batch_size, sample_interval)
\`\`\`

#### Results at the 3000-th Batch, batch_size = 128

Compared to the result of basic GAN with 2220 batches, the result of DCGAN at 3000-th batch is much better!

<center>
<a href="/assets/tech/040.png">
<img src="/assets/tech/040.png"/>
</a>
</center>
`;export{n as default};
