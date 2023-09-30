---
title: "Clone a Swipable Page Inspired from Discord Mobile App"
date: 2023-09-30
id: blog0185
tag: react-native
intro: "We can create our custom component by creating custom behaviour via customizing animtation!"
toc: true
---

#### Result Demonstration

<center>
  <video controls width="500">
    <source  src="/assets/tech/185/001.mp4" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  <video/>
</center>



#### Code Implementation

```js
import { View, Text, Dimensions, StyleSheet } from 'react-native'
import React, { useState } from 'react'
import Animated, { Extrapolate, cancelAnimation, interpolate, useAnimatedGestureHandler, useAnimatedScrollHandler, useAnimatedStyle, useDerivedValue, useSharedValue, withDecay, withSpring, withTiming } from 'react-native-reanimated';
import { PanGestureHandler, PanGestureHandlerGestureEvent, PinchGestureHandler, PinchGestureHandlerGestureEvent } from "react-native-gesture-handler";
const {  width } = Dimensions.get("window");

const bound = 40;
const returnCenterRange = width * 3 / 4

const playground = () => {
    const translateX = useSharedValue(0);
    const [underlyingPage, setUnderlyingPage] = useState<"" | "left" | "right">("");
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

export default playground;
```