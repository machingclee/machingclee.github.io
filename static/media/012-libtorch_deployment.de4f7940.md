---
id: portfolio012
title: "Translate Pytorch Model and Weight into Libtorch Lodel for C++ Project"
intro: This project attempts to deploy custom trained model in pytorch into browser.
thumbnail: /assets/portfolios/thumbnails/libtorch_deployment.png
tech: Pytorch (python), Libtorch (C++)
thumbWidth: 300
thumbTransX: -22
thumbTransY: -40
date: 2023-04-02
---

#### Repository

- [ImGui-barebone-windows-blazeface-integrated](https://github.com/machingclee/2023-01-25-ImGui-barebone-windows-blazeface-integrated/tree/main/mediapipe_libtorch/src/mediapipe_libtorch?fbclid=IwAR1gtFpkaP6cq4-y_FWkC_KBz6reAHPly7ObujzAqGU6egsyxVXuYYDrnWk)

#### Result

<Center>
<a href="/assets/portfolios/images/libtorch_result.png">
<img src="/assets/portfolios/images/libtorch_result.png" width="600"/>
</a>
</Center>

Value of this project:

- This project is a **complete C++ translation** of [mediapipe's blazeface in this repository](https://github.com/zmurez/MediaPipePyTorch) written in python.

- We build the **same model architecture** in libtorch in order to reconstruct the same structure as in the pytorch model.

- Therefore we can apply the **weight trained from pytorch** and
- Directly deploy the model in our C++ project.

#### Main Objective of This Project

When I was in _Eye Catching Limited_ I was responsible to create a desktop application that:

- Can be launched through our own website
- Tries to capture the eye of the user and screen at the same time.
- Predicts the position on screen at which user's eyes focus.

The libtorch project above is supposed to be integrated in this desktop application:

- https://www.youtube.com/watch?v=phVR3YgSgT4

which is still in ongoing state.
