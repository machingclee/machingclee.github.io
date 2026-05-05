const e=`---
title: Pytorch Fundamentals
date: 2022-05-23
id: blog076
tag: deep-learning, pytorch
intro: Record useful tools and commands in pytorch which I learn from translating DefectGAN model in tensorflow into pytorch.
---

### Conv2DSamePadding: The good day in Tensorflow with padding="same"

The output shape of

\`\`\`python
tf.keras.layers.Conv2D(channels, kernel_size, s, padding="same")
\`\`\`

in tensorflow is more predictable because it always takes an input of shape \`(N, H, W, C)\` into an output of shape \`(N, H//s, W//s, channels)\`. Unfortunately in pytorch \`padding="same"\` will fail if \`s > 1\`, but we usually need such an option to downsize the spatial dimenion by a constant multiple (usually that multiple is \`stride=2\`).

Therefore we create an equivalent version in pytorch:

\`\`\`python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

class Conv2dSamePadding(nn.Conv2d):
    """
    This conv layer is used if we want to make the shape
    of convolution more predictable.
    """

    def __init__(self, *args, **kwargs):
        super(Conv2dSamePadding, self).__init__(*args, **kwargs)

    def get_padding_for_same(self, kernel_size, stride, padding, input: torch.Tensor):
        if isinstance(padding, int):
            input = F.pad(input, (padding, padding, padding, padding))
        if isinstance(kernel_size, int):
            kernel_size = (kernel_size, kernel_size)
        if isinstance(stride, int):
            stride = (stride, stride)
        _, _, H, W = input.shape
        s_H = stride[0]
        s_W = stride[1]
        k_H = kernel_size[0]
        k_W = kernel_size[1]
        h2 = math.floor(H / s_H)
        w2 = math.floor(W / s_W)
        pad_W = (w2 - 1) * s_W + (k_W - 1) + 1 - W
        pad_H = (h2 - 1) * s_H + (k_H - 1) + 1 - H
        padding = (pad_W // 2, pad_W - pad_W // 2, pad_H // 2, pad_H - pad_H // 2)
        return padding

    def forward(self, input):
        padding = self.get_padding_for_same(self.kernel_size, self.stride, self.padding, input)
        return self._conv_forward(F.pad(input, padding), self.weight, self.bias)
\`\`\`

Checking:

\`\`\`python
result = Conv2dSamePadding(3, 6, 100, 3)(torch.randn(10, 3, 300, 300))
print(result.shape)
result = Conv2dSamePadding(3, 6, 100, 3)(torch.randn(10, 3, 299, 299))
print(result.shape)
result = Conv2dSamePadding(3, 6, 100, 3)(torch.randn(10, 3, 298, 298))
print(result.shape)
result = Conv2dSamePadding(3, 6, 100, 3)(torch.randn(10, 3, 297, 297))
print(result.shape)
\`\`\`

Result:

\`\`\`none
torch.Size([10, 6, 100, 100])
torch.Size([10, 6, 99, 99])
torch.Size([10, 6, 99, 99])
torch.Size([10, 6, 99, 99])
\`\`\`

### Spectral Normalization to Every Convolution Layer in a Module

\`\`\`python
def _add_sn(m):
    if isinstance(m, (nn.Conv2d, nn.ConvTranspose2d)):
        return spectral_norm(m)
    else:
        return m

def add_sn_(model: nn.Module):
    model.apply(_add_sn)
\`\`\`

### Weights Initialization to Every Convolution Layer in a Module

\`\`\`python
def initialize_weights(model):
    for m in model.modules():
        if isinstance(m, (nn.Conv2d, nn.ConvTranspose2d)):
            nn.init.xavier_normal_(m.weight.data)
\`\`\`

### Device Which Auto-Detect Cuda

\`\`\`python
import torch
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
\`\`\`

### Save and Load Model

\`\`\`python
torch.save(gen, "gen.pt")
torch.load("gen.pt")
\`\`\`

### Dataloader

In pytorch:

- We use \`Dataset\` to construct the logic to generate input and ground truth in training. For this, we subclass from \`Dataset\` and implement:
  - \`__getitem__(self, index)\` given an index \`i\`, give me a data \`dataset[i]\`.
  - \`__len__\` give me total length of the dataset.
- We then use \`DataLoader\` class to wrap \`Dataset\` object to construct a dataset pipeline.

Now we can test the outout of our dataset by \`dataset[0]\`.

#### Example of Dataset Object

\`\`\`python
import os
import numpy as np
import torch

from torch.utils.data import Dataset, DataLoader
from torchvision.io import read_image, image
from torchvision import transforms as T
from device import device
from config import ModelAndTrainingConfig as config

class DefectDataset(Dataset):
    def __init__(self):
        super(DefectDataset, self).__init__()
        self.defect_filepath_arr = None
        self.load_fect_filepath()

    def load_fect_filepath(self):
        if self.defect_filepath_arr is None:
            defect_data = []
            dataset_dir = config.dataset_dir

            for defect in config.defect_labels:
                normal_dir = f"{dataset_dir}/{defect}/normal"
                defect_dir = f"{dataset_dir}/{defect}/defect"
                mask_dir = f"{dataset_dir}/{defect}/defect_segmentation"
                defect_index = config.labels.index(defect)

                for basename in os.listdir(normal_dir):
                    filename = basename.replace(".jpg", "")
                    normal_path = f"{normal_dir}/{filename}.jpg"
                    defect_path = f"{defect_dir}/{filename}.jpg"
                    defect_mask_path = f"{mask_dir}/{filename}.png"
                    defect_data.append([defect_index, normal_path, defect_path, defect_mask_path])

            self.defect_filepath_arr = defect_data

    def load_cls_index_and_imgs_from_index(self, index):
        cls_index, normal_path, defect_path, defect_seg_path = self.defect_filepath_arr[index]
        resize = T.Resize(config.image_shape[1:3])
        np_normal = resize(read_image(normal_path)) / 127.5 - 1
        np_defect = resize(read_image(defect_path)) / 127.5 - 1
        np_defect_mask = resize(read_image(defect_seg_path, mode=image.ImageReadMode.GRAY)) / 255
        np_defect_mask = torch.where(np_defect_mask > 0.5, 1, 0)
        return cls_index, np_normal, np_defect, np_defect_mask

    def load_spatial_charactergorical_map_from_index(self, index):
        cls_index, _, _, defect_mask = self.load_cls_index_and_imgs_from_index(index)
        spartial_dim = tuple(config.image_shape[1:3])
        spatial_cat_map = np.zeros((len(config.labels),) + spartial_dim)
        spatial_cat_map[cls_index] = defect_mask[0]
        return spatial_cat_map

    def get_num_of_batches(self):
        return (len(self.defect_filepath_arr) // config.batch_size) + (0 if config.dataset_drop_last else 1)

    def __getitem__(self, index):
        defect_cls_index, np_normal, np_defect, np_defect_seg = \\
            self.load_cls_index_and_imgs_from_index(index)

        spatial_cat_map = self.load_spatial_charactergorical_map_from_index(index)

        return (
            torch.as_tensor(defect_cls_index).type(torch.LongTensor).to(device),
            torch.as_tensor(np_normal, dtype=torch.float, device=device),
            torch.as_tensor(np_defect, dtype=torch.float, device=device),
            torch.as_tensor(np_defect_seg, dtype=torch.float, device=device),
            torch.as_tensor(spatial_cat_map, dtype=torch.float, device=device)
        )

    def __len__(self):
        return len(self.defect_filepath_arr)
\`\`\`

#### Example of DataLoader Object

\`\`\`python
defect_dataset = DefectDataset()
defectDataloader = DataLoader(dataset=defect_dataset,
                              batch_size=config.batch_size,
                              shuffle=True,
                              #   prefetch_factor=config.batch_size,
                              drop_last=config.dataset_drop_last,
                              num_workers=config.dataset_num_workers)
\`\`\`

#### On num_workers and prefetch_factor

Note that from https://github.com/fastai/fastbook/issues/85

> We always need to set **_num_workers=0_** when creating a DataLoader
> because Pytorch multiprocessing does not work on Windows.

<center></center>

Moreover, \`prefetch_factor\` can be positive only when \`num_workers\` is positive. Therefore in windows, both \`prefetch_factor\` and \`num_workers\` must be \`0\`.
`;export{e as default};
