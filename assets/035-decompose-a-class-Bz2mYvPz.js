const e=`---
title: Decompose a Class into Separate Files
date: 2021-10-26
id: blog035
tag: python
intro: When a class grows to 500 to 1000 lines of codes it becomes hard and tedious to maintain because there starts to be many class methods, some are short, some are huge. It is a good starting point to separate particularly long functions from the class with ***very very minimal effort***, but how?
---

### Folder Structure

We start from the structure, \`sqs_client\` folder contains a utility class \`SqsClient\` in \`__init__.py\` which I have written in the past.

<center>
  <img src="/assets/tech/027.png"/>
</center>
<p/>

Originally all functions are written within a class defined in \`__init__.py\`. It causes mental fatigue when there is a bunch of functions but to only one of them we want to focus.

It also violates the **_separation of concerns_** principle for each single \`.py\` file (as a module) when all functionality are written in just a single file.

You may also notice I have an underscore in \`_listen.py\`. As in other languages this notation has something to do with privateness. However:

### Naming Convention --- Can we Make Class Methods Private?

In \`python\` there is **_no concept_** of private methods, the best you can do is to use **_name mangling_** as in:

\`\`\`python
class A:
  def __some_method(self):
    pass
\`\`\`

But users can still get access to it by \`a = A()\` and \`a._A__some_method()\`.

Worse still, functions named with double underscored as prefix cannot be imported by any other files. This makes our approach of decomposing a class impossible (as we shall see).

A single underscore \`_\` is enough to indicate a function should just be used internally (you can inspect it form other built-in modules in python like \`os\`). In IDEs, these methods will be sorted at the bottom in auto-completion.

### Implementation of Code Separation

As usual our \`__init__.py\` will be the entry point of our class and:

\`\`\`python
# __init__.py
class SqsClient:
  def __init__(self,...):
    self.sqs_client = ...

  # we remove the following function and import it from send_message.py
  # def send_message(self, message="n/a"):
  #   self.sqs_client.send_message(MessageBody=message)

  from ._listen import _listen
  from .send_message import send_message
  from .send_test_message import send_test_message
  from .start_listening_test_message import start_listening_test_message
  from .add_receive_message_handler import add_receive_message_handler
  from .start_listening import start_listening
\`\`\`

And we take \`send_message.py\` as an example:

\`\`\`python
# send_message.py
def send_message(self, message="n/a"):
    self.sqs_client.send_message(MessageBody=message)
\`\`\`

As we can see:

- We can copy and paste the methods written in \`__init__.py\` directly to another file without any modification of code (this make any refactoring rather simple!).
- In separated file we can still get access to attributes assigned to \`self\`.

When we init an instance by \`sqs_client = SqsClient()\`, we get access to all methods! We can run something like

\`\`\`python
sqs_client.send_message(message="123")
sqs_client.start_listening()
# ... etc
\`\`\`

and our \`__init__.py\` now just plays the role as an entry point.
`;export{e as default};
