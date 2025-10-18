---
title: Convenient `BottomSheet` Trigger in React-Native
date: 2025-10-17
id: blog0429
tag: react-native
toc: true
intro: Record a customized component for open a bottomsheet conveniently.
---

#### The Problem of `BottomSheet` in React-Native


When it comes to mobile very often we need a button to trigger a `BottomSheet`. 

Defining a `BottomSheet` as well as the mechanism to triggeer that `BottomSheet` can be ***very cumbersome***.

In a React-Native project of my current company we have used something called `@expo/react-native-action-sheet`, a `BottomSheet` via this (or other similarly library) involves the following definitions:

```tsx
import ActionSheet, { registerSheet } from "react-native-actions-sheet";

function MyCustomSheet() {
    return (
        <ActionSheet id="mySheetId">
            {/* Your custom content here */}
        </ActionSheet>
    );
}

registerSheet("mySheetId", MyCustomSheet);
```

And for better code organization we often separate files to define:

1. The custom `BottomSheet` content (to be wrapped by `ActionSheet`).

2. A unified file to store those `mySheetId`'s as a `Enum`.
3. A unified file to ***register*** all those components.

Sometimes we even need to pass existing states into these `BottomSheet` component, therefore we need to maintain another list of interfaces

4. ```tsx
    export interface SheetPayload {
        "mySheetId": {
            payload: TExternalState
        }
    }
    ```
    so that in custom `MySheetContent` you can define
    ```tsx
    export const MySheetContent = (props: SheetPayload["mySheetId"]) => {
        // or we directly code the content here
        return (
            <ActionSheet>
                <SomeOtherComponent {...props}/>
            </ActionSheet>
        )
    } 
    ```

5. When the project grows ..., 💥

    [![](/assets/img/2025-10-18-06-58-52.png)](/assets/img/2025-10-18-06-58-52.png)


#### The Solution
##### What do we have in web?
In [this article](/blog/article/Custom-Modal-Simplification) I have built a custom modal trigger with the help of `Modal` element from [ant-design's modal](https://ant.design/components/modal). The trigger has the following interface:


```tsx{2}
<CustsomModalTrigger
  modalContent={(props) => <AddUserModal {...props} someValue="Hello" />}
>
  <Button type="primary">Add Staff</Button>
</CustsomModalTrigger>
```

This component has done the following:

1. We have a button defined as the `children`, ***on clicking*** it will pop-up a modal.

2. We have a trigger wrapping it, which defined the ***content*** of the modal.

3. If you browse my source code, `AddUserModal` 
    - can customize the text for submit/cancel button;

    - can close the `Modal`;
    
    Because we have injected those functions  from `CustsomModalTrigger` (as you can see, `modalContent={(props) => ...` from the code block above).

***Everything can be inline***, meaning that we can do code separation only when it is complex enough to be necessary.


##### Let's Build one for React-Native

Let's posepone the code implementation to section [#implement].

The final interface we have:

```tsx
<CustomBottomSheetTrigger<OutputState, InputState>
                                    //   ^^^^^ state you want to pass into bottomsheet, sometimes no state is needed
    renderProps={{ title: "Delete Item", message: "Are you sure?" }}
    renderComponent={ConfirmationDialog}
    onClose={(confirmed) => console.log('Confirmed:', confirmed)}
    enableBackdropDismiss={false} // Prevent closing when clicking backdrop
>
    {(openSheet) => <Button onPress={openSheet}>Delete</Button>}
</CustomBottomSheetTrigger>
```



##### Some Inline Example


When everything is inline, `InputState` can be skipped as we don't need code separation:

```tsx
const function SomeComponent (props: ...) {
    ...
    const someList: Item[] = ...

    // to be displayed in bottom sheet:                     
    const optionList = ({
            closeWithState     // vvvvv type for setState from bottom sheet
        }: CustomBottomSheetProps<Item>) => {
        return (
            <View>
                <FlatList
                    data={someList}
                    ...
                    renderItem={({ item }) => {
                        return (
                            <Pressable
                                style={styles.optionItem}
                                onPress={() => {
                                    closeWithState(item)
                                }}
                            >
                                {item...}
                            </Pressable>
                        )
                    }}
                />
            </View>
        )
    }
    return (
        <View style={styles.inputContainer}>
            <CustomBottomSheetTrigger<Item>
                renderComponent={optionList}

                // closeWithState we call this:
                onClose={(item) => { setItem(item) }}
            >
                {(openSheet) => (
                    <Pressable
                        onPress={openSheet}
                    >
                       {... some content}
                    </Pressable>
                )}
            </CustomBottomSheetTrigger>
        </View>
    )
}

```


##### Code Implementation for `CustomBottomSheetTrigger` {#implement}

This `Trigger` is a wrapper of `BottomSheet` from [@gorhom/bottom-sheet](https://www.npmjs.com/package/@gorhom/bottom-sheet):


```tsx
import { BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet"
import {
    cloneElement,
    ComponentType,
    isValidElement,
    ReactElement,
    ReactNode,
    useCallback,
    useMemo,
    useRef,
    useState,
} from "react"
import { TouchableOpacity, ViewStyle } from "react-native"

export type CustomBottomSheetProps<TInternalState = void, TExternalState = void> = {
    closeWithState: (data: TInternalState) => void
    close: () => void
    renderProps: TExternalState
}

export const CustomBottomSheetTrigger = <
    TInternalState = void,
    TExternalState = void /* this types optional because the renderProps is optional*/,
>(props: {
    style?: ViewStyle
    renderProps?: TExternalState
    renderComponent: ComponentType<CustomBottomSheetProps<TInternalState, TExternalState | void>>
    onClose?: (internalState?: TInternalState) => void
    children: ReactNode | ((openBottomSheet: () => void) => ReactNode)
    enableBackdropDismiss?: boolean
}) => {
    const {
        style,
        renderProps,
        renderComponent: RenderComponent,
        onClose: onClosed,
        children,
        enableBackdropDismiss = true,
    } = props
    const [open, setOpen] = useState(false)
    const modalRef = useRef<BottomSheetModal>(null)

    const closeWithSetState = useCallback(
        (data?: TInternalState) => {
            modalRef.current?.dismiss()
            if (onClosed) {
                onClosed(data)
            }
        },
        [onClosed],
    )

    const closeOnly = useCallback(() => {
        modalRef.current?.dismiss()
    }, [])

    const handleOpen = useCallback(() => {
        setOpen(true)
        modalRef.current?.present()
    }, [])

    const handleDismiss = useCallback(() => {
        setOpen(false)
    }, [])

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                pressBehavior={enableBackdropDismiss ? "close" : "none"}
            />
        ),
        [enableBackdropDismiss],
    )

    // Handle both render prop and element children
    const trigger = useMemo(() => {
        // If children is a function, call it with openBottomSheet
        if (typeof children === "function") {
            return children(handleOpen)
        }
        // If children is a valid React element, clone and inject onPress
        if (isValidElement(children)) {
            return cloneElement(children as ReactElement<any>, {
                onPress: handleOpen,
            })
        }
        // Fallback: wrap in TouchableOpacity
        return (
            <TouchableOpacity style={style} onPress={handleOpen}>
                {children}
            </TouchableOpacity>
        )
    }, [children, handleOpen, style])

    return (
        <>
            {trigger}
            <BottomSheetModal
                enableDynamicSizing={true}
                backgroundStyle={{ backgroundColor: "rgb(255,255,255)" }}
                containerStyle={{ backgroundColor: "transparent", borderRadius: 20 }}
                handleStyle={{ backgroundColor: "transparent" }}
                style={{ borderRadius: 20 }}
                enablePanDownToClose={true}
                backdropComponent={renderBackdrop}
                onDismiss={handleDismiss}
                ref={modalRef}
            >
                <BottomSheetView>
                    {open && <RenderComponent closeWithState={closeWithSetState} close={closeOnly} renderProps={renderProps} />}
                </BottomSheetView>
            </BottomSheetModal>
        </>
    )
}

export default CustomBottomSheetTrigger
```