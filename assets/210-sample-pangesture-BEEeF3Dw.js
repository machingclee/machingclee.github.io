const n=`---
title: "Make a Custom Swipable Item"
date: 2023-11-05
id: blog0210
tag: react-native
intro: "Record a pan guesture component that can swipe an item to show hidden buttons"
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

<Center></Center>

### Result


<center>
  <video controls width="300">
    <source  src="/assets/tech/211/01.MP4" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  </video>
</center>


### Usage


Since we are going to animate the height when we delete the item, we need to provide it explicitly.

\`\`\`js
<Swipe
    ref={swipeRef}
    height={SELECTION_DEAULT_HEIGHT}
    containerStyle={{
        height: SELECTION_DEAULT_HEIGHT,
        borderColor: "rgba(0,0,0,0.2)",
    }}
    middle={{ component: roomSelection() }}
    right={{ component: sendReportAndEditButton(), width: 165 }}
/>
\`\`\`

### Code Implmentation

This is a component that I made in the past:

\`\`\`js
import { ReactNode, forwardRef, useImperativeHandle } from "react";
import { View } from "react-native";
import { PanGestureHandler, PanGestureHandlerGestureEvent } from "react-native-gesture-handler";
import Animated, {
    useAnimatedGestureHandler,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withDelay,
    withTiming
} from "react-native-reanimated";
import { ViewProps } from "react-native-svg/lib/typescript/fabric/utils";

export type SwipeHandle = {
    deleteItemAnimation: () => void,
    returnCenter: () => void,
}

type SwipeProps = {
    height: number,
    left?: { component: ReactNode, width: number }
    middle: { component: ReactNode },
    right?: { component: ReactNode, width: number }
    containerStyle?: ViewProps["style"]
}

const Swipe = forwardRef<SwipeHandle, SwipeProps>((props, ref) => {
    const { height, left, middle, right, containerStyle } = props;
    const translateX = useSharedValue(0);
    const containerOpacity = useSharedValue(1);
    const containerHeight = useSharedValue(height || 0);

    const deleteItemAnimation = () => {
        translateX.value = withTiming(0, { duration: 100 });
        containerOpacity.value = withTiming(0);
        containerHeight.value = withDelay(0, withTiming(0));
    }

    const returnCenter = () => {
        translateX.value = withTiming(0);
    }

    useImperativeHandle(ref, () => ({
        deleteItemAnimation,
        returnCenter
    }))

    const containerRstyle = useAnimatedStyle(() => {
        return {
            opacity: containerOpacity.value,
            height: containerHeight.value,
            transform: [{ translateX: translateX.value }]
        }
    })
    const enclosedButtonOpacity = useDerivedValue(() => {
        if (translateX.value < 0) {
            return Math.abs(translateX.value / (right?.width || 1));
        } else {
            return Math.abs(translateX.value / (left?.width || 1));
        }
    })

    const hiddenRightButtonRStyles = useAnimatedStyle(() => {
        return {
            opacity: enclosedButtonOpacity.value
        }
    })

    const panGeatureEvent = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { translateX: number }>({
        onStart: (e, ctx) => {
            ctx.translateX = translateX.value;
        },
        onActive: (e, ctx) => {
            translateX.value = Math.max(Math.min(ctx.translateX + e.translationX, left?.width || 0), -(right?.width || 0));
        },
        onEnd: (e, ctx) => {
            if (e.translationX * ctx.translateX < 0) {
                translateX.value = withTiming(0);
            }
            else if (e.translationX > 0) {
                translateX.value = withTiming(left?.width || 0);
            }
            else if (translateX.value < 0) {
                translateX.value = withTiming(-(right?.width || 0));
            }
            else {
                translateX.value = withTiming(0);
            }
        }
    });

    const rightHiddenButton = () => {
        return (
            <Animated.View style={[{
                position: "absolute",
                top: 0,
                right: 0,
                height: "100%",
                justifyContent: "center",
                flexDirection: "row",
            }, hiddenRightButtonRStyles]}>
                {right?.component}
            </Animated.View>
        )
    }

    const leftHiddenButton = () => {
        return (
            <Animated.View style={[{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                justifyContent: "center"
            }, hiddenRightButtonRStyles]}>
                {left?.component}
            </Animated.View>
        )
    }

    return (
        <View style={[{ position: "relative", }, containerStyle || {}]} >
            {leftHiddenButton()}
            {rightHiddenButton()}
            <PanGestureHandler onGestureEvent={panGeatureEvent} activeOffsetX={[-10, 10]}>
                <Animated.View style={[
                    {
                        width: "100%",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                    },
                    containerRstyle]
                }>
                    {middle.component}
                </Animated.View>
            </PanGestureHandler>
        </View>
    )
});

export default Swipe;
\`\`\`
`;export{n as default};
