const n=`---
title: "Event Storming Diagram by React Page"
date: 2026-02-11
id: blog0453
tag: spring, react
toc: true
intro: "Discuss how to draw event-storming diagram using data generated from existing commands and events, rather than a schematic design at the early stage of the system"
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

### Repository 

- https://github.com/machingclee/2026-02-09-command-flow-visualizer


### Data Demonstration


![](/assets/img/2026-02-11-17-00-04.png)

- [Sample Data](https://github.com/machingclee/2026-02-09-command-flow-visualizer/blob/main/src/commands.json)

- [Sample Diagram (Web Page)](http://event-storming-example.s3-website.ap-northeast-2.amazonaws.com/)


### Objective  of the Component

This component is to ***draw event storming diagram*** using data generated from existing commands and events of a backend application. 

We already have one approach drawing this diagram by 
- [PlantUML for EventSourcing and an GUI-application (for Editing)](/blog/article/PlantUML-for-EventSourcing-and-an-GUI-application-for-Editing-)

But setting a CICD job that deploys a web which draws the workflow is much easier.





### Usage

#### Terminology 

- **Command.** is used when it would change the application state.

- **Event.**  is used to describe a state change has happened.

- **Policy.** is used to orchestrate how an event could create side effect. A policy would listen to an event, and dispatch another command.

   All side effect must take place in policies. 

In spring, \`Command\` and \`Event\` are simply \`data class\`s in kotlin (or \`record class\` in java). 

A \`Policy\` is an \`@Component\`-annotated class that has a bunch of \`@EventListener\`-annotated methods. Namely, it defines a set of event listeners. 

Any state change causes an event, events are listened by \`EventListener\`s in our policies which will handle the logic of further state change. 

Let's consider an example:


<Example>


![](/assets/img/2026-02-11-17-22-09.png)

\`AIProfileCreatedEvent\` was listened by \`AIProfileDefaultPolicy\`, meaning a system state change would happen when a resource \`AIProfile\` has been created. 

Next \`AIProfileDefaultPolicy\` determines whether we should invoke \`SelectDefaultAIProfileCommand\` by considering if there is existing default selection or not.

So the state change of default selection is explicitly listed out in our event-storming diagram, rather than being hidden in the domain logic of creating an \`AIProfile\` via some.


</Example>


Note that ***there can be multiple events*** pointing to the same policy:

![](/assets/img/2026-02-12-09-54-47.png)

Our policy actually tries to manage/centralize the side effects of all related resources (like \`AIProfileDefaultPolicy\` focuses on all the side effects related to \`AIProfile\` default settings). 

There can be private methods in a policy that share similar state change logics, but once there are cases that break the similarity, we can easily change in event handlers (loose coupling).


#### Interfaces

Our major component is implemented by [react-flow](https://reactflow.dev/learn) with the following interfaces:


##### Command
\`\`\`tsx
interface Command {
    from: string;
    to: string[];
}
\`\`\`
- \`from\` is a command name
- \`to\` is a list of event names

##### Policy

\`\`\`tsx
interface Policy {
    policy: string;
    fromEvent: string;
    toCommand: string;
}
\`\`\`

- \`policy\` is a policy name
- \`fromEvent\` mean which event would trigger the policy
- \`toCommand\` mean which further state change would be triggered

#### \`CommandFlowVisualizer\`
Our visualizer takes the following interface:

\`\`\`tsx
const CommandFlowVisualizer = (props: {
    commands: {
        commands: Command[],
        policies: Policy[]
    }
}): ReactNode
\`\`\`

[Full implementation](https://github.com/machingclee/2026-02-09-command-flow-visualizer/blob/main/src/components/CommandFlowVisualizer.tsx) of the component can be found here, but this is not the focus of this article.

Assume that we have defined a data \`commands\`:

\`\`\`tsx
const commands : {
        commands: Command[],
        policies: Policy[]
} = [ ... ]
\`\`\`

Our diagram can be drawn as simply as invoking 
\`\`\`tsx
<CommandFlowVisualizer commands={commands} />
\`\`\``;export{n as default};
