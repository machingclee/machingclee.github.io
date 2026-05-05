const e=`---
title: Transfer Learning Based on VGG-16
date: 2021-08-28
id: blog0022
tags: deep-learning, tensorflow
intro: In classification tasks there are already state-of-the-art models trained from a myriad of images. We try to make a network surgery on one of them (VGG-16 this time) to quickly classifiy our custom dataset with good result.
---

### Preprocessing

As a usual practice every classifier starts with pre-processing the dataset for normalization so that

- the model needs not to learn the distribution of specific feature among the dataset and;
- focus on just learning the features.

To make use of VGG-16 we need to carry out exactly the same data pre-processing:

\`\`\`python
from tensorflow.keras.applications.vgg16 import preprocess_input
\`\`\`

we also import the following as a routine:

\`\`\`python
import tensorflow as tf

from tensorflow.keras import optimizers as optim
from tensorflow.keras import losses
from tensorflow.keras import metrics
from tensorflow.keras.applications import VGG16
from tensorflow.keras import Input
from tensorflow.keras import layers
from tensorflow.keras.models import Model
\`\`\`

### Dataset Pipeline with VGG's preprocess_input

In the sequel our \`label\` will be an nonnegative integer.

As we have no incentive to construct one-hot vectors as labels, we will be using sparse-categorical-entropy loss.

\`\`\`python
def get_label(file_path):
  return tf.strings.split(file_path, os.path.sep)[-2]

def path_to_imgLabel(file_path):
  label = tf.cast(tf.strings.to_number(get_label(file_path)), dtype=tf.int32)
  img = tf.io.read_file(file_path)
  img = tf.image.decode_jpeg(img, channels=3)
  return img, label

def preprocess_train_image(img, label):
  img = tf.image.resize(img, (224, 224))
  img = preprocess_input(img)
  return img, label

train_dataset = tf.data.Dataset.list_files("./trainingset/*/**") \\
.map(path_to_imgLabel) \\
.map(preprocess_train_image, num_parallel_calls=autotune) \\
.cache() \\
.shuffle(buffer_size) \\
.batch(batch_size)

val_dataset = tf.data.Dataset.list_files("./validationset/*/**")  \\
.map(path_to_imgLabel) \\
.map(preprocess_train_image, num_parallel_calls=autotune) \\
.cache() \\
.batch(batch_size)
\`\`\`

### Network Surgery

#### Objective

Suppose that I need to classify a dataset into \`544\` labels, then I want to make use of the features extracted by \`VGG-16\`, flatten and classify these features by our fully connected layers.

#### Implementation

We start off by constructing VGG16 model without head:

\`\`\`python
vgg_feature_model = VGG16(
    weights="imagenet",
    include_top=False,
    input_tensor=Input((224,224,3))
  )
\`\`\`

As inspected from \`vgg_feature_model.summary()\` the \`VGG\` model accepts inputs of shape \`(None, 224, 224, 3)\`. This is why we define \`vgg_feature_model\` this way.

\`vgg_feature_model\` in fact accepts a input tensor of flexible shapes in its \`input_tensor\` arguement. Sometimes we may also want

\`\`\`python
vgg_feature_model = VGG16(..., input_tensor=Input((256,256,3)))
\`\`\`

because \`(256, 256)\` is a common image size in datasets, as long as the image size is not too far from \`(224, 224)\` we are fine.

Next we define our feed-forward network for classification:

\`\`\`python
def forward_to_head(feature_model):
  feature = feature_model.output
  feature = layers.Flatten()(feature)

  head = layers.Dense(1024)(feature)
  head = layers.Dropout(0.5)(head)

  head = layers.Dense(544)(head)
  head = layers.Softmax()(head)

  return head

output = forward_to_head(vgg_feature_model)
model = Model(vgg_feature_model.input, output)
\`\`\`

#### Start the Training

Since our feed-forward network has no trained weights on any image data, there is a huge imbalance between the performance of VGG-16 and that of our network. For better result, we first freeze the training parameters:

\`\`\`python
for layer in vgg_feature_model.layers:
  layer.trainable = False
\`\`\`

and warm-up our dense network:

\`\`\`python
model.compile(
  optimizer=optim.Adam(learning_rate=1e-2, global_clipnorm=1),
  loss="sparse_categorical_crossentropy",
  metrics=["accuracy"]
)

model.fit(
  train_dataset,
  steps_per_epoch=len(train_dataset),
  epochs=50,
  validation_data=val_dataset,
  validation_steps=len(val_dataset),
  callbacks=callbacks
)
\`\`\`

We would not expect very good result at this point, undesired phenomenon would arise such as increasing losses or stagnant accuracies.

After a few epoches (the "few" is also a hyper-parameter for us to figure out). We can stop it by \`control + c\` and:

\`\`\`python
for layer in vgg_feature_model.layers:
  layer.trainable = True

model.fit(
  train_dataset,
  steps_per_epoch=len(train_dataset),
  epochs=50,
  validation_data=val_dataset,
  validation_steps=len(val_dataset),
  callbacks=callbacks
)
\`\`\`
`;export{e as default};
