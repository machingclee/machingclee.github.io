const e=`---
title: Summarize Rust Beginning Tutorial by a Simplified Multithreading Web Server
date: 2022-04-15
id: blog061
tag: rust
intro: Completed the Rust official tutorial from its <a href="https://doc.rust-lang.org/book/title-page.html">online book</a> and concluded the 20 chapters by a multithreading simple web server. Try to record the subtitle detail for future reference.
---

### Lessons from the Implementation

We record the implementation of the ThreadPool in the next section. For this section, we record several encountered errors and methods to get around them.

#### Box, Rc\\<T\\> | Weak\\<T\\>, RefCell\\<T\\>, Mutex\\<T\\>, Arc\\<t\\>

- \`Box<dyn T>\`
  - **_Single thread only_**
  - Help save data on heap instead of memory
  - Checked in compile time
- \`Rc<T> | Weak<T>\`
  - **_Reference Count Type_**
  - Checked in compile time
  - Used in **_single thread only_**
  - Created by \`let a = Rc:new(data)\`
  - Cloned by \`Rc::clone(&a)\`
  - \`a\` above is immutable
  - Used when multiple reference is needed
  - **_Mainly_** used as immutable reference
  - Combined with \`RefCell<T>\`, we can implement **_interior mutability_**
  - \`Rc<T>.downgrade()\` and \`Rc<T>.upgrade()\` can switch a reference to weak and strong respectively
  - (cont'd) Used when there is a recursive relation that has parent-children relationship
  - \`weak_reference_count\` wouldn't affect the release of resource as long as the \`strong_reference_count\` of a variable goes to \`0\`
- \`RefCell<T>\`

  - **_Reference Cell Type_**
  - Only checked in runtime
  - Used in **_single thread only_**
  - Can be used in mutable and immutable reference
  - Let \`let a = Rc::new(RefCell(4))\`, then \`a\` is immutable
  - But \`a.borrow_mut()\` can create a mutable reference
  - (cont'd) After destructured, \`*a.borrow_mut() += 10\` becomes valid
  - **Example (Interior Mutability).**

    \`\`\`rust
    // a should have been immutable,
    let a = Rc::new(RefCell::new(123));
    // but with RefCell::new, the data become mutable by using .borrow_mut()
    let b = Rc::new(&a);
    *b.borrow_mut() += 1000;
    print!("{:?}, {:?}", a, b);

    // print:
    // RefCell { value: 1123 }, RefCell { value: 1123 }
    \`\`\`

  - Some comments in the internet suggest avoiding interior mutability when possible
  - An immutable ereference can be created by \`a.borrow()\`

- \`Mutex<T>\`
  - Used in **_multi-threaded scenario_**
  - Used when internal state of the object of type \`T\` can change in different thread, this is to avoid data race
  - Need \`Mutex<T>.lock.unwrap()\` to get the lock and gain right to access and mutate the value
- \`Arc<T>\`
  - Used in **_multi-threaded scenario_**
  - **_Thread-safe_** and **_multi-threaded version_** of \`Rc<T>\`, can be referenced by many threads
  - A stands for **atomic**
  - **Example.** Suppose that a single \`receiver:  Arc<Mutex<mpsc::Receiver<Message>>>\` is passed to 10 threads:
    \`\`\`rust
    let message: Message = receiver.lock().unwrap().recv().unwrap();
    \`\`\`
    We will be using module \`mpsc\` (multi-producer, single-consumer) to get \`Sender\` and \`Receiver\`

#### Access Struct's Field but Encounter: does not implement the Copy trait Error

We consider the following exmaple:

\`\`\`rust
struct Foo {
    bar: Bar,
}

impl Foo {
    fn foo(&self) {
        self.bar.bar();
    }
}

struct Bar {}

impl Bar {
    fn bar(self) {}
}

fn main() {
    let foo = Foo { bar: Bar {} };
    foo.foo();
}
\`\`\`

By \`cargo check\` we get

\`\`\`text
93 |  let bar = self.bar;
   |            ^^^^^^^^
   |            |
   |            move occurs because \`self.bar\` has type \`Bar\`, which does not implement the \`Copy\` trait
   |            help: consider borrowing here: \`&self.bar\`
\`\`\`

##### Reason of the Problem

The problem is that \`fn Bar.bar\` takes the ownership of the \`Bar\` instance (the \`self.bar\`). If \`self.bar.bar()\` were executable, then \`self.bar\` will be release **_accidentally_** after the execution of that function is finished, which is disastrous and should be forbiddened.

<center></center>

##### Solution: Universal Trick by using Option\\<T\\>

In other words, \`self.bar\` must be taken away **_intentionally_** in order to be fed into \`.bar\` method. The universal trick is to make \`self.bar\` be of type \`Option<T>\`, then

\`\`\`rust
(self.bar as Option<T>).take()
\`\`\`

can take away **_both_** the ownership and the value of \`self.bar\` and set \`self.bar\` to \`None\`:

\`\`\`rust
...
struct Foo {
    bar: Option<Bar>,
}

impl Foo {
    fn foo(&mut self) {
        if let Some(bar) = self.bar.take() {
            bar.bar();
        }
    }
}
...
\`\`\`

Note that because \`self.bar\` is mutated (as \`self.bar\` becomes \`Option::None\`), we need \`foo(&mut self)\` instead of \`foo(&self)\`.

<center></center>

**Possible Scenario.**
The problem discusses above occur occasionally. For example, if our struct contains a field named \`thread: thread::JoinHandle<()>\`, and if we want to execute \`thread.join()\`, then because the signature of \`.join\` is:

\`\`\`rust
pub fn join(self) -> Result<T>
\`\`\`

we must take out the \`thread\` intentionally by chaning the type of the field \`thread\` from type \`thread::JoinHandle<()>\` to \`Option<thread::JoinHandle<()>>\`.
`;export{e as default};
