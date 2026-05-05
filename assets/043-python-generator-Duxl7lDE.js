const n=`---
title: Python Generator
date: 2022-01-04
id: blog043
tag: python
intro: A simple remark on generator in python.
---

### Problem of Looping a Generator Using for Loop

Given a generator \`gen\` we can loop through the element that it generates by writing

\`\`\`python
for g in gen:
  # do something
  pass
\`\`\`

This kind of interations is fine if we do simple scripting/small tasks. I want to point out the downside of using \`for\` loop:

#### No Control on When to Stop

However, looping in this way means we have no control on when to stop our for loop until the generator get exhausted (which usually results from breaking the while loop in that generator). Especially when we do such kind of iteration in another thread, we wish to stop it in our will.

#### Why break is not always Working

You may think well we can add a conditional break inside the for loop, but what if \`gen\` itself is blocking once certain condition is met and never ends? In this case any logic to break the for loop will never run.

For example, \`gen\` can be a generator that read the tail part of a file, i.e., it yields the latest line of the file whenever there is a new line written to that file. If the implementation has no stopping mechanism (like \`tailer.follow\` in <a href="https://pypi.org/project/tailer/">tailer</a>), how do we stop looping a generator manaully?

Changing the source code is not the best way as very likely we have to share the code within our team.

### If Interupting a Loop of Generator is What you Need

Instead we create a while loop to consume the output of the generator:

\`\`\`python
gen = my_gen()
stop_event = Event()

while True and not stop_event.is_set():
    try:
        line = next(gen)
        # do something
    except StopIteration:
        print("stopped generator")
        break
\`\`\`

Be careful we have to handle the \`StopInteration\` exception that is raised when the while loop in \`gen\` breaks.

Now we can stop the iteration whenever we trigger \`stop_event.set()\`.

### Concret Example of Generator

Consider the following generator:

\`\`\`python
def my_gen():
    count = 0
    start = time.time()
    while True:
        now = time.time()
        time_diff = now - start
        if 2 <= time_diff and time_diff < 6 and count <= 4 :
            count += 1
            yield("start")
        if time_diff >= 6:
            break
\`\`\`

Now if we run

\`\`\`python
print("start generator")
for line in my_gen():
    print(line)
print("stopped generator")
\`\`\`

we get

\`\`\`python
start generator     # at 0th second
start               # at 2th second
start               # at 2th second
start               # at 2th second
start               # at 2th second
start               # at 2th second
stopped generator   # at 6th second
\`\`\`

- Basically the generator is blocking (as we \`yield\` nothing) from 0 to 2nd second;
- print 5 \`start\`'s at the 2nd second, blocking until 6th second;
- and the code continue to print \`stopped generator\` when it gets out of the for loop.
`;export{n as default};
