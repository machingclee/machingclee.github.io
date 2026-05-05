const n=`---
title: Albumentations and Common Helper Functions with PyTorch
date: 2022-11-05
id: blog0103
tag: pytorch, deep-learning
intro: Record the most recently used combination of data augmentations.
---

### Common Helper Functions

#### resize_and_padding

\`resize_and_padding\` makes sure all input are of hte same shape:

\`\`\`python
def resize_img(img):
    """
    img:  Pillow image
    """
    h, w = img.height, img.width
    if h >= w:
        ratio = config.input_height / h
        new_h, new_w = int(h * ratio), int(w * ratio)
    else:
        ratio = config.input_width / w
        new_h, new_w = int(h * ratio), int(w * ratio)

        if new_w > config.input_width:
            ratio = config.input_width / new_w
            new_h, new_w = int(new_h * ratio), int(new_w * ratio)

    img = img.resize((new_w, new_h), Image.BILINEAR)
    return img, (w, h)
\`\`\`

\`\`\`python
def pad_img(img):
    h = img.height
    w = img.width
    img = np.array(img)
    img = np.pad(img,
                 pad_width=((0, config.input_height - h),
                            (0, config.input_width - w),
                            (0, 0)),
                 mode="reflect")
    img = Image.fromarray(img)
    assert img.height == config.input_height
    assert img.width == config.input_width
    return img
\`\`\`

\`\`\`python
def resize_and_padding(img, return_window=False):
    img, (ori_w, ori_h) = resize_img(img)
    w = img.width
    h = img.height
    padding_window = (w, h)
    img = pad_img(img)

    if not return_window:
        return img
    else:
        return img, padding_window, (ori_w, ori_h)
\`\`\`

The \`padding_window\` and \`(ori_w, ori_h)\` are used to reverse the transform to get the original image.

#### torch_img_transform

The built-in transform by pytorch are used to normalized the input:

\`\`\`python
from torchvision import transforms

torch_img_transform = transforms.Compose([
    # numpy array will have channels permuted to the second index: (b, c, h, w)
    transforms.ToTensor(),
    # normalize from [0, 1] to [-1, 1]
    transforms.Normalize(mean=(0.5, 0.5, 0.5), std=(0.5, 0.5, 0.5))
])
\`\`\`

#### torch_imgnet_transform

Normalization specific to imagenet data:

\`\`\`python
from torchvision import transforms

torch_imgnet_transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])
\`\`\`

#### Inverse of torch_imgnet_transform

\`\`\`python
def torch_imgnet_denormalization_to_pil(img: torch.Tensor) -> Image.Image:
    mean = torch.as_tensor([0.485, 0.456, 0.406])[None, :, None, None].to(device)
    std = torch.as_tensor([0.229, 0.224, 0.225])[None, :, None, None].to(device)
    img = (img * std + mean) * 255
    img = Image.fromarray(img.squeeze(0).permute(1, 2, 0).cpu().numpy().astype("uint8"))
    return img
\`\`\`

#### draw_dots and draw_boxes

The following are helpful for facial landmarks visualization:

\`\`\`python
def draw_box(pil_img: Image.Image, bboxes, confs=None, color=(255, 255, 255, 150)):
    draw = ImageDraw.Draw(pil_img)
    for i, bbox in enumerate(bboxes):
        xmin, ymin, xmax, ymax = bbox
        draw.rectangle(((xmin, ymin), (xmax, ymax)), outline=color, width=2)
        if confs is not None:
            conf = confs[i]
            draw.text(
                (xmin, max(ymin - 10, 4)),
                "{:.2f}".format(conf.item()),
                color
            )
\`\`\`

\`\`\`python
def draw_dots(pil_img: Image.Image, pred_boxes,
              pred_landmarks: Tuple[float], r=2, constrain_pts=False):
    draw = ImageDraw.Draw(pil_img)
    for bbox, landmark in zip(pred_boxes, pred_landmarks):
        xmin, ymin, xmax, ymax = bbox
        for x, y in np.array_split(landmark, 5):
            if not constrain_pts:
                draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 0, 0))
            else:
                if xmin <= x and x <= xmax and ymin <= y and y <= ymax:
                    draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 0, 0))
\`\`\`

#### xyxy_to_cxcywh and cxcywh_to_xyxy

\`\`\`python
def xyxy_to_cxcywh(bboxes):
    if len(bboxes) == 0:
        return bboxes
    cxcy = (bboxes[:, 0:2] + bboxes[:, 2:4]) / 2
    wh = (bboxes[:, 2:4] - bboxes[:, 0:2])

    if isinstance(bboxes, torch.Tensor):
        def cat_func(arr_to_concat): return torch.cat(arr_to_concat, dim=-1)
    else:
        def cat_func(arr_to_concat): return np.concatenate(arr_to_concat, axis=-1)

    out = cat_func([cxcy, wh])
    return out
\`\`\`

\`\`\`python
def cxcywh_to_xyxy(bboxes):

    if len(bboxes) == 0:
        return bboxes
    xmin_ymin = bboxes[:, 0:2] - bboxes[:, 2:4] / 2
    xmax_ymax = bboxes[:, 0:2] + bboxes[:, 2:4] / 2

    if isinstance(bboxes, torch.Tensor):
        def cat_func(arr_to_concat): return torch.cat(arr_to_concat, dim=-1)
    else:
        def cat_func(arr_to_concat): return np.concatenate(arr_to_concat, axis=-1)

    out = cat_func([xmin_ymin, xmax_ymax])

    return out
\`\`\`

### Augmentation by Albumentations

#### Resize and Padding

\`\`\`python
resize_and_padding_transforms_list = [
    A.LongestMaxSize(max_size=config.longest_side_length, interpolation=1, p=1),
    A.PadIfNeeded(
        min_height=config.input_height,
        min_width=config.input_height,
        border_mode=0,
        value=(0, 0, 0),
        position="top_left"
    )
]
\`\`\`

#### Miscellaneous Transforms

\`\`\`python
import albumentations as A

albumentation_transform = A.Compose([
    A.ShiftScaleRotate(shift_limit=0, scale_limit=(0.5, 2), p=1),
    A.Perspective(p=0.4),
    A.Rotate(limit=10, p=0.8),
    A.RGBShift(r_shift_limit=25, g_shift_limit=25, b_shift_limit=25, p=0.9),
    A.OneOf([
        A.Blur(blur_limit=3, p=0.5),
        A.ColorJitter(p=0.5)
    ], p=1.0),
    *resize_and_padding_transforms_list
],
    additional_targets={"image1": "image"}
)
\`\`\`

Here is the tricky part, note that

\`\`\`python
additional_targets={"image1": "image"}
\`\`\`

is used to tell \`albumentation_transform\` to accept kwarg \`image1\` which is an \`image\` (but not \`mask\`). Moreover:

- \`albumentation_transform\` itself understands not to do certain operations on mask. For example, it makes no sense to do RGB-shift to a mask.

- The kwargs \`image\` and \`mask\` are built-in and ready to be used.

- Note that \`albumentation_process\` **_only accpets numpy arrays_**.

\`\`\`python
def albumentation_process(bg_img, img, mask):
    # bg_img, img, mask are numpy arrays
    transformsed = albumentation_transform(image=bg_img, image1=img, mask=mask)
    bg_img = transformsed["image"]
    img = transformsed["image1"]
    mask = transformsed["mask"]
    return bg_img, img, mask
\`\`\`

### Results

A planar, axes-aligned synthetic image becomes:

<center>
<img src="/assets/tech/055.png"/ width="500">
</center>
`;export{n as default};
