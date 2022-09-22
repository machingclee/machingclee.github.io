title: Swin Transformer with einops Implementation
date: 2022-09-19
id: blog093
tag: deep-learning
intro: In practice we can directly use `torchvision.models.swin_t` to use pretrained model. The Reimplementation of the model is for sheer purpose of my self-learning.

#### Repository

- https://github.com/machingclee/2022-09-16-swin-transformer-einops-implementation/tree/main/src

#### Basic Imports

```python
import torch
import torch.nn.functional as F
import matplotlib.pyplot as plt

from torch import nn
from torch import Tensor
from PIL import Image
from torchvision.transforms import Compose, Resize, ToTensor
from einops import rearrange, reduce, repeat
from einops.layers.torch import Rearrange, Reduce
from typing import Tuple, Optional
```

#### PatchEmbedding

```python
class PatchEmbedding(nn.Module):
    def __init__(self, in_channels=3, patch_size=4, embed_dim=768):
        self.patch_size = patch_size
        super().__init__()
        self.projection = nn.Sequential(
            nn.Conv2d(in_channels, embed_dim, kernel_size=patch_size, stride=patch_size),
            Rearrange('b e (h) (w) -> b (h w) e'),
        )

    def forward(self, x: Tensor) -> Tensor:
        x = self.projection(x)
        return x
```

#### MLP

```python
class MLP(nn.Sequential):
    def __init__(self, dim, mlp_ratio=4.0, dropout=0.):
        super(MLP, self).__init__(
            nn.Linear(dim, int(dim * mlp_ratio)),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(int(dim * mlp_ratio), dim),
            nn.Dropout(dropout)
        )
```

#### windows_partition

```python
def windows_partition(x, window_size):
    x = rearrange(
        x,
        "b (win_size1 h2) (win_size2 w2) c -> (b h2 w2) (win_size1 win_size2) c",
        win_size1=window_size,
        win_size2=window_size
    )
    return
```

#### windows_reverse

```python
def windows_reverse(windows, window_size, h, w):
    h2 = h // window_size
    w2 = w // window_size
    # logically we should reverse to the shape "b (win_size1 h2) (win_size2 w2) c",
    # but technically we are going to add the result with skip connection,
    # therefore we reshape directly to "b (win_size1 h2 win_size2 w2) c"
    x = rearrange(
        windows,
        "(b h2 w2) (win_size1 win_size2) c -> b (win_size1 h2 win_size2 w2) c",
        win_size1=window_size,
        win_size2=window_size,
        h2=h2,
        w2=w2
    )
    return x
```

#### WindowAttention

```python
class WindowAttention(nn.Module):
    def __init__(self, dim, num_heads, window_size):
        super(WindowAttention, self).__init__()
        self.dim = dim
        self.window_size = window_size
        self.head_dim = dim // num_heads
        self.num_heads = num_heads
        self.scale = self.head_dim ** -0.5
        self.softmax = nn.Softmax(-1)
        self.qkv = nn.Linear(dim, dim * 3)
        self.proj = nn.Linear(dim, dim)

        """ <--- Create Relative Position Index """
        coords_h = torch.arange(window_size)
        coords_w = torch.arange(window_size)
        coords_flatten = torch.stack(torch.meshgrid([coords_h, coords_w])).flatten(1)
        relative_coords = coords_flatten[:, :, None] - coords_flatten[:, None, :]
        relative_coords = relative_coords.permute(1, 2, 0).contiguous()
        relative_coords[:, :, 0] += self.window_size - 1
        relative_coords[:, :, 1] += self.window_size - 1
        relative_coords[:, :, 0] *= 2 * self.window_size - 1

        # record the index from which we take value from a feature vector
        relative_position_index = relative_coords.sum(-1)

        # we don't need to learn the indexing
        self.register_buffer("relative_position_index", relative_position_index)
        """ Create Relative Position Index --->"""

        self.relative_position_bias_table = nn.Parameter(
            torch.zeros((2 * window_size - 1) * (2 * window_size - 1), num_heads)
        )
        nn.init.trunc_normal_(self.relative_position_bias_table)

    def forward(self, x, mask=None):
        # x: [b, num_img_tokens, embed_dim]
        # mask: [n, ws*ws, ws*ws]
        x = self.qkv(x)
        qkv = rearrange(x, "b n (h d qkv) -> (qkv) b h n d", h=self.num_heads, qkv=3)
        q, k, v = qkv[0], qkv[1], qkv[2]

        q = q * self.scale
        attn = torch.einsum("bhqd, bhkd -> bhqk", q, k)  # attn = Q * K^T

        relative_position_bias = self.relative_position_bias_table.index_select(
            0,
            self.relative_position_index.reshape((-1,))
        ).reshape((self.window_size**2, self.window_size**2, -1))

        # shift number of heads back to the first dimension
        # unsqueeze in order to broadcast for batches
        relative_position_bias = relative_position_bias.permute((2, 0, 1)).unsqueeze(0)

        attn = attn + relative_position_bias

        if mask is not None:
            discard_mask = 1 - mask
            discard_mask = discard_mask * -1e10
            attn = attn + discard_mask

        attn = self.softmax(attn)
        out = torch.einsum("bhai, bhid -> bhad", attn, v)  # attn * V
        out = rearrange(out, "b h n d -> b n (h d)")
        out = self.proj(out)
        return out
```

#### generate_mask

```python
def generate_mask(window_size=4, shift_size=2, input_resolution=(8, 8)):
    H, W = input_resolution
    img_mask = torch.zeros((1, H, W, 1))  # we keep the last dimension becuase we want to apply windows_partition
    h_slices = [slice(0, -window_size),
                slice(-window_size, -shift_size),
                slice(-shift_size, None)]
    w_slices = [slice(0, -window_size),
                slice(-window_size, -shift_size),
                slice(-shift_size, None)]

    count = 0
    for h in h_slices:
        for w in w_slices:
            img_mask[:, h, w, :] = count
            count += 1

    windows_mask = windows_partition(img_mask, window_size)
    # windows_mask: [(b h2 w2), (win_size1 win_size2), 1]
    windows_mask = windows_mask.reshape((-1, window_size * window_size))
    # [n, 1, ws*ws] - [n, ws*ws, 1]
    attn_mask = windows_mask.unsqueeze(1) - windows_mask.unsqueeze(2)
    attn_mask = torch.where(attn_mask == 0, 1., 0.)
    return attn_mask
```

#### SwinBlock

```python
class SwinBlock(nn.Module):
    def __init__(self, dim, input_resolution, num_heads, window_size, shift_size=0):
        super(SwinBlock, self).__init__()
        self.dim = dim
        self.resolution = input_resolution
        self.window_size = window_size
        self.shift_size = shift_size

        self.attn_norm = nn.LayerNorm(dim)
        self.attn = WindowAttention(dim, num_heads, window_size)

        self.mlp_norm = nn.LayerNorm(dim)
        self.mlp = MLP(dim)

        if self.shift_size > 0:
            attn_mask = generate_mask(window_size=self.window_size,
                                      shift_size=self.shift_size,
                                      input_resolution=self.resolution)
        else:
            attn_mask = None
        self.register_buffer('attn_mask', attn_mask)

    def forward(self, x):
        # x: [b, n, d]
        H, W = self.resolution
        B, N, C = x.shape
        h = x
        x = self.attn_norm(x)
        x = rearrange(x, "b (h w) c -> b h w c", h=H, w=W)

        if self.shift_size > 0:
            shifted_x = torch.roll(x, shifts=(-self.shift_size, -self.shift_size), dims=(1, 2))
        else:
            shifted_x = x

        x_windows = windows_partition(shifted_x, self.window_size)

        if self.attn_mask is not None:
            self.attn_mask = repeat(self.attn_mask[None, ...], "() num_patches h w -> b num_patches h w", b=B)
            # exactly the same rearrange with that in windows_reverse
            self.attn_mask = rearrange(self.attn_mask, "b num_patches h w -> (b num_patches) () h w")

        attn_windows = self.attn(x_windows, mask=self.attn_mask)
        attn_windows = windows_reverse(attn_windows, window_size=self.window_size, h=H, w=W)

        # reverse cyclic shift
        if self.shift_size > 0:
            x = torch.roll(shifted_x, shifts=(self.shift_size, self.shift_size), dims=(1, 2))
        else:
            x = shifted_x

        x = h + attn_windows

        h = x
        x = self.mlp_norm(x)
        x = self.mlp(x)
        x = h + x
        return
```

#### SwinStage

```python
class SwinStage(nn.Module):
    def __init__(self,
                 dim: int,
                 input_resolution: Tuple[int, int],
                 depth: int,
                 num_heads: int,
                 window_size: int,
                 patch_merging: Optional[PatchMerging] = None):
        super(SwinStage, self).__init__()
        self.blocks = nn.ModuleList()

        for i in range(depth):
            self.blocks.append(
                SwinBlock(dim=dim,
                          input_resolution=input_resolution,
                          num_heads=num_heads,
                          window_size=window_size,
                          shift_size=0 if i % 2 == 0 else window_size // 2)
            )
        if patch_merging is None:
            self.patch_merging = nn.Identity()
        else:
            self.patch_merging = patch_merging(input_resolution, dim)

    def forward(self, x):
        for block in self.blocks:
            x = block(x)

        x = self.patch_merging(x)
        return
```

#### SwinTransformer

```python
class SwinTransformer(nn.Module):
    def __init__(self,
                 image_size=224,
                 patch_size=4,
                 embed_dim=96,
                 window_size=7,
                 num_heads=[3, 6, 12, 24],
                 depths=[2, 2, 6, 2],
                 num_classes=1000,
                 output_hidden_states=False
                ):
        super(SwinTransformer, self).__init__()
        self.num_class = num_classes
        self.depths = depths
        self.num_heads = num_heads
        self.embed_dim = embed_dim
        self.num_stages = len(depths)
        self.num_features = int(self.embed_dim * (2 ** (self.num_stages - 1)))
        self.patch_resolution = [image_size // patch_size, image_size // patch_size]

        self.patch_embedding = PatchEmbedding(patch_size=patch_size, embed_dim=embed_dim)
        self.stages = nn.ModuleList()
        self.output_hidden_states = output_hidden_states

        for idx, (depth, n_heads) in enumerate(zip(self.depths, self.num_heads)):
            h, w = self.patch_resolution
            stage = SwinStage(dim=int(self.embed_dim * (2 ** idx)),
                              input_resolution=(h // (2**idx), w // (2**idx)),
                              depth=depth,
                              num_heads=n_heads,
                              window_size=window_size,
                              patch_merging=PatchMerging if (idx < self.num_stages-1) else None)
            self.stages.append(stage)
        self.window_size = window_size
        self.norm = nn.LayerNorm(self.num_features)
        self.avgpool = nn.AdaptiveAvgPool1d(1)  # last diemnsion will be shrinked to 1
        self.fc = nn.Linear(self.num_features, num_classes)

    def forward(self, x):
        x = self.patch_embedding(x)

        for stage in self.stages:
            x = stage(x)

        x = self.norm(x)

        if self.output_hidden_states:
            x = rearrange(
                x,
                "b (win_size_h win_size_w) embed_dim -> b embed_dim win_size_h win_size_w",
                win_size_h=self.window_size,
                win_size_w =self.window_size
            )
            return x

        x = rearrange(x, "b num_windows embed_dim -> b embed_dim num_windows")
        x = self.avgpool(x)
        x = rearrange(x, "b embed_dim c -> b (embed_dim c)")    # c = 1 due to avgpool
        x = self.fc(x)
        return x
```

#### Test Script

```python
t = torch.randn([4, 3, 224, 224])
patch_embedding = PatchEmbedding(patch_size=4, embed_dim=96)
swin_block = SwinBlock(dim=96, input_resolution=[56, 56], num_heads=4, window_size=7)
shifted_swin_block = SwinBlock(dim=96, input_resolution=[56, 56], num_heads=4, window_size=7, shift_size=7 // 2)
patch_merging = PatchMerging(input_resolution=[56, 56], dim=96)

out = patch_embedding(t)        # result: [4, 56*56, 96], here (224/4) * (224/4) = 56*56
out = swin_block(out)           # result: [4, 56*56, 96]
out = shifted_swin_block(out)   # result: [4, 56*56, 96]
out = patch_merging(out)        # result: [4, 784, 192], here 56*56 / 4 = 784
                                # 784 = 28*28 is considered as new number of windows
```
