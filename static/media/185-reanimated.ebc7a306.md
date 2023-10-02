---
title: "Clone a Swipable Page Inspired from Discord Mobile App"
date: 2023-09-26
id: blog0185
tag: react-native
intro: "We can create our custom component by creating custom behaviour via customizing animtation!"
toc: true
---


<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

#### Result

<center>
  <video controls width="500">
    <source  src="/assets/tech/185/001.mp4" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  <video/>
</center>

#### Code Implementation

```js
import { View, Text, Dimensions, StyleSheet } from 'react-native'
import Animated, { cancelAnimation, useAnimatedGestureHandler, useAnimatedStyle, useDerivedValue, useSharedValue, withDecay, withTiming } from 'react-native-reanimated';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from "react-native-gesture-handler";
const { width } = Dimensions.get("window");


const bound = 40;
const returnCenterRange = width * 3 / 4

const playground = () => {
    const translateX = useSharedValue(0);
    const clampedX = useDerivedValue(() => {
        return Math.min(Math.max(-width + bound, translateX.value), width - bound);
    })

    const leftpageRStyle = useAnimatedStyle(() => {
        if (clampedX.value > 0) {
            return { zIndex: 1 };
        } else {
            return { zIndex: 0 };
        }
    })

    const rightpageRStyle = useAnimatedStyle(() => {
        if (clampedX.value > 0) {
            return { zIndex: 0 };
        } else {
            return { zIndex: 1 };
        }
    })

    const panGestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { translateX: number }>({
        onStart: (event, context) => {
            context.translateX = clampedX.value;
            cancelAnimation(translateX);
        },
        onActive: (event, context) => {
            translateX.value = context.translateX + event.translationX;

        },
        onEnd: (event, context) => {
            translateX.value = withDecay({ velocity: event.velocityX });
            if (context.translateX === 0) {
                if (event.translationX > 0) {
                    translateX.value = withTiming(width);
                }
                else if (event.translationX < 0) {
                    translateX.value = withTiming(-width);
                }
            } else {
                if (Math.abs(event.translationX) < returnCenterRange && (context.translateX * event.translationX < 0)) {
                    console.log("event.translationX", event.translationX)
                    console.log("context.translateX", context.translateX)
                    translateX.value = withTiming(0);
                }
            }
        }
    });

    const rstyle = useAnimatedStyle(() => {
        return { transform: [{ translateX: clampedX.value }] }
    });

    return (
        <View style={{ flex: 1 }}>
            <PanGestureHandler onGestureEvent={panGestureHandler}>
                <Animated.View style={[{ ...StyleSheet.absoluteFillObject }]}>
                    <Animated.View style={[{
                        ...StyleSheet.absoluteFillObject, flex: 1, flexDirection: "row", zIndex: 2, backgroundColor: "#CBE6F7",
                    }, rstyle]}>
                        <View style={{ width, justifyContent: "center", alignItems: "center" }}>
                            <Text>Center Page</Text>
                        </View>
                    </Animated.View>


                    <Animated.View style={[{
                        ...StyleSheet.absoluteFillObject, flex: 0, zIndex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white",

                    }, leftpageRStyle]}>
                        <Text>
                            Left Page
                        </Text>
                    </Animated.View>

                    <Animated.View style={[{ ...StyleSheet.absoluteFillObject, flex: 0, zIndex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white" }, rightpageRStyle]}>
                        <Text>
                            Right Page
                        </Text>
                    </Animated.View>
                </Animated.View>
            </PanGestureHandler>
        </View >
    )
}

export default playground
```

#### Abstract into a Reusable Component

##### Implementation

```js
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native'
import { ReactNode, forwardRef, useImperativeHandle } from 'react'
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withTiming
} from 'react-native-reanimated';
import panGesTranslationUtil from '../util/panGesTranslationUtil';
const { width } = Dimensions.get("window");

export type TrinityHandle = {
  returnCenter: () => void
}

export type TrinityProps = {
  remainingWidth?: number
  left?: ReactNode,
  middle: ReactNode,
  right?: ReactNode
}

const TrinityPage = forwardRef<TrinityHandle, TrinityProps>((props, ref) => {
  const translateX = useSharedValue(0);
  const returnCenter = () => {
    translateX.value = withTiming(0);
  }

  const returnCenterRange = width * 4 / 5

  const { left, middle, right, remainingWidth = 40 } = props;

  const clampedX = useDerivedValue(() => {
    if (!right) {
      return panGesTranslationUtil.clampX(translateX, 0, width - remainingWidth);
    }
    else if (!left) {
      return panGesTranslationUtil.clampX(translateX, width - remainingWidth, 0);
    } else {
      return panGesTranslationUtil.clampX(translateX, width - remainingWidth, width - remainingWidth);
    }
  })

  useImperativeHandle(ref, () => ({
    returnCenter
  }));

  const leftpageRStyle = useAnimatedStyle(() => {
    if (clampedX.value > 0) {
      return { zIndex: 1 };
    } else {
      return { zIndex: 0 };
    }
  })

  const rightpageRStyle = useAnimatedStyle(() => {
    if (clampedX.value > 0) {
      return { zIndex: 0 };
    } else {
      return { zIndex: 1 };
    }
  })

  const panGestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { translateX: number }>({
    onStart: (event, context) => {
      context.translateX = clampedX.value;
      cancelAnimation(translateX);
    },
    onActive: (event, context) => {
      translateX.value = context.translateX + event.translationX;

    },
    onEnd: (event, context) => {
      translateX.value = withDecay({ velocity: event.velocityX });
      if (context.translateX === 0) {
        if (event.translationX > 0) {
          translateX.value = withTiming(width);
        }
        else if (event.translationX < 0) {
          translateX.value = withTiming(-width);
        }
      } else {
        if (Math.abs(event.translationX) < returnCenterRange && (context.translateX * event.translationX < 0)) {
          console.log("event.translationX", event.translationX)
          console.log("context.translateX", context.translateX)
          translateX.value = withTiming(0);
        }
      }
    }
  });

  const rstyle = useAnimatedStyle(() => {
    return { transform: [{ translateX: clampedX.value }] }
  });

  const backdropRStyle = useAnimatedStyle(() => {
    const opacity = 1 - ((width - remainingWidth) - clampedX.value) / (width - remainingWidth);
    return {
      opacity: opacity,
      zIndex: opacity === 0 ? -1 : 3
    }
  })

  const backDrop = (
    <Animated.View
      style={[
        { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)" },
        backdropRStyle
      ]}>
      <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject }} onPress={returnCenter} />
    </Animated.View>)

  return (
    <View style={{ flex: 1 }}>
      <PanGestureHandler onGestureEvent={panGestureHandler} activeOffsetX={[-10, 10]}>
        <Animated.View style={[{ ...StyleSheet.absoluteFillObject }]}>

          <Animated.View style={[{
            ...StyleSheet.absoluteFillObject, flex: 1,
            flexDirection: "row",
            zIndex: 2,
            backgroundColor: "#CBE6F7",
          }, rstyle]}>
            <View style={{ width }}>
              {middle}
            </View>
            {backDrop}
          </Animated.View>


          {left && <Animated.View style={[
            {
              ...StyleSheet.absoluteFillObject,
              flex: 0,
              zIndex: 1,
              backgroundColor: "white",
              width

            },
            leftpageRStyle
          ]}>
            <View style={{ width: width - remainingWidth }}>
              {left}
            </View>
          </Animated.View>}

          {right && <Animated.View style={[
            {
              ...StyleSheet.absoluteFillObject,
              flex: 0,
              zIndex: 1,
              backgroundColor: "white",
              width,
              alignItems: "flex-end"
            },
            rightpageRStyle
          ]}>
            <View style={{ width: width - remainingWidth }}>
              {right}
            </View>
          </Animated.View>
          }
        </Animated.View>
      </PanGestureHandler>
    </View >
  )
});

export default TrinityPage
```

##### Visual Example

<center>
  <video controls width="500">
    <source  src="/assets/tech/185/002.mov" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  <video/>
</center>

```js
import { Stack, useRouter, } from "expo-router"
import { useRef } from "react";
import TrinityPage, { TrinityHandle } from "../../components/TrinityPage";
import { FlatList } from "react-native-gesture-handler";
import { Text, TouchableOpacity, View } from "react-native";
import uuid from "react-native-uuid";
import Spacer from "../../components/Spacer";


const playgroundList = [
    "/(reanimated-practice)/001",
    "/(reanimated-practice)/003",
    "/(reanimated-practice)/005",
]


const PLAYGROUND_LIST = playgroundList.map(url => {
    return {
        url: url,
        title: url.replace("/(reanimated-practice)/", ""),
        id: uuid.v4() as string
    }
})

const Layout = () => {
    const ref = useRef<TrinityHandle>(null);
    const router = useRouter();
    const leftPlaygroundList = (
        <>
            <View style={{ height: "100%" }}>
                <Text>test</Text>
                <Spacer height={20} />
                <FlatList
                    data={PLAYGROUND_LIST}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => {
                        return (
                            <TouchableOpacity onPress={() => {
                                router.push(item.url as any);
                                ref.current?.returnCenter();
                            }}>
                                <View style={{ padding: 10, }}>
                                    <Text>Playground-{item.title} </Text>
                                </View>
                            </TouchableOpacity>
                        )
                    }}
                />
            </View>
        </>
    )
    return (
        <TrinityPage
            ref={ref}
            remainingWidth={100}
            left={leftPlaygroundList}
            middle={<Stack />}
        />
    )
}

export default () => {
    return <Layout />
}
```
