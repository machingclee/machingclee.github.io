---
title: "Rust Study Notes"
date: 2023-08-27
id: blog0169
tag: rust
intro: "Study notes from the beginning"
toc: true
---

#### Life Time

The compiler has 3 rules for the lifetime:

- The compiler assigns a lifetime parameter to **_each_** parameter that's a reference
- If there is exactly **_one_** input lifetime parameter, that lifetime is assigned to **_all_** output lifetime parameters.
- If there are **_multiple_** input lifetime parameters, **_but_** one of them is `&self` or `&mut self` because this is a method, the lifetime of `self` is assigned to **_all_** output lifetime parameters

Note that

- A liftime comes from an input reference is called an **input lifeime**;
- that comes from an output reference is called an **output lifetime**.

To sum up, we always expect:

$$
\text{output lifetime}=\min_\alpha\big\{\text{input_lifeime}_{\!\!\!\!\alpha}\big\}.
$$

#### Result Type

We treat `Result` type like a `Promise` in javascript, in which we have

- `return Ok(...); = resolve(...);` and
- `return Err(...); = reject(...);`.

The generic type parameters of `Result` following the rule:

```rust
Result<type returned by Ok, type returned by Err>
```

```rust
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
```

There are two ways to squeeze the `Config` out of `Result` enum:

##### Extraction Method 1: Squeezing by Unwrap

Next in our programme if we `unwrap` and handle the error gracefully:

```rust-1
let args: Vec<String> = env::args().collect();
let config = Config::new(&args).unwrap_or_else(|err| {
    println!("Problem parsing arguments: {}", err);
    process::exit(1);
});
run(config);
```

Then from line 6 onwards our `config` has been converted from `Result` to `Config`.

> **Take away.** We can squeeze `Result<T>` to ` T` by executing `unwrap()` once.

##### Extraction Method 2: Assigning by Some

Alternatively, it is conventional to write a placeholder `null` variable and assign value into it when something exists, that pattern in rust is implemented by `Option` enum and `Some` object:

```rust
let mut config: Option<Config> = None;

let result = Config::new(&args);
if let Ok(config_) = result {
    config = Some(config_);
};

if let Some(config_unwrapped) = config {
    run(config_unwrapped);
};
```

We didn't handle the error and error message. We can combine `unwrap_or_else` and the assignment `= Some(config_)` approach depending on the ways of doing things.

If we want multiple nulls checking,

```rust
if let (Some(a_), Some(b_)) = (a, b) {
    // do something
}
```

For example,

```rust
if let (Some(a), Some(b)) = (Some(7), Some(8)) {
    println!("Result: {}", a * b);
}
```

prints `56`.

#### Throwing Arbitrary Error

Consider the following function:

```rust
fn run(config: Config) -> Result<(), Box<dyn Error>> {
    let query = config.query;
    let filename = config.filename;
    let contents = fs::read_to_string(filename)?;
    println!("{}", contents);
    Ok(())
}
```

- `fs::read_to_string` returns a `Result` object. If we want to throw an `Error` and let the function call in the previous stack frame to handle it, we just add a `?`.
- The `Box<dyn Error>` in the return type serves the same purpose as `Java`'s
  ```java
  public void function someFunction() throws Exception {};
  ```

#### Handle the Final Execution Error

Assume that we have:

```rust-1
fn main() {
    let args: Vec<String> = env::args().collect();
    let config = Config::new(&args).unwrap_or_else(|err| {
        println!("[Problem parsing arguments] {}", err);
        process::exit(1);
    });
```

Then the following two are equivalent:

```rust-7
    run(config).unwrap_or_else(|err| {
        println!("Application Error: {}", err);
        process::exit(1);
    });
}
```

```rust-7
    if let Err(err) = run(config) {
        println!("Application Error: {}", err);
        process::exit(1);
    }
}
```
