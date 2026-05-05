const n=`---
title: Pytorch/libtorch with CPP API
date: 2023-01-11
id: blog0120
tag: C++, pytorch
intro: "We discuss how to import models trained in pytorch into cpp project."
---

### Install libtorch in Windows

From [libtorch official web site](https://pytorch.org/get-started/locally/) we select

<Center>
<a href="/assets/tech/120/001.png">
<img src="/assets/tech/120/001.png" width="680"/>
</a>
</Center>
<p/>
<center></center>

and click the link it pops up to download.

### Models from pytorch to pytorch C++

#### A Model in Python

\`\`\`python
import torch
import torch.nn.functional as F


class Net(torch.nn.Module):
    def __init__(self):
        super(Net, self).__init__()
        self.layer1 = torch.nn.Linear(100, 256)
        self.layer2 = torch.nn.Linear(256, 1)

    def forward(self, x):
        x = self.layer1(x)
        x = F.relu(x)
        x = self.layer2(x)
        x = F.relu(x)
        return x


if __name__ == "__main__":
    traced_net = torch.jit.trace(Net(), torch.randn(1, 100))
    torch.jit.save(traced_net, "models/net.pt")
\`\`\`

#### Inference in C++

##### Minimal Working CMakeLists.txt

\`\`\`cmake
add_executable(pymode_to_cpp main.cpp)

target_link_libraries(pymode_to_cpp PUBLIC \${TORCH_LIBRARIES})

if (MSVC)
  message("copying dll files")
  file(GLOB TORCH_DLLS "\${TORCH_INSTALL_PREFIX}/lib/*.dll")
  add_custom_command(TARGET pymode_to_cpp
                     POST_BUILD
                     COMMAND \${CMAKE_COMMAND} -E copy_if_different
                     \${TORCH_DLLS}
                     $<TARGET_FILE_DIR:pymode_to_cpp>)
endif (MSVC)
\`\`\`

##### The \`main.cpp\` File

\`\`\`cpp
#include "torch/script.h"
#include "torch/torch.h"
#include <iostream>
#include <string>

std::string model_pt_path{"C:\\\\Users\\\\user\\\\Repos\\\\C++\\\\
2023-01-12-DGGAN-in-pytorch-cpp-and-CMake-practice\\\\models\\\\net.pt"};

int main() {
    torch::jit::script::Module net = torch::jit::load(model_pt_path);
    torch::Tensor x = torch::randn({1, 100});
    torch::Tensor y = torch::randn({1, 100});
    torch::Tensor inputs = torch::cat({x, y});
    std::vector<torch::IValue> x_{inputs};
    torch::Tensor yTensor = net.forward(x_).toTensor();
    size_t ySize = yTensor.sizes()[0];
    float* yDataPtr = (float*)yTensor.data_ptr();
    try {
        // float result = output.toTensor().item<float>();
        for (int i = 0; i < ySize; i++) {
            float value = yDataPtr[i];
            std::cout << "The Float Value output: " << value << std::endl;
        }
    } catch (const c10::Error& e) {
        std::cerr << e.msg() << std::endl;
    }
}
\`\`\`

which yields

\`\`\`text
The Float Value output: 0.606562
The Float Value output: 0.160477
\`\`\`

Note that when \`yTensor\` is known to have \`batchSize\` 1, we may use \`Tensor.item<float>()\` to retrieve the data instead of resorting to the \`data_ptr()\` method.
`;export{n as default};
