const e=`---
title: Swin-Transformer Backbone in Faster RCNN
date: 2022-09-20
id: blog094
tag: deep-learning, pytorch
intro: Describe how to fed the features from Swin Transformer into Faster RCNN.
---

### Repository

- https://github.com/machingclee/2022-09-20-Swin-Transformer-backbone-FasterRCNN

### Target Features

The red arrows indicates the features we want:

<Center>
<a href="/assets/tech/094-fasterrcnn-swin/001.png" target="_blank">
  <img src="/assets/tech/094-fasterrcnn-swin/001.png" width="700"/>
</a>
</Center>

### Produce Features Pyramid from the Desired Features

An appendix of \`models.swin_t\` has been provided at the end of this blog post. Here \`config.fpn_feat_channels = 192\` which is to match the smallest number of features in the pyramid (so that we can do addition).

Here \`swin_t\` can be replaced by \`swin_s\` and \`swin_b\` for different experiments. Their output shape are still the same (with different number of blocks of transformer encoder).

\`\`\`python
class SwinFeatureExtractor(nn.Module):
    def __init__(self):
        super(SwinFeatureExtractor, self).__init__()
        self.model = models.swin_t(weights="DEFAULT").to(device)
        self.layer1 = self.model.features[0:2]
        self.layer2 = self.model.features[2:4]
        self.layer3 = self.model.features[4:6]
        self.layer4 = self.model.features[6:8]
        self.lateral_conv5 = nn.Conv2d(768, config.fpn_feat_channels, 1, 1)
        self.lateral_conv4 = nn.Conv2d(384, config.fpn_feat_channels, 1, 1)
        self.lateral_conv3 = nn.Conv2d(192, config.fpn_feat_channels, 1, 1)
        self.lateral_conv2 = nn.Conv2d(96, config.fpn_feat_channels, 1, 1)
        self.upscale = lambda input: F.interpolate(input, scale_factor=2)
        self.freeze_params()

    def freeze_params(self):
        for param in self.model.parameters():
            param.requires_grad = False

    def forward(self, x):
        x_4: Tensor = self.layer1(x)
        x_8 = self.layer2(x_4)
        x_16 = self.layer3(x_8)
        x_32 = self.layer4(x_16)

        x_4 = x_4.permute([0, 3, 1, 2])
        x_8 = x_8.permute([0, 3, 1, 2])
        x_16 = x_16.permute([0, 3, 1, 2])
        x_32 = x_32.permute([0, 3, 1, 2])

        p5 = self.lateral_conv5(x_32)
        p4 = self.lateral_conv4(x_16) + self.upscale(p5)
        p3 = self.lateral_conv3(x_8) + self.upscale(p4)
        p2 = self.lateral_conv2(x_4) + self.upscale(p3)

        return [p2, p3, p4, p5]
\`\`\`

Here \`x_k\` denotes the feature of spatial dimension $\\frac{H}{k} \\times \\frac{W}{k}$, where \`_, _, H, W = x.shape\`.

The major changes are just the \`img_shapes\` and \`fpn_feat_channels\`. The rest are the same.

### Sample Result

<Center>
  <img src="/assets/tech/094-fasterrcnn-swin/002.jpg" width="600"/>
</Center>

### Appendix: Printed Info of the Structure of SwinTransformer

\`\`\`text
SwinTransformer(
  (features): Sequential(
    (0): Sequential(
      (0): Conv2d(3, 96, kernel_size=(4, 4), stride=(4, 4))
      (1): Permute()
      (2): LayerNorm((96,), eps=1e-05, elementwise_affine=True)
    )
    (1): Sequential(
      (0): SwinTransformerBlock(
        (norm1): LayerNorm((96,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=96, out_features=288, bias=True)
          (proj): Linear(in_features=96, out_features=96, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.0, mode=row)
        (norm2): LayerNorm((96,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=96, out_features=384, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=384, out_features=96, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
      (1): SwinTransformerBlock(
        (norm1): LayerNorm((96,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=96, out_features=288, bias=True)
          (proj): Linear(in_features=96, out_features=96, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.018181818181818184, mode=row)
        (norm2): LayerNorm((96,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=96, out_features=384, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=384, out_features=96, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
    )
    (2): PatchMerging(
      (reduction): Linear(in_features=384, out_features=192, bias=False)
      (norm): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
    )
    (3): Sequential(
      (0): SwinTransformerBlock(
        (norm1): LayerNorm((192,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=192, out_features=576, bias=True)
          (proj): Linear(in_features=192, out_features=192, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.03636363636363637, mode=row)
        (norm2): LayerNorm((192,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=192, out_features=768, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=768, out_features=192, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
      (1): SwinTransformerBlock(
        (norm1): LayerNorm((192,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=192, out_features=576, bias=True)
          (proj): Linear(in_features=192, out_features=192, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.05454545454545456, mode=row)
        (norm2): LayerNorm((192,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=192, out_features=768, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=768, out_features=192, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
    )
    (4): PatchMerging(
      (reduction): Linear(in_features=768, out_features=384, bias=False)
      (norm): LayerNorm((768,), eps=1e-05, elementwise_affine=True)
    )
    (5): Sequential(
      (0): SwinTransformerBlock(
        (norm1): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=384, out_features=1152, bias=True)
          (proj): Linear(in_features=384, out_features=384, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.07272727272727274, mode=row)
        (norm2): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=384, out_features=1536, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=1536, out_features=384, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
      (1): SwinTransformerBlock(
        (norm1): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=384, out_features=1152, bias=True)
          (proj): Linear(in_features=384, out_features=384, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.09090909090909091, mode=row)
        (norm2): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=384, out_features=1536, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=1536, out_features=384, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
      (2): SwinTransformerBlock(
        (norm1): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=384, out_features=1152, bias=True)
          (proj): Linear(in_features=384, out_features=384, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.10909090909090911, mode=row)
        (norm2): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=384, out_features=1536, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=1536, out_features=384, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
      (3): SwinTransformerBlock(
        (norm1): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=384, out_features=1152, bias=True)
          (proj): Linear(in_features=384, out_features=384, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.1272727272727273, mode=row)
        (norm2): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=384, out_features=1536, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=1536, out_features=384, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
      (4): SwinTransformerBlock(
        (norm1): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=384, out_features=1152, bias=True)
          (proj): Linear(in_features=384, out_features=384, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.14545454545454548, mode=row)
        (norm2): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=384, out_features=1536, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=1536, out_features=384, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
      (5): SwinTransformerBlock(
        (norm1): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=384, out_features=1152, bias=True)
          (proj): Linear(in_features=384, out_features=384, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.16363636363636364, mode=row)
        (norm2): LayerNorm((384,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=384, out_features=1536, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=1536, out_features=384, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
    )
    (6): PatchMerging(
      (reduction): Linear(in_features=1536, out_features=768, bias=False)
      (norm): LayerNorm((1536,), eps=1e-05, elementwise_affine=True)
    )
    (7): Sequential(
      (0): SwinTransformerBlock(
        (norm1): LayerNorm((768,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=768, out_features=2304, bias=True)
          (proj): Linear(in_features=768, out_features=768, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.18181818181818182, mode=row)
        (norm2): LayerNorm((768,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=768, out_features=3072, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=3072, out_features=768, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
      (1): SwinTransformerBlock(
        (norm1): LayerNorm((768,), eps=1e-05, elementwise_affine=True)
        (attn): ShiftedWindowAttention(
          (qkv): Linear(in_features=768, out_features=2304, bias=True)
          (proj): Linear(in_features=768, out_features=768, bias=True)
        )
        (stochastic_depth): StochasticDepth(p=0.2, mode=row)
        (norm2): LayerNorm((768,), eps=1e-05, elementwise_affine=True)
        (mlp): MLP(
          (0): Linear(in_features=768, out_features=3072, bias=True)
          (1): GELU(approximate=none)
          (2): Dropout(p=0.0, inplace=False)
          (3): Linear(in_features=3072, out_features=768, bias=True)
          (4): Dropout(p=0.0, inplace=False)
        )
      )
    )
  )
  (norm): LayerNorm((768,), eps=1e-05, elementwise_affine=True)
  (avgpool): AdaptiveAvgPool2d(output_size=1)
  (head): Linear(in_features=768, out_features=1000, bias=True)
)
\`\`\`
`;export{e as default};
