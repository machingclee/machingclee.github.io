---
id: portfolio011
title: Deploy Custom Pytorch Model to Frontend
intro: This project attempts to deploy custom trained model in pytorch into browser.
thumbnail: /assets/portfolios/thumbnails/retinaface.png
tech: Python, Pytorch
thumbWidth: 400
thumbTransX: -100
thumbTransY: -50
date: 2022-11-10
---

#### Repository

- https://github.com/machingclee/2022-10-05-Retinaface-study

#### Deployed Website

If the screen keeps loading, you may try to refresh:

- https://onnx-trial.vercel.app/face-landmarks

**Remark 1.** All prediction happens at the frontend, no data will be sent to elsewhere.

**Remark 2.** Since the model is small, the facial landmark prediction has not been trained well.

#### Technical Detail

I have recorded the process of translating pytorch model into onnx format in this blog post:

- [Onnx Model Deployment to Frontend From Pytorch Model](/blog/Onnx-Model-Deployment-to-Frontend-From-Pytorch-Model)

#### Obstacle

The main obstacle is that some of the layers have no implementation using webgl (in which gpu is enabled), and we have to split a simple pytorch model into two parts.

- The first part is those common layers that webgl supports.
- The second part is those unsupported layers, which we can just rely on cpu calcuation.

Usually the second part are those not involving learnable layers, and that part focuses on parsing the result form the first part.
