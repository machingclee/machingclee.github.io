const e=`---
title: "Pin to Zoom Camera"
date: 2023-10-09
id: blog0192
tag: react-native
intro: "Pin to zoom is very common but it is not an out-of-the-box feature for camera API in iOS. Let's bring it back on our own."
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

### How do I come up with this Implementation?

I find an inspiring article

> [VisionCamera - Zooming](https://react-native-vision-camera.com/docs/guides/zooming)

<center></center>

but I don't need its full list of extra features....

However, it does shed some light on how to let the \`animated-state\` take effect to the actual react component. Combined we what I learn in

> [The basics of PinchGestureHandler with React Native Reanimated 2](https://www.youtube.com/watch?v=R7vyLItMQJw&list=PLjHsmVtnAr9TWoMAh-3QMiP7bPUqPFuFZ&index=5)

<center></center>

I reproduce the pin-to-zoom function successfully.

### Code Implementation

\`\`\`js
import { Camera, CameraProps, CameraType, ImageType } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/app/hooks';
import appSlice from '../../redux/slices/appSlice';
import { dialogColor } from '../../components/WbDialog';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BlurBackgorund from '../../components/BlurBackgorund';
import {
    PinchGestureHandler,
    PinchGestureHandlerGestureEvent,
    TouchableOpacity
} from 'react-native-gesture-handler';
import { chatThunkAction } from '../../redux/slices/chatSlice';
import msgUtil from '../../util/msgUtil';
import Animated, {
    useAnimatedGestureHandler,
    useAnimatedProps,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

const AnimatedCamera = Animated.createAnimatedComponent(Camera);

export default () => {
    const [type, setType] = useState(CameraType.back);
    const [permission, requestPermission] = Camera.useCameraPermissions();
    const roomOid = useAppSelector(s => s.chat.selectedRoom._id);
    const router = useRouter();
    const cameraRef = useRef<Camera>(null);
    const dispatch = useAppDispatch();

    const takePhoto = async () => {
        const res = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.5, imageType: ImageType.jpg });
        if (res) {
            if (!res.base64) {
                return msgUtil.error("Image data is invalid");
            }
            const base64String = res.base64;
            dispatch(chatThunkAction.uploadImageFile({ base64EncodedFile: { current: base64String }, roomOid }));
            router.push("/(billie)/room");
        }
    }


    const zoom = useSharedValue(0);

    const animatedProps = useAnimatedProps<Partial<CameraProps>>(
        () => ({ zoom: zoom.value }),
        [zoom]
    )

    const pinchHandler = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent, { zoom: number }>({
        onStart: (event, context) => {
            context.zoom = zoom.value;
        },
        onActive: (event, context) => {
            console.log(event.scale / 30);
            if (context.zoom == 0) {
                zoom.value = event.scale / 300;
            } else {
                zoom.value = context.zoom * (1 + event.scale / 2);
            }
        },
        onEnd: (event, context) => {
            context.zoom = zoom.value;
            if (event.scale < 0.8) {
                zoom.value = withSpring(0);
            }
        }
    })

    useEffect(() => {
        requestPermission().then((res) => {
            if (!res.granted) {
                dispatch(appSlice.actions.updateAppDialog({
                    open: true,
                    desc: "No camera right has been granted.",
                    ok: {
                        color: dialogColor.BLUE,
                        label: "OK",
                        action: () => {
                            router.push("/room")
                        }
                    }
                }))
            }
        })
    }, []);

    return (
        <View style={{ width: "100%", height: "100%" }}>
            <PinchGestureHandler onGestureEvent={pinchHandler}>
                <AnimatedCamera
                    animatedProps={animatedProps}
                    style={[{ width: "100%", height: "100%", position: "relative" }]}
                    type={type}
                    ref={cameraRef}
                >
                    <View style={{
                        position: "absolute",
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.8)",
                        height: 100,
                        width: "100%",
                        justifyContent: "center",
                        alignItems: "center"
                    }}>
                        <BlurBackgorund />
                        <TouchableOpacity onPress={takePhoto}>
                            <MaterialCommunityIcons name="circle-slice-8" size={80} color="white" />
                        </TouchableOpacity>
                    </View>
                </AnimatedCamera>
            </PinchGestureHandler>
        </View >
    )
}
\`\`\`

### Reference

- [VisionCamera-Zooming](https://react-native-vision-camera.com/docs/guides/zooming)
- [The basics of PinchGestureHandler with React Native Reanimated 2](https://www.youtube.com/watch?v=R7vyLItMQJw&list=PLjHsmVtnAr9TWoMAh-3QMiP7bPUqPFuFZ&index=5)
`;export{e as default};
