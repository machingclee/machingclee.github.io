const n=`---
title: Colab Setting
date: 2021-08-27
id: blog0019
tags: coding, deep-learning, python
intro: Basic command needed to mount a google drive and also to unzip compressed large dataset.
---

### Google Drive Mounting

\`\`\`python
from google.colab import drive
drive.mount('/content/drive')
\`\`\`

Now we can work on colab as in we are working in local environment.

### Unzip Files

Now you can \`cd\` into your working directory. For me:

\`\`\`python
! cd '/content/drive/My Drive/Colab Notebooks/cycleGAN-tensorflow'
\`\`\`

Inside \`cycleGAN-tensorflow\` I have a compressed file called \`horse2zebra.zip\`. We can now unzip it by

\`\`\`python
!unzip horse2zebra.zip
\`\`\`

which will create a new folder called \`horse2zebra\` and decompress your files into it.
`;export{n as default};
