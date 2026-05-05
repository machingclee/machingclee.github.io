const e=`---
title: "Rust Study Notes"
date: 2023-09-04
id: blog0169
tag: rust
intro: "This is a beginner notes."
toc: true
---

### Life Time

The compiler has 3 rules for the lifetime:

- The compiler assigns a lifetime parameter to **_each_** parameter that's a reference
- If there is exactly **_one_** input lifetime parameter, that lifetime is assigned to **_all_** output lifetime parameters.
- If there are **_multiple_** input lifetime parameters, **_but_** one of them is \`&self\` or \`&mut self\` because this is a method, the lifetime of \`self\` is assigned to **_all_** output lifetime parameters

Note that

- A liftime comes from an input reference is called an **input lifeime**;
- that comes from an output reference is called an **output lifetime**.

To sum up, we always expect:

$$
\\text{output lifetime}=\\min_\\alpha\\big\\{\\text{input_lifeime}_{\\alpha}\\big\\}.
$$

### Result Type

We treat \`Result\` type like a \`Promise\` in javascript, in which we have

- \`return Ok(...); = resolve(...);\` and
- \`return Err(...); = reject(...);\`.

The generic type parameters of \`Result\` following the rule:

\`\`\`rust
Result<type returned by Ok, type returned by Err>
\`\`\`

\`\`\`rust
struct Config<'a> {
    query: &'a String,
    filename: &'a String,
}

impl<'a> Config<'a> {
    fn new(args: &'a [String]) -> Result<Config, &str> {
        if args.len() < 3 {
            return Err("not enough arguments");
        }
        let query = &args[1];
        let filename = &args[2];
        Ok(Config { query, filename })
    }
}
\`\`\`

There are two ways to squeeze the \`Config\` out of \`Result\` enum:

#### Extraction Method 1: Squeezing by Unwrap

Next in our programme if we \`unwrap\` and handle the error gracefully:

\`\`\`rust-1
let args: Vec<String> = env::args().collect();
let config = Config::new(&args).unwrap_or_else(|err| {
    println!("Problem parsing arguments: {}", err);
    process::exit(1);
});
run(config);
\`\`\`

Then from line 6 onwards our \`config\` has been converted from \`Result\` to \`Config\`.

> **Take away.** We can squeeze \`Result<T>\` to \` T\` by executing \`unwrap()\` once.

#### Extraction Method 2: Assigning by Some

Alternatively, it is conventional to write a placeholder \`null\` variable and assign value into it when something exists, that pattern in rust is implemented by \`Option\` enum and \`Some\` object:

\`\`\`rust
let mut config: Option<Config> = None;

let result = Config::new(&args);
if let Ok(config_) = result {
    config = Some(config_);
};

if let Some(config_unwrapped) = config {
    run(config_unwrapped);
};
\`\`\`

We didn't handle the error and error message. We can combine \`unwrap_or_else\` and the assignment \`= Some(config_)\` approach depending on the ways of doing things.

If we want multiple nulls checking,

\`\`\`rust
if let (Some(a_), Some(b_)) = (a, b) {
    // do something
}
\`\`\`

For example,

\`\`\`rust
if let (Some(a), Some(b)) = (Some(7), Some(8)) {
    println!("Result: {}", a * b);
}
\`\`\`

prints \`56\`.

### Throwing Arbitrary Error

Consider the following function:

\`\`\`rust
fn run(config: Config) -> Result<(), Box<dyn Error>> {
    let query = config.query;
    let filename = config.filename;
    let contents = fs::read_to_string(filename)?;
    println!("{}", contents);
    Ok(())
}
\`\`\`

- \`fs::read_to_string\` returns a \`Result\` object. If we want to throw an \`Error\` and let the function call in the previous stack frame to handle it, we just add a \`?\`.
- The \`Box<dyn Error>\` in the return type serves the same purpose as \`Java\`'s
  \`\`\`java
  public void function someFunction() throws Exception {};
  \`\`\`

### Handle the Final Execution Error

Assume that we have:

\`\`\`rust-1
fn main() {
    let args: Vec<String> = env::args().collect();
    let config = Config::new(&args).unwrap_or_else(|err| {
        println!("[Problem parsing arguments] {}", err);
        process::exit(1);
    });
\`\`\`

Then the following two are equivalent:

\`\`\`rust-7
    run(config).unwrap_or_else(|err| {
        println!("Application Error: {}", err);
        process::exit(1);
    });
}
\`\`\`

\`\`\`rust-7
    if let Err(err) = run(config) {
        println!("Application Error: {}", err);
        process::exit(1);
    }
}
\`\`\`

### Second Visit to the Multi-threading Web Server Example In Rust Book

My energy got exhausted at the first time I go with rust book to the last chapter (you can see how much detail I have recorded [**_here_**](/blog/article/Summarize-Rust-Beginning-Tutorial-by-a-Simplified-Multithreading-Web-Server#Implementation-of-ThreadPool-for-Multithreaded-Web-Server) before the last chapter on web server!).

This time I grabbed and digested detail in a deeper understanding. I try to record the detail in this blog post.

#### fn main()

We start off by writing down the general structure of the program in \`main\` function, the intersting part lies inside \`lib.rs\`, i.e., how we define \`ThreadPool\`.

\`\`\`rust
use std::io::prelude::*;
use std::net::TcpListener;
use std::net::TcpStream;
use std::time::Duration;
use std::{fs, thread};

use web_server::ThreadPool;

fn main() {
    let listener = TcpListener::bind("127.0.0.1:7878").unwrap();

    let pool = ThreadPool::new(4);

    for stream in listener.incoming() {
        let stream = stream.unwrap();
        pool.execute(|| {
            handle_connection(stream);
        });
    }
}

fn handle_connection(mut stream: TcpStream) {
    let get = b"GET / HTTP/1.1\\r\\n";
    let sleep = b"GET /sleep HTTP/1.1\\r\\n";

    let mut buffer = [0; 1024];
    stream.read(&mut buffer).unwrap();

    println!("{}", buffer.starts_with(get));

    let (status_line, filename) = if buffer.starts_with(get) {
        ("HTTP/1.1 200 OK", "hello.html")
    } else if buffer.starts_with(sleep) {
        println!("{}", "sleeping...");
        thread::sleep(Duration::from_secs(5));
        println!("{}", "awake!");
        ("HTTP/1.1 200 OK", "hello.html")
    } else {
        ("HTTP/1.1 404 NOT FOUND", "404.html")
    };

    let contents = fs::read_to_string(filename).unwrap();
    let response = format!(
        "{}\\r\\nContent-Length: {}\\r\\n\\r\\n{}",
        status_line,
        &contents.len(),
        &contents
    );
    stream.write(response.as_bytes()).unwrap();
    stream.flush().unwrap();
}
\`\`\`

#### lib.rs, the web_server::ThreadPool

\`lib.rs\` is a single module which by default is imported by calling

\`\`\`rust
project_name::{what's defined as pub in lib.rs}
\`\`\`

Inside our \`lib.rs\` we have

\`\`\`rust-1
use std::option::Option;
use std::{
    sync::{
        mpsc::{self, Receiver},
        Arc, Mutex,
    },
    thread,
};

pub struct ThreadPool {
    workers: Vec<Worker>,
    sender: mpsc::Sender<Message>,
}
\`\`\`

I would like to pin the takeways in this program (instead of introducing what's the target and what's to be done in this example).

\`\`\`rust-14
// property of a mutable reference is at most mutable reference
// we cannot move it out, moving is not a mutation
impl Drop for ThreadPool {
    fn drop(&mut self) {
        println!("Terminating all workers");
        for _ in &self.workers {
            self.sender.send(Message::Terminate).unwrap();
        }

        for worker in &mut self.workers {
\`\`\`

**_1st Takeaway._** We would write line 23 as

\`\`\`rust
for worker in self.workers
\`\`\`

instead by our first instinct, an error will pop up:

\`\`\`none
\`self.workers\` moved due to this implicit call to \`.into_iter()\`
\`into_iter\` takes ownership of the receiver \`self\`, which moves \`self.workers\`
\`\`\`

- The property of a **_mutable reference_** is **_at most_** a mutable reference (which we need to specify).
- The reason is that \`.into_iter(self)\` is implicitly called, which \`moves\` our \`self.workers\` into a function that generates iterator.
- Although \`self\` is a **_mutable_** reference, moving its property is not a mutation, a move will _drain the memory out_ by assigning the source property to \`null_ptr\` and assign that original pointer to the target that we move into.

\`\`\`rust-24
            println!("Shutting down worker {}", worker.id);

            if let Some(thread) = worker.thread.take() {
                thread.join().unwrap();
            }
        }
    }
}
\`\`\`

**_2nd Takeaway._** Note that \`worker\` is a property of a mutable reference \`self.workers\`, hence again \`worker\` itself is at most a mutable reference.

However, we want to call \`worker.thread.join().unwrap()\`, the function \`join\` has signature \`join(self)\`, i.e., \`worker.thread\` will be moved.

The usual _trick_ in rust is to wrap \`T\` into \`Option<T>\`, then \`Option<T>::take()\` allows moving the \`Some<T>\` out by careful unsafe rust implementation.

\`\`\`rust-32
enum Message {
    Job(Box<dyn FnOnce() + Send + 'static>),
    Terminate,
}
\`\`\`

**_3nd Takeway._** In the course of coding this example, instead of implementing \`enum Message\`, what we originally implemented is simply

\`\`\`rust
type Job = Box<dyn FnOnce() + Send + 'static>
\`\`\`

and in line 42 has been

\`\`\`rust
let (sender, receiver) = mpsc::channel::<Job>();
\`\`\`

Because later on we not only want to signal a \`Job\` to the threads, we also want to signal a \`Termination\` to the threads.

In plain javascript we can naively implement this by sending \`["job", job]\` and \`["terminate", null]\` to the workers, i.e., we append some \`field\` to distinguish the messages.

In rust approach, we treat that \`field\`'s as enum **_variants_**:

- \`Job(job trait)\` $\\longleftrightarrow$ \`["job", job]\` (job is a closure)
- \`Terminate\` $\\longleftrightarrow$ \`["terminate", null]\`

and we group the variants in an enum class:

\`\`\`rust
enum Message {
    Job(Box<dyn FnOnce() + Send + 'static>),
    Terminate,
}
\`\`\`

\`\`\`rust-36
impl ThreadPool {
    pub fn new(size: usize) -> Self {
        assert!(size > 0);
        let mut workers = Vec::with_capacity(size);
        let (sender, receiver) = mpsc::channel::<Message>();

        let receiver = Arc::new(Mutex::new(receiver));

        for id in 0..size {
            workers.push(Worker::new(id, receiver.clone()));
        }

        ThreadPool { workers, sender }
    }

    pub fn execute<F>(&self, f: F)
    where
        F: FnOnce() + Send + 'static,
    {
        let job = Message::Job(Box::new(f));
        self.sender.send(job).unwrap();
    }
}

struct Worker {
    id: usize,
    thread: Option<thread::JoinHandle<()>>,
}

impl Worker {
    fn new(id: usize, receiver: Arc<Mutex<Receiver<Message>>>) -> Worker {
        let thread = thread::spawn(move || loop {
            let msg = receiver.clone().lock().unwrap().recv().unwrap();
            match msg {
                Message::Job(job) => {
                    println!("Worker {} got a job; excuting.", id);
                    job();
                }
                Message::Terminate => {
                    println!("Terminated!");
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
\`\`\`

Finally:

- \`Arc\` is a multi-threaded version of \`Rc\` for multiple reference to the same wrappered object.
- \`Mutex\` is to block access from other threads to the wrapped object.
`;export{e as default};
