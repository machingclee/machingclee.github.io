const e=`---
title: "Various ways of Implementing Chatroom Input Field in React Native"
date: 2024-07-13
id: blog0277
tag: react-native
intro: "It is easy to make input field, but building one in chatroom is a bit different."
---

<style>
  img {
    max-width: 660px;
  }
</style>


### KeyboardAvoidingView

#### Demo Video 1

<div>
<customvideo src="/assets/tech/277/001.MP4" width="340"/>
</div>

#### Implementation

When building mobile application, the main headache of using an input field is that the keyboard can hide your form. 


The first thing we learn is \`KeyboardAvoidingView\`, which in the past I have created one component to abstract every detail that I don't want to care again:

\`\`\`tsx
// KeyboardPushedView

import { KeyboardAvoidingView, Platform, View } from "react-native";
import { ReactNode } from "react"
import WbView from "./WbView";
import { ScrollView } from "react-native";
import useKeyboardVisible from "../hooks/useKeyboardVisible";

export default ({ formEle, bottomEle, keyboardVerticalOffset = 60, backgroundColor }: {
    formEle: ReactNode,
    bottomEle: ReactNode,
    keyboardVerticalOffset?: number,
    backgroundColor?: string
}) => {
    const { isKeyboardVisible } = useKeyboardVisible();
    const backgroundStyle: { backgroundColor?: string } = {}
    if (backgroundColor) {
        backgroundStyle.backgroundColor = backgroundColor;
    }
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
            keyboardVerticalOffset={keyboardVerticalOffset}
        >
            <WbView style={{ height: "100%", ...backgroundStyle }} >
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{
                        flex: 1,
                        justifyContent: "flex-end"
                    }}>
                        {formEle}
                        <View style={{ flex: 1 }} />
                    </View >
                </ScrollView>
                {!isKeyboardVisible && bottomEle}
            </WbView>
        </KeyboardAvoidingView>
    )
}
\`\`\`
So the next time I want to make a \`Stack.Screen\` that avoids the input being blocked by the keyboard, I can simply write:

\`\`\`tsx
const Login = () => {
    ...
    return (
        <KeyboardPushedView
            backgroundColor='white'
            keyboardVerticalOffset={0}
            formEle={
                <InputFieldAndButtons />
            }
            bottomEle={
                <></>
            }
        />
    )
}
\`\`\`

### Case When KeyboardAvoidingView Would not Help, Especially in Chat App ...

What if I want the input field to be ***sticky with the keyboard*** just like any existing messaging applications? \`KeyboardAvoidingView\` is not an answer here. There are two solutions for this scenario.

#### Solution 1. InputAccessoryView


##### Demo Video 2

<div>
<customvideo src="/assets/tech/277/003.MP4" width="340"/>
</div>


##### Implementation with Highlights and Explanation
\`\`\`tsx-1{24}
const MultiChat = ({
    quitRoomAction,
    sort,
    sessionId,
    inverted,
    showKeyboard,
    showCachedMessages = false,
    hasHeader,
    shouldEstablishSocketConnection,
    enableDeleteMessage,
    input,
}: {
    quitRoomAction: () => void,
    sort: "asc" | "desc",
    sessionId: string,
    inverted: boolean,
    showKeyboard: boolean,
    hasHeader: boolean,
    showCachedMessages?: boolean,
    shouldEstablishSocketConnection: boolean,
    enableDeleteMessage: boolean,
    input?: ReactNode
}) => {
    const keyboardActive = useAppSelector(s => s.chat.ongoingSessionInfo.roomKeyboardActive);
\`\`\`
- In line 24 we need a boolean to control the existence of the input component as shown in our video above. 

  We save that boolean in the redux store in order to control it wherever we want.

- A similar example can be found in discord mobile app, in which you swipe to the center to chat, and you swipe to the left to view channels and the keyboard is closed automatically.
\`\`\`tsx-25{72}
    const dispatch = useAppDispatch();
    const { addPageCount, count, resetPageCount } = usePageCount();

    const { flatListRef, messages, audioStartPlay } = useInitChatroom({
        quitRoomAction,
        sort,
        sessionId,
        shouldEstablishSocketConnection,
        showCachedMessages
    });
    const InputComponent = useCallback(() => input, [])

    useEffect(() => {
        resetPageCount()
        return () => {
            resetPageCount()
        }
    }, [])

    useEffect(() => {
        return () => {
            dispatch(chatSlice.actions.resetOngoingSession());
        }
    }, [])

    useEffect(() => {
        if (showKeyboard) {
            dispatch(chatSlice.actions.setRoomKeyboardActive(showKeyboard));
        }
        return () => {
            dispatch(chatSlice.actions.setRoomKeyboardActive(true));
        }
    }, [])

    return (
        <View style={{ position: "relative", flex: 1 }}>
            <CompLabel componentName="MultiChat" />
            <View style={{
                flexDirection: "column",
                flex: 1,
                alignItems: "center",
            }}>
                {hasHeader && <MultiChatHeader />}
                <FlatList
                    contentContainerStyle={{ paddingBottom: 60 }}
                    persistentScrollbar
                    keyboardShouldPersistTaps='handled'
                    automaticallyAdjustKeyboardInsets={true}
                    showsVerticalScrollIndicator={true}
\`\`\`
- In line 72 we need to set \`automaticallyAdjustKeyboardInsets={true}\` to let the height of \`ScrollView\` be adjustable when keyboard popups.
\`\`\`tsx-74{110-117}
                    onEndReachedThreshold={0.2}
                    onEndReached={async() => {
                        await dispatch(ChatThunkAction.getRoomMessagesHistory({
                            roomId: sessionId || "",
                            page: count,
                            sort: sort,
                            showCachedMessages
                        })).unwrap()
                        addPageCount();
                    }}
                    onScrollToIndexFailed={info => {
                        const wait = new Promise(resolve => setTimeout(resolve, 500));
                        wait.then(() => {
                            if (messages.length === 0) {
                                return;
                            }
                            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                        });
                    }}
                    initialScrollIndex={0}
                    inverted={inverted}
                    style={{ height: "100%", width: "100%", marginBottom: 0, paddingBottom: 0, }}
                    data={messages}
                    keyExtractor={item => item.uuid}
                    renderItem={({ item, index }) => {
                        return (
                            <View key={item.uuid} >
                                <MessageRow
                                    enableDelete={enableDeleteMessage}
                                    message={item}
                                    playAudio={audioStartPlay}
                                />
                            </View>
                        )
                    }}
                />
                {Platform.OS === "ios" && keyboardActive && (
                    <InputAccessoryView>
                        <InputComponent />
                    </InputAccessoryView>
                )}
                {Platform.OS !== "ios" && keyboardActive && (
                    <InputComponent />
                )}
            </View >
        </View>
    )
}
\`\`\`
- Lastly, note that \`InputAccessoryView\` is iOS-specific. The stickyless of inputfield right above the keyboard is natively supported in Android.


##### Caveat of InputAccessoryView

- As shown in the demo video, our \`InputAccessoryView\` ***cannot be animated*** by \`PanGesture\`, i.e., not controllable by \`react-reanimated\`.

- When there is highly customized pan gesture involved for page transition, the logic of closedness and openedness of the custom inputfield will also be error-prone.

- When the \`InputAccessoryView\` is embedded into a bottomsheet, then \`InputAccessoryView\` may still persist while transitioning to second bottomsheet. 

  Unless you kill/dismiss the first bottomsheet (that contains \`InputAccessoryView\`), but that means you can't return from the second.

#### Solution 2. Treat Input Element as a Sticky Header of the (Inverted) FlatList

##### Demo Video 3

(Here I scroll up to remove the keyboard)

<div>
<customvideo src="/assets/tech/277/002.MP4" width="340"/>
</div>

##### Implementation with Highlights


With the same code as above, we replace the \`FlatList\` element with emphasis on the highlighted lines:

\`\`\`tsx-68{71-73,75}
                <FlatList
                    ref={flatListRef}
                    persistentScrollbar
                    ListHeaderComponent={InputComponent}
                    stickyHeaderIndices={[0]}
                    invertStickyHeaders={false}
                    keyboardShouldPersistTaps='handled'
                    automaticallyAdjustKeyboardInsets={true}
                    showsVerticalScrollIndicator={true}
                    onEndReachedThreshold={0.2}
                    onEndReached={onEndReached_}
                    onScrollToIndexFailed={info => {
                        const wait = new Promise(resolve => setTimeout(resolve, 500));
                        wait.then(() => {
                            if (messages.length === 0) {
                                return;
                            }
                            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                        });
                    }}
                    initialScrollIndex={0}
                    inverted={inverted}
                    style={{ height: "100%", width: "100%", marginBottom: 0, paddingBottom: 0, }}
                    data={messages}
                    keyExtractor={item => item.uuid}
                    renderItem={({ item, index }) => {
                        return (
                            <View key={item.uuid} >
                                <MessageRow
                                    enableContextMenu={enableDeleteMessage}
                                    message={item}
                                    playAudio={audioStartPlay}
                                />
                            </View>
                        )
                    }}
                    onScroll={e => {
                        const currentOffset = e.nativeEvent.contentOffset.y;
                        const scrollUp = currentOffset > prevOffetRef.current;
                        if (scrollUp) {
                            Keyboard.dismiss();
                        }
                        prevOffetRef.current = currentOffset;
                    }}
                />
\`\`\`

Now the input element is part of the \`FlatList\`, and it can be animated by the pan-gesture handler. We don't need to worry about the ***blockage of the keyboard to other views transitted  by pan-guesture*** any more.


### Conclusion 

- When your view does not involve highly complicated pan-gesture animation (e.g., every page transition is  simply controlled by stack-navigation), go \`InputAccessoryView\`.

- Otherwise, treat the input element as the sticky header in a \`FlatList\`/\`ScrollView\` to avoid potential issues caused by the unexpected persistence of the input element.`;export{e as default};
