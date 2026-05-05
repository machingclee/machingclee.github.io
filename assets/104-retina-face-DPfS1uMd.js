const n=`---
title: RetinaFace
date: 2022-11-06
id: blog0104
tag: deep-learning, pytorch
intro: Record the study of headless detector for face and landmarks.
---

### Repository

- https://github.com/machingclee/2022-10-05-Retinaface-study

### Data Processing (Landmarks Specific)

#### Nice Augmentation Implementation for Record

\`keypoints\` argument in \`albumentations\` package causes incorrect augmented annotations for landmarks, for bbox augmentation we should stick with \`albumentations\`.

In case we need to augment landmarks we can try the following:

##### Cropping

\`\`\`python
# image is a [H, W, 3]-dimensional numpy array
def _crop(image, target_boxes, labels, landm, img_dim):
    height, width, _ = image.shape
    pad_image_flag = True

    for _ in range(250):
        """
        if random.uniform(0, 1) <= 0.2:
            scale = 1.0
        else:
            scale = random.uniform(0.3, 1.0)
        """
        PRE_SCALES = [0.3, 0.45, 0.6, 0.8, 1.0]
        scale = random.choice(PRE_SCALES)
        short_side = min(width, height)
        w = int(scale * short_side)
        h = w

        if width == w:
            l = 0
        else:
            l = random.randrange(width - w)
        if height == h:
            t = 0
        else:
            t = random.randrange(height - h)
        roi_xyxy = np.array((l, t, l + w, t + h))

        value = matrix_iof(target_boxes, roi_xyxy[np.newaxis])
        flag = (value >= 1)
        if not flag.any():
            continue

        target_centers = (target_boxes[:, :2] + target_boxes[:, 2:]) / 2
        mask_a = np.logical_and(roi_xyxy[:2] < target_centers, target_centers < roi_xyxy[2:]).all(axis=1)
        boxes_t = target_boxes[mask_a].copy()
        labels_t = labels[mask_a].copy()
        landms_t = landm[mask_a].copy()
        landms_t = landms_t.reshape([-1, 5, 2])

        if boxes_t.shape[0] == 0:
            continue

        image_t = image[roi_xyxy[1]:roi_xyxy[3], roi_xyxy[0]:roi_xyxy[2]]

        boxes_t[:, :2] = np.maximum(boxes_t[:, :2], roi_xyxy[:2])
        boxes_t[:, :2] -= roi_xyxy[:2]
        boxes_t[:, 2:] = np.minimum(boxes_t[:, 2:], roi_xyxy[2:])
        boxes_t[:, 2:] -= roi_xyxy[:2]

        # landm
        landms_t[:, :, :2] = landms_t[:, :, :2] - roi_xyxy[:2]
        landms_t[:, :, :2] = np.maximum(landms_t[:, :, :2], np.array([0, 0]))
        landms_t[:, :, :2] = np.minimum(landms_t[:, :, :2], roi_xyxy[2:] - roi_xyxy[:2])
        landms_t = landms_t.reshape([-1, 10])

        # make sure that the cropped image contains at least one face > 16 pixel at training image scale
        b_w_t = (boxes_t[:, 2] - boxes_t[:, 0] + 1) / w * img_dim
        b_h_t = (boxes_t[:, 3] - boxes_t[:, 1] + 1) / h * img_dim
        mask_b = np.minimum(b_w_t, b_h_t) > 0.0
        boxes_t = boxes_t[mask_b]
        labels_t = labels_t[mask_b]
        landms_t = landms_t[mask_b]

        if boxes_t.shape[0] == 0:
            continue

        pad_image_flag = False

        return image_t, boxes_t, labels_t, landms_t, pad_image_flag
    return image, target_boxes, labels, landm, pad_image_flag
\`\`\`

For successful cropping, we always get a square.

Note that most of the time \`pad_image_flag == False\`, the next padding method pads the image into a square in case we are too unfortunate to augment the data correctly in 250 trials (in that case, \`pad_image_flag == True\`):

\`\`\`python
def _pad_to_square(image, rgb_mean, pad_image_flag):
    if not pad_image_flag:
        return image
    height, width, _ = image.shape
    long_side = max(width, height)
    image_t = np.empty((long_side, long_side, 3), dtype=image.dtype)
    image_t[:, :] = rgb_mean
    image_t[0:0 + height, 0:0 + width] = image
    return image_t
\`\`\`

##### Resize and Mean Subtraction

\`\`\`python
def _resize_subtract_mean(image, insize, rgb_mean):
    interp_methods = [cv2.INTER_LINEAR, cv2.INTER_CUBIC, cv2.INTER_AREA, cv2.INTER_NEAREST, cv2.INTER_LANCZOS4]
    interp_method = interp_methods[random.randrange(5)]
    image = cv2.resize(image, (insize, insize), interpolation=interp_method)
    image = image.astype(np.float32)
    image -= rgb_mean
    return image
\`\`\`

##### Mirroring

Mirror the image with 0.5 probability:

\`\`\`python
def _mirror(image, boxes, landms):
    _, width, _ = image.shape
    if random.randrange(2):
        image = image[:, ::-1]
        boxes = boxes.copy()
        boxes[:, 0::2] = width - boxes[:, 2::-2]

        # landm
        landms = landms.copy()
        landms = landms.reshape([-1, 5, 2])
        landms[:, :, 0] = width - landms[:, :, 0]
        tmp = landms[:, 1, :].copy()
        landms[:, 1, :] = landms[:, 0, :]
        landms[:, 0, :] = tmp
        tmp1 = landms[:, 4, :].copy()
        landms[:, 4, :] = landms[:, 3, :]
        landms[:, 3, :] = tmp1
        landms = landms.reshape([-1, 10])

    return image, boxes, landms
\`\`\`

##### Complete Pipeline Based on the Above

\`\`\`python
def augment(self, image, targets):
    assert targets.shape[0] > 0, "this image does not have gt"

    target_boxes = targets[:, :4].copy()
    labels = targets[:, -1].copy()
    landm = targets[:, 4:-1].copy()

    # this random crop can also change the landmarks, which is problematic in
    # albumentation (keyponits argument cause some incorrect augmented
    # annotation)
    image_t, boxes_t, labels_t, landm_t, pad_image_flag = _crop(image, target_boxes, labels, landm, self.img_dim)
    image_t = _distort(image_t)
    image_t = _pad_to_square(image_t, self.rgb_means, pad_image_flag)
    image_t, boxes_t, landm_t = _mirror(image_t, boxes_t, landm_t)
    height, width, _ = image_t.shape

    # change channel dimension ahead of height, width as well:
    # also pad to square:
    image_t = _resize_subtract_mean(image_t, self.img_dim, self.rgb_means)
    # for pytorch
    image_t = image_t.transpose(2, 0, 1)

    # normalize bboxes and landmarks:
    boxes_t[:, 0::2] /= width
    boxes_t[:, 1::2] /= height
    landm_t[:, 0::2] /= width
    landm_t[:, 1::2] /= height

    labels_t = np.expand_dims(labels_t, 1)
    targets_t = np.hstack((boxes_t, landm_t, labels_t))

    return image_t, targets_t
\`\`\`

### RetinaFace.forward(inputs)

#### Forward

\`\`\`python-1
def forward(self, inputs):
    # inputs is a batch of images
    out = self.body(inputs) # out = [(1, t_1), (2, t_2), (3, t_3)]
\`\`\`

where \`self.body\` is the \`resnset50\` model, with

$$
\\texttt{t_i.shape} = (512\\times 2^{i}, H/2^{i+3}, W/2^{i+3})
$$

for $i=0, 1, 2$, i.e., features of strides 8, 16, 32 respectively.

These features are then mapped to have the same channel size (by what we call lateral embedding and upsampling) and **concatenated** by addition in a usual fpn network.

\`\`\`python-4
  fpn = self.fpn(out)
\`\`\`

#### FPN

Here \`self.fpn\` is an instance of:

\`\`\`python
class FPN(nn.Module):
    def __init__(self,in_channels_list,out_channels):
        super(FPN,self).__init__()
        leaky = 0

        if (out_channels <= 64):
            leaky = 0.1

        self.output1 = conv_bn1X1(in_channels_list[0], out_channels, stride = 1, leaky = leaky)
        self.output2 = conv_bn1X1(in_channels_list[1], out_channels, stride = 1, leaky = leaky)
        self.output3 = conv_bn1X1(in_channels_list[2], out_channels, stride = 1, leaky = leaky)

        self.merge1 = conv_bn(out_channels, out_channels, leaky = leaky)
        self.merge2 = conv_bn(out_channels, out_channels, leaky = leaky)

    def forward(self, input):
        # names = list(input.keys())
        input = list(input.values())

        output1 = self.output1(input[0])
        output2 = self.output2(input[1])
        output3 = self.output3(input[2])

        up3 = F.interpolate(output3, size=[output2.size(2), output2.size(3)], mode="nearest")
        output2 = output2 + up3
        output2 = self.merge2(output2)

        up2 = F.interpolate(output2, size=[output1.size(2), output1.size(3)], mode="nearest")
        output1 = output1 + up2
        output1 = self.merge1(output1)

        out = [output1, output2, output3]
        return out
\`\`\`

#### SSH (Single Stage Headless detector)

We next encode the features further by single stage headless detector:

\`\`\`python-5
      feature1 = self.ssh1(fpn[0])
      feature2 = self.ssh2(fpn[1])
      feature3 = self.ssh3(fpn[2])
      features = [feature1, feature2, feature3]
\`\`\`

Here \`self.ssh1\`, \`self.ssh2\` and \`self.ssh3\` are instances of (we set \`in_channel\` and \`out_channel\` to 256):

\`\`\`python
class SSH(nn.Module):
    def __init__(self, in_channel, out_channel):
        super(SSH, self).__init__()
        assert out_channel % 4 == 0
        leaky = 0
        if (out_channel <= 64):
            leaky = 0.1
        self.conv3X3 = conv_bn_no_relu(in_channel, out_channel//2, stride=1)

        self.conv5X5_1 = conv_bn(in_channel, out_channel//4, stride=1, leaky = leaky)
        self.conv5X5_2 = conv_bn_no_relu(out_channel//4, out_channel//4, stride=1)

        self.conv7X7_2 = conv_bn(out_channel//4, out_channel//4, stride=1, leaky = leaky)
        self.conv7x7_3 = conv_bn_no_relu(out_channel//4, out_channel//4, stride=1)

    def forward(self, input):
        conv3X3 = self.conv3X3(input)

        conv5X5_1 = self.conv5X5_1(input)
        conv5X5 = self.conv5X5_2(conv5X5_1)

        conv7X7_2 = self.conv7X7_2(conv5X5_1)
        conv7X7 = self.conv7x7_3(conv7X7_2)

        out = torch.cat([conv3X3, conv5X5, conv7X7], dim=1)
        out = F.relu(out)
        return out
\`\`\`

#### End of forward: Predictions by ClassHead, BboxHead, LandmarkHead

We finally estimate \`bbox_regressions\`, \`classifications\` and \`ldm_regressions\` by identical detection heads on different feature scale:

\`\`\`python-9
      bbox_regressions = torch.cat(
          [self.BboxHead[i](feature) for i, feature in enumerate(features)],
          dim=1
      )
      classifications = torch.cat(
          [self.ClassHead[i](feature) for i, feature in enumerate(features)],
          dim=1
      )
      ldm_regressions = torch.cat(
          [self.LandmarkHead[i](feature) for i, feature in enumerate(features)],
          dim=1
      )

      if self.phase == 'train':
          output = (bbox_regressions, classifications, ldm_regressions)
      else:
          output = (bbox_regressions, F.softmax(classifications, dim=-1), ldm_regressions)
      return output
\`\`\`

where

\`\`\`python
self.ClassHead = self._make_class_head(fpn_num=3, inchannels=cfg['out_channel'])
self.BboxHead = self._make_bbox_head(fpn_num=3, inchannels=cfg['out_channel'])
self.LandmarkHead = self._make_landmark_head(fpn_num=3, inchannels=cfg['out_channel'])

def _make_class_head(self, fpn_num=3, inchannels=64, anchor_num=2):
    classhead = nn.ModuleList()
    for i in range(fpn_num):
        classhead.append(ClassHead(inchannels, anchor_num))
    return classhead

def _make_bbox_head(self, fpn_num=3, inchannels=64, anchor_num=2):
    bboxhead = nn.ModuleList()
    for i in range(fpn_num):
        bboxhead.append(BboxHead(inchannels, anchor_num))
    return bboxhead

def _make_landmark_head(self, fpn_num=3, inchannels=64, anchor_num=2):
    landmarkhead = nn.ModuleList()
    for i in range(fpn_num):
        landmarkhead.append(LandmarkHead(inchannels, anchor_num))

class ClassHead(nn.Module):
    def __init__(self, inchannels=512, num_anchors=3):
        super(ClassHead, self).__init__()
        self.num_anchors = num_anchors
        self.conv1x1 = nn.Conv2d(
            inchannels,
            self.num_anchors * 2,
            kernel_size=(1, 1),
            stride=1,
            padding=0
        )

    def forward(self, x):
        out = self.conv1x1(x)
        out = out.permute(0, 2, 3, 1).contiguous()

        return out.view(out.shape[0], -1, 2)


class BboxHead(nn.Module):
    def __init__(self, inchannels=512, num_anchors=3):
        super(BboxHead, self).__init__()
        self.conv1x1 = nn.Conv2d(
            inchannels,
            num_anchors * 4,
            kernel_size=(1, 1),
            stride=1,
            padding=0
        )

    def forward(self, x):
        out = self.conv1x1(x)
        out = out.permute(0, 2, 3, 1).contiguous()

        return out.view(out.shape[0], -1, 4)


class LandmarkHead(nn.Module):
    def __init__(self, inchannels=512, num_anchors=3):
        super(LandmarkHead, self).__init__()
        self.conv1x1 = nn.Conv2d(
            inchannels,
            num_anchors * 10,
            kernel_size=(1, 1),
            stride=1,
            padding=0
        )

    def forward(self, x):
        out = self.conv1x1(x)
        out = out.permute(0, 2, 3, 1).contiguous()

        return out.view(out.shape[0], -1, 10)
\`\`\`

#### Summary for Detection Modules

- RetinaFace network is nothing but a RPN network in faster RCNN.
- The only difference is: we use \`SSH\` module to decode the features of different scale from \`mobilenet\`/\`resnet\` instead of passing those features directly to detection head as in faster RCNN.

### Loss Calculation

#### Loss Entry Point

\`\`\`python
criterion = MultiBoxLoss(num_classes, 0.35, True, 0, True, 7, 0.35, False)
priors = PriorBox(cfg, image_size=(img_dim, img_dim)).forward().cuda()
loss_l, loss_c, loss_landm = criterion(out, priors, targets)
\`\`\`

We explain \`PriorBox\` in the following:

#### PriorBox

In short, \`PriorBox\` provides us tiled grids onto a plane with given \`image_size\` and \`stride\` (in the \`cfg\`).

\`\`\`python
class PriorBoxConfig(TypedDict):
    min_sizes: int
    steps: int
    clip: bool

class PriorBox(object):
    def __init__(self, cfg: PriorBoxConfig, image_size=None, phase='train'):
        super(PriorBox, self).__init__()
        self.min_sizes = cfg['min_sizes']   # min sizes = list of sizes of each sq anchor box w.r.t. feature scales,
                                            # e.g., [[16, 32], [64, 128], [256, 512]]
        self.steps = cfg['steps']           # steps = strides
        self.clip = cfg['clip']
        self.image_size = image_size
        self.feature_maps = [
            [ceil(self.image_size[0]/step), ceil(self.image_size[1]/step)]
            for step in self.steps
        ]
        self.name = "s"

    def forward(self):
        anchors = []
        for k, f in enumerate(self.feature_maps):
            min_sizes = self.min_sizes[k]
            for i, j in product(range(f[0]), range(f[1])):
                for min_size in min_sizes: # e.g., min_sizes = [16, 32]
                    s_kx = min_size / self.image_size[1]
                    s_ky = min_size / self.image_size[0]
                    cx = (j + 0.5) * self.steps[k] / self.image_size[1]
                    cy = (i + 0.5) * self.steps[k] / self.image_size[0]
                    anchors += [cx, cy, s_kx, s_ky]

        # back to torch land
        output = torch.Tensor(anchors).view(-1, 4)
        if self.clip:
            output.clamp_(max=1, min=0)
        return output
\`\`\`

#### MultiBoxLoss

##### MultiBoxLoss.\\_\\_init\\_\\_

The loss function is abstracted in an \`nn.Module\`:

\`\`\`python
class MultiBoxLoss(nn.Module):
    """SSD Weighted Loss Function
    Compute Targets:
        1) Produce Confidence Target Indices by matching  ground truth boxes
           with (default) 'priorboxes' that have jaccard index > threshold parameter
           (default threshold: 0.5).
        2) Produce localization target by 'encoding' variance into offsets of ground
           truth boxes and their matched  'priorboxes'.
        3) Hard negative mining to filter the excessive number of negative examples
           that comes with using a large number of default bounding boxes.
           (default negative:positive ratio 3:1)
    Objective Loss:
        L(x,c,l,g) = (Lconf(x, c) + αLloc(x,l,g)) / N
        Where, Lconf is the CrossEntropy Loss and Lloc is the SmoothL1 Loss
        weighted by α which is set to 1 by cross val.
        Args:
            c: class confidences,
            l: predicted boxes,
            g: ground truth boxes
            N: number of matched default boxes
        See: https://arxiv.org/pdf/1512.02325.pdf for more details.
    """
    def __init__(
            self,
            num_classes,
            overlap_thresh,
            prior_for_matching,
            bkg_label,
            neg_mining,
            neg_pos,
            neg_overlap,
            encode_target
        ):
        super(MultiBoxLoss, self).__init__()
        self.num_classes = num_classes
        self.threshold = overlap_thresh
        self.background_label = bkg_label
        self.encode_target = encode_target
        self.use_prior_for_matching = prior_for_matching
        self.do_neg_mining = neg_mining
        self.negpos_ratio = neg_pos
        self.neg_overlap = neg_overlap
        self.variance = [0.1, 0.2]
\`\`\`

##### MultiBoxLoss.forward

\`\`\`python-1
def forward(self, predictions, priors, targets):
    """Multibox Loss
    Args:
        predictions (tuple): A tuple containing loc preds, conf preds,
        and prior boxes from SSD net.
            conf shape: torch.size(batch_size,num_priors,num_classes)
            loc shape: torch.size(batch_size,num_priors,4)
            priors shape: torch.size(num_priors,4)

        ground_truth (tensor): Ground truth boxes and labels for a batch,
            shape: [batch_size,num_objs,5] (last idx is the label).
    """
    loc_data, conf_data, landm_data = predictions
    priors = priors
    num = loc_data.size(0)
    num_priors = (priors.size(0))

    # match priors (default boxes) and ground truth boxes
    loc_t = torch.Tensor(num, num_priors, 4)
    landm_t = torch.Tensor(num, num_priors, 10)
    conf_t = torch.LongTensor(num, num_priors)
    for idx in range(num):
        truths = targets[idx][:, :4]
        labels = targets[idx][:, -1]
        landms = targets[idx][:, 4:14]
        defaults = priors.data
        match(self.threshold, truths, defaults, self.variance,
              labels, landms, loc_t, conf_t, landm_t, idx)
\`\`\`

##### The Match Function

\`loc_t\`, \`landm_t\` and \`conf_t\` are passed into \`match\` function as a reference and will be mutated to get normalized data from \`targets\` relative to the anchor with which the target bounding box fit the best.

\`\`\`python
def match(threshold, truths, priors, variances, labels, landms, loc_t, conf_t, landm_t, idx):
    """Match each prior box with the ground truth box of the highest jaccard
    overlap, encode the bounding boxes, then return the matched indices
    corresponding to both confidence and location preds.
    Args:
        threshold: (float) The overlap threshold used when mathing boxes.
        truths: (tensor) Ground truth boxes, Shape: [num_obj, 4].
        priors: (tensor) Prior boxes from priorbox layers, Shape: [n_priors,4].
        variances: (tensor) Variances corresponding to each prior coord,
            Shape: [num_priors, 4].
        labels: (tensor) All the class labels for the image, Shape: [num_obj].
        landms: (tensor) Ground truth landms, Shape [num_obj, 10].
        loc_t: (tensor) Tensor to be filled w/ endcoded location targets.
        conf_t: (tensor) Tensor to be filled w/ matched indices for conf preds.
        landm_t: (tensor) Tensor to be filled w/ endcoded landm targets.
        idx: (int) current batch index
    Return:
        The matched indices corresponding to 1)location 2)confidence 3)landm preds.
    """
    # jaccard index
    overlaps = jaccard(
        truths,
        point_form(priors)
    )
    # (Bipartite Matching)
    # [1,num_objects] best prior for each ground truth
    best_prior_overlap, best_prior_idx = overlaps.max(1, keepdim=True)

    # ignore hard gt
    valid_gt_idx = best_prior_overlap[:, 0] >= 0.2
    best_prior_idx_filter = best_prior_idx[valid_gt_idx, :]
    if best_prior_idx_filter.shape[0] <= 0:
        loc_t[idx] = 0
        conf_t[idx] = 0
        return

    # [1,num_priors] best ground truth for each prior
    best_truth_overlap, best_truth_idx = overlaps.max(0, keepdim=True)
    best_truth_idx.squeeze_(0)
    best_truth_overlap.squeeze_(0)
    best_prior_idx.squeeze_(1)
    best_prior_idx_filter.squeeze_(1)
    best_prior_overlap.squeeze_(1)
    best_truth_overlap.index_fill_(0, best_prior_idx_filter, 2)  # ensure best prior
    # TODO refactor: index  best_prior_idx with long tensor
    # ensure every gt matches with its prior of max overlap
    for j in range(best_prior_idx.size(0)):     # 判别此anchor是预测哪一个boxes
        best_truth_idx[best_prior_idx[j]] = j
    matches = truths[best_truth_idx]            # Shape: [num_priors,4] 此处为每一个anchor对应的bbox取出来
    conf = labels[best_truth_idx]               # Shape: [num_priors]      此处为每一个anchor对应的label取出来
    conf[best_truth_overlap < threshold] = 0    # label as background   overlap<0.35的全部作为负样本
    loc = encode(matches, priors, variances)

    matches_landm = landms[best_truth_idx]
    landm = encode_landm(matches_landm, priors, variances)
    loc_t[idx] = loc    # [num_priors,4] encoded offsets to learn
    conf_t[idx] = conf  # [num_priors] top class label for each prior
    landm_t[idx] = landm
\`\`\`

The assignment \`matches = truths[best_truth_idx]\` is actually distributing the ground truths to appropriate prior (anochor box) index, as is the assignment \`matches_landm = landms[best_truth_idx]\`.

##### Bounding Boxes Encoding and Landmarks Encoding

Both encoding functions map the ground truth data to a relative shifting data to the corresponding best anchor **_with all values being normalizaed_**:

\`\`\`python
def encode(matched, priors, variances):
    """Encode the variances from the priorbox layers into the ground truth boxes
    we have matched (based on jaccard overlap) with the prior boxes.
    Args:
        matched: (tensor) Coords of ground truth for each prior in point-form
            Shape: [num_priors, 4].
        priors: (tensor) Prior boxes in center-offset form, e.g., (cx, cy, w, h)
            Shape: [num_priors,4].
        variances: (list[float]) Variances of priorboxes
    Return:
        encoded boxes (tensor), Shape: [num_priors, 4]
    """

    # dist b/t match center and prior's center
    g_cxcy = (matched[:, :2] + matched[:, 2:]) / 2 - priors[:, :2]
    # encode variance
    g_cxcy /= (variances[0] * priors[:, 2:])
    # match wh / prior wh
    g_wh = (matched[:, 2:] - matched[:, :2]) / priors[:, 2:]
    g_wh = torch.log(g_wh) / variances[1]
    # return target for smooth_l1_loss
    return torch.cat([g_cxcy, g_wh], 1)  # [num_priors,4]

def encode_landm(matched, priors, variances):
    """Encode the variances from the priorbox layers into the ground truth boxes
    we have matched (based on jaccard overlap) with the prior boxes.
    Args:
        matched: (tensor) Coords of ground truth for each prior in point-form
            Shape: [num_priors, 10].
        priors: (tensor) Prior boxes in center-offset form
            Shape: [num_priors,4].
        variances: (list[float]) Variances of priorboxes
    Return:
        encoded landm (tensor), Shape: [num_priors, 10]
    """

    # dist b/t match center and prior's center
    matched = torch.reshape(matched, (matched.size(0), config.n_landmarks, 2))
    priors_cx = priors[:, 0].unsqueeze(1).expand(matched.size(0), config.n_landmarks).unsqueeze(2)
    priors_cy = priors[:, 1].unsqueeze(1).expand(matched.size(0), config.n_landmarks).unsqueeze(2)
    priors_w = priors[:, 2].unsqueeze(1).expand(matched.size(0), config.n_landmarks).unsqueeze(2)
    priors_h = priors[:, 3].unsqueeze(1).expand(matched.size(0), config.n_landmarks).unsqueeze(2)
    priors = torch.cat([priors_cx, priors_cy, priors_w, priors_h], dim=2)
    g_cxcy = matched[:, :, :2] - priors[:, :, :2]
    # encode variance
    g_cxcy /= (variances[0] * priors[:, :, 2:])
    # g_cxcy /= priors[:, :, 2:]
    g_cxcy = g_cxcy.reshape(g_cxcy.size(0), -1)
    # return target for smooth_l1_loss
    return g_cxcy
\`\`\`

The variances are hyper-parameters that try to let the model learn more quickly.

##### Calculate the Loss

We continue from the **MultiBoxLoss.forward** section:

\`\`\`python-29
    zeros = torch.tensor(0).cuda()
    # landm Loss (Smooth L1)
    # Shape: [batch,num_priors,10]
    pos1 = conf_t > zeros
    num_pos_landm = pos1.long().sum(1, keepdim=True)
    N1 = max(num_pos_landm.data.sum().float(), 1)
    pos_idx1 = pos1.unsqueeze(pos1.dim()).expand_as(landm_data)
    landm_p = landm_data[pos_idx1].view(-1, 10)
    landm_t = landm_t[pos_idx1].view(-1, 10)
    loss_landm = F.smooth_l1_loss(landm_p, landm_t, reduction='sum')

    pos = conf_t != zeros
    conf_t[pos] = 1

    # Localization Loss (Smooth L1)
    # Shape: [batch,num_priors,4]
    pos_idx = pos.unsqueeze(pos.dim()).expand_as(loc_data)
    loc_p = loc_data[pos_idx].view(-1, 4)
    loc_t = loc_t[pos_idx].view(-1, 4)
    loss_l = F.smooth_l1_loss(loc_p, loc_t, reduction='sum')

    # Compute max conf across batch for hard negative mining
    batch_conf = conf_data.view(-1, self.num_classes)
    loss_c = log_sum_exp(batch_conf) - batch_conf.gather(1, conf_t.view(-1, 1))

    # Hard Negative Mining
    loss_c[pos.view(-1, 1)] = 0 # filter out pos boxes for now
    loss_c = loss_c.view(num, -1)
    _, loss_idx = loss_c.sort(1, descending=True)
    _, idx_rank = loss_idx.sort(1)
    num_pos = pos.long().sum(1, keepdim=True)
    num_neg = torch.clamp(self.negpos_ratio*num_pos, max=pos.size(1)-1)
    neg = idx_rank < num_neg.expand_as(idx_rank)

    # Confidence Loss Including Positive and Negative Examples
    pos_idx = pos.unsqueeze(2).expand_as(conf_data)
    neg_idx = neg.unsqueeze(2).expand_as(conf_data)
    conf_p = conf_data[(pos_idx+neg_idx).gt(0)].view(-1,self.num_classes)
    targets_weighted = conf_t[(pos+neg).gt(0)]
    loss_c = F.cross_entropy(conf_p, targets_weighted, reduction='sum')

    # Sum of losses: L(x,c,l,g) = (Lconf(x, c) + αLloc(x,l,g)) / N
    N = max(num_pos.data.sum().float(), 1)
    loss_l /= N
    loss_c /= N
    loss_landm /= N1

    return loss_l, loss_c, loss_landm
\`\`\`
`;export{n as default};
