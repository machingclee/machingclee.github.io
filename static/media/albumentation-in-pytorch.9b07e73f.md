title: Albumentations with PyTorch
date: 2022-06-15
id: blog083
tag: pytorch, deep-learning

intro: Record the most recently used combination of data augmentations.

#### Dataset Object

We have introduced albumentation with tensorflow in <a href="/blog/Image-Augmentation-with-Custom-Dataset-Pipeline">this post</a>. However, the built-in dataset object in tensorflow itself is over-complicated. After transitioned into pytorch, preparing dataset generator is never an headache any more. 

Assume that we are going to feed 3 images into an inpainting network, which requires:
- A mask of text that train text-stroke prediction module.
- An image without any text and;
- The same image above with text as a synthetic data in order to train text-removal image generation module.

If we were to perform data augmentation, we need to operate the same set of transfomations to all 3 images.

We will do this by `albumentation_process` in the `__getitem__` method below:


```python 
class SceneTextDataset(Dataset):
    def __init__(
        self,
        cropped_bg_dir=config.cropped_bg_dir,
        cropped_txt_dir=config.cropped_txt_dir,
        cropped_txt_mask_dir=config.cropped_txt_mask_dir
    ) -> None:
        super(SceneTextDataset, self).__init__()
        self.cropped_bg_img_paths = glob(f"{cropped_bg_dir}/*.png")
        self.cropped_txt_dir = cropped_txt_dir
        self.cropped_txt_mask_dir = cropped_txt_mask_dir
        random.shuffle(self.cropped_bg_img_paths)

    def __getitem__(self, index):
        bg_path = self.cropped_bg_img_paths[index]
        basename = os.path.basename(bg_path)
        txt_path = f"{self.cropped_txt_dir}/{basename}"
        txt_mask_path = f"{self.cropped_txt_mask_dir}/{basename}"

        bg_img = Image.open(bg_path).convert("RGB")
        txt_img = Image.open(txt_path).convert("RGB")
        txt_mask_img = Image.open(txt_mask_path).convert("RGB")

        bg_img = resize_and_padding(bg_img)
        txt_img = resize_and_padding(txt_img)
        txt_mask_img = resize_and_padding(txt_mask_img)

        bg_img = np.array(bg_img)
        txt_img = np.array(txt_img)
        txt_mask_img = np.array(txt_mask_img)

        bg_img, txt_img, txt_mask_img = albumentation_process(bg_img, txt_img, txt_mask_img)

        return (
            torch_img_transform(txt_img),
            torch_img_transform(bg_img),
            torch_mask_transform(txt_mask_img)
        )

    def __len__(self):
        return len(self.cropped_bg_img_paths)
```
##### Helper Functions
###### resize_and_padding
`resize_and_padding` makes sure all input are of hte same shape:
```python 
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


def pad_img(img):
    h = img.height
    w = img.width
    img = np.array(img)
    img = np.pad(img, pad_width=((0, config.input_height - h), (0, config.input_width - w), (0, 0)), mode="reflect")
    img = Image.fromarray(img)
    assert img.height == config.input_height
    assert img.width == config.input_width
    return img


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
```
The `padding_window` and `(ori_w, ori_h)` are used to reverse the transform to get the original image.




###### torch_img_transform and torch_mask_mask
The built-in transform by pytorch are used to normalized the input:
```python 
torch_img_transform = transforms.Compose([
    # numpy array will have channels permuted to the second index: (n, c, h, w)
    transforms.ToTensor(), 
    # normalize from [0, 1] to [-1, 1]
    transforms.Normalize(mean=(0.5, 0.5, 0.5), std=(0.5, 0.5, 0.5))  
])

torch_mask_transform = transforms.Compose([
    # same for mask, but we don't need normalization to [-1, 1]
    transforms.ToTensor() 
])
```


#### Augmentation by Albumentations

```python
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
],
    additional_targets={"image1": "image"}
)
```
Here is the tricky part, note that 
```python 
additional_targets={"image1": "image"}
```
is used to tell `albumentation_transform` to accept kwarg `image1` which is an `image` (but not `mask`). Moreover:

- `albumentation_transform` itself understands not to do certain operations on mask. For example, it makes no sense to do RGB-shift to a mask.

- The kwargs `image` and `mask` are built-in and ready to be used. 

- Note that `albumentation_process` ***only accpets numpy arrays***.


```python 
def albumentation_process(bg_img, txt_img, txt_mask_img):
    # bg_img, txt_img, txt_mask_img are numpy arrays
    transformsed = albumentation_transform(image=bg_img, image1=txt_img, mask=txt_mask_img)
    bg_img = transformsed["image"]
    txt_img = transformsed["image1"]
    txt_mask_img = transformsed["mask"]
    return bg_img, txt_img, txt_mask_img
```

#### Results 

A planar, axes-aligned synthetic image becomes:

<center>
<img src="/assets/tech/055.png"/ width="500">
</center>