const e=`---
id: portfolio010
title: Defect Classifcation by Object Detections
intro: We implement a defect classifier by means of object detection.
thumbnail: /assets/portfolios/thumbnails/rust_detections.png
tech: Python, Pytorch
thumbWidth: 400 
thumbTransX: 0
thumbTransY: 0
hoverImageHeight: 137
date: 2022-06-29
---

### Repository
- We use faster rcnn with Resnet-50 as backbone and use FPN architecture, the model is exactly the same as below with the training data being kept confidential:
  https://github.com/machingclee/Minimal-Code-for-Faster-RCNN-with-FPN-in-pytorch

### Task Discription
I was responsible to implement an algorithm to classify the defect type, if any, of a cropped signboard. The signboards are detected and cropped by a yolo algorithm, so I am left with implementing a classifier.

- **First Attempt.** We build a naive binary classifier that intakes an image and output a score of being a rusty signboards, however we face two problems using this approach:
  1. There are not enough images of rusty signboard. In fact, there is very slim chance of finding a rusty signboard in a trip view.
  2. We don't know what is learned by the network, worse still, we have no control on what to learn.

<p/>

- **Second Attempt.** We have not enough rusty signboard images, but we relatively large amount of  rust within an image, therefore we use object detection and the classification score of **faster rcnn** of each detection boxes to define rust score. 

  Denote 
  $$
  \\{b_1,b_2,\\dots, b_n\\}
  $$
  the rust detection boxes and 
  $$
  \\{s_1,s_2,\\dots,s_n\\}
  $$ 
  the corresponding rust classification scores, a signboard is defined to be **rusty** if 
  $$
    \\text{there is a signboard with cls score } \\ge 0.6 \\iff \\max_{i=1,2,\\dots, n} s_i \\ge 0.6,
  $$
  where the rusty-score threshold 0.6 is based on the evaluation of the model performance. It will change over time and is not fixed.

### Results
Interpretations of the Images:
- Green boxes are ground truths
- Blue boxes are predictions with the cls score attached right above

<center>
<img src="/assets/portfolios/images/rust01.jpg">
</center>
<center>
<img src="/assets/portfolios/images/rust02.jpg">
</center>
<center>
<img src="/assets/portfolios/images/rust03.jpg">
</center>
<center>
<img src="/assets/portfolios/images/rust04.jpg">
</center>
<center>
<img src="/assets/portfolios/images/rust05.jpg">
</center>`;export{e as default};
