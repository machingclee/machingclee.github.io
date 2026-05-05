const e=`---
title: "EAST: A Text Detection Algorithm"
date: 2022-05-29
id: blog082
tag: pytorch, deep-learning
intro: "Break down the code for my own study. e.g., the way it does image cropping, resizing, etc augmentations while keeping the vertice consistent are very valuable reference, the way it does nms is also succint! ***Source Code:*** <a href='https://github.com/SakuraRiven/EAST'>Link</a>"
---

### Results

<center>
<a href="/assets/tech/054.jpg" target="_blank">
<img width="600" src="/assets/tech/054.jpg"/>
</a>
</center>

### dataset.py

#### Import

\`\`\`python
from shapely.geometry import Polygon
from abc import ABC, abstractmethod
from torch.utils.data import Dataset
from PIL import Image
from torchvision.transforms import transforms
import torch
import os
import numpy as np
import math
import cv2
\`\`\`

#### CustomDataset

\`\`\`python
class CustomDataset(Dataset):
    def __init__(self, img_path, gt_path, scale=0.25, length=512):
        super(CustomDataset, self).__init__()
        self.img_files = []
        for img_file in sorted(os.listdir(img_path)):
            if img_file.endswith(".jpg") or img_file.endswith(".png"):
                self.img_files.append(os.path.join(img_path, img_file))

        self.gt_files = []
        for gt_file in sorted(os.listdir(gt_path)):
            if gt_file.endswith(".txt"):
                self.gt_files.append(os.path.join(gt_path, gt_file))

        self.scale = scale
        self.length = length

    def __getitem__(self, index):
        with open(self.gt_files[index], 'r', encoding="utf-8") as f:
            lines = f.readlines()
        vertices, labels = extract_vertices(lines)

        img = Image.open(self.img_files[index])
        img, vertices = adjust_height(img, vertices)
        img, vertices = rotate_img(img, vertices)
        img, vertices = crop_img(img, vertices, labels, self.length)
        transform = transforms.Compose([transforms.ColorJitter(0.5, 0.5, 0.5, 0.25),
                                        transforms.ToTensor(),
                                        transforms.Normalize(mean=(0.5, 0.5, 0.5), std=(0.5, 0.5, 0.5))])

        score_map, geo_map, ignored_map = get_score_geo(img, vertices, labels, self.scale, self.length)
        return transform(img), score_map, geo_map, ignored_map

    def __len__(self):
        return len(self.img_files)
\`\`\`

#### extract_vertices

\`\`\`python
def extract_vertices(lines):
    '''extract vertices info from txt lines
    Input:
            lines   : list of string info
    Output:
            vertices: vertices of text regions <numpy.ndarray, (n,8)>
            labels  : 1->valid, 0->ignore, <numpy.ndarray, (n,)>
    '''
    labels = []
    vertices = []
    for line in lines:
        vertices.append(list(map(int, line.rstrip('\\n').lstrip('\\ufeff').split(',')[:8])))
        label = 0 if '###' in line else 1
        labels.append(label)
    return np.array(vertices), np.array(labels)
\`\`\`

#### adjust_height

\`\`\`python
def adjust_height(img, vertices, ratio=0.2):
    '''adjust height of image to aug data
    Input:
            img         : PIL Image
            vertices    : vertices of text regions <numpy.ndarray, (n,8)>
            ratio       : height changes in [0.8, 1.2]
    Output:
            img         : adjusted PIL Image
            new_vertices: adjusted vertices
    '''
    ratio_h = 1 + ratio * (np.random.rand() * 2 - 1)
    old_h = img.height
    new_h = int(np.around(old_h * ratio_h))
    img = img.resize((img.width, new_h), Image.BILINEAR)  # PIL api (caution, widthxheight)

    new_vertices = vertices.copy()
    if vertices.size > 0:
        new_vertices[:, [1, 3, 5, 7]] = vertices[:, [1, 3, 5, 7]] * (new_h / old_h)
    return img, new_vertices
\`\`\`

#### rotate_img

\`\`\`python
def rotate_img(img, vertices, angle_range=10):
    '''rotate image [-10, 10] degree to aug data
    Input:
            img         : PIL Image
            vertices    : vertices of text regions <numpy.ndarray, (n,8)>
            angle_range : rotate range
    Output:
            img         : rotated PIL Image
            new_vertices: rotated vertices
    '''
    center_x = (img.width - 1) / 2
    center_y = (img.height - 1) / 2
    angle = angle_range * (np.random.rand() * 2 - 1)  # from -10 to 10
    img = img.rotate(angle, Image.BILINEAR)             # PIL api
    new_vertices = np.zeros(vertices.shape)
    for i, vertice in enumerate(vertices):
        new_vertices[i, :] = rotate_vertices(vertice, -angle / 180 * math.pi, np.array([[center_x], [center_y]]))
    return img, new_vertices
\`\`\`

#### rotate_vertices

\`\`\`python
def rotate_vertices(vertices, theta, anchor=None):
    '''rotate vertices around anchor
    Input:
            vertices: vertices of text region <numpy.ndarray, (8,)>
            theta   : angle in radian measure
            anchor  : fixed position during rotation
    Output:
            rotated vertices <numpy.ndarray, (8,)>
    '''
    v = vertices.reshape((4, 2)).T
    if anchor is None:
        anchor = v[:, :1]
    rotate_mat = get_rotate_mat(theta)
    res = np.dot(rotate_mat, v - anchor)
    return (res + anchor).T.reshape(-1)
\`\`\`

#### get_rotate_mat

\`\`\`python
def get_rotate_mat(theta):
    '''positive theta value means rotate clockwise'''
    return np.array([[math.cos(theta), -math.sin(theta)], [math.sin(theta), math.cos(theta)]])
\`\`\`

#### crop_img

\`\`\`python
def crop_img(img, vertices, labels, length):
    '''crop img patches to obtain batch and augment
    Input:
            img         : PIL Image
            vertices    : vertices of text regions <numpy.ndarray, (n,8)>
            labels      : 1->valid, 0->ignore, <numpy.ndarray, (n,)>
            length      : length of cropped image region
    Output:
            region      : cropped image region
            new_vertices: new vertices in cropped region
    '''
    h, w = img.height, img.width
    # confirm the shortest side of image >= length
    if h >= w and w < length:
        img = img.resize((length, int(h * length / w)), Image.BILINEAR)
    elif h < w and h < length:
        img = img.resize((int(w * length / h), length), Image.BILINEAR)
    ratio_w = img.width / w
    ratio_h = img.height / h
    assert(ratio_w >= 1 and ratio_h >= 1)

    new_vertices = np.zeros(vertices.shape)
    if vertices.size > 0:
        new_vertices[:, [0, 2, 4, 6]] = vertices[:, [0, 2, 4, 6]] * ratio_w
        new_vertices[:, [1, 3, 5, 7]] = vertices[:, [1, 3, 5, 7]] * ratio_h

    # find random position
    remain_h = img.height - length
    remain_w = img.width - length
    flag = True
    cnt = 0
    while flag and cnt < 1000:
        cnt += 1
        start_w = int(np.random.rand() * remain_w)
        start_h = int(np.random.rand() * remain_h)
        flag = is_cross_text([start_w, start_h], length, new_vertices[labels == 1, :])
    box = (start_w, start_h, start_w + length, start_h + length)
    region = img.crop(box)
    if new_vertices.size == 0:
        return region, new_vertices

    new_vertices[:, [0, 2, 4, 6]] -= start_w
    new_vertices[:, [1, 3, 5, 7]] -= start_h
    return region, new_vertices
\`\`\`

#### is_cross_text

\`\`\`python
def is_cross_text(start_loc, length, vertices):
    '''check if the crop image crosses text regions
    Input:
            start_loc: left-top position
            length   : length of crop image
            vertices : vertices of text regions <numpy.ndarray, (n,8)>
    Output:
            True if crop image crosses text region
    '''
    if vertices.size == 0:
        return False
    start_w, start_h = start_loc
    a = np.array([start_w, start_h, start_w + length, start_h,
                  start_w + length, start_h + length, start_w, start_h + length]).reshape((4, 2))
    p1 = Polygon(a).convex_hull
    epsilon = 1e-6
    for vertice in vertices:
        p2 = Polygon(vertice.reshape((4, 2))).convex_hull
        inter = p1.intersection(p2).area
        if 0.01 <= inter / (p2.area + epsilon) <= 0.99:
            return True
    return False
\`\`\`

#### get_score_geo

\`\`\`python
def get_score_geo(img, vertices, labels, scale, length):
    '''generate score gt and geometry gt
    Input:
            img     : PIL Image
            vertices: vertices of text regions <numpy.ndarray, (n,8)>
            labels  : 1->valid, 0->ignore, <numpy.ndarray, (n,)>
            scale   : feature map / image
            length  : image length
    Output:
            score gt, geo gt, ignored
    '''
    score_map = np.zeros((int(img.height * scale), int(img.width * scale), 1), np.float32)
    geo_map = np.zeros((int(img.height * scale), int(img.width * scale), 5), np.float32)
    ignored_map = np.zeros((int(img.height * scale), int(img.width * scale), 1), np.float32)

    index = np.arange(0, length, int(1 / scale))
    index_x, index_y = np.meshgrid(index, index)
    ignored_polys = []
    polys = []

    for i, vertice in enumerate(vertices):
        if labels[i] == 0:
            ignored_polys.append(np.around(scale * vertice.reshape((4, 2))).astype(np.int32))
            continue

        poly = np.around(scale * shrink_poly(vertice).reshape((4, 2))).astype(np.int32)  # scaled & shrinked
        polys.append(poly)
        temp_mask = np.zeros(score_map.shape[:-1], np.float32)
        cv2.fillPoly(temp_mask, [poly], 1)

        theta = find_min_rect_angle(vertice)
        rotate_mat = get_rotate_mat(theta)

        rotated_vertices = rotate_vertices(vertice, theta)
        x_min, x_max, y_min, y_max = get_boundary(rotated_vertices)
        rotated_x, rotated_y = rotate_all_pixels(rotate_mat, vertice[0], vertice[1], length)

        # given p in Polygon(vertice), top_distance = p - Pr_{top_L}(p) = r(p)_y - r(Pr_{top_L}(p))_y = r(p)_y - ymin
        # where r is the rotation anchored at the top-left corner
        # and p in Polygon(vertice) only if r(p)_y - ymin >= 0
        # d1 = distance from top to point (j, i)

        # the gt is top, bottom, left, right (上, 下, 左, 右)
        d1 = rotated_y - y_min
        d1[d1 < 0] = 0
        d2 = y_max - rotated_y
        d2[d2 < 0] = 0
        d3 = rotated_x - x_min
        d3[d3 < 0] = 0
        d4 = x_max - rotated_x
        d4[d4 < 0] = 0
        geo_map[:, :, 0] += d1[index_y, index_x] * temp_mask
        geo_map[:, :, 1] += d2[index_y, index_x] * temp_mask
        geo_map[:, :, 2] += d3[index_y, index_x] * temp_mask
        geo_map[:, :, 3] += d4[index_y, index_x] * temp_mask
        geo_map[:, :, 4] += theta * temp_mask

    cv2.fillPoly(ignored_map, ignored_polys, 1)
    cv2.fillPoly(score_map, polys, 1)
    return torch.Tensor(score_map).permute(2, 0, 1), torch.Tensor(geo_map).permute(2, 0, 1), torch.Tensor(ignored_map).permute(2, 0, 1)
\`\`\`

#### shrink_poly

\`\`\`python-1
def shrink_poly(vertices, coef=0.3):
    '''shrink the text region
    Input:
            vertices: vertices of text region <numpy.ndarray, (8,)>
            coef    : shrink ratio in paper
    Output:
            v       : vertices of shrinked text region <numpy.ndarray, (8,)>
    '''
    x1, y1, x2, y2, x3, y3, x4, y4 = vertices
    r1 = min(cal_distance(x1, y1, x2, y2), cal_distance(x1, y1, x4, y4))
    r2 = min(cal_distance(x2, y2, x1, y1), cal_distance(x2, y2, x3, y3))
    r3 = min(cal_distance(x3, y3, x2, y2), cal_distance(x3, y3, x4, y4))
    r4 = min(cal_distance(x4, y4, x1, y1), cal_distance(x4, y4, x3, y3))
    r = [r1, r2, r3, r4]

    # obtain offset to perform move_points() automatically
    if cal_distance(x1, y1, x2, y2) + cal_distance(x3, y3, x4, y4) > \\
            cal_distance(x2, y2, x3, y3) + cal_distance(x1, y1, x4, y4):
        offset = 0  # two longer edges are (x1y1-x2y2) & (x3y3-x4y4)
    else:
        offset = 1  # two longer edges are (x2y2-x3y3) & (x4y4-x1y1)

    v = vertices.copy()
    v = move_points(v, 0 + offset, 1 + offset, r, coef)
\`\`\`

- The movement is always parellel to the edges.
- In each \`move_points\`, two adjacent vectice will be pushed towards each other.
- Each vertex will be adjusted twice in two directions in order to move towards center.

\`\`\`python-25
    v = move_points(v, 2 + offset, 3 + offset, r, coef)
    v = move_points(v, 1 + offset, 2 + offset, r, coef)
    v = move_points(v, 3 + offset, 4 + offset, r, coef)
    return v
\`\`\`

#### find_min_rect_angle

\`\`\`python
def find_min_rect_angle(vertices):
    '''find the best angle to rotate poly and obtain min rectangle
    Input:
            vertices: vertices of text region <numpy.ndarray, (8,)>
    Output:
            the best angle <radian measure>
    '''
    angle_interval = 1
    angle_list = list(range(-90, 90, angle_interval))
    area_list = []
    for theta in angle_list:
        rotated = rotate_vertices(vertices, theta / 180 * math.pi)
        x1, y1, x2, y2, x3, y3, x4, y4 = rotated
        temp_area = (max(x1, x2, x3, x4) - min(x1, x2, x3, x4)) * \\
            (max(y1, y2, y3, y4) - min(y1, y2, y3, y4))
        area_list.append(temp_area)

    sorted_area_index = sorted(list(range(len(area_list))), key=lambda k: area_list[k])
    min_error = float('inf')
    best_index = -1
    rank_num = 10
    # find the best angle with correct orientation
    for index in sorted_area_index[:rank_num]:
        rotated = rotate_vertices(vertices, angle_list[index] / 180 * math.pi)
        temp_error = cal_error(rotated)
        if temp_error < min_error:
            min_error = temp_error
            best_index = index
    return angle_list[best_index] / 180 * math.pi
\`\`\`

#### cal_distance

\`\`\`python
def cal_distance(x1, y1, x2, y2):
    '''calculate the Euclidean distance'''
    return math.sqrt((x1 - x2)**2 + (y1 - y2)**2)
\`\`\`

#### get_boundary

\`\`\`python
def get_boundary(vertices):
    '''get the tight boundary around given vertices
    Input:
            vertices: vertices of text region <numpy.ndarray, (8,)>
    Output:
            the boundary
    '''
    x1, y1, x2, y2, x3, y3, x4, y4 = vertices
    x_min = min(x1, x2, x3, x4)
    x_max = max(x1, x2, x3, x4)
    y_min = min(y1, y2, y3, y4)
    y_max = max(y1, y2, y3, y4)
    return x_min, x_max, y_min, y_max
\`\`\`

#### rotate_all_pixels

\`\`\`python
def rotate_all_pixels(rotate_mat, anchor_x, anchor_y, length):
    '''get rotated locations of all pixels for next stages
    Input:
            rotate_mat: rotatation matrix
            anchor_x  : fixed x position
            anchor_y  : fixed y position
            length    : length of image
    Output:
            rotated_x : rotated x positions <numpy.ndarray, (length,length)>
            rotated_y : rotated y positions <numpy.ndarray, (length,length)>
    '''
    x = np.arange(length)
    y = np.arange(length)
    x, y = np.meshgrid(x, y)
    x_lin = x.reshape((1, x.size))
    y_lin = y.reshape((1, x.size))
    coord_mat = np.concatenate((x_lin, y_lin), 0)
    rotated_coord = np.dot(rotate_mat, coord_mat - np.array([[anchor_x], [anchor_y]])) + \\
        np.array([[anchor_x], [anchor_y]])
    rotated_x = rotated_coord[0, :].reshape(x.shape)
    rotated_y = rotated_coord[1, :].reshape(y.shape)
    return rotated_x, rotated_y
\`\`\`

#### move_points

\`\`\`python
def move_points(vertices, index1, index2, r, coef):
    '''move the two points to shrink edge
    Input:
            vertices: vertices of text region <numpy.ndarray, (8,)>
            index1  : offset of point1
            index2  : offset of point2
            r       : [r1, r2, r3, r4] in paper
            coef    : shrink ratio in paper
    Output:
            vertices: vertices where one edge has been shinked
    '''
    index1 = index1 % 4
    index2 = index2 % 4
    x1_index = index1 * 2 + 0
    y1_index = index1 * 2 + 1
    x2_index = index2 * 2 + 0
    y2_index = index2 * 2 + 1

    r1 = r[index1]
    r2 = r[index2]
    length_x = vertices[x1_index] - vertices[x2_index]
    length_y = vertices[y1_index] - vertices[y2_index]
    length = cal_distance(vertices[x1_index], vertices[y1_index], vertices[x2_index], vertices[y2_index])
    if length > 1:
        ratio = (r1 * coef) / length
        vertices[x1_index] += ratio * (-length_x)
        vertices[y1_index] += ratio * (-length_y)
        ratio = (r2 * coef) / length
        vertices[x2_index] += ratio * length_x
        vertices[y2_index] += ratio * length_y
    return vertices
\`\`\`

#### cal_error

\`\`\`python
def cal_error(vertices):
    '''default orientation is x1y1 : left-top, x2y2 : right-top, x3y3 : right-bot, x4y4 : left-bot
    calculate the difference between the vertices orientation and default orientation
    Input:
            vertices: vertices of text region <numpy.ndarray, (8,)>
    Output:
            err     : difference measure
    '''
    x_min, x_max, y_min, y_max = get_boundary(vertices)
    x1, y1, x2, y2, x3, y3, x4, y4 = vertices
    err = cal_distance(x1, y1, x_min, y_min) + cal_distance(x2, y2, x_max, y_min) + \\
        cal_distance(x3, y3, x_max, y_max) + cal_distance(x4, y4, x_min, y_max)
    return err
\`\`\`

### losses.py

#### Import

\`\`\`python
import torch
import torch.nn as nn
\`\`\`

#### get_dice_loss

\`\`\`python
def get_dice_loss(gt_score, pred_score):
    inter = torch.sum(gt_score * pred_score)
    union = torch.sum(gt_score) + torch.sum(pred_score) + 1e-5
    return 1. - (2 * inter / union)
\`\`\`

#### get_geo_loss

\`\`\`python
def get_geo_loss(gt_geo, pred_geo):
    d1_gt, d2_gt, d3_gt, d4_gt, angle_gt = torch.split(gt_geo, 1, 1)
    d1_pred, d2_pred, d3_pred, d4_pred, angle_pred = torch.split(pred_geo, 1, 1)
    area_gt = (d1_gt + d2_gt) * (d3_gt + d4_gt)
    area_pred = (d1_pred + d2_pred) * (d3_pred + d4_pred)
    w_union = torch.min(d3_gt, d3_pred) + torch.min(d4_gt, d4_pred)
    h_union = torch.min(d1_gt, d1_pred) + torch.min(d2_gt, d2_pred)
    area_intersect = w_union * h_union
    area_union = area_gt + area_pred - area_intersect
    iou_loss_map = -torch.log((area_intersect + 1.0) / (area_union + 1.0))
    angle_loss_map = 1 - torch.cos(angle_pred - angle_gt)
    return iou_loss_map, angle_loss_map
\`\`\`

#### Loss

\`\`\`python
class Loss(nn.Module):
    def __init__(self, weight_angle=10):
        super(Loss, self).__init__()
        self.weight_angle = weight_angle

    def forward(self, gt_score, pred_score, gt_geo, pred_geo, ignored_map):
        if torch.sum(gt_score) < 1:
            return torch.sum(pred_score + pred_geo) * 0

        classify_loss = get_dice_loss(gt_score, pred_score * (1 - ignored_map))
        iou_loss_map, angle_loss_map = get_geo_loss(gt_geo, pred_geo)

        angle_loss = torch.sum(angle_loss_map * gt_score) / torch.sum(gt_score)
        iou_loss = torch.sum(iou_loss_map * gt_score) / torch.sum(gt_score)
        geo_loss = self.weight_angle * angle_loss + iou_loss
        return geo_loss + classify_loss
\`\`\`

### train.py

#### import

\`\`\`python
import torch
from torch.utils import data
from torch import nn
from torch.optim import lr_scheduler
from dataset import CustomDataset
from detect import performance_check
from models import EAST
from losses import Loss
from tqdm import tqdm
from device import device
from utils import ConsoleLog
import os
import time
\`\`\`

#### train

\`\`\`python
console_log = ConsoleLog(lines_up_on_end=1)
def train(train_img_path, train_gt_path, pths_path, batch_size, lr, num_workers, epoch_iter, interval):
    file_num = len(os.listdir(train_img_path))
    trainset = CustomDataset(train_img_path, train_gt_path)
    train_loader = data.DataLoader(trainset,
                                   batch_size=batch_size,
                                   shuffle=True,
                                   num_workers=num_workers,
                                   drop_last=True)

    criterion = Loss()
    model = EAST()
    data_parallel = False

    if torch.cuda.device_count() > 1:
        model = nn.DataParallel(model)
        data_parallel = True

    model.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = lr_scheduler.MultiStepLR(optimizer,
                                         milestones=[epoch_iter // 2],
                                         gamma=0.1)

    for epoch in range(epoch_iter):
        model.train()
        epoch_loss = 0
        epoch_time = time.time()

        for batch, (img, gt_score, gt_geo, ignored_map) in enumerate(tqdm(
            train_loader,
            total=len(trainset) // batch_size,
            bar_format="{desc}: {percentage:.1f}%|{bar:15}| {n}/{total_fmt} [{elapsed}, {rate_fmt}{postfix}]"
        )):
            start_time = time.time()

            img = img.to(device)
            gt_score = gt_score.to(device)
            gt_geo = gt_geo.to(device)
            ignored_map = ignored_map.to(device)

            pred_score, pred_geo = model(img)

            loss = criterion(gt_score, pred_score, gt_geo, pred_geo, ignored_map)

            epoch_loss += loss.item()
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            scheduler.step()

            if (batch + 1) % save_interval == 0:
                performance_check(model, save_image_path="results/epoch_{}_batch_{}.jpg".format(epoch, batch + 1))

            console_log.print(
                'Epoch is [{}/{}], mini-batch is [{}/{}], time consumption is {:.8f}, batch_loss is {:.8f}'.format(
                    epoch + 1, epoch_iter, batch + 1, int(file_num / batch_size), time.time() - start_time, loss.item()),
                is_key_value=False
            )

        if (epoch + 1) % interval == 0:
            state_dict = model.module.state_dict() if data_parallel else model.state_dict()
            torch.save(state_dict, os.path.join(pths_path, 'model_epoch_{}.pth'.format(epoch + 1)))


if __name__ == '__main__':
    train_img_path = os.path.abspath('dataset/images')
    train_gt_path = os.path.abspath('dataset/annotations')
    pths_path = './pths'
    batch_size = 24
    lr = 1e-3
    num_workers = 4
    epoch_iter = 600
    save_interval = 5
    train(train_img_path, train_gt_path, pths_path, batch_size, lr, num_workers, epoch_iter, save_interval)
\`\`\`

### detect.py

#### Import

\`\`\`python
from torchvision import transforms
from PIL import Image, ImageDraw
from models import EAST
from dataset import get_rotate_mat
from utils import nms_locality
from device import device

import config
import torch
import os
import numpy as np
import random
\`\`\`

#### resize_img

\`\`\`python
def resize_img(img):
    '''resize image to be divisible by 32
    '''
    w, h = img.size
    resize_w = w
    resize_h = h

    resize_h = resize_h if resize_h % 32 == 0 else int(resize_h / 32) * 32
    resize_w = resize_w if resize_w % 32 == 0 else int(resize_w / 32) * 32
    img = img.resize((resize_w, resize_h), Image.BILINEAR)
    ratio_h = resize_h / h
    ratio_w = resize_w / w

    return img, ratio_h, ratio_w
\`\`\`

#### load_pil

\`\`\`python
def load_pil(img):
    '''convert PIL Image to torch.Tensor
    '''
    t = transforms.Compose([transforms.ToTensor(), transforms.Normalize(mean=(0.5, 0.5, 0.5), std=(0.5, 0.5, 0.5))])
    return t(img).unsqueeze(0)
\`\`\`

#### is_valid_poly

\`\`\`python
def is_valid_poly(res, score_shape, scale):
    '''check if the poly in image scope
    Input:
            res        : restored poly in original image
            score_shape: score map shape
            scale      : feature map -> image
    Output:
            True if valid
    '''
    cnt = 0
    for i in range(res.shape[1]):
        if res[0, i] < 0 or res[0, i] >= score_shape[1] * scale or \\
                res[1, i] < 0 or res[1, i] >= score_shape[0] * scale:
            cnt += 1
    return True if cnt <= 1 else False
\`\`\`

#### restore_polys

\`\`\`python
def restore_polys(valid_pos, valid_geo, score_shape, scale=4):
    '''restore polys from feature maps in given positions
    Input:
            valid_pos  : potential text positions <numpy.ndarray, (n,2)>
            valid_geo  : geometry in valid_pos <numpy.ndarray, (5,n)>
            score_shape: shape of score map
            scale      : image / feature map
    Output:
            restored polys <numpy.ndarray, (n,8)>, index
    '''
    polys = []
    index = []
    valid_pos *= scale
    d = valid_geo[:4, :]  # 4 x N
    angle = valid_geo[4, :]  # N,

    for i in range(valid_pos.shape[0]):
        x = valid_pos[i, 0]
        y = valid_pos[i, 1]
        y_min = y - d[0, i]
        y_max = y + d[1, i]
        x_min = x - d[2, i]
        x_max = x + d[3, i]
        rotate_mat = get_rotate_mat(-angle[i])

        temp_x = np.array([[x_min, x_max, x_max, x_min]]) - x
        temp_y = np.array([[y_min, y_min, y_max, y_max]]) - y
        coordidates = np.concatenate((temp_x, temp_y), axis=0)
        res = np.dot(rotate_mat, coordidates)
        res[0, :] += x
        res[1, :] += y

        if is_valid_poly(res, score_shape, scale):
            index.append(i)
            polys.append([res[0, 0], res[1, 0], res[0, 1], res[1, 1], res[0, 2], res[1, 2], res[0, 3], res[1, 3]])
    return np.array(polys), index
\`\`\`

#### get_boxes

\`\`\`python
def get_boxes(score, geo, score_thresh=config.detection_score_threshold, nms_thresh=0.2):
    '''get boxes from feature map
    Input:
            score       : score map from model <numpy.ndarray, (1,row,col)>
            geo         : geo map from model <numpy.ndarray, (5,row,col)>
            score_thresh: threshold to segment score map
            nms_thresh  : threshold in nms
    Output:
            boxes       : final polys <numpy.ndarray, (n,9)>
    '''
    score = score[0, :, :]
    xy_text = np.argwhere(score > score_thresh)  # n x 2, format is [r, c]
    if xy_text.size == 0:
        return None

    xy_text = xy_text[np.argsort(xy_text[:, 0])]
    valid_pos = xy_text[:, ::-1].copy()  # n x 2, [x, y]
    # Due to ::-1, pos is now following (x, y) = (i, j) notational convention
    valid_geo = geo[:, xy_text[:, 0], xy_text[:, 1]]  # 5 x n
    # So is valid_geo
    polys_restored, index = restore_polys(valid_pos, valid_geo, score.shape)
    if polys_restored.size == 0:
        return None

    boxes = np.zeros((polys_restored.shape[0], 9), dtype=np.float32)
    boxes[:, :8] = polys_restored
    boxes[:, 8] = score[xy_text[index, 0], xy_text[index, 1]]
    boxes = nms_locality(boxes.astype('float32'), nms_thresh)
    return boxes
\`\`\`

#### adjust_ratio

\`\`\`python
def adjust_ratio(boxes, ratio_w, ratio_h):
    '''refine boxes
    Input:
            boxes  : detected polys <numpy.ndarray, (n,9)>
            ratio_w: ratio of width
            ratio_h: ratio of height
    Output:
            refined boxes
    '''
    if boxes is None or boxes.size == 0:
        return None
    boxes[:, [0, 2, 4, 6]] /= ratio_w
    boxes[:, [1, 3, 5, 7]] /= ratio_h
    return np.around(boxes)
\`\`\`

#### detect

\`\`\`python
def detect(img, model, device):
    '''detect text regions of img using model
    Input:
            img   : PIL Image
            model : detection model
            device: gpu if gpu is available
    Output:
            detected polys
    '''
    img, ratio_h, ratio_w = resize_img(img)
    with torch.no_grad():
        score, geo = model(load_pil(img).to(device))
    boxes = get_boxes(score.squeeze(0).cpu().numpy(), geo.squeeze(0).cpu().numpy())
    return adjust_ratio(boxes, ratio_w, ratio_h)
\`\`\`

#### plot_boxes

\`\`\`python
def plot_boxes(img, boxes):
    '''plot boxes on image
    '''
    if boxes is None:
        return img

    draw = ImageDraw.Draw(img)
    for box in boxes:
        draw.polygon([box[0], box[1], box[2], box[3], box[4], box[5], box[6], box[7]], outline=(0, 255, 0))
    return img
\`\`\`

#### detect_dataset

\`\`\`python
def detect_dataset(model, device, test_img_path, submit_path):
    '''detection on whole dataset, save .txt results in submit_path
    Input:
            model        : detection model
            device       : gpu if gpu is available
            test_img_path: dataset path
            submit_path  : submit result for evaluation
    '''
    img_files = os.listdir(test_img_path)
    img_files = sorted([os.path.join(test_img_path, img_file) for img_file in img_files])

    for i, img_file in enumerate(img_files):
        print('evaluating {} image'.format(i), end='\\r')
        boxes = detect(Image.open(img_file), model, device)
        seq = []
        if boxes is not None:
            seq.extend([','.join([str(int(b)) for b in box[:-1]]) + '\\n' for box in boxes])
        with open(os.path.join(submit_path, 'res_' + os.path.basename(img_file).replace('.jpg', '.txt')), 'w') as f:
            f.writelines(seq)
\`\`\`

#### performance_check

\`\`\`python
def performance_check(model, save_image_path):
    model.eval()
    images = os.listdir("dataset/images")
    random.shuffle(images)
    img = Image.open("dataset/images/{}".format(images[0]))
    boxes = detect(img, model, device)
    plot_img = plot_boxes(img, boxes)
    plot_img.save(save_image_path)
    plot_img.save("results/latest_output.jpg")
    model.train()
\`\`\`

### device

\`\`\`python
import torch
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
\`\`\`

### utils

#### Import

\`\`\`python
from pydash.objects import get, set_
from shapely.geometry import Polygon
import numpy as np
\`\`\`

#### iou

\`\`\`python
def iou(g, p):
    g = Polygon(g[:8].reshape((4, 2)))
    p = Polygon(p[:8].reshape((4, 2)))
    if not g.is_valid or not p.is_valid:
        return 0
    inter = Polygon(g).intersection(Polygon(p)).area
    union = g.area + p.area - inter
    if union == 0:
        return 0
    else:
        return inter / union
\`\`\`

#### weighted_merge

\`\`\`python
def weighted_merge(g, p):
    g[:8] = (g[8] * g[:8] + p[8] * p[:8]) / (g[8] + p[8])
    g[8] = (g[8] + p[8])
    return g
\`\`\`

#### standard_nms

\`\`\`python
def standard_nms(S, thres):
    order = np.argsort(S[:, 8])[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        ious = np.array([iou(S[i], S[t]) for t in order[1:]])

        inds = np.where(ious <= thres)[0]
        # since order[0] is taken out
        order = order[inds + 1]

    return S[keep]
\`\`\`

#### nms_locality

\`\`\`python
def nms_locality(polys, thres=0.3):
    '''
    locality aware nms of EAST
    :param polys: a N*9 numpy array. first 8 coordinates, then prob
    :return: boxes after nms
    '''
    S = []
    p = None
    for g in polys:
        if p is not None and iou(g, p) > thres:
            p = weighted_merge(g, p)
        else:
            if p is not None:
                S.append(p)
            p = g
    if p is not None:
        S.append(p)

    if len(S) == 0:
        return np.array([])
    return standard_nms(np.array(S), thres)
\`\`\`
`;export{e as default};
