const e=`---
title: collate_fn in pytorch
date: 2022-11-03
id: blog0102
tag: deep-learning, pytorch
intro: Discuss how to customize the patching of the results from \`__getitem__\` method of \`Dataset\` object in pytorch.
---

### Trouble in Standard Dataset Object

We come into the following scenario very often in which we need to return the (normalized) image tensor as well as the corresponding annotations.

\`\`\`python
class WFLWDatasets(data.Dataset):
    ...
    def __getitem__(self, index):
        data = self.get_data()
        curr_data = data[index]
        rel_img_path, annotations = curr_data
        self.img = np.array(Image.open(os.path.join(self.img_dir,
                                                    os.path.normpath(rel_img_path))))
        target = np.array(annotations) # list of 15-dim arrays

        # img, target become tensor after self.preproc
        img, target = self.preproc(self.img, target)

        return img, target
    ...
\`\`\`

However, an error will occur when loading the dataset via \`DataLoader\` by

\`\`\`python
from torch.utils.data as DataLoader

batch_iterator = iter(data.DataLoader(dataset,
                                      batch_size, # >= 2
                                      shuffle=True))
\`\`\`

**Reason.** When we return a batch of images, the number of annotations (e.g., 2 bboxes for the first image and 15 bboxes for the second image) will differ, we cannot concat \`[2, 4]\`-dimensional tensor with \`[15, 4]\`-dimensional tensor.

But by default, \`Dataloader\` has an attribute \`collate_fn\` which is initialized to the following function.

\`\`\`python
def default_collate(batch):
    elem = batch[0]
    elem_type = type(elem)
    if isinstance(elem, torch.Tensor):
        out = None
        if torch.utils.data.get_worker_info() is not None:
            # If we're in a background process, concatenate directly into a
            # shared memory tensor to avoid an extra copy
            numel = sum(x.numel() for x in batch)
            storage = elem.storage()._new_shared(numel, device=elem.device)
            out = elem.new(storage).resize_(len(batch), *list(elem.size()))
        return torch.stack(batch, 0, out=out)
    elif elem_type.__module__ == 'numpy' and elem_type.__name__ != 'str_' \\
            and elem_type.__name__ != 'string_':
        if elem_type.__name__ == 'ndarray' or elem_type.__name__ == 'memmap':
            # array of string classes and object
            if np_str_obj_array_pattern.search(elem.dtype.str) is not None:
                raise TypeError(default_collate_err_msg_format.format(elem.dtype))

            return default_collate([torch.as_tensor(b) for b in batch])
        elif elem.shape == ():  # scalars
            return torch.as_tensor(batch)
    elif isinstance(elem, float):
        return torch.tensor(batch, dtype=torch.float64)
    elif isinstance(elem, int):
        return torch.tensor(batch)
    elif isinstance(elem, string_classes):
        return batch
    elif isinstance(elem, collections.abc.Mapping):
        try:
            return elem_type({key: default_collate([d[key] for d in batch]) for key in elem})
        except TypeError:
            # The mapping type may not support \`__init__(iterable)\`.
            return {key: default_collate([d[key] for d in batch]) for key in elem}
    elif isinstance(elem, tuple) and hasattr(elem, '_fields'):  # namedtuple
        return elem_type(*(default_collate(samples) for samples in zip(*batch)))
    elif isinstance(elem, collections.abc.Sequence):
        # check to make sure that the elements in batch have consistent size
        it = iter(batch)
        elem_size = len(next(it))
        if not all(len(elem) == elem_size for elem in it):
            raise RuntimeError('each element in list of batch should be of equal size')
        transposed = list(zip(*batch))  # It may be accessed twice, so we use a list.

        if isinstance(elem, tuple):
            return [default_collate(samples) for samples in transposed]  # Backwards compatibility.
        else:
            try:
                return elem_type([default_collate(samples) for samples in transposed])
            except TypeError:
                # The sequence type may not support \`__init__(iterable)\` (e.g., \`range\`).
                return [default_collate(samples) for samples in transposed]

    raise TypeError(default_collate_err_msg_format.format(elem_type))
\`\`\`

For short, it unsqueezes each positional entry at 0 position and concat them accordingly to form a batch (e.g., two \`[3, 256, 256]\` image tensors will be concated into a \`[2, 3, 256, 256]\` tensor). An error occurs when this concatenation process fails.

### Solution by collate_fn

Is it necessary for the target (annotation) objects to be concated any way? No, instead, we can return a list (array) of target objects, and reshape our targets (no matter it is \`[2, 4]\`-dimensional or \`[15, 4]\`-dimensional) into a tensor of consistent shape, and finally concat these consistent target tensors and compute loss against the batch of predictions from the model.

Example:

- line 68 of [RetinaFace's multibox_loss](https://github.com/machingclee/2022-10-05-Retinaface-study/blob/main/layers/modules/multibox_loss.py).

The trick is done by defining our own \`collate_fn\`:

\`\`\`python
def collate_fn(batch):
    imgs = []
    batch_annotations = []

    for i in range(len(batch)):
        data = batch[i]
        img, annotation = data
        imgs.append(img.unsqueeze(0))
        batch_annotations.append(annotation)

    return torch.cat(imgs, dim=0).to(device), batch_annotations
\`\`\`

Note that when \`batch_size=2\`, then each batch is a list:

\`\`\`python
[dataset.__getitem__(n_1), dataset.__getitem__(n_2)]
\`\`\`

for some \`n_1, n_2\` with $\\texttt{n_1}\\neq \\texttt{n_2}$. Therefore

- For the first positional entry of our returned output, we concat our image tensor in the usual way (\`.unsqueeze(0)\` and \`torch.cat\`), but
- For the second positional entry, we concat them into a usual list and we return that list instead of a tensor.

We plug our \`collate_fn\` to \`DataLoader\` object by

\`\`\`python
batch_iterator = iter(data.DataLoader(dataset,
                                      batch_size, # >= 2
                                      shuffle=True,
                                      collate_fn=collate_fn))
\`\`\`

and the iteration result \`next(batch_iterator)\` is of type \`Tensor, List[Tensor]\`.
`;export{e as default};
