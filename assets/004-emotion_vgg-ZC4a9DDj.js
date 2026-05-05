const n=`---
id: portfolio004
title: Emotion Detection by EmotionVGG Net
intro: A trial to build AI application on video.
thumbnail: /assets/portfolios/thumbnails/emotion.png
tech: Python, Tensorflow
thumbWidth: 320 
thumbTransX: 16
thumbTransY: -12
hoverImageHeight: 220
date: 2020-12-29
---



### Repository
- https://github.com/machingclee/deep-learning-study/tree/main/2020-12-26-emotion-recognition


### Result
<center>
  <iframe width="560" height="315" src="https://www.youtube.com/embed/yG-P6H31RFc" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" frameBorder="0" allowFullScreen></iframe>
</center>
<p/>

**Intuition.** In *AlexNet* an image is fed into several convolutional layers with increasing filter depth and decreasing filter size (as the network goes deeper), and with spatial dimenion being resized just by max pooling layer, as in the following figure indicate:

<center>
<img src="/assets/tech/AlexNet.png"/ width="600"/>
</center>
<p/>

VGG net suggests almost the same structure, however, all layers of large filter size is replaced by a sequence of conv layers of filter size 3x3:

<center>
<img src="/assets/tech/VGG.jpg"/ width="600"/>
</center>
<p/>

For instance, a 5x5 conv layer "condenses 25 grid" into a singleton, which can also be done by applying two 3x3 conv layers (by stride 1 without padding), this also motivates the number of 3x3 conv layers used to replace the old 11x11 conv layer.

**EmotionVGGNet.** Our EmotionVGG Net is a simplified version of VGG Net, the network structure can be better explained by code than any picture:

\`\`\`python
class EmotionVGGNet:
    @staticmethod
    def build(width, height, depth, n_classes):
        inputShape = (height, width, depth)
        chanDim = -1
  
        if K.image_data_format() == "channels_first":
            inputShape = (depth, height, width)
            chanDim = 1
  
        input = Input(shape=inputShape)
  
        x = input
        # first block
        for _ in range(0, 2):
            x = Conv2D(32, (3, 3),  padding="same", kernel_initializer="he_normal")(x)
            x = ELU()(x)
            x = BatchNormalization(axis=chanDim)(x)
  
        x = MaxPooling2D(pool_size=(2, 2))(x)
        x = Dropout(0.25)(x)
  
        # second block
        for _ in range(0, 2):
            x = Conv2D(64, (3, 3), kernel_initializer="he_normal", padding="same")(x)
            x = ELU()(x)
            x = BatchNormalization(axis=chanDim)(x)
  
        x = MaxPooling2D(pool_size=(2, 2))(x)
        x = Dropout(0.25)(x)
  
        # third block
        x = Flatten()(x)
        for _ in range(0, 2):
            x = Dense(64, kernel_initializer="he_normal")(x)
            x = ELU()(x)
            x = BatchNormalization()(x)
            x = Dropout(0.5)(x)
  
        x = Dense(n_classes, kernel_initializer="he_normal")(x)
        x = Activation("softmax")(x)
  
        return Model(input, x)
\`\`\`

We train the model by using FER2013 dataset. After experiment I have decided to train for 100 epoches, adjusted learning rate 2 times when training loss and validation loss start to diverge (and retrain again by a linear decay in learning rate within this range), finally conclude that the weights at epoch 80 is the most suitable one (to prevent overfitting):


<center>
<img src="/assets/tech/vggnet_emotion-epoch80.png"/ width="600"/>
</center>
<p/>

At the end, we apply pretrained Haar cascade model given by openCV (weights that we load can be found here) to perform face detection and run model.predict on those rectangle per frame.
`;export{n as default};
