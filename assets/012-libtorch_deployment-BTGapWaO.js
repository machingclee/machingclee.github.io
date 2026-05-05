const t=`---
id: portfolio012
title: "Translate Pytorch Model and Weight into Libtorch Model for Cpp Project"
intro: This project attempts to apply weights trained from pytorch (Python) model to libtorch (C++) model by constructing the same model structure.
thumbnail: /assets/portfolios/thumbnails/libtorch_deployment.png
tech: Pytorch (python), Libtorch (C++)
thumbWidth: 300
thumbTransX: 0
thumbTransY: 0
hoverImageHeight: 185
date: 2023-04-02
---

### Repository

- [ImGui-barebone-windows-blazeface-integrated](https://github.com/machingclee/2023-01-25-ImGui-barebone-windows-blazeface-integrated/tree/main/mediapipe_libtorch/src/mediapipe_libtorch?fbclid=IwAR1gtFpkaP6cq4-y_FWkC_KBz6reAHPly7ObujzAqGU6egsyxVXuYYDrnWk)

### Result

<Center>
<a href="/assets/portfolios/images/libtorch_result.png">
<img src="/assets/portfolios/images/libtorch_result.png" width="600"/>
</a>
</Center>

### Technical Detail

I have recorded all the detail needed for the translation in

- [Libtorch Study Notes With OpenCV](/blog/article/Libtorch-Study-Notes-With-OpenCV)

This inclues:

1. How to register modules;

2. How to validate the libtorch model is compatible with the pytorch model;

3. Simple usage of opencv (in C++) that is helpful to migrate from \`numpy\`.

### Main Value of This Translation Project:

- This project is a **complete C++ translation** of [mediapipe's blazeface in this repository](https://github.com/zmurez/MediaPipePyTorch) written in python.

- We build the **same model architecture** in libtorch in order to reconstruct the same structure as in the pytorch model.

- Therefore we can apply the **weight trained from pytorch** and
- Directly deploy the model in our C++ project.

This libtorch model is to be integrated into the desktop application:

- https://www.youtube.com/watch?v=phVR3YgSgT4

which is still in ongoing state.
`;export{t as default};
