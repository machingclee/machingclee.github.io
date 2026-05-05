const n=`---
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

### Result

<center>
  <video controls width="400">
    <source  src="/assets/tech/185/001.mp4" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  </video>
</center>

### Code Implementation

\`\`\`js
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native'
import React, { ReactNode, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
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

export type TrinityProps = {
    remainingWidth?: number,
    backgroundColor?: string,
    left?: ReactNode,
    middle: ReactNode,
    right?: ReactNode
}

class Trinity {
    public turnLeft: () => void = () => { };
    public turnCenter: () => void = () => { };
    public turnRight: () => void = () => { };
    public enableScroll: () => void = () => { };
    public disableScroll: () => void = () => { };

    public instance = (props: TrinityProps) => {
        const { left, middle, right, remainingWidth = 40, backgroundColor = "#EBEBEB" } = props;
        const translateX = useSharedValue(0);
        const enabledScrollSharedValue = useSharedValue(1);
        const disableScroll = () => {
            enabledScrollSharedValue.value = 0
        }
        const enableScroll = () => {
            enabledScrollSharedValue.value = 1;
        }
        const turnLeft = () => {
            translateX.value = withTiming(width);
        }
        const turnCenter = () => {
            translateX.value = withTiming(0);
        }
        const turnRight = () => {
            translateX.value = withTiming(-width);
        }

        this.turnLeft = turnLeft;
        this.turnCenter = turnCenter;
        this.turnRight = turnRight;
        this.enableScroll = enableScroll;
        this.disableScroll = disableScroll;

        const returnCenterRange = width * 4 / 5

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

        const maxTranslateX = width - remainingWidth;
        const leftOpacity = useDerivedValue(() => {
            const scale = clampedX.value / maxTranslateX;
            if (clampedX.value > 0) {
                return Math.abs(scale)
            } else {
                return 0
            }
        })

        const rightOpacity = useDerivedValue(() => {
            const scale = clampedX.value / maxTranslateX;
            if (clampedX.value < 0) {
                return Math.abs(scale)
            } else {
                return 0
            }
        })


        const leftpageRStyle = useAnimatedStyle(() => {
            if (clampedX.value > 0) {
                return {
                    zIndex: 1,
                    opacity: leftOpacity.value
                };
            } else {
                return {
                    zIndex: 0,
                    opacity: 0,
                };
            }
        })

        const rightpageRStyle = useAnimatedStyle(() => {
            if (clampedX.value > 0) {
                return {
                    zIndex: 0,
                    opacity: 0
                };
            } else {
                return {
                    zIndex: 1,
                    opacity: rightOpacity.value
                };
            }
        })

        const panGestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, {
            translateX: number,
        }>({
            onStart: (event, context) => {
                context.translateX = clampedX.value;
                cancelAnimation(translateX);
            },
            onActive: (event, context) => {
                if (enabledScrollSharedValue.value === 0) {
                    return;
                }
                translateX.value = context.translateX + event.translationX;
            },
            onEnd: (event, context) => {
                if (enabledScrollSharedValue.value === 0) {
                    return;
                }
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
                        translateX.value = withTiming(0);
                    }
                }
            }
        });

        const middleRstyle = useAnimatedStyle(() => {
            return {
                transform: [{ translateX: clampedX.value }]
            }
        });

        const middleBorderRadius = useDerivedValue(() => {
            return 10 * Math.abs(clampedX.value / width);
        })
        const middleINnerRstyle = useAnimatedStyle(() => {
            return {
                borderRadius: middleBorderRadius.value
            }
        })

        const backdropRStyle = useAnimatedStyle(() => {
            const opacity = Math.abs(1 - ((width - remainingWidth) - clampedX.value) / (width - remainingWidth));
            return {
                backgroundColor: \`rgba(0,0,0,0.2)\`,
                opacity: opacity,
                zIndex: opacity === 0 ? -1 : 5
            }
        })

        const backDrop = (
            <Animated.View
                style={[
                    { ...StyleSheet.absoluteFillObject },
                    backdropRStyle
                ]}>
                <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject }} onPress={turnCenter} />
            </Animated.View>)

        return (

            <View style={{ flex: 1, backgroundColor: backgroundColor }}>

                <PanGestureHandler
                    onGestureEvent={panGestureHandler}
                    activeOffsetX={[-10, 10]}
                >
                    <Animated.View style={[{ ...StyleSheet.absoluteFillObject }]}>
                        <Animated.View style={[{
                            ...StyleSheet.absoluteFillObject, flex: 1,
                            flexDirection: "row",
                            zIndex: 2,
                        }, middleRstyle]}>
                            <Animated.View style={[middleINnerRstyle, {
                                width,
                                overflow: "hidden"
                            }]}>
                                {middle}
                                {backDrop}
                            </Animated.View>

                        </Animated.View>


                        {left && <Animated.View style={[
                            {
                                ...StyleSheet.absoluteFillObject,
                                flex: 0,
                                zIndex: 1,
                                width,
                            },
                            leftpageRStyle
                        ]}>
                            <View style={{
                                width: width - remainingWidth,
                                overflow: "hidden"
                            }}>
                                {left}
                            </View>
                        </Animated.View>}

                        {right && <Animated.View style={[
                            {
                                ...StyleSheet.absoluteFillObject,
                                flex: 0,
                                zIndex: 1,
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
    };
}

export default Trinity
\`\`\`

### Usage

#### Two Pages to Swipe

\`\`\`js
export const roomTrinity = new Trinity();

const Room = () => {
    return (
        <roomTrinity.instance
            remainingWidth={width - 150}
            middle={<MultiChat />}
            right={<Namelist />}
        />
    )
}
\`\`\`

#### Three Pages to Swipe, with Tabs Navigator at the Middle

Here we use \`expo-router\`:

\`\`\`js
export const tradesTrinity = new Trinity();

export default () => {
    const accessToken = useAppSelector(s => s.auth.accessToken);
    const router = useRouter();

    useEffect(() => {
        tradesTrinity.turnCenter();
    }, []);

    useEffect(() => {
        if (!accessToken) {
            router.push("/login")
        }
    }, [accessToken]);

    return (
        <SafeAreaView>
            <View style={{ width: "100%", height: "100%" }}>
                <tradesTrinity.instance
                    remainingWidth={40}
                    left={<LeftScreens />}
                    right={<RightScreen />}
                    middle={(
                        <Tabs
                            initialRouteName="issue"
                            screenOptions={{
                                headerShown: false,
                                tabBarStyle: { backgroundColor: "#292929" }
                            }}>
                            <Tabs.Screen name="issue"
                                options={{
                                    tabBarShowLabel: false,
                                    tabBarActiveTintColor: "white",
                                    tabBarIcon: (props) => <Ionicons name="document-text" size={24} color="#666666" style={{ color: props.color }} />
                                }} />
                            <Tabs.Screen name="(chat)" options={{
                                tabBarShowLabel: false,
                                tabBarActiveTintColor: "white",
                                tabBarIcon: (props) => <Ionicons name="chatbubbles" size={24} color="#666666" style={{ color: props.color }} />
                            }} />
                            <Tabs.Screen name="mail" options={{
                                tabBarShowLabel: false,
                                tabBarActiveTintColor: "white",
                                tabBarIcon: (props) => <Ionicons name="mail-sharp" size={24} color="#666666" style={{ color: props.color }} />
                            }} />
                            <Tabs.Screen name="voiceMemo" options={{
                                tabBarShowLabel: false,
                                tabBarActiveTintColor: "white",

                                tabBarIcon: (props) => <FontAwesome name="plus-circle" size={24} color="#666666" style={{ color: props.color }} />
                            }} />
                        </Tabs>
                    )}
                />
            </View>
        </SafeAreaView>
    )
}
\`\`\`

`;export{n as default};
