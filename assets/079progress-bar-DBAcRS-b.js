const t=`---
title: "tqdm: The Progress bar for Iterations"
date: 2022-05-27
id: blog079
tag: python
intro: Record the use of a progress bar when using for loop, and record how to customize the output.
---

### Syntax

In training we can create a generator by \`data_gen = iter(dataloader)\`. By using \`tqdm\` we can create a progress bar to visuallize the progress of the current Epoch:

\`\`\`python
for ... in tqdm(data_gen,
                total=n_batches,
                desc="Epoch {}".format(epoch),
                bar_format=config.bar_format):
    ...
\`\`\`

- \`total\` Since generator cannot provide the total legnth, we must provide \`total\` as kwarg.
- Note that \`total\` depends on \`drop_last\` in \`DataLoader\` (in pytorch).
- \`desc\` is easy to understand.

### bar_format

The \`bar_format\` we use can be formatted by:

\`\`\`text
"{desc}: {percentage:.1f}%|{bar:15}| {n}/{total_fmt} [{elapsed}, {rate_fmt}{postfix}]"
\`\`\`

This will show the information as shown in the picture:

<center>
<a href="/assets/tech/053.png">
<img width="600" src="/assets/tech/053.png"/>
</a>
</center>
<p></p>
`;export{t as default};
