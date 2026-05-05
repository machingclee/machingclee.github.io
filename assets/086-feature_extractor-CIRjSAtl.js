const e=`---
title: Feature Extractors
date: 2022-07-14
id: blog086
tag: pytorch, deep-learning
intro: Different backbones have different APIs for extracting features from an image, we record some of them.
---

### How to find the Slice of Layers

Usually we can inspect a model by print(the_model), from that it is easy to find the correct slice indexes of the corresponding layers.

### Backbones

#### VGG-16

\`\`\`python
class Vgg16FeatureExtractor(nn.Module):
    def __init__(self):
        super(FeatureExtractor, self).__init__()
        self.vgg = models.vgg16(pretrained=True).to(device)
        self.features = self.vgg.features
        self.out_channels = None

        self.conv_blk1 = self.features[0:4]
        self.conv_blk2 = self.features[4:9]
        self.conv_blk3 = self.features[9:16]
        self.conv_blk4 = self.features[16:23]
        self.conv_blk5 = self.features[23:29]

        self.freeze_vgg_bottom_layers()

    def unfreeze_layers(self, from_layer, to_layer):
        for layer in list(self.features)[from_layer: to_layer]:
            if isinstance(layer, nn.Conv2d):
                for param in layer.parameters():
                    param.requires_grad = True

    def freeze_vgg_bottom_layers(self):
        for layer in (list(self.conv_blk1) + list(self.conv_blk2) + list(self.conv_blk3)):
            if isinstance(layer, nn.Conv2d):
                for param in layer.parameters():
                    param.requires_grad = False

    def vgg_weight_init_upper_layers(self):
        for layer in list(self.feature_extraction.children())[9:]:
            if isinstance(layer, nn.Conv2d):
                torch.nn.init.normal_(layer.weight, std=0.01)
                torch.nn.init.constant_(layer.bias, 0)

    def unfreeze_vgg(self):
        for param in self.vgg.parameters():
            param.requires_grad = True

    def forward(self, x):
        x = self.conv_blk1(x)
        x = self.conv_blk2(x)
        x = self.conv_blk3(x)
        x = self.conv_blk4(x)
        x = self.conv_blk5(x)
        return x
\`\`\`

#### Resnet-34

\`\`\`python
class Resnet34FeatureExtractor(nn.Module):
    def __init__(self):
        # type: (Backbone) -> None
        super(FeatureExtractor, self).__init__()

        self.resnet34 = models.resnet34(pretrained=True).to(device)
        # self.layer9 = self.resnet34.
        self.conv1 = self.resnet34.conv1
        self.bn1 = self.resnet34.bn1
        self.relu = self.resnet34.relu
        self.maxpool = self.resnet34.maxpool
        self.layer1 = self.resnet34.layer1
        self.layer2 = self.resnet34.layer2
        self.layer3 = self.resnet34.layer3
        self.freeze_resnet34_bottom_layers()

    def freeze_resnet34_bottom_layers(self):
        for layer in ([self.conv1] + list(self.layer1) + list(self.layer2)):
            if isinstance(layer, nn.Conv2d):
                for param in layer.parameters():
                    param.requires_grad = False

    def forward(self, x):
        x= self.conv1(x)
        x= self.bn1(x)
        x= self.relu(x)
        x= self.maxpool(x)
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        return x
\`\`\`

#### Resnet-50-FPN

\`\`\`python
class ResnetFPNFeactureExtractor(nn.Module):
    def __init__(self):
        super(ResnetFPNFeactureExtractor, self).__init__()
        self.resnet50 = models.resnet50(pretrained=True)

        self.conv2 = nn.Sequential(
            self.resnet50.conv1,
            self.resnet50.bn1,
            self.resnet50.relu,
            self.resnet50.maxpool,
            self.resnet50.layer1
        )
        self.conv3 = self.resnet50.layer2
        self.conv4 = self.resnet50.layer3
        self.conv5 = self.resnet50.layer4

        self.lateral_conv5 = nn.Conv2d(2048, config.fpn_feat_channels, 1, 1)
        self.lateral_conv4 = nn.Conv2d(1024, config.fpn_feat_channels, 1, 1)
        self.lateral_conv3 = nn.Conv2d(512, config.fpn_feat_channels, 1, 1)
        self.lateral_conv2 = nn.Conv2d(256, config.fpn_feat_channels, 1, 1)

        self.upscale = lambda input: F.interpolate(input, scale_factor=2)
        self.freeze_params()

    def freeze_params(self):
        modules = [
            self.conv2,
            self.conv3,
            # self.conv4,
            # self.conv5
        ]
        for module in modules:
            for layer in module:
                if isinstance(layer, nn.Conv2d):
                    for param in layer.parameters():
                        param.requires_grad = False

    def forward(self, x):
        c2 = self.conv2(x)
        c3 = self.conv3(c2)
        c4 = self.conv4(c3)
        c5 = self.conv5(c4)

        p5 = self.lateral_conv5(c5)
        p4 = self.lateral_conv4(c4) + self.upscale(p5)
        p3 = self.lateral_conv3(c3) + self.upscale(p4)
        p2 = self.lateral_conv2(c2) + self.upscale(p3)

        return [p2, p3, p4, p5]
\`\`\`
`;export{e as default};
