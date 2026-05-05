const n=`---
title: "General Purpose Dialog using MUI with Flexible { xs, sm, md, lg, ...etc } Widths"
date: 2024-12-28
id: blog0353
tag: react
toc: true
intro: "We record a general purpose dialog whose width can be sm, md, lg, etc to avoid the consideration of width of the dialog content."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Usage

\`\`\`js
ConfirmAssignmentContentDialog.setWidth("sm");
ConfirmAssignmentContentDialog.setContent(() => () => (
  <ConfirmAssignmentContent />
));
ConfirmAssignmentContentDialog.setOpen(true);
\`\`\`

In fact we have the following options:

![](/assets/img/2024-12-28-03-24-35.png)

### Definition of GeneralDialog

\`\`\`js
import { Breakpoint, Dialog } from "@mui/material";
import { OverlayScrollbarsComponent, OverlayScrollbarsComponentRef } from "overlayscrollbars-react";
import { useRef, useState } from "react";

export default class GeneralDialog {
    public setContent = (_: () => () => JSX.Element) => { };
    public setOpen: (open: boolean) => void = () => { };
    public setBackgroundColor: (bgColor: string) => void = () => { };
    public setWidth: (width: false | Breakpoint | undefined) => void = () => { };
    public open: () => void = () => { };
    public close: () => void = () => { };

    render = () => {
        const [content, setContent] = useState(() => () => <></>)
        const [open, setOpen] = useState(false);
        const [bgColor, setBgcolor] = useState("white");
        const [width, setWidth] = useState<false | Breakpoint | undefined>("md")
        const ref = useRef<OverlayScrollbarsComponentRef<"div"> | null>(null);

        this.setOpen = setOpen;
        this.setContent = setContent;
        this.setWidth = setWidth;
        this.open = () => setOpen(true);
        this.close = () => setOpen(false);
        this.setBackgroundColor = setBgcolor
        const Content = content;

        return (
            <Dialog
                PaperProps={{ style: { backgroundColor: bgColor, zIndex: 10 ** 7 + 1 } }}
                maxWidth={width}
                fullWidth={true}
                onClose={() => { setOpen(false) }} open={open}
            >
                <OverlayScrollbarsComponent
                    style={{ height: "100%", width: "100%", overflowY: "auto" }}
                    ref={ref}
                    options={{
                        scrollbars: {
                            autoHide: "leave",
                            autoHideDelay: 100,
                        }
                    }}
                >
                    <Content />
                </OverlayScrollbarsComponent>
            </Dialog >
        );
    }
}
\`\`\`
`;export{n as default};
