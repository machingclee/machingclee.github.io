const e=`---
title: "Implement ECDSA for Transaction Verification in a Blockchain"
date: 2025-10-08
id: blog0422
tag: rust, blockchain, elliptic-curve
toc: true
intro: Study verificaiton mechanism in a blockchain system.
img: blockchain
---


<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>

### Repository 

Executable testing code is placed at:

- [2025-10-02-blockchain-study-in-rust](https://github.com/machingclee/2025-10-02-blockchain-study-in-rust)

This project is a ***study of Rust*** under the block-chain context, and this is not a full block-chain project.



### Cargo.toml
\`\`\`toml
hex = "0.4.3"
p256 = {version  = "0.13.2", features=["ecdsa", "arithmetic"]}
rand_core="0.6"
sha2 = "0.10.9"
ripemd160 = "0.9"
bs58 = "0.4"
serde={version="1.0.207", features=["derive"]}
serde_json = "1.0.124"
\`\`\`

### Crate

\`\`\`rust
use bs58;
use p256::ecdsa::{
    Signature, SigningKey, VerifyingKey,
    signature::{self, SignerMut, Verifier},
};
use rand_core::OsRng;
use ripemd160::{Digest as RipDigest, Ripemd160};
use serde::Serialize;
use sha2::{Digest, Sha256};
\`\`\`

- Here we import the traits \`SignerMut\` and \`Verifier\` simply for importing the ***implementation*** for the struct \`VerifyingKey\`.  

- More specifically, without \`Verifier\` the method call 
  \`\`\`rust
  public_key.verify(&msg_bytes, &signature)
  \`\`\`
  will throw an error in IDE level, where \`public_key: VerifyingKey<NistP256>\`.

### Define Wallet and Transaction

\`\`\`rust
// src/wallet/mod.rs

pub struct Wallet {
    pub signing_key: SigningKey,
    pub verifying_key: VerifyingKey,
    address: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct Transaction {
    pub sender: String,
    pub recipient: String,
    pub amount: u64,
    pub public_key: String,
    pub signature: String,
}
\`\`\`

### ECDSA Wallet Implementation: Signing and Verifying Transactions
#### Detail Hidden in Crate \`p256\`, \`ripemd160\` and \`OsRng\`
##### More on public key and private key in an elliptic curve setting

Let's start our long journey from defining the factory method of a \`Wallet\`:

\`\`\`rust-1
impl Wallet {
    pub fn new() -> Self {
        let signing_key = SigningKey::random(&mut OsRng);
        let verifying_key = signing_key.verifying_key().clone();
        let mut address = String::new();
\`\`\`
Recall that the \`p256\` curve (also known as \`secp256r1\` or \`prime256v1\` or \`256-bit\` prime field) has these parameters:
\`\`\`rust
a = -3
b = 0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B
p (prime field) = 2^256 - 2^224 + 2^192 + 2^96 - 1
\`\`\`

What \`OsRng\` provides is just the random number generation for creating private keys. The process works like this:

1. The curve parameters below are fixed in \`p256\` (that's why we import \`SigningKey\` from it) 
    - $a\\in \\mathbb Z /p\\mathbb Z$
    - $b\\in \\mathbb Z /p\\mathbb Z$
    - $p \\in \\mathbb N$ prime
    - a generator $g$ on the elliptic curve
    - an order $n = |\\langle g\\rangle |$
2. \`OsRng\` generates a random number $k_\\text{pri}$ between $1$ and $n-1$ as a private key
3. The public key  (i.e., \`verifying_key\`) is calculated as 
    $$
    Q = k_\\text{pri} \\underset{\\text{elliptic}}{\\times }g \\in \\frac{\\mathbb Z}{p\\mathbb Z} \\times \\frac{\\mathbb Z}{p\\mathbb Z}\\tag{$*$} 
    $$
4. From coding perspective the actual \`verifying_key\` that we use is the concated string of the coordinates \`[Q_x, Q_y]\`.

##### Isn't a private key just an integer? Why need \`SigningKey\`

Essentially ***private key*** is just a ***random number*** in $\\mathbb Z/n\\mathbb Z$ ($n\\in \\mathbb N - \\{p\\}$ the order of a cylic group fixed in \`p256\`), we wrap it into a struct created by \`SigningKey::random\` to provide a safe abstraction that:
- Ensures the random number is in the correct range
- Prevents common cryptographic mistakes
- Handles the complexities of ECDSA operations (such as creating \`verifying_key\` and signing a json payload in string)

Full Implementation of \`SigningKey\` includes:
- The actual private key (the random number we just picked)
- Methods for signing (sign)
- Methods for deriving the public key $Q$ in $(*)$ above (the \`verifying_key\`)
- Proper serialization/deserialization
 
#### Generate an address

We continue to implement the factory method of a \`Wallet\`. Let's define a mutable closure to mutate the address just defined in line 5.

\`\`\`rust-6{21}
        let mut gen_address = || {
            let key_points = verifying_key.to_encoded_point(false);
            if let (Some(x), Some(y)) = (key_points.x(), key_points.y()) {
                let mut pub_key_bytes = Vec::with_capacity(x.len() + y.len());
                pub_key_bytes.extend_from_slice(x);
                pub_key_bytes.extend_from_slice(y);
                let hash = Sha256::digest(&pub_key_bytes);
                let mut hasher = Ripemd160::new();
\`\`\`
See **Remark 1**[^remark1] for the difference between \`Sha256\` and \`Ripemd160\`.
\`\`\`rust-14
                hasher.update(&hash);
                let mut address_hash_result = hasher.finalize().to_vec();
                address_hash_result.insert(0, 0x00);
\`\`\`
See **Remark 2**[^remark2] below for the purpose of \`0x00\`.
\`\`\`rust-17
                let hash2 = Sha256::digest(&address_hash_result);
                let hash3 = Sha256::digest(&hash2);
                let checksum = &hash3[0..4];
                let full_hash = [address_hash_result, checksum.to_vec()].concat();
                address = bs58::encode(full_hash).into_string();
            } else {
            }
        };

        gen_address();

        Self {
            signing_key,
            verifying_key,
            address,
        }
    }
\`\`\`

[^remark1]:
    **Remark 1.** Note that this hasher from \`Ripemd160\` does not share the same purpose as the hasher \`Sha256::new()\`.

    1. \`SHA256\`
        - Outputs a 256-bit (32 bytes) hash
        - Generally considered more secure
        - Used in Bitcoin and many other cryptocurrencies
        - \`\`\`rust 
          // Example:
          let input = b"hello";
          let hash = Sha256::digest(input);  // 32 bytes output
          \`\`\`
    2. \`RIPEMD160\`
        - Outputs a 160-bit (20 bytes) hash
        - Used specifically in Bitcoin address generation
        - Makes addresses shorter while maintaining security
        - \`\`\`rust
          // Example:
          let mut hasher = Ripemd160::new();
          hasher.update(input);
          let hash = hasher.finalize();  // 20 bytes output
          \`\`\`



[^remark2]:
    **Remark 2.** In cryptocurrency address generation (specifically Bitcoin-style addresses), the \`0x00\` prefix is added to indicate the network version or address type. Here's what it means:


    - \`0x00\` is the version byte for mainnet addresses in Bitcoin 

    Different networks/coins use different version bytes:
    1. \`0x00\` Bitcoin ***mainnet***
    2. \`0x6f\` Bitcoin ***testnet***

    Other cryptocurrencies use different values. 



Next we print out private and public key in hexadecimal representation as string.

\`\`\`rust-34{41}
    pub fn private_key_str(&self) -> String {
        hex::encode(self.signing_key.to_bytes())
    }

    pub fn public_key_str(&self) -> String {
        let key_points = self.verifying_key.to_encoded_point(false);
        if let (Some(x), Some(y)) = (key_points.x(), key_points.y()) {
            let pub_str = hex::encode(&x).as_str().to_string() + hex::encode(&y).as_str();
            pub_str
        } else {
            String::new()
        }
    }

    pub fn get_address(&self) -> String {
        self.address.clone()
    }
\`\`\`

Note that the direct concatenation of the hex strings of x,y-coordinate of the public key in line 41 is known as ***uncompressed key***. We need to know this detail when we try to verify the transaction by the public key.



#### Create a Signature for a Transaction
##### Step 1. Convert transaction into json string
\`\`\`rust-51{56,62}
    pub fn sign_transaction(&mut self, receiver: &String, amount: u64) -> Transaction {
        let mut transaction = Transaction {
            sender: self.address.clone(),
            recipient: receiver.clone(),
            amount,
            signature: String::new(),
            public_key: self.public_key_str(),
        };
        let serialized_str = serde_json::to_string(&transaction).unwrap();
\`\`\`
##### Step 2. Sign the json string 
\`\`\`rust-60{61}
        let serialized_bytes = serialized_str.as_bytes();
        let signature: Signature = self.signing_key.sign(serialized_bytes);
        transaction.signature = hex::encode(signature.to_bytes());
        transaction
    }
\`\`\`

By ***creating a signature*** in line 61 we mean that 

1. We hash the message  (arbitrary length) into a 32 bytes value by \`sha256\`
2. This hashed value is treated as an integer in 32 bytes, we do subsequent computation in ***256-bit prime field*** to create a pair of two 32 bytes value $(R,S)$ (interchangeably in \`bytes\` or \`String\`). 

We will discuss more on the values $R,S$ in the section [#R-and-S].

Note that when we try to verify the signature with the message (in our case, the transaction), we need to return the \`transaction.signature\` to an empty string. We will see that in line 67 below.


#### Verify the Signature to Justify the Transaction is Valid
##### Step 1. Get the hashed transaction payload \`H(m)\`
\`\`\`rust-65
    pub fn verify_transaction(transaction: &Transaction) -> bool {
        let mut transaction_clone = transaction.clone();
        transaction_clone.signature = String::new();

        let message = serde_json::to_string(&transaction_clone).unwrap();
        let msg_bytes = message.as_bytes();
\`\`\`
This finishes the part to create a message to verify.


##### Step 2. Reconstruct \`Signature<NistP256>\` from the signature {#R-and-S}


Recall that from [study notes on elliptic curve](/blog/article/Elliptic-Curve-and-Operator-Overloading#The-Elliptic-Curve-Digital-Signature-Algorithm-(ECDSA)), a \`signature\` is a pair of two 32 bytes value (\`String\` or \`[u8; 32]\`) \`[R | S]\` computed from (backend) client side:

$$
\\begin{cases}
R :=  \\pi_x(k\\underset{\\text{elliptic}}{\\times} g),\\\\
S := k^{-1}(\\texttt{H(m)} + r\\times k_\\text{pri}).
\\end{cases}
$$

Here 
- $\\pi_x(P)$ denotes the x-coordinate of point $P$ in $\\mathbb R^2$, where $P=k\\underset{\\text{elliptic}}{\\times} g$ 
- $g$ is a generator of the cyclic subgroup $\\langle g \\rangle$ in the elliptic curve
- $k$ is a ***nounce***, a randomly selected integer for each transaction 
- \`H(m): [u8, 32]\` is implicitly calculated via line 61 using \`sha256\`, this value is completely hidden from us and buried into the value \`S\` in the signature \`[R | S]\`.

  In computation \`H(m)\` is converted into \`BigInt\` for mathematical computation of \`S\` on an \`p256\`-elliptic curve.
 


Now line 71 to 73 becomes very clear to us:


\`\`\`rust-71{73}
        let signature = transaction.signature.clone();
        let signature_bytes = hex::decode(signature).unwrap();
        let signature_array: [u8; 64] = signature_bytes.try_into().unwrap();
\`\`\`
\`try_into\` is a special trick/methodology in rust for type casting when we have a type declared on the left hand side. We do an \`unwrap()\` since it returns a \`Result\` enum.
\`\`\`rust-74
        let signature = match Signature::from_bytes(&signature_array.into()) {
            Ok(signature) => signature,
            Err(e) => {
                println!("error: {:?}", e);
                return false;
            }
        };
        let public_key_str = transaction_clone.public_key.clone();
        let mut public_key_bytes = hex::decode(public_key_str).unwrap();
        public_key_bytes.insert(0, 0x04);
\`\`\`
See **Remark 3**[^remark3] for the purpose of \`0x04\`.

[^remark3]: 
    **Remark 3.** The \`0x04: u8\` prefix is used in \`SEC1\` (Standards for Efficient Cryptography) encoding for ***uncompressed*** public keys in elliptic curve cryptography. 

    Other prefix values include:
    - \`0x02\` or \`0x03\` Used for compressed public key format
    - \`0x02\` Y coordinate is even
    - \`0x03\` Y coordinate is odd\\
        When $(x_0, y_0)$ is a solution, so is $(x_0, -y_0)\\equiv (x_0, p-y_0) \\pmod{p}$, thus we need \`0x02\` and \`0x03\` to identify the value. 

    In the code, when we encode the public key, we start with the raw X and Y coordinates ***directly concatenated*** (line 41).

    Therefore we add \`0x04\` at the head to tell the decoder this is an uncompressed key, the resulting format is: \`[0x04 | X coordinate | Y coordinate]\`.

##### Step 3. Undergo the mathematical validation

Recall that a verification of a message and a signature $(R,S)$ comprises of the following computation:

$$
\\pi_x\\left(\\begin{gathered}
\\big[S^{-1}\\cdot \\texttt{H(m)}\\big]\\underset{\\text{elliptic}}{\\times}g \\\\
\\underset{\\text{elliptic}}{+}\\\\
\\big[S^{-1}\\cdot R\\big]\\underset{\\text{elliptic}}{\\times}K_\\text{pub}
\\end{gathered}\\right)\\stackrel{?}{\\equiv} R \\pmod{\\mathrm{ord}(g)}.
\\tag{$**$}
$$

Where the key $K_\\text{pub}$ is directly taken from the payload of the transaction (line 81-83).  From coding point of view $(**)$ is rephased as 
$$
K_\\text{pub}\\texttt{.verify}(\\texttt{H(m)}, (R,S))
$$
with function signature 
\`\`\`rust
fn verify(&self, message: &[u8], &Signature<NistP256>) -> Result<()>
\`\`\`
in line 85 below:
\`\`\`rust-84{85}
        let public_key = VerifyingKey::from_sec1_bytes(&public_key_bytes).unwrap();
        public_key.verify(&msg_bytes, &signature).is_ok()
    }
}
\`\`\`
Note that \`&msg_bytes\` is hashed into \`[u8; 32]\` again internally and hidden from us.


### main.rs


Finally we test the wallet and print the outcome for demonstration.

\`\`\`rust 
mod wallet;

use wallet::Wallet;

fn main() {
    let mut wallet = Wallet::new();
    println!("private key: {}", wallet.private_key_str());
    println!("public key: {}", wallet.public_key_str());
    println!("The address {}", wallet.get_address());
    let mut transaction = wallet.sign_transaction(&"0x1234567890".to_string(), 100);
    println!("Transaction: {:?}", transaction);
    transaction.amount += 0;
    println!("verify: {}", Wallet::verify_transaction(&transaction));
}
\`\`\`

And we get the output:

[![](/assets/img/2025-10-10-06-47-18.png)](/assets/img/2025-10-10-06-47-18.pn)



### References

- Taylor Chen, [*Rust and Blockchain programming bootcamp:from zero to expert*](https://www.udemy.com/course/rust-and-blockchain-programming-bootcampfrom-zero-to-expert/?couponCode=PLOYALTY0923), Udemy

- Ching-Cheong Lee, [*Elliptic Curve and Operator Overloading*](/blog/article/Elliptic-Curve-and-Operator-Overloading)

### Footnotes`;export{e as default};
