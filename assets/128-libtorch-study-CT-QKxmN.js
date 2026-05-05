const n=`---
title: "Libtorch Study Notes With OpenCV"
date: 2023-04-02
id: blog0128
tag: C++, pytorch, libtorch
intro: "In the course of translating pytorch model into libtorch model there are traps and tricks that are worthing being recorded. Also record the simple use of opencv as it substitutes the role of numpy in python."
---

### API Documentation

- https://pytorch.org/cppdocs/api/library_root.html

### Tensor Slicing

- [More detailed translation from pytorch to libtorch](https://pytorch.org/cppdocs/notes/tensor_indexing.html)

| Python                                                 | C++ (assuming \`using namespace torch::indexing\`)                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| \`tensor[None] = 1\`                                     | \`tensor.index_put_({None}, 1)\`                                                     |
| \`tensor[:, 2] = 0 \`                                    | \`tensor.index_put_({Slice(), 2}, 0)\`                                               |
| \`tensor[Ellipsis, ...] = 1\`                            | \`tensor.index_put_({Ellipsis, "..."}, 1)\`                                          |
| \`tensor[1, 2] = 1\`                                     | \`tensor.index_put_({1, 2}, 1)\`                                                     |
| \`tensor[True, False] = 1\`                              | \`tensor.index_put_({true, false}, 1)\`                                              |
| \`tensor[1::2] = 1\`                                     | \`tensor.index_put_({Slice(1, None, 2)}, 1)\`                                        |
| \`tensor[torch.tensor([1, 2])] = 1\`                     | \`tensor.index_put_({torch::tensor({1, 2})}, 1)\`                                    |
| \`tensor[..., 0, True, 1::2, torch.tensor([1, 2])] = 1\` | \`tensor.index_put_({"...", 0, true, Slice(1, None, 2), torch::tensor({1, 2})}, 1)\` |

### How to deal with \`.npy\` file

There are several packages to load \`.npy\` file in C++. However, since have pytorch, additional package for \`.npy\` file is **not necessary**.

#### Save the Numpy Array as Tensor in Pytorch

We can load the array from \`.npy\` file and translate it into tensor easily by

\`\`\`python
anchors = torch.tensor(np.load(anchors_npy_path), dtype=torch.float32)
\`\`\`

then we save it by

\`\`\`python
torch.save({"anchors": anchors}, "anchors.pt")
\`\`\`

#### Load the Tensor in Libtorch

\`\`\`cpp
std::vector<char> get_the_bytes(std::string filename)
{
    std::ifstream input(filename, std::ios::binary);
    std::vector<char> bytes(
        (std::istreambuf_iterator<char>(input)),
        (std::istreambuf_iterator<char>()));
    input.close();
    return bytes;
}

torch::Tensor load_anchors(std::string pt_path)
{
    torch::Tensor anchors;
    std::vector<char> f               = get_the_bytes(pt_path);
    c10::Dict<IValue, IValue> weights = torch::pickle_load(f).toGenericDict();
    for (auto const& w : weights)
    {
        std::string name = w.key().toStringRef();
        at::Tensor param = w.value().toTensor().toType(torch::kFloat32);

        if (name == "anchors")
        {
            std::cout << "anchors was found, loading anchors" << "\\n" << param;
            anchors = param;
            break;
        }
    }
    return anchors;
}
\`\`\`

### Create Simple Layers in Libtorch

In the sequel we assume in our namespace:

\`\`\`cpp
using namespace torch;
\`\`\`

#### nn::Conv2d

\`\`\`cpp
nn::Conv2d(nn::Conv2dOptions(in_channels, out_channels, kernel_size)
               .stride(stride)
               .padding(padding)
               .groups(in_channels)
               .bias(true)),
\`\`\`

#### nn::MaxPool2d

\`\`\`cpp
nn::MaxPool2d(nn::MaxPool2dOptions({ kernel_size1, kernel_size2 }.stride({ 2, 2 })));
\`\`\`

#### nn::functional::pad

\`\`\`cpp
h = nn::functional::pad(x, nn::functional::PadFuncOptions({ 0, 2, 0, 2 }).value(0));
\`\`\`

### Create Multi-Dimensional Array in Libtorch

#### Create \`torch::Tensor\` from raw 2d-Array

\`\`\`cpp
float matrix[2][4] = {
    { 1, 1, 1, 1 },
    { -1, 0, 2, 3 }
};

torch::Tensor result = torch::from_blob(matrix, { 2, 4 }).toType(torch::kFloat32);
std::cout << " result[0][1]" << result[0][1] << std::endl;

float data = 0;
torch::Tensor y = torch::from_blob(&data, { 1 }).toType(torch::kFloat32);
std::cout << "y: " << y << std::endl;
\`\`\`

- \`float\` cannot be replaced by \`int\` as otherwise there will be numerical error in data conversion.
- The size of the tensor can be accessed by \`auto sizes = y.sizes()\`. The size of each dim can be accessed by index operator \`sizes[i]\`.

#### Create \`torch::Tensor\` from \`cv::Mat\`

\`\`\`cpp
torch::Tensor result = torch::from_blob(mat.data, { 1, height, width, 3 }, torch::kByte)
                           .permute({ 0, 3, 1, 2 })
                           .toType(torch::kFloat32);
result.div_(255.0);
\`\`\`

#### Create \`cv::Mat\` from \`torch::Tensor\`

\`\`\`cpp
cv::Mat from_tensor_to_mat = cv::Mat(
    h,
    w,
    CV_32FC3,
    img3.permute({ 0, 2, 3, 1 }).squeeze(0).data_ptr()
);
\`\`\`

- If A_tensor is 3-dimensional in channel, we need \`CV_32FC3\`, similarly if a tensor 1-dimensional in channel we need \`CV_32FC1\`.

### Validate a Libtorch Model is Compatible (in weight) to a Pytorch Model.

#### Custom \`nnModule::load_parameters\` and \`nnModule::print_parameters\`

Essentially this will replace all \`torch::nn::module\`.

##### Header

\`\`\`cpp
class nnModule : public nn::Module
{
public:
    std::vector<char> get_the_bytes(std::string filename);
    void load_parameters(std::string pt_pth);
    void print_parameters(std::string file_path, bool with_weight = false);
};
\`\`\`

##### Source

\`\`\`cpp
std::vector<char> nnModule::get_the_bytes(std::string filename)
{
    std::ifstream input(filename, std::ios::binary);
    std::vector<char> bytes(
        (std::istreambuf_iterator<char>(input)),
        (std::istreambuf_iterator<char>()));

    input.close();
    return bytes;
}

void nnModule::load_parameters(std::string pt_pth)
{
    std::vector<char> f               = this->get_the_bytes(pt_pth);
    c10::Dict<IValue, IValue> weights = torch::pickle_load(f).toGenericDict();

    const torch::OrderedDict<std::string, at::Tensor>& model_params = this->named_parameters();
    std::vector<std::string> param_names;
    for (auto const& w : model_params)
    {
        param_names.push_back(w.key());
    }

    torch::NoGradGuard no_grad;
    for (auto const& w : weights)
    {
        std::string name = w.key().toStringRef();
        at::Tensor param = w.value().toTensor();

        if (std::find(param_names.begin(), param_names.end(), name) != param_names.end())
        {
            auto target_model_param = model_params.find(name);

            for (int i = 0; i < target_model_param->sizes().size(); i++)
            {
                assert(target_model_param->sizes()[i] == param.sizes()[i]);
            }

            target_model_param->copy_(param);
        }
        else
        {
            std::cout << name << " does not exist among model parameters." << std::endl;
        };
    }
}

void nnModule::print_parameters(std::string file_path, bool with_weight)
{

    std::ostringstream oss;

    for (const auto& pair : named_parameters())
    {
        oss << "[" << pair.key() << "] ";
        int shape_arr_size = pair.value().sizes().size();

        std::string size_tuple_str = "torch.Size([";
        for (int i = 0; i < shape_arr_size; i++)
        {
            std::string curr_dim_len = std::to_string(pair.value().sizes()[i]);
            size_tuple_str += curr_dim_len;
            if (i != (shape_arr_size - 1))
            {
                size_tuple_str += ", ";
            }
        }
        size_tuple_str += "])";

        oss << size_tuple_str << "\\n";

        if (with_weight)
        {
            oss << pair.value()
                << "\\n"
                << "---------------"
                << "\\n";
        }
    }

    std::ofstream file;
    file.open(file_path);
    try
    {
        file << oss.str();
    }
    catch (std::exception err)
    {
        std::cout << err.what() << std::endl;
    }
    file.close();
}
\`\`\`

##### Dual Functions in Python for Comparison

\`\`\`python
def save_model(model_, des_weight_path):
    w = {k: v for k, v in model_.state_dict().items()}
    torch.save(w, des_weight_path)


def print_weight_list(model_, des_txt_filepath, with_weight=False):
    with open(des_txt_filepath, "w+") as f_handle:

        txt = ""
        for name, param in model_.named_parameters():
            txt += "[{}] {}\\n".format(name, param.shape)
            if with_weight:
                txt += str(param.numpy())
                txt += "\\n" + "---------------" + "\\n"

        f_handle.write(txt)
\`\`\`

#### Example

For example, in this [repository](https://github.com/machingclee/2023-01-25-ImGui-barebone-windows-blazeface-integrated/tree/main/mediapipe_libtorch/src/mediapipe_libtorch?fbclid=IwAR1komT77la5Eah9i9zRIE0LrvkLv2XEU4XNi06ogIy0KN1qnzh8wh3T4pk) my modules are all inherited publicly from \`nnModule\` defined above, therefore we can

- **On Libtorch Side.**

\`\`\`cpp
face_detector->print_parameters(des_str)
\`\`\`

- **On Pytorch Side.**

\`\`\`python
print_weight_list(face_detector, des_str)
\`\`\`

with \`with_weight = false\` by default (you can set it \`true\` if you want to further debug the libtorch model, but the file will become very large and unreadable).

These two functions are designed to output the same result:

\`\`\`text
[backbone1.0.weight] torch.Size([24, 3, 5, 5])
[backbone1.0.bias] torch.Size([24])
[backbone1.2.convs.0.weight] torch.Size([24, 1, 3, 3])
[backbone1.2.convs.0.bias] torch.Size([24])
[backbone1.2.convs.1.weight] torch.Size([24, 24, 1, 1])
[backbone1.2.convs.1.bias] torch.Size([24])
[backbone1.3.convs.0.weight] torch.Size([24, 1, 3, 3])
...
\`\`\`

When two files are exactly the same, we are confident that the pytorch weight can be applied to libtorch model as well.

### Create a Custom Module and Register Sub-modules in Practice

#### Register Tensors form Pytorch to Libtorch

##### Parameters

The following are equivalent:

\`\`\`python
class Net(torch.nn.Module):
  def __init__(self, N, M):
    super(Net, self).__init__()
    self.W = torch.nn.Parameter(torch.randn(N, M))
    self.b = torch.nn.Parameter(torch.randn(M))

  def forward(self, input):
    return torch.addmm(self.b, input, self.W)
\`\`\`

\`\`\`cpp
class Net : torch::nn::Module
{
    torch::Tensor W, b;
public:
    Net(int64_t N, int64_t M)
    {
        W = register_parameter("W", torch::randn({N, M}));
        b = register_parameter("b", torch::randn(M));
    }
    torch::Tensor forward(torch::Tensor input)
    {
        return torch::addmm(b, input, W);
    }
};
\`\`\`

##### Modules

The following are equivalent:

\`\`\`python
class Net(torch.nn.Module):
  def __init__(self, N, M):
      super(Net, self).__init__()
      # Registered as a submodule behind the scenes
      self.linear = torch.nn.Linear(N, M)
      self.another_bias = torch.nn.Parameter(torch.rand(M))

  def forward(self, input):
    return self.linear(input) + self.another_bias
\`\`\`

\`\`\`cpp
class Net : torch::nn::Module
{
    torch::nn::Linear linear;
    torch::Tensor another_bias;
public:
    Net(int64_t N, int64_t M) : {
        linear = register_module("linear", torch::nn::Linear(N, M));
        another_bias = register_parameter("b", torch::randn(M));
    }
    torch::Tensor forward(torch::Tensor input) {
        return linear->forward(input) + another_bias;
    }
};
\`\`\`

#### Real Example in Practice

##### Rules

- In libtorch all modules are created by producing a \`shared_ptr\` pointing to an \`nn::Module\`.
- For example, \`auto net1 = nn::Conv2d(...)\` and \`auto net2 = nn::Relu(...)\` are both pointers.
- \`nn::Sequential()\` only accepts smart pointers like \`nn::Sequential(net1, net2)\`.

For custom module, we can create such a pointer-factory by \`TORCH_MODULE\` macro. The principles are

- For module just for internal use, we simply leave it as an \`nn::Module\` object.
- For module that is going to be exposed to user, we write \`NetImpl\` and use \`TORCH_MODULE(Net)\` to create a special pointer class \`Net\`.

##### BlazeBlock from mediapipe's BlazeFace

\`\`\`cpp
// header file
class BlazeBlockImpl : public nnModule
{
protected:
    int in_channels;
    int out_channels;
    int kernel_size;
    int stride;
    std::string act;
    nn::Conv2d skip_proj = nullptr;
    int channel_pad;
    int padding;
    nn::Sequential convs   = nullptr;
    nn::MaxPool2d max_pool = nullptr;
    std::variant<nn::ReLU, nn::PReLU> act_layer;
    bool use_skip_proj = false;

public:
    BlazeBlockImpl(
        int in_channels,
        int out_channels,
        int kernel_size    = 3,
        int stride         = 1,
        std::string act    = "relu",
        bool use_skip_proj = false);
    torch::Tensor forward(torch::Tensor x);
};

TORCH_MODULE(BlazeBlock);
\`\`\`

\`\`\`cpp
// source file
BlazeBlockImpl::BlazeBlockImpl(
    int in_channels,
    int out_channels,
    int kernel_size,
    int stride,
    std::string act,
    bool use_skip_proj) : in_channels(in_channels),
                          out_channels(out_channels),
                          kernel_size(kernel_size),
                          stride(stride),
                          act(act),
                          use_skip_proj(use_skip_proj)
{
    channel_pad = out_channels - in_channels;
    if (stride == 2)
    {
        max_pool = nn::MaxPool2d(nn::MaxPool2dOptions({ stride, stride }));
        padding  = 0;
    }
    else
    {
        padding = (int)((kernel_size - 1) / 2);
    }

    nn::Sequential convs_ = nn::Sequential();
    convs_->push_back(nn::Conv2d(nn::Conv2dOptions(in_channels, in_channels, kernel_size)
                                      .stride(stride)
                                      .padding(padding)
                                      .groups(in_channels)
                                      .bias(true)));
    convs_->push_back(nn::Conv2d(nn::Conv2dOptions(in_channels, out_channels, 1)
                                      .stride(1)
                                      .padding(0)
                                      .bias(true)));

    convs = register_module("convs", convs_);

    if (use_skip_proj)
    {
        skip_proj = register_module(
            "skip_proj",
            nn::Conv2d(nn::Conv2dOptions(in_channels, out_channels, 1)
                            .stride(1)
                            .padding(0)
                            .bias(true)));
    }
    else
    {
        skip_proj = nullptr;
    }

    if (act == "relu")
    {
        act_layer = nn::ReLU(nn::ReLUOptions(true));
    }
    else if ("prelu")
    {
        act_layer = register_module(
            "act",
            nn::PReLU(nn::PReLUOptions().num_parameters(out_channels))
        );
    }
    else
    {
        throw std::exception("activation layer not implemented.");
    }
}

torch::Tensor BlazeBlockImpl::forward(torch::Tensor x)
{
    torch::Tensor h;
    if (stride == 2)
    {
        if (kernel_size == 3)
        {
            h = nn::functional::pad(x, nn::functional::PadFuncOptions({ 0, 2, 0, 2 }).value(0));
        }
        else
        {
            h = nn::functional::pad(x, nn::functional::PadFuncOptions({ 1, 2, 1, 2 }).value(0));
        }
        x = this->max_pool(x);
    }
    else
    {
        h = x;
    }

    if (skip_proj)
    {
        x = skip_proj->forward(x);
    }
    else if (channel_pad > 0)
    {
        x = nn::functional::pad(
            x, n
            n::functional::PadFuncOptions({ 0, 0, 0, 0, 0, channel_pad }).value(0)
        );
    }

    torch::Tensor y = convs->forward(h) + x;
    // y = reinterpret_cast<IHasForward*>(&act_layer)->forward(y);
    // I want to avoid the following:

    if (auto act_layer_ptr = std::get_if<nn::ReLU>(&act_layer))
    {
        y = (*act_layer_ptr)->forward(y);
    }
    else if (auto act_layer_ptr = std::get_if<nn::PReLU>(&act_layer))
    {
        y = (*act_layer_ptr)->forward(y);
    }

    return y;
};
\`\`\`

### OpenCV

#### Load an Image

\`\`\`cpp
cv::Mat img = cv::imread(img_path, cv::IMREAD_COLOR);
\`\`\`

#### Write a \`cv::Mat\` into an Image

\`\`\`cpp
cv::imwrite(image_path, img1);
\`\`\`

#### Resize an Image

\`\`\`cpp
cv::Mat img1;
//         src, des           int, int
cv::resize(img, img1, cv::Size(w1, h1));
\`\`\`

#### Pad an Image

\`\`\`cpp
cv::Mat img1_;
cv::copyMakeBorder(
    img1,                 // src
    img1_,                // des
    padh1,                // top
    padh2,                // bottom
    padw1,                // left
    padw2,                // right
    cv::BORDER_CONSTANT,
    cv::Scalar(0)
);
\`\`\`

#### COLOR_BGR2RGB

\`\`\`cpp
cv::cvtColor(frame, frame, cv::COLOR_BGR2RGB);
\`\`\`

#### Drawing

\`\`\`cpp
cv::circle(frame, cv::Point2i({ x, y }), size, color, size);
cv::line(
    frame,
    cv::Point2i({ x0, y0 }),
    cv::Point2i({ x1, y1 }),
    cv::Scalar({ 0, 0, 0 }),
    size
);
\`\`\`

#### Read from Camera

\`\`\`cpp
cv::VideoCapture capture(1);
cv::Mat frame;

if (!capture.isOpened())
{
    throw std::exception("Unable to open camera.");
}

while (true)
{
    capture.read(frame);
    if (frame.empty())
    {
        throw std::exception("Blank frame grabbed.");
    }
    assert(frame.channels() == 3);
    ...
}
\`\`\`
`;export{n as default};
