const e=`---
title: Cascade RCNN
date: 2022-09-30
id: blog098
tag: deep-learning
intro: Code implementation in pytorch on Cascade RCNN, the code base is mainly a modification of my previous project.
---

### Source Code

- https://github.com/machingclee/2022-09-20-Swin-Transformer-backbone-Cascade-RCNN/blob/main/src/cascade_faster_rcnn_swin_transformer_fpn.py

### Paper

- https://arxiv.org/pdf/1712.00726.pdf

### From Faster RCNN

<Center>
<img src="/assets/tech/098-cascade-rcnn/002.png"/>
</Center>

<p/>
<center></center>

Let's have a rough review on faster rcnn. In the figure above \`I\` is an input image, it is fed into a convolutional backbone and we get a feature tensor.

- That feature can be tought of as the local representation of a patched image (the smaller the spatial dimension of the feature, the larger the patched window).
- For exmaple, if a feature is of size \`(B, 256, H/16, W/16)\`, that means each "patched window" is of size $16\\times 16$ and the feature is captured by \`256\` channels.
- In Faster RCNN each feature of patched windows is transformed into the prediction of number of anchors by \`nn.Conv2d(256, n_anchors*4, 1, 1)\` and transformed into the coresponding "objectness" (whether it is a background) by \`nn.Conv2d(256, n_anchors*2, 1, 1)\`.

- These anchors prediction are called **_region proposal_**, they are scored by the "objectness" scores (which we call logits) in another branch that we have mention aboved. They are then filtered by that scores and also their intersection of union (iou) which measures the overlap of two anchors (if they are too close, the one with lower objectness score will be removed).

- The filtered anchors are then used in a pooling layer called \`ROI-Align\`. Therefore we get a feature vector of size \`(B, n_filtered_anchors, 7, 7)\`. These features are used to further predict the **_refinements_** of region proposals that eventually become our final bounding box prediction.

### Improvement from Faster RCNN: Cascade RCNN

<Center>
<img src="/assets/tech/098-cascade-rcnn/001.png"/>
</Center>
<p/>
<center></center>

Cascade RCNN goes a little bit further, we get our bounding boxes from the last paragraph in \`B1\`. let's call these stage-1-prediction.

In the next stage, we treat those boxes as our new region proposals and repeat the process to predict a more refined version of the final bounding boxes. The key is:

- In this second stage, our proposal is allowed to have higher **_iou threshold_**.
- In the thrid stage, we keep increasing our iou threshold.

Eventually we will get more and more precise bounding box with smaller and smaller chance of overlapping each another.

In terms of code, they look:

\`\`\`python
roi_cls_losses = 0
roi_reg_losses = 0

pred_fg_bg_logits = flattened_pred_fg_bg_logits
levels = flattened_levels

for i in range(len(config.cascade_proposal_ious)):
    if (levels.shape[0] != rois.shape[0]):
        print("something wrong")
    roi_cls_loss, roi_reg_loss, cls_logits, rois, pred_fg_bg_logits, levels = \\
        self.stage_prediction_in_training(
            out_feat,
            target_boxes,
            target_cls_indexes,
            rois,
            pred_fg_bg_logits,
            levels,
            n_levels,
            config.cascade_proposal_ious[i]
        )

    roi_cls_losses += roi_cls_loss
    roi_reg_losses += roi_reg_loss
\`\`\`

Since my work is done on feature pyramid, the implementation will be a lot more complicated, but the idea behind it is simple, the reader can try to implement it on faster rcnn with single-feature-backbone.
`;export{e as default};
