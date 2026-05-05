const e=`---
title: "Custom BottomSheet"
date: 2023-10-03
id: blog0188
tag: react-native
intro: "We build our own bottom sheet."
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

### Result

<center>
  <video controls width="400">
    <source  src="/assets/tech/188/001.MP4" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  </video>
</center>

### Code Implementation

As usual code implementation is a mess of ad-hoc detail, but the usage is very simple!

\`\`\`js
import { ReactNode, forwardRef, useImperativeHandle } from "react";
import Animated, { useAnimatedGestureHandler, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useHeaderHeight, } from '@react-navigation/elements';
import Constants from 'expo-constants';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from "react-native-gesture-handler";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";

const { height } = Dimensions.get("window");

export type BottomSheetHandle = {
  show: () => void;
  close: () => void;
}

export type BottomSheetProps = {
  component: ReactNode,
  maxHeight?: number
}

const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>((props, ref) => {
  const bottomSheetShiftY = useSharedValue(0);
  const headerHeight = useHeaderHeight();
  const statusbarHeight = Constants.statusBarHeight;
  const topHeaderHeight = headerHeight + statusbarHeight
  const screenHeight = height - topHeaderHeight;
  const { maxHeight = screenHeight * 9 / 10 } = props;

  const show = () => {
    bottomSheetShiftY.value = withSpring(-maxHeight / 2)
  }
  const close = () => {
    bottomSheetShiftY.value = withTiming(0);
  }
  useImperativeHandle(ref, () => ({
    show,
    close,
  }))

  const bottomSheetClampedY = useDerivedValue(() => {
    return Math.max(-maxHeight, Math.min(screenHeight, bottomSheetShiftY.value));
  })


  const sheetRstyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: bottomSheetClampedY.value }]
    }
  })

  const backdropRstyle = useAnimatedStyle(() => {
    return {
      opacity: - bottomSheetClampedY.value / screenHeight
    }
  })

  const panHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { translationY: number }>({
    onStart: (event, context) => {
      context.translationY = bottomSheetShiftY.value;
    },
    onActive: (event, context) => {

      bottomSheetShiftY.value = context.translationY + event.translationY;
    },
    onEnd: (event) => {
      console.log(event.absoluteY, maxHeight);

      if (event.absoluteY > maxHeight * 1.5) {
        bottomSheetShiftY.value = withTiming(0);
      } else {
        bottomSheetShiftY.value = withTiming(-maxHeight);
      }
    }
  });

  const bottomsheetRstyle = useAnimatedStyle(() => {
    if (bottomSheetShiftY.value < 0) {
      return { height: screenHeight };
    } else {
      return { height: 0 };
    }
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { zIndex: 2 }, bottomsheetRstyle]}>
      <PanGestureHandler onGestureEvent={panHandler}>
        <Animated.View style={StyleSheet.absoluteFillObject}>
          <Animated.View style={[
            StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.6)" },
            backdropRstyle,
          ]} />
          <TouchableOpacity
            onPress={() => { bottomSheetShiftY.value = withTiming(0) }}
            style={[StyleSheet.absoluteFillObject, { width: "100%", height: "100%" }]}
          />
          <Animated.View style={[
            {
              position: "absolute",
              width: "100%",
              height: "100%",
              backgroundColor: "white",
              top: screenHeight,
              borderRadius: 10,
              overflow: "hidden"
            },
            sheetRstyle
          ]}>
            <Animated.View style={[
              { width: "100%", flexDirection: "row", justifyContent: "center", paddingTop: 15 },
            ]}>
              <View style={[
                { width: 50, height: 4, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 2 },
              ]} />
            </Animated.View>

            <View style={{ marginTop: 20 }}>
              {props.component}
            </View>
          </Animated.View>

        </Animated.View>
      </PanGestureHandler>
    </Animated.View>
  )
})

export default BottomSheet;
\`\`\`

### Usage

\`\`\`js
const playground = () => {
  const ref = useRef < BottomSheetHandle > null;
  const showBottomSheet = () => {
    ref.current?.show();
  };
  return (
    <View
      style={{
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <TouchableOpacity onLongPress={showBottomSheet} delayLongPress={1000}>
        <Text style={{ padding: 20, borderWidth: 1 }}>Test</Text>
      </TouchableOpacity>
      <BottomSheet
        component={
          <>
            <Text>This is my nice Test</Text>
          </>
        }
        ref={ref}
        maxHeight={400}
      />
    </View>
  );
};
\`\`\`
`;export{e as default};
