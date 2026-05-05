const e=`---
title: Onnx Model Deployment to Frontend From Pytorch Model
date: 2022-11-14
id: blog0105
tag: deep-learning, pytorch, react
intro: Record how to change pytorch model into onnx model and deploy it to frontend.
---

### Repository

- [Repo Link](https://github.com/machingclee/2022-11-11-landmarks-trial-frontend)
- [Deployed Frontend](https://onnx-trial.vercel.app)

### Script to Convert Pytorch Model into ONNX model

Let's take a model called \`RetinaFace\` as an example. Given that we have a target model that has been trained, we convert it into onnx model by pytorch built-in command:

\`\`\`python
import torch

retina_face = RetinaFace(cfg=cfg)
retina_face.eval()
regression_parser = SimplifiedRegressionParser()
regression_parser.eval()

dummy_inputs_retina_face = torch.randn(
    1, 3, config.input_img_size, config.input_img_size
)
dummy_inputs_regression_parser = (
    torch.randn(1, config.n_priors, 4),
    torch.randn(1, config.n_priors),
    torch.randn(1, config.n_priors, 196)
)

torch.onnx.export(
    retina_face,
    dummy_inputs_retina_face,
    'FaceDetector.onnx',
    export_params=True,
    verbose=False,
    input_names=["inputImage"],
    output_names=["bbox_regressions", "scores", "ldm_regressions"],
    opset_version=11
)
torch.onnx.export(
    regression_parser,
    args=dummy_inputs_regression_parser,
    f='RegressionParser.onnx',
    export_params=True,
    verbose=False,
    input_names=["bbox_regressions", "scores", "landm_regressions"],
    output_names=["boxes", "scores", "landms"],
    opset_version=11
)
\`\`\`

### Script to Deploy the ONNX model in Frontend

#### Loading Detection Head Model and Prediction Parser Model

Let's create a file \`utils/modelUtils\`. In this inference we break our model into two parts

- faceSession
- faceRegressionSession

and load them via:

\`\`\`javascript
// utils/modelUtils.ts

import * as ort from "onnxruntime-web";
import { useEffect, useState, Dispatch, SetStateAction } from "react";
import { getImageTensorFromPath } from "./imageUtils";
import { time } from "./timeUtils";

export let faceSession: ort.InferenceSession;
export let faceRegressionSession: ort.InferenceSession;

export const loadModels = async () => {
  faceSession = await ort.InferenceSession.create(faceUrl, {
    executionProviders: ["webgl"],
    graphOptimizationLevel: "all",
  });

  faceRegressionSession = await ort.InferenceSession.create(regressionUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
};
\`\`\`

#### Why the Hack we Need two Models?

As can be seen in the parameter \`executionProviders\` above, we can choose to use \`webgl\` and \`wasm\` backend for our model. \`webgl\` employes GPU in the inference, but it comes with limitations:

- \`webgl\` does not support all operators in the given \`opset_version\`
- Many, many usual operators have no support in \`webgl\`
- A complete list of supported operators can be found in [this link](https://github.com/microsoft/onnxruntime/blob/main/js/web/docs/operators.md)

The way to get around this problem is:

- Unsupported operators should be moved into another model
- \`wasm\` supports all operators in a given \`opset_version\`
- Therefore we load that additional model with \`wasm\` backend in order to execute those unsupported operators

#### Script to Execute Prediction

There are many image utils functions, you can unfold the following when you are curious:

<details>
<summary> Click to inspect utils/imageUtils.ts </summary>

\`\`\`javascript
// utils/imageUtils.ts

import * as Jimp from 'jimp';
import { Tensor } from 'onnxruntime-web';
import { getConfig } from './configUtils';

const config = getConfig();

export async function getImageTensorFromPath(
  path: string,
  dims: number[] = [
    1,
    3,
    config.modelRequiredSizes?.width || 640,
    config.modelRequiredSizes?.height || 640
  ]
): Promise<Tensor> {
  var image = await loadImagefromPath(path, dims[2], dims[3]);
  var imageTensor = imageDataToTensor(image, dims);
  return imageTensor;
}

async function loadImagefromPath(
  path: string,
  width: number = config.modelRequiredSizes?.width || 640,
  height: number = config.modelRequiredSizes?.height || 640
): Promise<Jimp> {
  // Use Jimp to load the image and resize it.
  var imageData = await Jimp.default.read(path).then((imageBuffer: Jimp) => {
    return imageBuffer
  });

  return imageData;
}
function imageDataToTensor(image: Jimp, dims: number[]): Tensor {
  // 1. Get buffer data from image and create R, G, and B arrays.
  var imageBufferData = image.bitmap.data;
  const [redArray, greenArray, blueArray] = new Array(new Array<number>(), new Array<number>(), new Array<number>());

  // 2. Loop through the image buffer and extract the R, G, and B channels
  for (let i = 0; i < imageBufferData.length; i += 4) {
    redArray.push(imageBufferData[i]);
    greenArray.push(imageBufferData[i + 1]);
    blueArray.push(imageBufferData[i + 2]);
    // skip data[i + 3] to filter out the alpha channel
  }

  // 3. Concatenate RGB to transpose [224, 224, 3] -> [3, 224, 224] to a number array
  const transposedData = redArray.concat(greenArray).concat(blueArray);

  // 4. convert to float32
  let i, l = transposedData.length; // length, we need this for the loop
  // create the Float32Array size 3 * 224 * 224 for these dimensions output
  const float32Data = new Float32Array(dims[1] * dims[2] * dims[3]);
  for (i = 0; i < l; i++) {
    float32Data[i] = transposedData[i] / 255.0; // convert to float
  }
  // 5. create the tensor object from onnxruntime-web.
  const inputTensor = new Tensor("float32", float32Data, dims);
  return inputTensor;
}
\`\`\`

---

</details>

\`\`\`javascript
// utils/modelUtils.ts

import * as ort from 'onnxruntime-web';
import { useEffect, useState, Dispatch, SetStateAction } from 'react';
import { getImageTensorFromPath } from './imageUtils';
import { time } from './timeUtils';

export const getPredictionFromImagePath = async (imgUrl: string): Promise<{
  hasPositiveResult: boolean,
  result: {
    inferenceTime: number,
    regressionTime: number,
    box: number[],
    landm: number[],
    scores: number[]
  }
}> => {
  if (faceSession && faceRegressionSession) {

    const inferenceStartTime = time.time()
    const imgTensor = await getImageTensorFromPath(imgUrl || "")
    const feeds: Record<string, ort.Tensor> = {};
    feeds[faceSession.inputNames[0]] = imgTensor;
    const outputData = await faceSession.run(feeds);
    const output0 = outputData[faceSession.outputNames[0]];
    const output1 = outputData[faceSession.outputNames[1]];
    const output2 = outputData[faceSession.outputNames[2]];
    const inferenceEndtime = time.time()

    const inferenceTime = inferenceEndtime - inferenceStartTime;

    const feeds_: Record<string, ort.Tensor> = {};
    feeds_[faceRegressionSession.inputNames[0]] = output0;
    feeds_[faceRegressionSession.inputNames[1]] = output1;
    feeds_[faceRegressionSession.inputNames[2]] = output2;

    const regressionStartTime = time.time();
    const output = await faceRegressionSession.run(feeds_);
    const regressionEndtime = time.time();
    const regressionTime = regressionEndtime - regressionStartTime

    const { boxes, landms, scores } = output;
    const hasPositiveResult = boxes.data.length > 0 && boxes && landms && scores;

    if (hasPositiveResult) {
      return ({
        hasPositiveResult: true,
        result: {
          inferenceTime,
          regressionTime,
          box: (boxes.data as any) as number[],
          landm: (landms.data as any) as number[],
          scores: (scores.data as any) as number[]
        }
      })
    }
  }
  return ({
    hasPositiveResult: false,
    result: {
      inferenceTime: 0,
      regressionTime: 0,
      box: [],
      landm: [],
      scores: [],
    }
  })
}
\`\`\`

#### Start the Prediction Loop and Draw Result in Canvas

\`\`\`javascript
const startPrediction_ = async () => {
  if (continuePredictionRef.current) {
    const webcamRef = webcamVideoRef.current;
    const video = webcamRef?.video;
    const canvas = canvasRef.current;

    if (video && canvas) {
      if (canvasWidthHeight.width == 0 && canvasWidthHeight.height == 0) {
        // both are zero when being initialized like after changing the camera device
        setCanvasWidthHeight({
          width: video?.videoWidth,
          height: video?.videoHeight,
        });
      }
      const imgUrl = webcamRef.getScreenshot(
        config?.modelRequiredSizes || { width: 640, height: 640 }
      );
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (imgUrl) {
          const prediction = await getPredictionFromImagePath(imgUrl);
          const { hasPositiveResult, result } = prediction;
          if (hasPositiveResult) {
            const { box, landm, scores, inferenceTime, regressionTime } =
              result;
            setInfTimes({ inferenceTime, regressionTime });
            // shape check:
            if (box.length == 4 && landm.length == 196 && scores.length == 1) {
              setScore(scores[0]);
              const [xmin, ymin, xmax, ymax] = box;
              ctx.clearRect(0, 0, video?.videoWidth, video?.videoHeight);
              drawRectangle(ctx, xmin, ymin, xmax, ymax);
              for (let i = 0; i < 98; i++) {
                const x = landm[2 * i];
                const y = landm[2 * i + 1];
                drawDot(ctx, x, y);
              }
            }
          }
        }
      }
    }
    await startPrediction_();
  }
  onPredictionStop();
};
\`\`\`
`;export{e as default};
