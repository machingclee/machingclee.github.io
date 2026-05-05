const e=`---
title: Convenient \`BottomSheet\` Trigger in React-Native
date: 2025-10-17
id: blog0429
tag: react-native
toc: true
intro: Record a customized component for open a bottomsheet conveniently.
---

### The Problem of \`BottomSheet\` in React-Native


When it comes to mobile very often we need a button to trigger a \`BottomSheet\`. 

Defining a \`BottomSheet\` as well as the mechanism to triggeer that \`BottomSheet\` can be ***very cumbersome***.

In a React-Native project of my current company we have used something called \`@expo/react-native-action-sheet\`, a \`BottomSheet\` via this (or other similarly library) involves the following definitions:

\`\`\`tsx
import ActionSheet, { registerSheet } from "react-native-actions-sheet";

function MyCustomSheet() {
    return (
        <ActionSheet id="mySheetId">
            {/* Your custom content here */}
        </ActionSheet>
    );
}

registerSheet("mySheetId", MyCustomSheet);
\`\`\`

And for better code organization we often separate files to define:

1. The custom \`BottomSheet\` content (to be wrapped by \`ActionSheet\`).

2. A unified file to store those \`mySheetId\`'s as a \`Enum\`.
3. A unified file to ***register*** all those components.

Sometimes we even need to pass existing states into these \`BottomSheet\` component, therefore we need to maintain another list of interfaces

4. \`\`\`tsx
    export interface SheetPayload {
        "mySheetId": {
            payload: TExternalState
        }
    }
    \`\`\`
    so that in custom \`MySheetContent\` you can define
    \`\`\`tsx
    export const MySheetContent = (props: SheetPayload["mySheetId"]) => {
        // or we directly code the content here
        return (
            <ActionSheet>
                <SomeOtherComponent {...props}/>
            </ActionSheet>
        )
    } 
    \`\`\`

5. When the project grows ..., 💥

    [![](/assets/img/2025-10-18-06-58-52.png)](/assets/img/2025-10-18-06-58-52.png)


### The Solution
#### Motivation
In [this article](/blog/article/Custom-Modal-Simplification) I have built a custom modal trigger with the help of \`Modal\` element from [ant-design's modal](https://ant.design/components/modal). The trigger has the following interface:


\`\`\`tsx{2}
<CustsomModalTrigger
  modalContent={(props) => <AddUserModal {...props} someValue="Hello" />}
>
  <Button type="primary">Add Staff</Button>
</CustsomModalTrigger>
\`\`\`
We will be vibe-coding a counterpart for react-native in section [#implement].

Let's first go through some examples on how to use it:

#### Usage of \`CustomBottomSheetTrigger\`

##### Minimal Example 




The final interface we have:

\`\`\`tsx
<CustomBottomSheetTrigger 
    renderComponent={(props) => <MyContent {...props} title="Hello" />}
>
    {(openSheet) => <Button onPress={openSheet}>Open</Button>}
</CustomBottomSheetTrigger>
\`\`\`
where 
\`\`\`tsx
const MyContent = ({ close, title }: BillieBottomSheetProps & { title: string }) => (
    <View>
        <Text>{title}</Text>
        <Button onPress={close}>Close</Button>
    </View>
)
\`\`\`



##### Example which helps set values

Sometimes we want a bottom sheet to let users make selection, we want to set the state after the selection is done. 

Now we simply pass a setter into the bottom sheet content:


\`\`\`tsx{8}
<CustomBottomSheetTrigger
    renderComponent={(props) => {
        return (
            <ValueOptionsList
                {...props}
                customField={customField}
                initialValueIds={selectedValueIds}
                setValueIds={updateValues}
            />
        )
    }}
>
    {(openSheet) => (
        <Pressable onPress={openSheet}>
            {display for selectedValueIds ...}
        </Pressable>
    )}
<CustomeBottomSheetTrigger>
\`\`\`


#### Code Implementation for \`CustomBottomSheetTrigger\` {#implement}

This \`Trigger\` is a wrapper of \`BottomSheet\` from [@gorhom/bottom-sheet](https://www.npmjs.com/package/@gorhom/bottom-sheet):


\`\`\`tsx
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

export type BillieBottomSheetProps = {
    close: () => void
}

export const CustomBottomSheetTrigger = (props: {
    style?: ViewStyle
    renderComponent: ComponentType<BillieBottomSheetProps>
    children: ReactNode | ((openBottomSheet: () => void) => ReactNode)
    enableBackdropDismiss?: boolean
}) => {
    const { style, renderComponent: RenderComponent, children, enableBackdropDismiss = true } = props
    const [open, setOpen] = useState(false)
    const modalRef = useRef<BottomSheetModal>(null)

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
                <BottomSheetView>{open && <RenderComponent close={closeOnly} />}</BottomSheetView>
            </BottomSheetModal>
        </>
    )
}

export default CustomBottomSheetTrigger
\`\`\``;export{e as default};
