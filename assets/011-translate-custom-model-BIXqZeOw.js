const e=`---
id: portfolio011
title: Deploy Custom Pytorch Model to Web Frontend
intro: This project attempts to deploy custom trained model in pytorch into browser.
thumbnail: /assets/portfolios/thumbnails/retinaface.png
tech: Python, Pytorch
thumbWidth: 400
thumbTransX: 0
thumbTransY: 0
hoverImageHeight: 175
date: 2022-11-10
---

### Repository

- https://github.com/machingclee/2022-10-05-Retinaface-study

### Deployed Website

If the screen keeps loading, you may try to refresh:

- https://onnx-trial.vercel.app/face-landmarks

<Center>
<a href="/assets/portfolios/images/web_site_detection_demo.png">
<img src="/assets/portfolios/images/web_site_detection_demo.png" width="600"/>
</a>
</Center>

**Remark 1.** All prediction happens at the frontend, no data will be sent to elsewhere.

**Remark 2.** Since the model is small, the facial landmark prediction has not been trained well.

### Technical Detail

I have recorded the process of translating pytorch model into onnx format in this blog post:

- [Onnx Model Deployment to Frontend From Pytorch Model](/blog/article/Onnx-Model-Deployment-to-Frontend-From-Pytorch-Model)

### Obstacle

The main obstacle is that some of the layers have no implementation using webgl (in which gpu is enabled), and we have to split a simple pytorch model into two parts.

- The first part is those common layers that webgl supports.
- The second part is those unsupported layers, which we can just rely on cpu calculation.

Usually the second part are those not involving learnable layers, and that part focuses on parsing the result from the first part.

### Variation of the Model into Rust Detection

After understanding the model thoroughly (so that I know what to feed into the model), I created another dataset pipeline for rust detection, and the result is pretty well:

- [Demonstration and Explanation of the Work](https://youtu.be/013QXBFrXnQ?t=428)
`;export{e as default};
