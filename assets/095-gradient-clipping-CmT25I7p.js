const n=`---
title: Gradient Clipping
date: 2022-09-22
id: blog095
tag: deep-learning, pytorch
toc: false
intro: Record a script to clip gradient to avoid graident explosion.
---

\`\`\`python
# model is the nn.Module object that we are going to train:
torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clipping_thres)
\`\`\`
`;export{n as default};
