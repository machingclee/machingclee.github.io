const t=`---
id: portfolio005
title: YOLOv3 Face Detection with OpenImage Dataset
intro: First trial to train yolo v3 on custom data set.
thumbnail: /assets/portfolios/thumbnails/yolov3custom.png
tech: Python, Tensorflow
thumbWidth: 400
thumbTransX: 15
thumbTransY: -9
hoverImageHeight: 110
date: 2021-03-08
---

### Repository

- https://github.com/machingclee/deep-learning-study/tree/main/2021-02-15-yolo-trials/2021-02-15-YOLOV3-head-detection

### Study Notes on Yolo Algorithm

- https://machingclee.github.io/blog/article/YOLOv3-Deep-Dive

### Result

As I am not satisfied with the Haar cascade model from openCV for face detection. I start to study YOLO and study how to prepare annotation file for training. After training YOLOv3 with 2000 images from open images dataset and 3 anchors, I get:

<center>
  <iframe width="560" height="315" src="https://www.youtube.com/embed/OlWjSy9SXDo" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
</center>

<p/>
<p/>
I can also directly use the package like face-recognition in python, but now I am able to detect whatever I want from this training experience.
`;export{t as default};
