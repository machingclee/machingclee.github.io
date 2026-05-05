const a=`---
title: Image Augmentation with Custom Dataset Pipeline
date: 2021-08-29
id: blog0023
tags: tensorflow
intro: We introduce <a href="https://albumentations.ai/docs/getting_started/installation/">albumentations</a> for image augmentation that helps generalize our model to unknown data.
---

### Define Our Mapping Functions to Tensorflow Dataset

#### Image path to (img, label) format

We start from pre-processing functions that handle the validation dataset and also arbitrary images with which we will feed into our model:

\`\`\`python
from tensorflow.keras.applications.vgg16 import preprocess_input

autotune = tf.data.experimental.AUTOTUNE

def get_label(file_path):
  return tf.strings.split(file_path, os.path.sep)[-2]

def path_to_imgLabel(file_path):
  label = tf.cast(tf.strings.to_number(get_label(file_path)), dtype=tf.int32)
  img = tf.io.read_file(file_path)
  img = tf.image.decode_jpeg(img, channels=3)
  return img, label

def preprocess_train_image(img, label):
  img = tf.image.resize(img, (vgg_img_size, vgg_img_size))
  img = preprocess_input(img)
  return img, label
\`\`\`

#### Image Augmentations I - The Basic Pipeline

Since \`tf.imaga\` can just provide us a limited amounts of augmentations to our input data, like \`tf.image.random_flip_left_right\`, for a richer resouce of augmentation we try to import \`albumentations\` library:

\`\`\`python
from albumentations import (
  Compose,
  RandomBrightnessContrast,
  ImageCompression,
  HueSaturationValue,
  HorizontalFlip,
  Rotate
)
\`\`\`

and define our transforms that will be applied to images when we take a batch of images from generator:

\`\`\`python
transforms = Compose([
  Rotate(limit=40),
  RandomBrightnessContrast(p=0.5),
  ImageCompression(quality_lower=85, quality_upper=100, p=0.5),
  HueSaturationValue(hue_shift_limit=20, sat_shift_limit=30, val_shift_limit=20, p=0.5),
  HorizontalFlip()
])
\`\`\`

We define the data augmentation function (the last line, \`image_augmentation\`) that will take \`img, label\` as arguments:

\`\`\`python
from functools import partial

def aug_fn(image, img_size):
  data = {"image": image}
  aug_data = transforms(**data)
  aug_img = aug_data["image"]
  aug_img = tf.image.resize(aug_img, size=[img_size, img_size])
  return aug_img

def image_augmentation(image, label, img_size):
  aug_img = tf.numpy_function(func=aug_fn, inp=[image, img_size], Tout=tf.float32)
  img_shape=(img_size, img_size, 3)
  aug_img.set_shape(img_shape)
  return aug_img, label

image_augmentation = partial(image_augmentation, img_size=vgg_img_size)
\`\`\`

#### Image Augmentations II - Same Augmentations to a pair of Images

In image segmentations our image augmentations have to be carried out equally to both the images and masks.

Suppose our image training dataset, \`./cars\`, has a associated mask dataset, \`./mask\`, we pair them as follows:

\`\`\`python
dataset = tf.data.Dataset.list_files("./cars/*")

def path_to_imgLabel(file_path):
  mask_filepath = tf.strings.regex_replace(file_path, "cars", "masks" )
  mask_filepath = tf.strings.regex_replace(mask_filepath, ".jpg", "_mask.gif" )

  img = tf.io.read_file(file_path)
  img = tf.image.decode_jpeg(img)

  img = tf.image.resize(img, (img_size, img_size))

  mask = tf.io.read_file(mask_filepath)
  mask = tf.image.decode_gif(mask)
  mask = tf.image.resize(mask, (img_size, img_size))
  mask = tf.reshape(mask, (img_size, img_size, 3))
  mask = tf.reduce_mean(mask, axis=-1, keepdims=True)

  return img, mask

train_data = dataset.map(path_to_imgLabel)
\`\`\`

Next we apply color-invariant augmentations to the pair \`(img, mask)\`'s and color-related augmentation to \`img\`'s, for that we define two transformations:

\`\`\`python
transforms_general = Compose(
  [
    Rotate(limit=40),
    HorizontalFlip(),
  ],
   additional_targets={'mask0': 'image'}
)

transform_color = Compose(
  [
    RandomBrightnessContrast(p=0.5),
    ImageCompression(quality_lower=85, quality_upper=100, p=0.5),
    HueSaturationValue(hue_shift_limit=20, sat_shift_limit=30, val_shift_limit=20, p=0.5),
  ]
)
\`\`\`

they kwarg \`additional_targets={'mask0': 'image'}\` means that \`mask0\` will share the same set of transformation with \`image\`, and after the transformation we can retrieve the transformed mask by the key \`mask0\`.

**_Note the tricky part here_**. It might be tempting to define \`additional_targets={'mask': 'image'}\`, but unfortunately there are 4 reserved keywords that cannot be used as a key in the dictionary for \`additional_targets\`.

From <a href="https://albumentations.ai/docs/examples/example_multi_target/">documentation</a> these are \`image\`, \`mask\`, \`bboxes\` and \`keypoints\`.

Now we define the next pair of functions which bring the transformations above into play:

\`\`\`python
def aug_fn(image, mask):
  transformed = transforms_general(image=image, mask0=mask)
  image = transformed['image']
  mask = transformed['mask0']

  aug_data = transform_color(image=image)
  image = aug_data['image']
  return image, mask

def image_augmentation(image, mask):
  transformed = tf.numpy_function(func=aug_fn, inp=[image, mask], Tout=[tf.float32, tf.float32])
  aug_img = transformed[0]
  aug_mask = transformed[1]
  aug_img.set_shape((img_size, img_size, 3))
  aug_mask.set_shape((img_size, img_size, 1))

  return aug_img, aug_mask
\`\`\`

Beware of the argument \`Tout\` above, it has to be a list that specifies the data type of the output. Otherwise \`OperatorNotAllowedInGraphError\` would occur since the function has no idea what is the data type that \`tf.numpy_function\` will return.

### Finish the Pipeline

The strategy of our complete dataset pipeline is to:

1.  take \`path\` to \`img, label\`;
2.  then map the images by functions taking \`img, label\` to \`img, label\` multiple times, which depends on the number of mapping we need.

    For example, in the chain of \`.map(image_augmentation).map(preprocess_train_image)\` below we are free to remove the augmentation part and leave \`preprocess_train_image\` alone (which is what it is initially when there is no augmentation implemented).

\`\`\`python
train_dataset = tf.data.Dataset.list_files("./train_dataset/*/**") \\
.map(path_to_imgLabel) \\
.map(image_augmentation, num_parallel_calls=autotune).prefetch(autotune) \\
.map(preprocess_train_image, num_parallel_calls=autotune) \\
.cache() \\
.shuffle(buffer_size) \\
.batch(batch_size)

val_dataset = tf.data.Dataset.list_files("./val_dataset/*/**")  \\
.map(path_to_imgLabel) \\
.map(preprocess_train_image, num_parallel_calls=autotune) \\
.cache() \\
.batch(batch_size)
\`\`\`

### Read the Result of Image Augmentation

As usual we import:

\`\`\`python
import matplotlib.pyplot as plt
\`\`\`

and define:

\`\`\`python
def view_image(ds):
  image, label = next(iter(ds)) # extract 1 batch from the dataset
  image = image.numpy().astype('uint8')
  label = label.numpy().astype('uint8')

  fig = plt.figure(figsize=(22, 22))
  for i in range(20):
    ax = fig.add_subplot(4, 5, i+1, xticks=[], yticks=[])
    ax.imshow(image[i])
    ax.set_title(f"Label: {label[i]}")
\`\`\`

Finally we run:

\`\`\`python
view_image(train_dataset)
\`\`\`

Result: <br/>
<br/>

<center>
<a href="/assets/tech/010.png">
<img width="420" src="/assets/tech/010.png"/>
</a>
</center>
<br/>

### References

- https://www.youtube.com/watch?v=rAdLwKJBvPM
- https://albumentations.ai/docs/examples/example_multi_target/
`;export{a as default};
