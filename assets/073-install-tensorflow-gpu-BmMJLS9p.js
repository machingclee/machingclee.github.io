const e=`---
title: Install tensorflow-gpu
date: 2022-05-15
id: blog073
tag: deep-learning
intro: Record standard step to set up tensorflow-gpu, cuda and cudnn.
---

### tensorflow-gpu, cudatoolkit and cuDNN

First scroll down the to bottom of <a href="https://www.tensorflow.org/install/source_windows?hl=zh-tw">this page</a> to get a list of compatible version of tensorflow-gpu, cuDNN and CUDA.

For me I have been using tensorflow-gpu 2.4.0, cuDNN 8.x and cuda 11.x. We can:

- Install tensorflow-gpu 2.4.0 by \`pip install tensorflow-gpu==2.4.0\`.
- Install cudatoolkit 11.0 by \`conda install cudatoolkit==11.0\`.
- Download cuDNN 8.4.0 from <a href="https://developer.nvidia.com/rdp/cudnn-download#a-collapse805-110">here</a>. Copy the files from
  - \`downloaded\\cuDNN8.4.0\\{bin, include, lib}\`
    into
  - \`C:\\Users\\<name>\\anaconda3\\envs\\<env name>\\Library\\{bin, include, lib}\`
    respectively.

### Possible error: zlibwapi.dll

When running script with tensorflow, the program may raise the following error:

\`\`\`text
Could not locate zlibwapi.dll
\`\`\`

To solve it we following the instruction from sectoin **_3.1.3. Installing zlib_** from <a href="https://docs.nvidia.com/deeplearning/cudnn/install-guide/index.html#install-zlib-windows">here</a>.

### Indication of Running Tensorflow with GPU Successfully

The following messages should be logged in our console when we are running a script with tensorflow imported.

\`\`\`text
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cudart64_110.dll
I tensorflow/compiler/jit/xla_cpu_device.cc:41] Not creating XLA devices, tf_xla_enable_xla_devices not set
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library nvcuda.dll
I tensorflow/core/common_runtime/gpu/gpu_device.cc:1720] Found device 0 with properties:
pciBusID: 0000:01:00.0 name: GeForce RTX 3090 computeCapability: 8.6
coreClock: 1.725GHz coreCount: 82 deviceMemorySize: 24.00GiB deviceMemoryBandwidth: 871.81GiB/s
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cudart64_110.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cublas64_11.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cublasLt64_11.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cufft64_10.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library curand64_10.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cusolver64_10.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cusparse64_11.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cudnn64_8.dll
I tensorflow/core/common_runtime/gpu/gpu_device.cc:1862] Adding visible gpu devices: 0
I tensorflow/core/platform/cpu_feature_guard.cc:142] This TensorFlow binary is optimized with oneAPI Deep Neural Network Library (oneDNN) to use the following CPU instructions in performance-critical operations:  AVX2
To enable them in other operations, rebuild TensorFlow with the appropriate compiler flags.
I tensorflow/core/common_runtime/gpu/gpu_device.cc:1720] Found device 0 with properties:
pciBusID: 0000:01:00.0 name: GeForce RTX 3090 computeCapability: 8.6
coreClock: 1.725GHz coreCount: 82 deviceMemorySize: 24.00GiB deviceMemoryBandwidth: 871.81GiB/s
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cudart64_110.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cublas64_11.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cublasLt64_11.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cufft64_10.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library curand64_10.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cusolver64_10.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cusparse64_11.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cudnn64_8.dll
I tensorflow/core/common_runtime/gpu/gpu_device.cc:1862] Adding visible gpu devices: 0
I tensorflow/core/common_runtime/gpu/gpu_device.cc:1261] Device interconnect StreamExecutor with strength 1 edge matrix:
I tensorflow/core/common_runtime/gpu/gpu_device.cc:1267]      0
I tensorflow/core/common_runtime/gpu/gpu_device.cc:1280] 0:   N
I tensorflow/core/common_runtime/gpu/gpu_device.cc:1406] Created TensorFlow device (/job:localhost/replica:0/task:0/device:GPU:0 with 21821 MB memory) -> physical GPU (device: 0, name: GeForce RTX 3090, pci bus id: 0000:01:00.0, compute capability: 8.6)
I tensorflow/compiler/jit/xla_gpu_device.cc:99] Not creating XLA devices, tf_xla_enable_xla_devices not set
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cudnn64_8.dll
I tensorflow/core/platform/windows/subprocess.cc:308] SubProcess ended with return code: 0

I tensorflow/core/platform/windows/subprocess.cc:308] SubProcess ended with return code: 0

I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cublas64_11.dll
I tensorflow/stream_executor/platform/default/dso_loader.cc:49] Successfully opened dynamic library cublasLt64_11.dll
I tensorflow/stream_executor/cuda/cuda_blas.cc:1838] TensorFloat-32 will be used for the matrix multiplication. This will only be logged once.
\`\`\`
`;export{e as default};
