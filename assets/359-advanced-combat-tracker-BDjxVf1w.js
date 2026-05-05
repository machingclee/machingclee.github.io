const e=`---
title: "Advanced Combat Tracker (ACT): Scriping for Trigger"
date: 2024-01-11
id: blog0359
tag: act
toc: true
intro: "Record basic scriping for trigger."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Capture Variables from Event Text

In ACT every **_event text_** will be processed by our **_triggers_** (we can fire event text from our action as well, see conditional action in the next section).

The trigger determines if the subsequent **_actions_** take place by the following regular expression:

[![](/assets/img/2025-01-11-09-16-03.png)](/assets/img/2025-01-11-09-16-03.png)

Let's analyse the grouping here:

\`\`\`text
(?<=\\[notice\\]\\s)(?<sentence>.*)，位置(?<position>((\\d|\\w){1}))(?=|)
\`\`\`

They all follow the pattern:

\`\`\`text
(?<variable-name><matching-pattern>)
\`\`\`

which means that

1. Once \`matching-pattern\` matched
2. Assign the matched string to \`variable-name\`.

Note that we always just want the partially matched string. The \`match-group\` is exactly what we want.

### Actions to the Event Text: Scalar Variable Operation and Trigger Operation

#### Set-variable Action: Set the captured variable into global state

Assume a regular expression is met, let's add an action:

[![](/assets/img/2025-01-11-09-26-01.png)](/assets/img/2025-01-11-09-26-01.png)

Here the variable \`sentence\` is captured from \`(?<sentence>.*)\` in the example of previous section. Under the hood it:

1. Created a new variable called \`sigma_content\` in **_global scope_**.
2. Assigned a scoped variable (on captured) \`sentence\` into \`sigma_content\`. The value is dereferrenced by \`\${sigma_content}\`.

3. This is equivalent to
   \`\`\`js
   global_state["sigma_content"] = sentence;
   \`\`\`
   To access this global state, we will use \`\${var:sigma_content}\` later.

#### Conditional Action: Fire another trigger conditionally using global state

Let's add an action and select Trigger Operation:

![](/assets/img/2025-01-11-09-53-19.png)

This time we choose to fire another trigger with the information captured from scoped varaiable \`position\`.

![](/assets/img/2025-01-11-09-35-27.png)

You will be adding another trigger to be fired by the action we discuss just now.

Now let's switch to **_Action condition_**, you are free to add any condition using the global states as follows:

![](/assets/img/2025-01-11-09-50-25.png)

### Reset Variables

We need to reset variables when next fight starts:

![](/assets/img/2025-01-11-10-05-13.png)

\`\`\`text
戦闘開始！
\`\`\`
`;export{e as default};
