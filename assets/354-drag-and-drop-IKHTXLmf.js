const n=`---
title: "Pragmatic drag and drop from Atlassian Design System"
date: 2024-12-29
id: blog0354
tag: react
toc: true
intro: "Let's get rid of the deprecated react beautiful dnd."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Installation and Tutorial

We use the [@atlaskit/pragmatic-drag-and-drop](https://www.npmjs.com/package/@atlaskit/pragmatic-drag-and-drop) package

\`\`\`text
yarn add @atlaskit/pragmatic-drag-and-drop
\`\`\`

and here is the [tutorial](https://atlassian.design/components/pragmatic-drag-and-drop/tutorial).

### Draggable

\`\`\`jsx{41-47}
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { ReactNode, HTMLAttributes, useRef, useState, useEffect } from 'react';
import invariant from 'tiny-invariant';

// eslint-disable-next-line
export type DraggableDropData<T extends Record<string, any>> = {
    data: T;
    setDragging: (dragging: boolean) => void;
};

// eslint-disable-next-line
export const Draggable = <T extends Record<string, any>>(
    props: {
        children: ReactNode;
        data: T;
        canDrag: boolean;
    } & HTMLAttributes<HTMLDivElement>
) => {
    const { children, data, canDrag, ..._props } = props;
    const ref = useRef(null);
    const [dragging, setDragging] = useState<boolean>(false);
    useEffect(() => {
        const el = ref.current;
        invariant(el);
        return draggable({
            element: el,
            canDrag: () => canDrag,
            getInitialData: () => ({ data, setDragging }),
            onDragStart: () => setDragging(true),
            onDrop: () => {
                setDragging(false);
            },
        });
    }, [data, canDrag]);

    return (
        <div
            ref={ref}
            {..._props}
            style={{
                opacity: dragging ? 0.4 : 1,
                position: 'absolute',
                width: '100%',
                height: '100%',
                zIndex: 10 ** 7,
                top: 0,
                left: 0,
            }}
        >
            {children}
        </div>
    );
};
\`\`\`

- Highlighted CSS can be customized for your own need.

- \`getInitialData\` returns the data \`source\` which is accessible from the \`Droppable\` component in the next section (\`onDragEnter, onDragLeave, canDrop, onDrop\`).

### Droppable

\`\`\`js
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { ReactNode, HTMLAttributes, useRef, useState, useEffect } from 'react';
import invariant from 'tiny-invariant';
import toastUtil from '../../utils/toastUtil';
import { DraggableDropData } from './Draggable';

enum HoveredState {
    IDLE = 'IDLE',
    VALID_MOVE = 'VALID_MOVE',
    INVALID_MOVE = 'INVALID_MOVE',
}

// eslint-disable-next-line
export const Droppable = <T extends Record<string, any>>(
    props: {
        children: ReactNode;
        isValidMove: (data: T) => boolean;
        onValidDrop: (data: T) => void | Promise<void>;
    } & HTMLAttributes<HTMLDivElement>
) => {
    const { children, isValidMove, onValidDrop, ..._props } = props;
    const ref = useRef(null);
    const [hoveredState, setHoveredState] = useState<HoveredState>(HoveredState.IDLE);
    const getColor = () => {
        if (hoveredState === HoveredState.IDLE) {
            return 'white';
        } else if (hoveredState === HoveredState.INVALID_MOVE) {
            return 'red';
        } else if (hoveredState === HoveredState.VALID_MOVE) {
            return 'yellow';
        }
    };

    useEffect(() => {
        const el = ref.current;
        invariant(el);

        return dropTargetForElements({
            element: el,
            onDragEnter: ({ source, location }) => {
                const { data } = source.data as DraggableDropData<T>;
                const destination = location.current.dropTargets[0];
                if (!destination) {
                    return;
                }
                const validMove = isValidMove(data);
                if (validMove) {
                    setHoveredState(HoveredState.VALID_MOVE);
                } else {
                    setHoveredState(HoveredState.INVALID_MOVE);
                }
            },
            onDragLeave: ({ source, location }) => {
                const destination = location.current.dropTargets[0];
                const { setDragging } = source.data as DraggableDropData<T>;
                if (!destination) {
                    setDragging(false);
                } else {
                    setDragging(true);
                }
                setHoveredState(HoveredState.IDLE);
            },
            canDrop: ({ source }) => {
                const { data } = source.data as DraggableDropData<T>;
                return isValidMove(data);
            },
            onDrop: async ({ source }) => {
                const { data, setDragging } = source.data as DraggableDropData<T>;
                try {
                    const validMove = isValidMove(data);
                    if (validMove) {
                        await onValidDrop(data);
                    }
                } catch (error) {
                    toastUtil.error(JSON.stringify(error));
                } finally {
                    setHoveredState(HoveredState.IDLE);
                    setDragging(false);
                }
            },
        });
    }, [isValidMove, onValidDrop]);

    return (
        <div {..._props} style={{ backgroundColor: getColor() }} ref={ref}>
            {children}
        </div>
    );
};
\`\`\`

### It is that Simple! Usage!

- [Example](https://github.com/machingclee/2024-07-30-Alice-Timetable-System-Frontend/blob/v3/main/src/pages/Students/components/ClassEventForWeeklyTimetable.tsx)

We define a grid of \`Droppable\` with \`Draggable\` defined inside of it. We use state to control whether the \`Draggable\` should be displayed or not by determining the global state:

\`\`\`js
{[droppableId: string]: DraggableData | null}
\`\`\`

In our case each droppable has an id (serve as a location), and that global state (map) can tell **_which_** id has **_what_** data.

[![](/assets/img/2024-12-29-15-58-32.gif)](/assets/img/2024-12-29-15-58-32.gif)
`;export{n as default};
