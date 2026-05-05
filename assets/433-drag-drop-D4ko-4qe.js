const e=`---
title: Dnd-Kit
date: 2025-11-08
id: blog0433
tag: react
toc: true
intro: We study the latest drag-drop library.
img: /assets/img/2025-11-13-04-39-17.png
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>



<Center>

<customvideo src="/assets/videos/demo-drag-drop.mp4"></customvideo>

</Center>

### Installation 

\`\`\`bash
yarn add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
\`\`\`

### Skeleton with \`DndContext\` and \`SortableContext\`


#### Basic Strcuture 

##### Variant 1: One Sortable Region

<customimage src="/assets/img/2025-11-15-19-37-50.png" width="300"></customimage>

###### Orchestration of components {#one_region_orchestration}

- In this form we orchestrate the components as follows:
  \`\`\`ts-1
  <DndContext {...props}>
      <SortableContext items={[
          "meaningful_prefix_item1Id", 
          "meaningful_prefix_item2Id"
      ]}>
          <SortableItem item={item1} />
          <SortableItem item={item2} />
      </SortableContext>
  </DndContext>
  \`\`\`

###### Standard props for \`DndContext\`

Usually \`props\` is of the form 
\`\`\`ts
{ sensors, collisionDetection, onDragStart, onDragEnd }
\`\`\`
We defer the introduction of sensors to [#sensors]

###### Data for dragging logic
Refer to line-3 to 4 of [#one_region_orchestration], the ids provided in \`items\` props will be used to calculate the dragging logic/animation, those ids will be connected to the dragging component as follows:

\`\`\`ts{3}
const SortableItem () => {
    const { ..., setNodeRef } = useSortable({
        id: "meaningful_prefix_item1Id"
        data: {
            type: "script",
            script: script,
        },
    })
    return (
        <div ref={setNodeRef}>
        ...
        </div>
    )
}
\`\`\`
where we can provide metadata for the dragging/dropping collision item in \`data\` props.


By experience the \`id\` provided in \`useSortable\` hook will be much more accessible than \`data\` when we handle our custom \`collisionDetection\` logic. Make sure to prepend a ***meaningful prefix*** whenever possible.

###### What is \`collisionDection\` any way?
Detailed definition will be dicussed in [#collisionDetection].

By \`collisionDetection\` we mean the logic to determine ***which item*** to ***interact*** with ***when dragging*** another item. 

  For example, when we drag an item to a region, which one should be considered as a collision? The folder? Or the item nested inside of the folder? Do we have priority? 

The \`collisionDetection\` logic will directly affect the outcome (the \`over\` part) in 
\`\`\`ts
const { active, over } = useDndContext();
\`\`\`
or in \`onDragEnd\` callback:
\`\`\`ts
// to be passed into DndContext
const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    ...  
}
\`\`\`
Now we can access our data by \`{active, over}.data.current\`.

###### Recap before we dive deeper

In general, two tasks are needed to be defined on our own:
- \`collisionDetection\`: This relies heavily on our \`id\`'s in \`items\` prop, so provide meaningful prefix for the \`id\` in \`useSortable\` hook.

- \`onDragEnd\`: What \`API\` to call and what state to change, so provide \`data\` in \`useSortable\` hook.

##### Variant 2: Multiple Sortable Regions

[![](/assets/img/2025-11-15-19-48-00.png)](/assets/img/2025-11-15-19-48-00.png)

###### Orchestation {#simple_orchiestratgion_multi_regions}


Standard usecase is like we have a list of items and we want to drag one item into a folder of another list of folders.

The orchestration will be like

\`\`\`ts-1
<DndContext
    sensors={sensors}
    collisionDetection={customCollisionDetection}
    onDragStart={handleDragStart}
    onDragEnd={handleDragEnd}
>
    {/* this is wrapped by a SortableContext */}
    <SortableSubfolders 
        folders={folders} 
    />
    {/*  this is wrapped by another SortableContext */}
    <SortableScripts
        items={items}
        selectedFolderId={selectedFolderId}
    />
    {/* DragOverlay for smooth animations */}
    <DragOverlay>
        {activeId && activeType === "script" && (
            <ScriptItem script={script} folderId={folderId} />
        )}
        {activeId && activeType === "folder" && (
            <CollapsableFolder folder={folder} />
        )}
    </DragOverlay>
</DndContext>
\`\`\`

###### Dragging logic and animation across two regions

Again the dragging collision logic and the drag-end logic need to be provided in \`DndContext\`. 

Now to ensure smooth dragging animation, we need to disable the default animation in ***all*** \`SortableContext\`s

- [See the file for detail](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/src/app-component/FolderColumn/SortableFolderItem.tsx#L88)

We then define what we to be dragged ***visually*** using \`DragOveraly\` component (line-17 to 24 in [#simple_orchiestratgion_multi_regions]). Our \`collisionDetection\` logic now is also a key to the real-time sorting logic.


#### \`DndContext\` 

The root component that manages the drag-and-drop state.

\`\`\`ts
<DndContext
    sensors={sensors}
    collisionDetection={arg=>customCollisionDetection(arg)}
    onDragStart={handleDragStart}
    onDragEnd={handleDragEnd}
>
    {/* Draggable content here */}
</DndContext>
\`\`\`
We will be explaining the following key components in [#sensors], [#collisionDetection], [#onDragStart] and [#onDragEnd] respectively:

- \`sensors\`: Input methods (mouse, touch, keyboard)

- \`collisionDetection\`: Algorithm to detect overlaps
- \`onDragStart\`: Callback when drag begins
- \`onDragEnd\`: Callback when item is dropped
##### \`sensors\` {#sensors}


\`\`\`ts
import { KeyboardSensor, PointerSensor } from "@dnd-kit/core";
...

const sensors = useSensors(
    useSensor(PointerSensor),        // Mouse, touch, stylus
    useSensor(KeyboardSensor, {      // Keyboard navigation
        coordinateGetter: sortableKeyboardCoordinates,
    })
);
\`\`\`


###### PointerSensor


- Handles mouse, touch, and pen inputs
- Starts drag when pointer is pressed and moved
- Default activation: immediate on pointer down + move

###### KeyboardSensor

- This enables accessibility for keyboard users
- Allows drag/drop with arrow keys and Space/Enter
- \`sortableKeyboardCoordinates\` provides standard keyboard sorting behavior


##### \`collisionDetection\` {#collisionDetection}

This determines ***which droppable zone*** the dragged item is over. \`collisionDetection: CollisionDetection\` takes the following form:

\`\`\`ts
type CollisionDetection = (args: {
    active: Active;
    collisionRect: ClientRect;
    droppableRects: RectMap;
    droppableContainers: DroppableContainer[];
    pointerCoordinates: Coordinates | null;
}) => Collision[];
\`\`\`
where 
\`\`\`ts
export interface Collision {
    id: UniqueIdentifier;
    data?: Data;
}
\`\`\`

###### \`pointerWithin\` Strategy

It is used to check if pointer is inside droppable.

The return 
\`\`\`ts
const pointerCollisions = pointerWithin(args)
\`\`\`
are \`droppable\`s that contain the pointer position.

###### \`rectIntersection\` Strategy

Checks if pointer is inside droppable. 

Turn return 
\`\`\`ts
const rectCollisions = rectIntersection(args)
\`\`\`
are \`droppable\`s that intersect with dragged element's bounds




###### \`closestCenter\` Strategy

The return 
\`\`\`ts
const closestCollision = rectIntersection(args)
\`\`\`
is the \`droppable\` with the center closest to the center of the dragged element.


###### Example of \`customCollisionDetection\` 

This is an example used in my recent Tauri project.  We defer our custom collision detection logic to section [#customCollisionDetection]


##### \`onDragStart\` {#onDragStart}

\`\`\`ts
const [activeId, setActiveId] = useState<number | null>(null);
const [activeType, setActiveType] = useState<"script" | "folder" | null>(null);
\`\`\`

\`\`\`ts
const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    // custom state for data display
    setActiveId(active.id as number); 
    // custom state for data display
    setActiveType(active.data.current?.type || null);

    // Only set reordering state when dragging a folder, not a script
    if (active.data.current?.type === "folder") {
        dispatch(folderSlice.actions.setIsReorderingFolder(true));
    }
};
\`\`\`

##### \`onDragEnd\` {#onDragEnd}

\`\`\`ts
const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !folderResponse || !selectedRootFolderId) {
        dispatch(folderSlice.actions.setIsReorderingFolder(false));
        return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    // Case 1: Script dropped on folder (or root folder area) - move script to folder
    if (activeData?.type === "script" && overData?.type === "folder") {
        const script = activeData.script;
        const targetFolderId = overData.folderId;

        console.log("Moving script to folder:", script.id, "->", targetFolderId);

        moveScriptIntoFolder({
            scriptId: script.id,
            folderId: targetFolderId,
            rootFolderId: selectedRootFolderId,
        })
            .unwrap()
            .catch((error) => {
                console.error("Failed to move script:", error);
            });
    }
    // Case 2: Reordering scripts
    else if (activeData?.type === "script" && overData?.type === "script") {
        const activeScript = activeData.script as ShellScriptResponse;
        const overScript = overData.script as ShellScriptResponse;

        // Find which folders contain the scripts
        const activeFolder = findFolderContainingScript(folderResponse, activeScript.id!);
        const overFolder = findFolderContainingScript(folderResponse, overScript.id!);

        if (!activeFolder || !overFolder) {
            console.error("Could not find folders containing scripts");
            return;
        }

        // Case 2a: Scripts in the same folder - just reorder
        if (activeFolder.id === overFolder.id) {
            const oldIndex = activeFolder.shellScripts.findIndex(
                (s) => s.id === activeScript.id
            );
            const newIndex = activeFolder.shellScripts.findIndex((s) => s.id === overScript.id);

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                console.log(
                    \`Reordering scripts in folder \${activeFolder.id}: \${oldIndex} -> \${newIndex}\`
                );
                reorderScripts({
                    folderId: activeFolder.id,
                    fromIndex: oldIndex,
                    toIndex: newIndex,
                    rootFolderId: selectedRootFolderId,
                })
                    .unwrap()
                    .catch((error) => {
                        console.error("Failed to reorder scripts:", error);
                    });
            }
        }
        // Case 2b: Scripts in different folders - move and reorder
        else {
            const targetIndex = overFolder.shellScripts.findIndex(
                (s) => s.id === overScript.id
            );

            if (targetIndex !== -1) {
                console.log(
                    \`Moving script \${activeScript.id} from folder \${activeFolder.id} to folder \${overFolder.id} at index \${targetIndex}\`
                );

                const currentScriptCount = overFolder.shellScripts.length;

                // Step 1: Move the script to the target folder
                moveScriptIntoFolder({
                    scriptId: activeScript.id!,
                    folderId: overFolder.id,
                    rootFolderId: selectedRootFolderId,
                })
                    .unwrap()
                    .then(() => {
                        // Step 2: Reorder the script to the target index
                        // After moving, the script is at the end (currentScriptCount position)
                        const fromIndex = currentScriptCount;
                        if (fromIndex !== targetIndex) {
                            return reorderScripts({
                                folderId: overFolder.id,
                                fromIndex: fromIndex,
                                toIndex: targetIndex,
                                rootFolderId: selectedRootFolderId,
                            }).unwrap();
                        }
                    })
                    .catch((error) => {
                        console.error("Failed to move and reorder script:", error);
                    });
            }
        }
    }
    // Case 3: Reordering folders
    else if (activeData?.type === "folder" && overData?.type === "folder") {
        const oldIndex = folderResponse.subfolders.findIndex((f) => f.id === active.id);
        const newIndex = folderResponse.subfolders.findIndex((f) => f.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            console.log("Reordering folders");
            reorderSubfolders({
                parentFolderId: selectedRootFolderId,
                fromIndex: oldIndex,
                toIndex: newIndex,
                rootFolderId: selectedRootFolderId,
            })
                .unwrap()
                .catch((error) => {
                    console.error("Failed to reorder folders:", error);
                });
        }
    }

    dispatch(folderSlice.actions.setIsReorderingFolder(false));
    setActiveId(null);
    setActiveType(null);
};
\`\`\`


#### \`SortableContext\`

This enables items within a list to be reordered.

\`\`\`typescript
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";


<DndContext>
    ...
    <SortableContext
        items={items.map(item => item.id)}
        strategy={verticalListSortingStrategy}
    >
        {items.map(item => (
            <SortableItem key={item.id} item={item} />
        ))}
    </SortableContext>
</DndContext>
\`\`\`

- \`items\`: Array of item IDs
- \`strategy\`: Sorting behavior (vertical, horizontal, grid, etc)

Since in my application I mostly focus on vertical list, we directly use the default \`verticalListSortingStrategy\`.

**Remark.**  The purpose of \`items\`:
- ✅ Tell \`dnd-kit\` which items belong to this sortable group
- ✅ Track the order of items (for sorting calculations)
- ✅ Identify which items can be reordered together
- ❌ NOT used for rendering
- ❌ NOT used to access item data

The \`sortable\` item will be identified with the value in \`items\` via the \`useSortable\` or \`useDroppable\` hook when we provide \`{ id }\`.

#### Hooks to Register Dragging and Dropping MetaData

##### \`useSortable\`

This makes an individual item \`sortable\`, i.e., can be dragged ***and*** can be dropped (on mouse up).

\`\`\`typescript
const {
    attributes,   // Props for the draggable element
    listeners,    // Event handlers for dragging
    setNodeRef,   // Ref to attach to the DOM element
    transform,    // Current position transformation
    transition,   // CSS transition
    isDragging,   // Boolean indicating drag state
} = useSortable({
    id: item.id,
    data: { type: "item", item }, // Custom metadata
});
\`\`\`

Component (with \`ref={setNodeRef}\`) will register a value \`{ id, data }\` which will be used to customize the \`collision\` logic and \`onDragEnd\` logic.


##### \`useDroppable\`

This creates a drop zone that can receive dragged items (cannot be dragged itself).

\`\`\`typescript
const {
    setNodeRef,   // Ref for the droppable area
    isOver,       // Boolean: true when item hovers over this zone
} = useDroppable({
    id: "drop-zone-1",
    data: { type: "folder", folderId: 123 },
});
\`\`\`
Again any component having \`ref={setNodeRef}\` will become a droppable area.


#### DragOverlay

This renders a clone that follows the cursor while dragging (creates smooth animations).

\`\`\`typescript
<DragOverlay>
    {activeItem ? (  // activeItem is a local state
        <div className="opacity-80">
            <ItemPreview item={activeItem} />
        </div>
    ) : null}
</DragOverlay>
\`\`\`

### Example 
#### Repository 

- https://github.com/machingclee/2025-10-27-shell-script-manager-tauri

#### Brief Description {#brief_desc}

In the following example, we have 

- Collapsable Folders
- Scripts

For which:

- Scripts can be sorted among themselves
- A script can be dragged into a folder
- Scripts within a folder can be sorted


<customvideo src="/assets/videos/demo-drag-drop.mp4"></customvideo>



\`\`\`text
ScriptsColumn (DndContext)
    ├── SortableSubfolders
    │   └── CollapsableFolder (useSortable + useDroppable)
    │       - Can be dragged (for reordering)
    │       - Can accept scripts (as drop target)
    │
    └── SortableScripts
        └── SortableScriptItem (useSortable)
            - Can be dragged into folders or reordered
\`\`\`


#### Implementation

##### Main DndContext Setup {#customCollisionDetection}

**File:** \`src/app-component/ScriptsColumn/ScriptsColumn.tsx\`

\`\`\`ts-1
export default function ScriptsColumn() {
    const [activeId, setActiveId] = useState<number | null>(null);
    const [activeType, setActiveType] = useState<"script" | "folder" | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
\`\`\`
Next we define our custom collision logic. Recall that \`CollisionDetection\` always return \`Collision[]\`, as discussed in [#collisionDetection].


\`\`\`ts-11
    // Custom collision detection
    const customCollisionDetection: CollisionDetection = (args) => {
        const { active } = args;
        const isDraggingScript = active?.data.current?.type === "script";

        // When dragging scripts, prioritize folder drop zones
        if (isDraggingScript) {
            const pointerCollisions = pointerWithin(args);
            if (pointerCollisions.length > 0) {
                const droppableCollision = pointerCollisions.find(
                    ({ id }) => String(id).startsWith("folder-droppable-")
                );
                if (droppableCollision) {
                    return [droppableCollision];
                }
            }
        }

        // For folders, use normal rect intersection
        return rectIntersection(args);
    };
\`\`\`
This \`collisionDetection\` will indirectly affect \`over\` in line-44 below. 

For example, when a \`sortable\` lies inside a \`droppable\`, our custom collision logic tell us to return the one of highest priority (the folder-droppable) and affect what is returned in \`over\`.

\`\`\`ts-32{44}
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as number);
        setActiveType(active.data.current?.type || null);

        // Only set reordering state when dragging folders
        if (active.data.current?.type === "folder") {
            dispatch(folderSlice.actions.setIsReorderingFolder(true));
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || !folderResponse || !selectedFolderId) {
            dispatch(folderSlice.actions.setIsReorderingFolder(false));
            return;
        }

        const activeData = active.data.current;
        const overData = over.data.current;

        // Case 1: Script dropped on folder
        if (activeData?.type === "script" && overData?.type === "folder") {
            moveScript({
                ...activeData.script,
                folderId: overData.folderId,
            });
        }
        // Case 2: Reordering scripts
        else if (activeData?.type === "script" && overData?.type === "script") {
            // Reorder logic...
        }
        // Case 3: Reordering folders
        else if (activeData?.type === "folder" && overData?.type === "folder") {
            // Reorder logic...
        }

        dispatch(folderSlice.actions.setIsReorderingFolder(false));
        setActiveId(null);
        setActiveType(null);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableSubfolders folderResponse={folderResponse} />
            <SortableScripts
                folderResponse={folderResponse}
                selectedFolderId={selectedFolderId}
            />

            {/* DragOverlay for smooth animations */}
            <DragOverlay>
                {activeId && activeType === "script" && (
                    <div className="opacity-80">
                        <ScriptItem script={script} folderId={folderId} />
                    </div>
                )}
                {activeId && activeType === "folder" && (
                    <div className="opacity-80">
                        <CollapsableFolder folder={folder} />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
}
\`\`\`

##### Sortable Folder (Dual Purpose: Sortable + Droppable)

**File:** \`src/app-component/ScriptsColumn/CollapsableFolder.tsx\`


As displayed in the video of [#brief_desc], folder can be dragged and dropped, it does not come as a surprise that we need to use both \`useSortable\` and \`useDroppable\` hooks:


\`\`\`typescript-1{11,21,35}
export default function CollapsableFolder({ folder }) {
    // Make folder sortable (for reordering folders)
    const {
        attributes,
        listeners,
        setNodeRef: setSortableNodeRef,
        transform,
        transition,
        isDragging,
        setActivatorNodeRef,
    } = useSortable({
        id: folder.id,
        data: {
            type: "folder",
            folderId: folder.id,
            folder: folder,
        },
    });

    // Make folder droppable (to accept scripts)
    const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
        id: \`folder-droppable-\${folder.id}\`,
        data: {
            type: "folder",
            folderId: folder.id,
            folder: folder,
        },
    });

    // Get active drag context
    const { active } = useDndContext();
    const isDraggingScript = active?.data.current?.type === "script";

    // Only highlight when a script hovers over this folder
    const showHighlight = isOver && isDraggingScript;
\`\`\`

In line-35 we also require the folder be highlighted only when we are dragging a script.

Finally we set our folder as both \`droppable\` and \`sortable\` via \`ref\` attribute:
\`\`\`ts-36{37-40,49}
    // Combine both refs
    const setNodeRef = (node: HTMLElement | null) => {
        setSortableNodeRef(node);
        setDroppableNodeRef(node);
    };

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? "none" : transition,
        opacity: isDragging ? 0 : 1,  // Hide original when dragging
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <div className={clsx({
                "bg-gray-400 dark:bg-neutral-600": showHighlight,
                // Other styles...
            })}>
                <div ref={setActivatorNodeRef} {...listeners}>
                    <GripVertical />
                </div>
\`\`\`
Note that line-54 to 56 activated the draggability of an item. Only this "handle" can ***activate*** dragging:

![](/assets/img/2025-11-10-03-20-20.png)

Finally:

\`\`\`ts-57
                <Folder className="w-4 h-4" fill="currentColor" />
                {folder.name}
            </div>
        </div>
    );
}
\`\`\`


##### Sortable Script

**File:** \`src/app-component/ScriptsColumn/SortableScriptItem.tsx\`

This is relatively easy as it is the most basic draggable unit:

\`\`\`typescript
export default function SortableScriptItem({ script, folderId }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        setActivatorNodeRef,
    } = useSortable({
        id: script.id,
        data: {
            type: "script",
            script: script,
        },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? "none" : transition,
        opacity: isDragging ? 0 : 1,  // Hide when dragging
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <div ref={setActivatorNodeRef} {...listeners}>
                <GripVertical className="w-4 h-4" />
            </div>
            <ScriptItem script={script} folderId={folderId} />
        </div>
    );
}
\`\`\`


####  Key Challenges & Solutions

##### Challenge 1: Crossing SortableContext Boundaries

**Problem:** Dragging a script from the scripts list to a folder in the folders list caused animation interruption.

**Solution:**

1. Use a single \`DndContext\` wrapping both lists
2. Make folders **both sortable AND droppable**
3. Add \`DragOverlay\` to show a smooth clone following the cursor

\`\`\`typescript
// Single DndContext for both lists
<DndContext>
    <SortableContext items={folderIds}>
        {/* Folders */}
    </SortableContext>
    <SortableContext items={scriptIds}>
        {/* Scripts */}
    </SortableContext>
    <DragOverlay>
        {/* Smooth clone */}
    </DragOverlay>
</DndContext>
\`\`\`

Note that we have disabled (hided) the original clone of sortable object by:

- [this line](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/src/app-component/ScriptsColumn/SortableScriptItem.tsx#L39)


In some sense we have "moved" this clone into the \`DragOverlay\`. This makes it possible to have a smooth transition from one \`SortableContext\` to another \`SortableContext\`.


##### Challenge 2: Identifying Drop Targets

**Problem:** How to distinguish between dropping on a folder vs reordering?

**Solution:** We have prioritized the collision logic while dragging a script:

\`\`\`ts
// If we have script collisions, always prioritize them for sorting
if (scriptCollisions.length > 0) {
    // ... returns script collisions
    return [...scriptCollisions, ...droppablesToInclude];
}
\`\`\`

- [link to the file](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/src/app-component/ScriptsColumn/ScriptsColumn.tsx#L157)


So when we drag a script:
1. Over another script → Collision detection returns the script ID
    - \`over.id = 456\` (another script)
    - \`over.data.current.type = "script"\`
    - Result: Reordering happens
2. Over empty folder area → Collision detection returns the droppable ID
    - \`over.id = "folder-droppable-20"\`
    - \`over.data.current.type = "folder"\`
    - Result: Moving to folder happens

### References


- dndkit, [*dnd-kit Documentation*](https://docs.dndkit.com/)

- dndkit, [*dnd-kit Examples*](https://master--5fc05e08a4a65d0021ae0bf2.chromatic.com/)
- dndkit, [*GitHub Repository*](https://github.com/clauderic/dnd-kit)`;export{e as default};
