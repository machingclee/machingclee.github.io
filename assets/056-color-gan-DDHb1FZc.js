const n=`---
title: Color-GAN with Auto-Coloring on Animated Gray Images
date: 2022-04-01
id: blog056
tag: tensorflow, deep-learning
intro: We study one of the GANs that can perform auto coloring to gray-images.
---

### About this Article

This article is an experiment inspired by this tutorial: <a href="https://towardsdatascience.com/colorizing-black-white-images-with-u-net-and-conditional-gan-a-tutorial-81b2df111cd8">Colorizing black & white images with U-Net and conditional GAN — A Tutorial</a>.

Since I am not used to pytorch which the tutorial bases on, the following things will be rewritten in tensorflow:

- The models
- The data processing pipeline
- The generator of dataset
- The train loop (including the update of training weights)
- The visualization of our results

Enjoy!

### Results

Since the training datasets are just animated characters. The only common characteristic are the color of skins, therefore the model is not able to paint clothes, hair in a colorful way (as it has no idea how to learn).

Original image:

<center>
<img src="/assets/tech/035.jpg"/> 
<p/>
</center>

Transferred to gray scale and let the GAN color it:

<center>
<img src="/assets/tech/036.png" width="600"/>
<p/>
</center>

### Preliminary Import

#### Usual Packages

\`\`\`python
from numpy.random import randint
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.losses import MeanAbsoluteError, MeanSquaredError
from tensorflow.keras.initializers import  HeNormal
from tensorflow.keras.preprocessing.image import img_to_array, load_img
from tensorflow.keras.layers import (
  Input, Conv2D, Conv2DTranspose, LeakyReLU,
  Activation, Concatenate, BatchNormalization, ZeroPadding2D
)
import numpy as np
import cv2
import tensorflow as tf
import matplotlib.pyplot as plt
from glob import glob
import os
from tensorflow.keras.models import Model
from tqdm.notebook import tqdm
from skimage.color import rgb2lab, lab2rgb
import os

%matplotlib inline
\`\`\`

#### For Using GPU

\`\`\`python
os.environ['TF_XLA_FLAGS'] = '--tf_xla_enable_xla_devices'

config = tf.compat.v1.ConfigProto(
  gpu_options=tf.compat.v1.GPUOptions(per_process_gpu_memory_fraction=0.8)
)
config.gpu_options.allow_growth = True
session = tf.compat.v1.Session(config=config)
tf.compat.v1.keras.backend.set_session(session)
\`\`\`

### RGB Color Space and Lab Color Space (WIP)

To be added.

### Dataset Generator

We will again make use of the \`tf.data.Dataset.list_files\` as a starting point to create a \`tf.data.Dataset\` object.

The \`Dataset\` object is very handy because of the following useful methods:

- \`.map()\`
- \`.filter()\`
- \`.shuffle(buffer_size)\`
- \`.batch(batch_size)\`
- \`.cache()\`

##### Preprocessing Functions

\`\`\`python
SIZE = 256

def path_to_img(file_path):
  img = tf.io.read_file(file_path)
  img = tf.image.decode_jpeg(img, channels=3)
  img = tf.image.resize(img, (SIZE, SIZE))
  return img

def rgb_normalize_to_0_1(img):
  img = tf.cast(img, dtype=tf.float32)
  return img/255

def rgb_denormalize_from_0_1(img):
  return (img + 1)*127.5

def lab_normalize_to_minus1_to_1(img):
  L = img[:, :, 0] / 50. - 1
  ab = img[:, :, [1, 2]]/110.
  return L[..., np.newaxis], ab

def lab_denormalize_from_minus1_to_1(img):
  L = (img[:, :, [0]] + 1) * 50
  ab = img[:, :, [1, 2]] * 110
  return np.concatenate([L, ab], axis=-1)

def process_img(img):
  # tf.numpy_function(func=lambda x: print(x), inp=[img], Tout=tf.float32)
  img = img/255.
  img = tf.image.random_flip_left_right(img)

  img_lab = tf.numpy_function(func=lambda x: rgb2lab(x).astype("float32"),
                              inp=[img],
                              Tout=tf.float32)

  L, ab = tf.numpy_function(func=lab_normalize_to_minus1_to_1,
                            inp=[img_lab],
                            Tout=[tf.float32, tf.float32])

  return L, ab
\`\`\`

##### Chaining Preprocessing Functions

Therefore we just need to take care of how to preprocess data from individual file path. \`Dataset\`'s api will handle the rest.

Among the above, we use \`.map\` to chain our data processing pipeline:

\`\`\`python
def get_data_generator():
  buffer_size = 100
  batch_size = 16
  dataset = tf.data.Dataset.list_files(f"{dataset_name}/*.jpg")\\
    .map(path_to_img)\\
    .map(process_img)\\
    .shuffle(buffer_size)\\
    .batch(batch_size)

  return (data for data in iter(dataset))
\`\`\`

### Implementation

#### Generator by UNet Structure

\`\`\`python
def conv_block(n_filters, input, kernel_initialization=None):
  if kernel_initialization:
    y = Conv2D(n_filters, (3, 3), strides=(2, 2), padding="same", use_bias=False, kernel_initializer=kernel_initialization)(input)
  else:
    y = Conv2D(n_filters, (3, 3), strides=(2, 2), padding="same", use_bias=False)(input)
  y = BatchNormalization()(y)
  y = LeakyReLU(0.2)(y)
  return y

def upconv_block(n_filters, input, skip_connection):
  u = Conv2DTranspose(n_filters, (3, 3), strides=(2, 2), padding="same")(input)
  u = Concatenate(axis=-1)([u, skip_connection])
  u = Conv2D(n_filters, (3, 3), strides=1, padding="same", activation="relu")(u)
  u = Conv2D(n_filters, (3, 3), strides=1, padding="same", activation="relu")(u)
  return u

def get_generator():
  init = HeNormal()
  x = Input(shape=(SIZE, SIZE, 1))
  d1 = conv_block(64, x, kernel_initialization=init)
  d2 = conv_block(128, d1)
  d3 = conv_block(256, d2)

  d4 = conv_block(512, d3)

  u3 = upconv_block(256, d4, d3)
  u2 = upconv_block(128, u3, d2)
  u1 = upconv_block(64, u2, d1)

  final = upconv_block(2, u1, x)
  final = Activation("tanh")(final)

  return Model(x, final)
\`\`\`

#### PatchGAN Discriminator by Repeated Conv Blocks

\`\`\`python
def add_padding(padding=(1,1)):
  return ZeroPadding2D(padding=padding)

def get_discriminator():
  input = Input(shape=(256,256,2))
  x = add_padding()(input)
  x = Conv2D(64, (4, 4), strides=2, padding="same", use_bias=False)(x)
  x = LeakyReLU(0.2)(x)

  x = add_padding()(x)
  x = Conv2D(128, (4, 4), strides=2, padding="same", use_bias=False)(x)
  x = BatchNormalization()(x)
  x = LeakyReLU(0.2)(x)

  x = add_padding()(x)
  x = Conv2D(256, (4, 4), strides=2, padding="same", use_bias=False)(x)
  x = BatchNormalization()(x)
  x = LeakyReLU(0.2)(x)

  x = add_padding()(x)
  x = Conv2D(512, (4, 4), strides=1, padding="same", use_bias=False)(x)
  x = BatchNormalization()(x)
  x = LeakyReLU(0.2)(x)


  x = add_padding()(x)
  x = Conv2D(1, (4, 4), strides=1, padding="same")(x)
  return Model(input, x)
\`\`\`

### Training

#### Functions to Visualize Intermediate Performance

\`\`\`python
def get_gray_image_from_path(img_path):
  im_gray = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
  im_gray_3ch = np.concatenate([im_gray[...,np.newaxis] for _ in range(3)], axis=-1)
  return im_gray_3ch

def visualize_result(epoch=0, step=0):
  random_index = np.random.randint(0, len(imgs_paths))
  img_path = imgs_paths[random_index]
  im_gray_3ch = get_gray_image_from_path(img_path)
  filename = os.path.basename(img_path)

  original_size = im_gray_3ch.shape[0:2][::-1]
  img_ = cv2.resize(im_gray_3ch, dsize=(SIZE, SIZE), interpolation=cv2.INTER_CUBIC)
  img_ = img_/255.
  img_lab = rgb2lab(img_).astype("float32")
  L, _ = lab_normalize_to_minus1_to_1(img_lab)
  faked_coloring = gen.predict(np.array([L]))[0]
  colored_img_in_lab_in_minus1_to_1 = np.concatenate([L, faked_coloring], axis=-1)
  colored_img_in_lab = lab_denormalize_from_minus1_to_1(colored_img_in_lab_in_minus1_to_1)
  faked_colored_image = (lab2rgb(colored_img_in_lab) * 255).astype("uint8")
  faked_colored_image = cv2.resize(faked_colored_image, dsize=original_size, interpolation=cv2.INTER_CUBIC)

  plt.figure(figsize=(18, 30))
  plt.subplot(1, 2, 1)
  plt.axis("off")
  plt.imshow(im_gray_3ch.astype("uint8"))

  plt.subplot(1, 2, 2)
  plt.axis("off")
  plt.imshow(faked_colored_image)

  taget_folder = "./epoch_{}".format(str(epoch).zfill(2))
  if not os.path.exists(taget_folder):
    os.makedirs(taget_folder)

  plt.savefig("./epoch_{}/result_{}_from_{}.png".format(str(epoch).zfill(2), str(step).zfill(3), filename), dpi=80, bbox_inches="tight")
\`\`\`

#### Start Training

##### Training Without Noise

Now we implement our custom training loop for 10 epochs. We use \`get_data_generator\` to get new dataset for each epoch.

We start our model/data initilization and training loop in separate code block:

\`\`\`python
gen_opt = Adam(learning_rate=0.0002, beta_1=0.5, beta_2=0.999)
disc_opt = Adam(learning_rate=0.0002, beta_1=0.5, beta_2=0.999)

gen_L1_loss_lambda = 100

mse = MeanSquaredError()
mae = MeanAbsoluteError()
\`\`\`

and start:

\`\`\`python
for epoch in range(0, 10):
  epoch = epoch + 1
  batch = 0
  data_generator = get_data_generator()
  while True:
    try:
      batch += 1
      print(f"{batch}-th batch", end="\\r")
      Ls, abs = next(data_generator)
      real_images = tf.concat([Ls, abs], axis=-1)

      with tf.GradientTape(persistent=True) as tape:
        faked_coloring = gen(Ls)
        true_coloring = abs

        critic_on_faked_colorings = disc(faked_coloring)
        critic_on_true_coloring = disc(true_coloring)


        gen_loss = mse(tf.ones_like(critic_on_faked_colorings), critic_on_faked_colorings)\\
                        + 100 * mae(abs, faked_coloring)

        disc_loss = 0.5 * mse(tf.zeros_like(critic_on_faked_colorings), critic_on_faked_colorings)\\
            + 0.5 * mse(tf.ones_like(critic_on_true_coloring), critic_on_true_coloring)


      grad_gen = tape.gradient(gen_loss, gen.trainable_variables)
      grad_disc = tape.gradient(disc_loss, disc.trainable_variables)

      gen_opt.apply_gradients(zip(grad_gen, gen.trainable_variables))
      disc_opt.apply_gradients(zip(grad_disc, disc.trainable_variables))

      if batch % 10 == 0:
        visualize_result(epoch, int(batch/10))

    except StopIteration:
      print(f"Epoch {epoch} Ended")
      break
    except Exception as err:
      print(err)
      break
\`\`\`

##### Training With Noise (WIP)

##### Training With Pretrained VGG-16 as a Backbone (WIP)

### References

- <a href="https://towardsdatascience.com/colorizing-black-white-images-with-u-net-and-conditional-gan-a-tutorial-81b2df111cd8">
    Colorizing black & white images with U-Net and conditional GAN — A Tutorial
  </a>
- <a href="https://arxiv.org/abs/1603.08511">
    Richard Zhang, Phillip Isola, Alexei A. Efros, Colorful Image Colorization
  </a>
- <a href="https://arxiv.org/abs/1611.07004">
    Phillip Isola, Jun-Yan Zhu, Tinghui Zhou, Alexei A. Efros, Image-to-Image Translation with Conditional Adversarial Networks
  </a>
`;export{n as default};
