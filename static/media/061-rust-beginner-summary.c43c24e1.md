title: Summarize Rust Beginning Tutorial by a Simplified Multithreading Web Server
date: 2022-04-15
id: blog061
tag: rust
intro: Completed the Rust official tutorial from its <a href="https://doc.rust-lang.org/book/title-page.html">online book</a> and concluded the 20 chapters by a multithreading simple web server. Try to record the subtitle detail for future reference.



#### Lessons from the Implementation
We record the implementation of the ThreadPool in the next section. For this section, we record several encountered errors and methods to get around them.

##### Box, Rc\<T\> | Weak\<T\>, RefCell\<T\>, Mutex\<T\>, Arc\<t\>
- `Box<dyn T>`
  - ***Single thread only***
  - Help save data on heap instead of memory
  - Checked in compile time
- `Rc<T> | Weak<T>` 
  - ***Reference Count Type***
  - Checked in compile time
  - Used in ***single thread only***
  - Created by `let a = Rc:new(data)`
  - Cloned by `Rc::clone(&a)`
  - `a` above is immutable
  - Used when multiple reference is needed
  - ***Mainly*** used as immutable reference
  - Combined with `RefCell<T>`, we can implement ***interior mutability***
  - `Rc<T>.downgrade()` and `Rc<T>.upgrade()` can switch a reference to weak and strong respectively
  - (cont'd) Used when there is a recursive relation that has parent-children relationship
  - `weak_reference_count` wouldn't affect the release of resource as long as the  `strong_reference_count` of a variable goes to `0`
- `RefCell<T>`
  - ***Reference Cell Type***
  - Only checked in runtime
  - Used in ***single thread only***
  - Can be used in mutable and immutable reference
  - Let `let a = Rc::new(RefCell(4))`, then `a` is immutable
  - But `a.borrow_mut()` can create a mutable reference 
  - (cont'd) After destructured, `*a.borrow_mut() += 10` becomes valid
  - **Example (Interior Mutability).**
    ```rust
    // a should have been immutable,
    let a = Rc::new(RefCell::new(123));
    // but with RefCell::new, the data become mutable by using .borrow_mut()
    let b = Rc::new(&a);
    *b.borrow_mut() += 1000;
    print!("{:?}, {:?}", a, b);

    // print:
    // RefCell { value: 1123 }, RefCell { value: 1123 }
    ```
  - Some comments in the internet suggest avoiding interior mutability when possible
  - An immutable ereference can be created by `a.borrow()`
- `Mutex<T>`
  - Used in ***multi-threaded scenario***
  - Used when internal state of the object of type `T` can change in different thread, this is to avoid data race
  - Need `Mutex<T>.lock.unwrap()` to get the lock and gain right to access and mutate the value
- `Arc<T>` 
  - Used in ***multi-threaded scenario***
  - ***Thread-safe*** and ***multi-threaded version*** of `Rc<T>`, can be referenced by many threads
  - A stands for **atomic**
  - **Example.** Suppose that a single `receiver:  Arc<Mutex<mpsc::Receiver<Message>>>` is passed to 10 threads:
    ```rust
    let message: Message = receiver.lock().unwrap().recv().unwrap();
    ```
    We will be using module `mpsc` (multi-producer, single-consumer) to get `Sender` and `Receiver`



##### Access Struct's Field but Encounter: does not implement the Copy trait Error

We consider the following exmaple:
```rust
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
```
By `cargo check` we get 
```text
93 |  let bar = self.bar;
   |            ^^^^^^^^
   |            |
   |            move occurs because `self.bar` has type `Bar`, which does not implement the `Copy` trait
   |            help: consider borrowing here: `&self.bar`
```
###### Reason of the Problem
The problem is that `fn Bar.bar` takes the ownership of the `Bar` instance (the `self.bar`). If `self.bar.bar()` were executable, then `self.bar` will be release ***accidentally*** after the execution of that function is finished, which is disastrous and should be forbiddened.

<center></center>

###### Solution: Universal Trick by using Option\<T\>
In other words, `self.bar` must be taken away ***intentionally*** in order to be fed into `.bar` method. The universal trick is to make `self.bar` be of type `Option<T>`, then 
```rust
(self.bar as Option<T>).take()
```
can take away ***both*** the ownership and the value of `self.bar` and set `self.bar` to `None`:

```rust 
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
```
Note that because `self.bar` is mutated (as `self.bar` becomes `Option::None`), we need `foo(&mut self)` instead of `foo(&self)`.

<center></center>

**Possible Scenario.**
The problem discusses above occur occasionally. For example, if our struct contains a field named `thread: thread::JoinHandle<()>`, and if we want to execute `thread.join()`, then because the signature of `.join` is:
```rust
pub fn join(self) -> Result<T>
```
we must take out the `thread` intentionally by chaning the type of the field `thread` from type `thread::JoinHandle<()>` to  `Option<thread::JoinHandle<()>>`.

Such case does happen in our `Worker` struct in the next section.


#### Implementation of ThreadPool for Multithreaded Web Server
##### src/main.rs
```rust 
use std::{
    fs,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    thread,
    time::Duration,
};
use web_server::ThreadPool;

fn main() {
    let listener = TcpListener::bind("127.0.0.1:8080").unwrap();
    let pool = ThreadPool::new(4);

    for stream in listener.incoming() {
        let stream = stream.unwrap();
        pool.execute(|| handle_connection(stream));
    }
}

fn handle_connection(mut stream: TcpStream) {
    let get = b"GET / HTTP/1.1\r\n";
    let sleep = b"GET /sleep HTTP/1.1\r\n";

    let mut buffer = [0; 1024];
    stream.read(&mut buffer).unwrap();

    println!("{}", buffer.starts_with(get));

    let status_line: &str;
    let filename: &str;

    if buffer.starts_with(get) {
        status_line = "HTTP/1.1 200 OK";
        filename = "hello.html";
    } else if buffer.starts_with(sleep) {
        println!("{}", "sleeping...");
        thread::sleep(Duration::from_secs(5));
        println!("{}", "awake!");
        status_line = "HTTP/1.1 200 OK";
        filename = "hello.html";
    } else {
        status_line = "HTTP/1.1 404 NOT FOUND";
        filename = "404.html";
    };
    let contents = fs::read_to_string(filename).unwrap();
    let response = format!(
        "{}\r\nContent-Length: {}\r\n\r\n{}",
        status_line,
        contents.len(),
        &contents
    );
    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();
}
```
##### src/lib.rs
```rust
use std::{
    sync::{mpsc, Arc, Mutex},
    thread::{self, JoinHandle, Thread},
};

pub struct ThreadPool {
    workers: Vec<Worker>,
    sender: mpsc::Sender<Message>,
}

impl Drop for ThreadPool {
    fn drop(&mut self) {
        for _ in &self.workers {
            self.sender.send(Message::Terminate).unwrap();
        }

        for worker in &mut self.workers {
            println!("Shutting down worker {}", worker.id);
            if let Some(thread) = worker.thread.take() {
                thread.join().unwrap();
            }
        }
    }
}

enum Message {
    NewJob(Job),
    Terminate,
}

type Job = Box<dyn FnOnce() + Send + 'static>;

struct Worker {
    id: usize,
    thread: Option<thread::JoinHandle<()>>,
}

impl Worker {
    fn new(id: usize, receiver: Arc<Mutex<mpsc::Receiver<Message>>>) -> Worker {
        let thread = thread::spawn(move || loop {
            // recv() block the thread until new messages was sent
            // when that meassage is consumed by another rect, the message will be deleted
            // it is like a queue in python
            let message: Message = receiver.lock().unwrap().recv().unwrap();
            match message {
                Message::NewJob(job) => {
                    println!("Worker {} got a job; excuting", id);
                    job();
                }
                Message::Terminate => {
                    break;
                }
            }
        });
        Worker {
            id,
            thread: Some(thread),
        }
    }
}

impl ThreadPool {
    pub fn new(size: usize) -> ThreadPool {
        assert!(size > 0);
        let mut workers = Vec::with_capacity(size);
        let (sender, receiver) = mpsc::channel();
        let receiver = Arc::new(Mutex::new(receiver));
        for id in 0..size {
            let worker = Worker::new(id, Arc::clone(&receiver));
            workers.push(worker)
        }
        ThreadPool { workers, sender }
    }
    pub fn execute<F>(&self, f: F)
    where
        F: FnOnce() -> () + Send + 'static,
    {
        let job = Box::new(f);
        self.sender.send(Message::NewJob(job)).unwrap();
    }
}
```

