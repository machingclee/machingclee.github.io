const n=`---
title: "std::variant"
date: 2023-04-05
id: blog0129
tag: C++
intro: "In typescript we have \`type A = B | C\`, we also have an analogue in C++."
toc: false
---

Sometime it is helpful to create a type that accept both class \`A\` and class \`B\`.
A real example from deep learning is:

\`\`\`cpp
// header file
class BlazeBlockImpl : public nnModule
{
protected:
    ...
    std::variant<nn::ReLU, nn::PReLU> act_layer;
    ...
}
\`\`\`

and we assign this \`act_layer\` in constructor

\`\`\`cpp
// source file
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
\`\`\`

depending on a variable \`act\` passed into this constructor. This \`std::variant\` serves as the same purpose of union type in typescript (note!! \`union\` is a special keyword in C++ and does not work in the same way as typescript).

Special type-checking will be needed to apply \`act_layer\` to a tensor, for this we separate \`act_layer\` into two cases:

\`\`\`cpp
torch::Tensor y = ...;
if (auto act_layer_ptr = std::get_if<nn::ReLU>(&act_layer))
{
    y = (*act_layer_ptr)->forward(y);
}
else if (auto act_layer_ptr = std::get_if<nn::PReLU>(&act_layer))
{
    y = (*act_layer_ptr)->forward(y);
}
\`\`\`

That's how \`std::variant\` work.
`;export{n as default};
