const e=`---
title: Resulting Shapes of Conv-net by Direct Experiment
date: 2022-03-23
id: blog050
tag: deep-learning
intro: From time to time it is easy to forget the formula to calculate the output shape of \`Conv2D\`, \`MaxPooling2D\`, etc, layers. Record some sample code to test shapes easily.
---

### Sample Code for Shape Experimental Calculation

Suppose we have the up-sampling part in part of the U-Net:

\`\`\`python
  u = UpSampling2D(size=2)(layer_input)
  u = Conv2D(filters, kernel_size=4, strides=1, padding="same", activation="relu")(u)
\`\`\`

What is the resulting shape of the output? For \`strides=1\` and \`padding="same"\` we can memorize the output shape are always unchanged.

But what if \`kernel_size = 3\` and \`strides=2\`, \`padding="valid"\`? There is no point to memorize the formula for output shape as we can always experiment it out as follows:

\`\`\`python
x = tf.random.normal([1, 28,28,3])
x = Conv2D(32, kernel_size=3, strides=2, padding="valid", activation="relu")(x)
print(tf.shape(x))

# output: tf.Tensor([ 1 13 13 32], shape=(4,), dtype=int32)
\`\`\`

### Rigorous Proof to Formula of Shapes

Let $s\\in \\mathbb N$, for $\\texttt{strides=}s$ and $\\texttt{padding="same"}$ we can prove the following:

> $\\displaystyle \\texttt{output_width} = \\left\\lfloor\\frac{\\text{input_width}-1}{s}\\right\\rfloor + 1 = \\left\\lceil\\frac{\\text{input_width}}{s}\\right\\rceil$

This is due to the following simple fact:

> **Fact.** Let $w$ and $s$ be positive integers, there holds
>
> $$
> \\left\\lfloor\\frac{w-1}{s}\\right\\rfloor + 1 = \\left\\lceil\\frac{w}{s}\\right\\rceil.
> $$

<proof>

**Proof.** We do case by case study. If $w=ks$ for some positive $k\\in \\mathbb N$, then

$$
\\text{LHS} = \\left\\lfloor k - \\frac{1}{s}\\right\\rfloor +1 = (k-1)+1=k =  \\lceil k\\rceil = \\text{RHS}.
$$

When $w=ks+j$, for some $k\\in \\mathbb N$ and $j\\in \\mathbb N\\cap (0,s)$, then

$$
\\text{LHS} = \\left\\lfloor k+\\frac{j-1}{s}\\right\\rfloor + 1 = k+1 = \\left\\lceil k+\\frac{j}{s}\\right\\rceil =  \\left\\lceil \\frac{ks+j}{s}\\right\\rceil =  \\left\\lceil\\frac{w}{s}\\right\\rceil=\\text{RHS}.
$$

</proof>
`;export{e as default};
