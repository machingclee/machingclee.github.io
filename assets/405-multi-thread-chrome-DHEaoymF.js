const e=`---
title: Multi-threading For Elementary Tasks in Browsers
date: 2025-07-22
id: blog0405
tag: js, nodejs, react
toc: true
intro: We use additional thread to execute computational task by built-in workers API
---

### The Worker Object

In browser we can delegate our computational task via \`Worker\` API (from browser) as follows:

\`\`\`kotlin{3,5,11-12,14}
const workerCode = \`
    self.onmessage = function(e) {
        const taskInput = e.data
        // some computation using this input
        const taskOutput = ...
        self.postMessage(taskOutput)
    };\`
const blob = new Blob([workerCode], { type: "application/javascript" })
const worker = new Worker(URL.createObjectURL(blob))

const taskInput = ...
worker.postMessage(taskInput)
worker.onmessage = (e) => {
    const taskOutput = e.data
    // set state using this output
    ...
}
\`\`\`

### Cannot pass Function as a Message into Worker

It is ***tempting*** 

1. ***not to*** define the code execution via the \`workCode\` string and

2. to try passing the function into the \`Worker\` object by  \`postMessage\` and let the worker asynchronously handle the function execution. 

This however is ***impossible***, we get the following error if we do so:

\`\`\`text
Unhandled Rejection (DataCloneError): Failed to execute 'postMessage' on 'Worker': 
    function () {
        var self = this, args = arguments;
        return new Promise(function (resolve, reject) 
        ...<omitted>... 
    } 
could not be cloned.
\`\`\`

this is due to the ***unserializability*** of functions object, therefore ***no dependency*** is possible to be carried into the \`Worker\`. 

In other words, \`Worker\` can only execute elementary tasks that the browser can understand.`;export{e as default};
