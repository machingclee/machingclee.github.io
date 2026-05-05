const n=`---
title: "A Minimal Example for react-beautiful-dnd"
date: 2024-07-28
id: blog0302
tag: react
toc: true
intro: "Record a minial working example for react-beautiful-dnd."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Repository
Instead of the official one (that is not maintained for a long while), we use a forked repo:
- https://github.com/hello-pangea/dnd
We install by 
\`\`\`text
yarn add @hello-pangea/dnd
\`\`\`

### Result 

Since I haven't set state on drag end, the result bounces back to the original:

<a href="/assets/tech/302/dnd.gif"><img src="/assets/tech/302/dnd.gif"/></a>


### Code Example 

It is my intention ***not to wrap*** any of the \`Dropppable\` and \`Draggable\` into a component. In this way we see how the componenets work and how they should be structured.

Later we can abstract all those complexities into a component when we refactor it.

\`\`\`tsx
export default () => {
    const currDate = new Date();
    const currDateDayjs = dayjs(currDate);
    const firstDayOfMonth = startOfMonth(currDate);
    const endDayOfMonth = endOfMonth(currDate);
    const daysOfMonth = eachDayOfInterval({ start: firstDayOfMonth, end: endDayOfMonth });

    const richerDaysOfMonth = daysOfMonth.map(date => {
        const dayJS = dayjs(date);
        const dayIndex = getDay(date);
        return {
            dayIndex,
            dayJS
        }
    })

    const geyDayInMonth = (dayIndex: number) => {
        return richerDaysOfMonth.filter(d => d.dayIndex === dayIndex);
    }

    const [ids1, setIds1] = useState<string[]>(Object.keys(tasks1));
    const [ids2, setIds2] = useState<string[]>(Object.keys(tasks2));

    return (
        <div>
            <SectionTitle>Timetables</SectionTitle>
            <Spacer />
            <SectionTitle>
                {currDateDayjs.format("MMMM")}
            </SectionTitle>
            <Spacer />
            <DragDropContext
                onDragEnd={(result) => {

                }}
            >
                <div style={{ display: "flex" }}>
                    <div style={{ flex: 1 }}>
                        <Droppable droppableId="test-1">
                            {(provided) => {
                                return (
                                    <div ref={provided.innerRef} {...provided.droppableProps}>
                                        {ids1.map((id, index) => {
                                            const task = tasks1[id]
                                            return (
                                                <Draggable draggableId={id.toString()} index={index}>
                                                    {(provided_) => (
                                                        <div

                                                            ref={provided_.innerRef}
                                                            key={task.id}
                                                            {...provided_.draggableProps}
                                                            {...provided_.dragHandleProps}
                                                        >
                                                            <div style={{ padding: 10, boxShadow: boxShadow.SHADOW_61 }}>
                                                                {task.context}
                                                            </div>
                                                            <Spacer />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            )
                                        })}
                                        {provided.placeholder}
                                    </div>
                                )
                            }}
                        </Droppable>
                    </div>
                    <Spacer />
                    <div style={{ flex: 1 }}>
                        <Droppable droppableId="test-2">
                            {(provided) => {
                                return (
                                    <div ref={provided.innerRef} {...provided.droppableProps}>
                                        {ids2.map((id, index) => {
                                            const task = tasks2[id]
                                            return (
                                                <Draggable draggableId={id.toString()} index={index}>
                                                    {(provided_) => (
                                                        <div

                                                            ref={provided_.innerRef}
                                                            key={task.id}
                                                            {...provided_.draggableProps}
                                                            {...provided_.dragHandleProps}
                                                        >
                                                            <div style={{ padding: 10, boxShadow: boxShadow.SHADOW_61 }}>
                                                                {task.context}
                                                            </div>
                                                            <Spacer />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            )
                                        })}
                                        {provided.placeholder}
                                    </div>
                                )
                            }}
                        </Droppable>
                    </div>
                </div >
            </DragDropContext >
        </div >
    )
}
\`\`\`
`;export{n as default};
