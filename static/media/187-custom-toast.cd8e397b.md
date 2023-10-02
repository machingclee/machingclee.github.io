---
title: "Custom Toast Messages"
date: 2023-10-01
id: blog0187
tag: react-native
intro: "We build our own toast meassages."
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
    <source  src="/assets/tech/187/001.mp4" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  <video/>
</center>

#### Reason to Make One

- With `react-reanimated` making a toast notification is extremely simple. 
- Therefore there is no reason to rely on notification packages in `npm`, at the same time,  we have full control how the notification looks and behaves.

- Our notications get no boilerplate feeling.


#### Code Implementation

- Our strategy is to initialize `ToastProvider` (the default export) as quick as possible, so as to initialize the function `addMessage` which (whose reference) is eventually stored inside of `toastProviderStore`.


- We are thereby able to `addMessage()` anywhere using the reference stored in this `toastProviderStore`. 

- We make a utility function to play around with this store at the end.

```js
import { View, Text, Dimensions, StyleSheet } from "react-native"
const { width } = Dimensions.get("window");
import { BlurView } from "@react-native-community/blur";
import Animated, {
    FadeIn,
    FadeOut,
    runOnJS,
    useAnimatedGestureHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from "react-native-reanimated";
import { PanGestureHandler, PanGestureHandlerGestureEvent } from "react-native-gesture-handler";
import { ToastMessage } from "../dto/dto";
import Spacer from "./Spacer";
import { useEffect, useState } from "react";
import { Ionicons } from '@expo/vector-icons';
import uuid from "react-native-uuid";
import lodash from "lodash";

const toastWidth = width - 20;

export const toastProviderStore: {
    addMessage: ((props: { type: ToastMessage["type"], msg: string }) => void) | null,
} = {
    addMessage: null
}

const Toast = ({ message, remainingIds, deleteMessage }: {
    message: ToastMessage,
    remainingIds: string[],
    deleteMessage: (props: { uuid: string }) => void;
}) => {
    const deleteToast = () => {
        setTimeout(() => deleteMessage({ uuid: message.uuid }), 500);
    };

    const translateX = useSharedValue(0);
    const maxHeight = useSharedValue(100);

    const rstyle = useAnimatedStyle(() => {
        return {
            maxHeight: maxHeight.value,
            transform: [{ translateX: translateX.value }]
        }
    })

    const containerRstyle = useAnimatedStyle(() => {
        return {
            maxHeight: maxHeight.value,
        }
    });

    const suicide = () => {
        "worklet";
        let sign = -1;
        const magnitute = Math.abs(translateX.value);
        if (magnitute > 0) {
            sign = translateX.value / magnitute;
        }
        translateX.value = withTiming(width * sign);
        maxHeight.value = withTiming(0);

        runOnJS(deleteToast)();
    }

    const panGesture = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
        onActive: (e) => {
            translateX.value = e.translationX;
        },
        onEnd: () => {
            if (Math.abs(translateX.value) > 20) {
                suicide();
            } else {
                translateX.value = withTiming(0);
            }
        }
    })

    const toastStyle = (() => {
        if (message.type === "success") {
            return styles.successToast
        } else if (message.type === "info") {
            return styles.infoToast
        } else {
            return styles.errorToast
        }
    })()

    const toastIcon = (() => {
        if (message.type === "success") {
            return <Ionicons name="checkmark-circle" size={26} color={toastStyle.color} />
        } else if (message.type === "info") {
            return <Ionicons name="md-information-circle-sharp" size={26} color="white" />
        } else {
            return <Ionicons name="alert-circle" size={26} color="white" />
        }
    })()

    useEffect(() => {
        if (!remainingIds.includes(message.uuid)) {
            setTimeout(() => { suicide(); }, 500)
        }
    }, [remainingIds])

    return (
        <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={containerRstyle}
        >
            <PanGestureHandler
                activeOffsetX={[-10, 10]}
                onGestureEvent={panGesture}
            >
                <Animated.View style={[
                    {
                        marginTop: 10,
                        width: toastWidth,
                        paddingVertical: 10,
                        paddingHorizontal: 20,
                        borderWidth: 1,
                        borderRadius: 10,
                        overflow: "hidden",
                        ...toastStyle
                    },
                    rstyle
                ]}>
                    <BlurView
                        style={styles.absolute}
                        blurType="light"
                        blurAmount={10}
                        reducedTransparencyFallbackColor="rgba(247,223,192)"
                    />
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ width: 36 }}>{toastIcon}</View>
                        <View style={{ flex: 1 }}><Text style={{ color: toastStyle.color }}>{message.text}</Text></View>
                    </View>
                </Animated.View>
            </PanGestureHandler>
        </Animated.View>
    )
}

export default () => {
    const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
    const remainingIds = toastMessages.map(m => m.uuid);
    const [startScrolling, setStartScrolling] = useState(false);

    const addMessage = ({ type, msg }: { type: ToastMessage["type"], msg: string }) => {
        const toast: ToastMessage = { uuid: uuid.v4() as string, type, text: msg };

        setToastMessages(msgs => {
            if (msgs.length >= 3) {
                return [...msgs.slice(msgs.length - 2, msgs.length), toast]
            } else {
                return [...msgs, toast];
            }
        });
    };

    if (!toastProviderStore.addMessage) {
        toastProviderStore.addMessage = addMessage;
    }

    const deleteMessage = ({ uuid }: { uuid: string }) => {
        setToastMessages(msgs => {
            const newMsgs = lodash.cloneDeep(msgs);
            return newMsgs.filter(m => m.uuid !== uuid);
        });
    }

    return (
        <View style={{
            alignItems: "center",
            position: "absolute",
            zIndex: 1,
            width,
        }}>
            <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                onScrollBeginDrag={() => {
                    setStartScrolling(true);
                }}
                onScrollEndDrag={() => {
                    setTimeout(() => { setStartScrolling(false); }, 500)
                }}
                style={{
                    marginTop: 20
                }}
            >
                {toastMessages.map(msg => {
                    return (
                        <Toast message={msg} key={msg.uuid} deleteMessage={deleteMessage} remainingIds={remainingIds} />
                    )
                })}
                {startScrolling && <Spacer height={100} />}
            </Animated.ScrollView>
        </View >
    )
}

const styles = StyleSheet.create({
    container: {
        justifyContent: "center",
        alignItems: "center"
    },

    successToast: {
        color: "#499F1F",
        borderColor: "rgba(48,200,97,0.4)",
        backgroundColor: "rgba(247,223,192, 0.5)",
    },
    errorToast: {
        color: "white",
        borderColor: "#DD7C72",
        backgroundColor: "rgba(204,25,6,0.6)",
    },
    infoToast: {
        color: "white",
        borderColor: "#4489DC",
        backgroundColor: "rgba(153,39,172,0.75)",
    },
    absolute: {
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
    }
});
```

#### Usage

In `_layout.tsx` at the root project level (or `App.tsx` without `expo-router`) we added our `ToastProvider` to initialize our `addMessage` function:

```js
function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Provider store={store}>
        <PersistGate persistor={persistor}>
          <ConfigApiClient store={store}>
            ...
          </ConfigApiClient>

          <ToastProvider />

        </PersistGate>
      </Provider>
      <FlashMessage position="top" hideOnPress={true} />
    </ThemeProvider>
  );
}
```
Since we simply use `useState` in our `Toast`'s, our `ToastProvider` does not necessarily lie inside `Provider`.

Next we create a utility function to different kinds of messages:

```js
// toastUtil.ts

import { toastProviderStore } from "../components/ToastProvider"

const success = (msg: string) => {
    toastProviderStore?.addMessage?.({ type: "success", msg });
}

const info = (msg: string) => {
    toastProviderStore?.addMessage?.({ type: "info", msg });
}

const error = (msg: string) => {
    toastProviderStore?.addMessage?.({ type: "error", msg });
}

export default {
    success,
    info,
    error
}
```
