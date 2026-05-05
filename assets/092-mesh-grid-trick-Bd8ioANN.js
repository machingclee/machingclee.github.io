const n=`---
title: Mesh Grid Trick
date: 2022-09-07
id: blog092
tag: deep-learning, pytorch
toc: false
intro: Record a trick to create mesh grid coordinate.
---

The following

\`\`\`python
coords_h = torch.tensor([0, 1, 2])
coords_w = torch.tensor([0, 1, 2])
xys = torch.stack(torch.meshgrid(coords_h, coords_w)).flatten(1)
print(xys)
\`\`\`

gives

\`\`\`none
tensor([[0, 0, 0, 1, 1, 1, 2, 2, 2],
        [0, 1, 2, 0, 1, 2, 0, 1, 2]])
\`\`\`

Now we rearrange

\`\`\`python
xys = rearrange(xys, "i coord -> coord i")
print(xys)
\`\`\`

to get

\`\`\`none
tensor([[0, 0],
        [0, 1],
        [0, 2],
        [1, 0],
        [1, 1],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2]])
\`\`\`
`;export{n as default};
