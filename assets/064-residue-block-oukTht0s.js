const n=`---
title: Different Kinds of Residue Blocks
date: 2022-04-20
id: blog064
tag: deep-learning
intro: Record different kinds of residue block that I have seen.
---

### Two Structures

From the paper <a href="https://arxiv.org/pdf/1512.03385.pdf"><i>Deep Residual Learning for Image Recognition</i></a> we can find two possible structure:

<center>
<a href="/assets/tech/041.png">
<img src="/assets/tech/041.png" width="600"/>
</a>
</center>
<p/>
<center></center>

The left is called a **_basic block structure_**, and the right is called a **_bottleneck structure_**.

#### Basic Block Structure

Reference: <a href>https://keras.io/examples/generative/cyclegan/</a>

\`\`\`python
def residual_block(
    x,
    activation,
    kernel_initializer=kernel_init,
    kernel_size=(3, 3),
    strides=(1, 1),
    padding="valid",
    gamma_initializer=gamma_init,
    use_bias=False,
):
    dim = x.shape[-1]
    input_tensor = x

    x = ReflectionPadding2D()(input_tensor)
    x = layers.Conv2D(
        dim,
        kernel_size,
        strides=strides,
        kernel_initializer=kernel_initializer,
        padding=padding,
        use_bias=use_bias,
    )(x)
    x = tfa.layers.InstanceNormalization(gamma_initializer=gamma_initializer)(x)
    x = activation(x)

    x = ReflectionPadding2D()(x)
    x = layers.Conv2D(
        dim,
        kernel_size,
        strides=strides,
        kernel_initializer=kernel_initializer,
        padding=padding,
        use_bias=use_bias,
    )(x)
    x = tfa.layers.InstanceNormalization(gamma_initializer=gamma_initializer)(x)
    x = layers.add([input_tensor, x])
    return x
\`\`\`

#### Bottleneck Structure

For deeper network, we use:

\`\`\`python
def residual_block(
  x,
  filter_depth,
  strides=(1, 1),
  reduce_dim=False,
  reg=0.0001,
  bn_eps=2e-5,
  bn_mom=0.9
):
  shortcut = x
  # we batch-normalize along the the channel axis, which is -1:
  bn = BatchNormalization(axis=-1, epsilon=bn_eps, momentum=bn_mom)(x)
  act = Activation("relu")(bn)
  x = Conv2D(
    int(filter_depth * 0.25),
    (1, 1),
    strides=strides,
    use_bias=False,
    kernel_regularizer=l2(reg)
  )(act)

  x = BatchNormalization(axis=-1, epsilon=bn_eps, momentum=bn_mom)(x)
  x = Activation("relu")(x)
  x = Conv2D(
    int(filter_depth * 0.25),
    (3, 3),
    strides=strides,
    padding="same",
    use_bias=False,
    kernel_regularizer=l2(reg)
  )(x)

  x = BatchNormalization(axis=-1, epsilon=bn_eps, momentum=bn_mom)(x)
  x = Activation("relu")(x)
  x = Conv2D(
    filter_depth,
    (1, 1),
    use_bias=False,
    kernel_regularizer=l2(reg)
  )(x)

  if reduce_dim:
    shortcut = Conv2D(
      filter_depth,
      (1, 1),
      strides=(2, 2),
      use_bias=False,
      kernel_regularizer=l2(reg)
    )(act)

  x = add([x, shortcut])

  return x
\`\`\`
`;export{n as default};
