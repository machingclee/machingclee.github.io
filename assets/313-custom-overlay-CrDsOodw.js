const n=`---
title: "Custom Overlay Scrollbar Container"
date: 2024-08-11
id: blog0313
tag: react
toc: false
intro: "Record a component for simple reuse."
---

<style>
  img {
    max-width: 660px;
  }
</style>

Dependencies:

\`\`\`text
yarn add overlayscrollbars
\`\`\`

First import the CSS in \`main.tsx\`:

\`\`\`tsx
import 'overlayscrollbars/overlayscrollbars.css';
\`\`\`
Implmentation:

\`\`\`tsx
import { OverlayScrollbarsComponent, OverlayScrollbarsComponentRef } from "overlayscrollbars-react";
import { HTMLAttributes, ReactNode, useRef } from "react";

export default (props: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) => {
    const { children, ...props_ } = props;
    const ref = useRef<OverlayScrollbarsComponentRef<"div"> | null>(null);
    return (
        <div {...props_}>
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
                {props.children}
            </OverlayScrollbarsComponent>
        </div>
    )
}
\`\`\``;export{n as default};
