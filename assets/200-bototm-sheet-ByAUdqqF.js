const n=`---
title: "@gorhom/bottom-sheet"
date: 2023-10-21
id: blog0200
tag: react-native
intro: "Though we are able to create a bottom-sheet on our own, we may as well use existing stable ones from others!"
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

### The Package

This package is already in typescript, let's

\`\`\`text
yarn add @gorhom/bottom-sheet
\`\`\`

### Wrap our Stack Element in Root Level \\_layout.tsx

\`\`\`js
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

function RootLayoutNav() {
    ...
    return (
        <BottomSheetModalProvider>
            ...
        </BottomSheetModalProvider>
    )
}
\`\`\`

### Our own Wrapper

\`\`\`js
import { BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetModal } from "@gorhom/bottom-sheet"
import { ReactNode, useCallback, useMemo, useRef, useState } from "react"

export type WbBottomSheetProps = {
    index?: number
}

class WbBottomSheet {
    public static close = () => { }
    public static open = () => { }
    public static setContent = (content: ReactNode) => { };

    public static instance = (props: WbBottomSheetProps) => {
        const [content, setContent] = useState<ReactNode>(null);
        const { index = 1, } = props;
        const snapPoints = useMemo(() => ['50%', '75%', "100%"], []);
        const modalref = useRef<BottomSheetModal>(null);
        const open = () => {
            modalref.current?.present();
        }
        const close = () => {
            modalref.current?.dismiss();
        }
        this.open = open;
        this.close = close;
        this.setContent = setContent

        const renderBackdrop = useCallback(
            (props: BottomSheetBackdropProps) => (
                <>
                    <BottomSheetBackdrop
                        {...props}
                        disappearsOnIndex={-1}
                        appearsOnIndex={1}
                    />
                </>
            ), []
        );

        return (
            <BottomSheetModal
                backgroundStyle={{ backgroundColor: "rgb(255,255,255)", }}
                containerStyle={{ backgroundColor: "transparent", borderRadius: 20 }}
                handleStyle={{ backgroundColor: "transparent" }}
                style={{ borderRadius: 20 }}
                enablePanDownToClose={true}
                backdropComponent={renderBackdrop}
                ref={modalref}
                index={index}
                snapPoints={snapPoints}
            >
                {content}
            </BottomSheetModal>
        )
    }
}

export default WbBottomSheet
\`\`\`
`;export{n as default};
