const e=`---
title: Faster RCNN in PyTorch
date: 2022-06-27
id: blog084
tag: pytorch, deep-learning
intro: Minimal functioning implementation of faster rcnn (with and without fpn).
---

### Repo

- Feature of Single-Scale:

  https://github.com/machingclee/Minimal-Code-for-Faster-RCNN-in-pytorch

- Feature of Multi-Scale with Feature Pyramid Network

  https://github.com/machingclee/Minimal-Code-for-Faster-RCNN-with-FPN-in-pytorch

### Results

Here the faded white boxes are the ROIs, and blue boxes are refined ROIs that are estimated from the feature of ROIAlign module.

<div>
  <center>
  <a href="/assets/tech/057.jpg">
    <img src="/assets/tech/057.jpg" width="45%" style="margin-right:10pt"/>
  </a>
  <a href="/assets/tech/058.jpg">
    <img src="/assets/tech/058.jpg" width="45%"/>
  </a>
  </center>
</div>

### Model Structure

<a href="/assets/tech/056.png" target="_blank">
  <img src="/assets/tech/056.png" width="100%"/>
</a>

### How to Read the Source Code

It is not easy to explain everything in a blog post. Rather one can delve into the source code and see how it works!

Reader can treat \`src/faster_rcnn.py\` as an entry point, the class \`FasterRCNN\` is our target result. The \`FasterRCNN.forward\` method behaves differently when it is in:

- **Training Mode.** It returns
  - \`rpn_cls_loss\`
  - \`rpn_reg_loss\`
  - \`roi_cls_loss\`
  - \`roi_reg_loss\`
- **Evaluation Mode.** It returns
  - \`scores\`
  - \`roi_refined_box\`
  - \`cls_idxes\`
  - \`rois\` (no use, debugging purpose)
`;export{e as default};
