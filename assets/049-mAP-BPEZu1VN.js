const e=`---
title: Simple Introduction to mAP and F1-Score
date: 2022-03-21
id: blog049
tag: deep-learning
intro: Explain why and how it can provides a performance index to a localization algorithm.
---

### Summary from Research

In conclusion, when we are concerned with the performance of the model under different/specific IoU, i.e., when bounding box accuracy is our concern, then we use mAP.

However, some model is well-trained for annotating target object already, but it fails to spot diversified target that cause missing detection, then IoU is not our concern, we can simply use **_F1- score_**.

### F1-Score

Define

$$
\\texttt{Precision} := \\frac{TP}{TP+FP}\\quad \\text{and}\\quad \\texttt{Recall} := \\frac{TP}{TP+FN},
$$

then we define \`F1-score\` to be

$$
\\texttt{F1-score} := \\frac{2}{\\displaystyle\\frac{1}{ \\texttt{Precision}}  + \\frac{1}{\\texttt{Recall}}} = \\frac{2\\times \\texttt{Precision}\\times \\texttt{Recall}}{ \\texttt{Precision}+\\texttt{Recall}}.
$$

<p></p>

I refer to **[ZL]** for more detail on F1-score and how it behaves compared to arithmetic mean and geometric mean. In short summary, $\\texttt{F1-score}$ penalizes **_unbalanced_** $\\texttt{Precision}$ and $\\texttt{Recall}$.

### mAP

#### Precision and Recall

Given that we have fixed a label $\\mathcal L$ to work with, say $\\mathcal L = \\texttt{damaged_display}$, we need the following table with

$$
\\text{Recall} = \\frac{\\text{acc. }TP}{\\text{Total number of signboard of class $\\mathcal L$}}.
$$

Note that the denominator is actually the total number of ground truths from **_all_** images, not just from a single image.

By sorting the results using objectiveness/confidence score, we get a table like:

<center>
<a href="/assets/tech/028.jpg" target="_blank">
  <img src="/assets/tech/028.jpg" style="width:90%"/>
</a>
</center>
<p/>

#### Why Recall

Precision $\\displaystyle \\frac{TP}{TP+FP}$ (where $FP$ is the number of boxes identified as $\\mathcal L$ in correctly) is not enough as it doesn't count undetected signboard.

#### Calculation of mAP from the Graph

By using the precision and recall columns we should be able to graph it as follows:

<center>
<a href="/assets/tech/029.png" target="_blank">
  <img src="/assets/tech/029.png" />
</a>
</center>
<p/>

Note that the area under the path now means exactly the average precision (that's why recall is a fraction, it helps normalize the number of calls).

Programmatically we don't calculate that area directly, we smooth the graph out for approximated average precision in the following way:

<center>
<a href="/assets/tech/029.png" target="_blank">
  <img src="/assets/tech/030.png"/>
</a>
</center>
<p/>

The new dots is exactly the same as the value $p(r)=\\max_{r'\\ge r}p(r')$, where $r$ is the recall, our approximated precision is

$$
\\frac{1}{\\text{number of rows in table}} \\times \\sum_{r\\ge 0} p(r)
$$

which is, for example,

$$
\\frac{1}{11}(1+0.6666+0.4285+0.4285+0.4285+0+0+0+0+0+0) = 26.84\\%
$$

in the figure above.

### References

- **[ZL]** Zeya LT, <a href="https://towardsdatascience.com/essential-things-you-need-to-know-about-f1-score-dbd973bf1a3">Essential Things You Need to Know About F1-Score</a>
`;export{e as default};
