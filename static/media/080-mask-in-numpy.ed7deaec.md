---
title: Masks in Numpy and Retrive Corresponding Indexes
date: 2022-05-28
id: blog080
tag: python
intro: Mask in numpy, tensorflow and pytorch is very useful to filter out desired values, but sometimes the index that the mask marks as `True` is also import, we record a function to retrive those information.
---

### Masks

Suppose that

- `target_masks` is of shape `(N, width, height, 10, 2)`,
- where `N` denotes the number of batches,
- `width`, `height` denote the size of a feature,
- and for every given `n, j, i, k`, `target_masks[n, j, i, k]` is a one-hot vector.
  Then we can create a mask by

```python
positive_sample = target_masks[..., 1] == 1
```

This will create a mask of shape `(N, width, height, 10)` in which all values are boolean, but how do we know all the indexes `n, j, i, k` that the mask indicates as `True`?

Sometimes the mask itself is enough to filter out other related `np.array`'s (by applying the mask like `other_nparray[positive_sample]`), but sometimes the spartial index `j, i` also provides us the information we need.

For that we will use the following function:

### get_indexes_from_mask(mask)

This function is as simple as:

```python
def get_indexes_from_mask(mask):
    return np.array(list(zip(*np.where(mask))))
```

For example, suppose that each position `j, i` was assigned a `box` in `boxes` with shape `(N, height, width, 4)` and a `score` in `scores` with shape `(N, height, width, 1)`, then we can create a mask by

```python
score_mask = scores[..., 0] > 0.8
```

Now apart from getting the desired scores by

- `selected_scores=scores[score_mask]` (this will be **_flattened_** and of shape `(n', 1)`),
  we can equivalently:
- ```python
  selected_indexes = get_indexes_from_mask(score_mask)
  selected_scores = np.array([scores[tuple(index)]
                              for index in selected_indexes])
  ```
  Note that
  - numpy array does not accept `int-np-array` as an index (unlike `bool-np-array`),
  - We need to convert `int-np-array` into `int-tuple`. The conversion is simply by `tuple(np-array)`.

### tf.where, tf.gather (to be updated)

Equivalently we can use `tf.where` and `tf.gather`.
