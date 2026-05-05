const n=`---
title: Data Augmentation for Object Detection
date: 2022-06-30
id: blog085
tag: pytorch, deep-learning
toc: false
intro: Record my data augmentation used in object detection.
---

We define the transform:

\`\`\`python
albumentation_transform = A.Compose([
    A.ShiftScaleRotate(shift_limit=0, rotate_limit=10, p=0.7),
    A.RGBShift(r_shift_limit=25, g_shift_limit=25, b_shift_limit=25, p=0.9),
    A.HorizontalFlip(p=0.5),
    A.GaussNoise(p=0.5),
    A.RandomBrightnessContrast(p=0.5),
    A.RandomGamma(p=0.5),
    A.OneOf([
        A.Blur(blur_limit=3, p=0.5),
        A.ColorJitter(p=0.5)
    ], p=0.8),
    A.LongestMaxSize(max_size=config.input_height, interpolation=1, p=1),
    A.PadIfNeeded(
        min_height=config.input_height,
        min_width=config.input_height,
        border_mode=0,
        value=(0, 0, 0),
        position="top_left"
    ),
],
    p=1,
    bbox_params=A.BboxParams(format="pascal_voc", min_area=0.1)
)
\`\`\`

In this way the combination of \`A.LongestMaxSize\` and \`A.PadIfNeeded\` have

- resized the image and
- padded the image into a square
  so that our numpy array is of suitable shape and ready to be fed into our network.

Now we transform the image and coordinate of bounding box at the same time:

\`\`\`python
def data_augmentation(img, bboxes):
    if isinstance(img, Image.Image):
        img = np.array(img)
    transformed = albumentation_transform(image=img, bboxes=bboxes)
    img = transformed["image"]
    bboxes = transformed["bboxes"]
    return img, bboxes
\`\`\`

Note that \`bboxes\` is of type:

\`\`\`python
bboxes: List[List[float, float, float, float, int | string]]
\`\`\`

Since our format is \`pascal_voc\`, the 4 \`float\`'s there are \`(xmin, ymin, xmax, ymax)\`.

The final coordinate \`bboxes[:, 4]\` is usually the class labels of the bounding boxes, it will not be transformed by albumentation and will be kept unchanged there.
`;export{n as default};
