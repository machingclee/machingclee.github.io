const n=`---
title: "Rust Fundamentals"
date: 2025-09-30
id: blog0421
tag: rust
toc: true
intro: We study basic structure of a rust project
---



<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
  .download-btn-solid {
    background: #3b82f6;
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 16px;
    font-weight: 600;
    padding: 6px 24px;
    transition: all 0.3s ease;
    text-decoration: none;
    display: inline-block;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    margin-bottom: 20px;
  }

  .download-btn-solid:hover {
    background: #2563eb;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
  }
</style>

### Cargo 

- \`cargo new <project-name>\` to create a new project
- \`cargo add <crate-name>\` to add a crate



### Rules for Modules

Consider the following project structure:


<customimage src="/assets/img/2025-10-01-02-45-01.png" width="400"></customimage>

#### Define a module (By File)

By default we can can create a module by creating simply a \`blockchain.rs\` file.

#### Define a module (By Folder)

If we want to create a module by directory \`blockchain/\`, we need an ***entrypoint*** named \`mod.rs\` in that directory.


#### Export

In \`blockchain/mod.rs\` or \`blockchain/*.rs\`, we mark the target object that we want to export by \`pub\`.

#### Import module

In \`main.rs\` if we want to import objects from \`blockchain/\`, we write:
\`\`\`rust
// main.rs

// ask rust to grab the blockchain.rs or blockchain/mod.rs
mod blockchain; 

// what to import from blockchain/mod.rs
use blockchain::{Block, BlockChain, BlockSearch, BlockSearchResult}; 
\`\`\`
Rust will search for the file \`blockchain.rs\`, if nothing is matched then it looks for \`blockchain/mod.rs\`.

Each file is itself a namespace/module.
#### Import submodule

If we want to make the submodule \`blockchain/transaction.rs\` accessible by \`main.rs\`, first we ***declare to export*** that submodule in \`mod.rs\`:
\`\`\`rust
// blockchain/mod.rs 

pub mod transaction   // accessible by main.rs
// mod trasnaction    // accessible only by blockchain/mod.rs.
\`\`\`
Then in \`main.rs\` (if \`Transaction\` is defined in \`blockchain/transaction.rs\`):
\`\`\`rust
mod blockchain;
use blockchain::transaction::Transaction
\`\`\`

#### Import submodule from submodule (use crate::)

Assume now: 

<customimage src="/assets/img/2025-10-01-11-41-27.png" width="340"></customimage>

and we have 
\`\`\`rust
// blockchain/new_module.rs

pub struct NewModule {
    pub name: String,
}
\`\`\` 
then to import this \`NewModule\` into \`transaction.rs\` we 

1. \`mod new_module\` to declare a module in \`mod.rs\` and 

2. \`use crate::blockchain::new_module::NewModule;\` in \`transaction.rs\`.


### Implement Methods to a Struct

As in \`golang\` or \`kotlin\` we can define additional method to an existing struct/class:


\`\`\`rust 
pub struct Transaction {
    sender_address: Vec<u8>,
    recipient_address: Vec<u8>,
    value: u64,
}

impl Transaction {
    pub fn new(sender: Vec<u8>, recipient: Vec<u8>, value: u64) -> Transaction {
        Transaction {
            sender_address: sender,
            recipient_address: recipient,
            value,
        }
    }


    pub fn print(&self) {
        println!("sender_address {:?}", self.sender_address);
        println!("recipient_address: {:?}", self.recipient_address);
    }
}
\`\`\`

### The \`println!\` Function

- When we want rust to print a ***custom struct***, add \`#[derive(Debug)]\` to let rust generate and formatting function for us. These struct can be printed by 
  \`\`\`rust
  println!("some statement {:?}", some_struct)
  \`\`\`

- For primitive type we simple write \`println!("some value {}", some_value)\`

- To print a struct with customized logic, see <customanchor href="/blog/article/Rust-Fundamentals#Predefined-Trait:-std::fmt::Display">this section</customanchor>



### Trait (Interface)
A trait is simply an interface in other programming languages:

#### Custom Trait

\`\`\`rust
pub trait Serialization<T> {
    fn serialization(&self) -> Vec<u8>;
    fn deserialization(bytes: Vec<u8>) -> T;
}
\`\`\`

To let a struct implement a trait, we write 

\`\`\`rust
impl Serialization<Transaction> for Transaction {
    fn serialization(&self) -> Vec<u8> {
        ...
    }
}
\`\`\`


#### Predefined Trait: \`std::fmt::Display\`

Sometimes we would like to define the custom logging of our own structs via 
\`\`\`rust
println!("the object {}", the_object)
\`\`\`
while the \`{:?}\` that prints \`[#derive(Debug)]\`-annotated struct ***has no*** desired custom logic, here is how we do it:

\`\`\`rust
use std::fmt;

impl fmt::Display for Transaction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "\\n{}\\nSender address: {:?}\\nRecipent addresss: {:?}\\nValue: {}\\n{}",
            "-".repeat(40),
            self.sender_address,
            self.recipient_address,
            self.value,
            "-".repeat(40)
        )
    }
}
\`\`\`







### Convert into Bytes and Convert backwards

In some ocassion we need to serialize data efficiently via converting everythings into bytes.

#### usize

Nowadays our OS is typically in 64-bit, the \`usize\` by default refers to \`u64\`, which takes 8 bytes:

\`\`\`rust
let forward: Vec<u8> = (100_000_000 as usize).to_be_bytes().to_vec();
// we get 100_000_000 again:
let backard = usize::from_be_bytes(bytes[0..8].try_into().unwrap());
\`\`\`

Here \`bytes[0..8]\` is a \`[u8]\` type variable, which is known as an ***unsized*** variable that cannot be used anywhere (rust needs to know the size at compile time).

Here is what's happening:

\`\`\`rust
let slice = bytes[0..8]
    .try_into() // try to convert the unsized array into a sized one
    .unwrap()   // extract value from Ok(&[u8])
\`\`\`
    

#### String


\`\`\`rust
let forward: Vec<u8> = "some_string".as_bytes().to_vec();
let backward: String = String::from_utf8(in_bytes).unwrap();
\`\`\`


### Operator Overloading by Implementing Traits
#### \`+\`
Assume that we want to overload the meaning of \`+\` operator, then we simply write:

\`\`\`rust
use std::ops::AddAssign;
           // vvvvv type on the RHS 
impl AddAssign<i32> for Block {
                              // vvvvv type on the RHS
    fn add_assign(&mut self, rhs: i32) {
        self.nonce += rhs;
    }
}
\`\`\`



Our custom struct can now add an integer: \`block + 1\` to mean \`block.nonce += 1\`.


#### \`==\`

\`\`\`rust
use std::cmp::PartialEq;

pub struct Block {
    nonce: i32,
    previous_hash: Vec<u8>,
    time_stamp: u128,
    transactions: Vec<Vec<u8>>,
}

impl PartialEq for Block {
    fn eq(&self, other: &Self) -> bool {
        let self_hash = self.hash();
        let other_hash = other.hash();
        self_hash == other_hash
    }

    fn ne(&self, other: &Self) -> bool {
        !(*self == *other)
    }
}
\`\`\`

#### \`[index]\`

Note that we have to define the \`Output\` type:

\`\`\`rust{9}
use std::ops::{Index};

pub struct BlockChain {
    transaction_pool: Vec<Vec<u8>>,
    chain: Vec<Block>,
}

impl Index<usize> for BlockChain {
    type Output = Block;
    fn index(&self, index: usize) -> &Self::Output {
        let res = self.chain.get(index);
        match res {
            Some(block) => {
                return block;
            }
            None => {
                panic!("index out of range for the chain");
            }
        }
    }
}
\`\`\`
`;export{n as default};
