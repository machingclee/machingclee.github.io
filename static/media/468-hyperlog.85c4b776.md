---
title: "Redis HyperLogLog"
date: 2026-03-04
id: blog0468
tag: redis, math
toc: true
intro: "Study statistic study via HyerLogLog."
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>


### Introduction

HyperLogLog is a probabilistic data structure used to estimate the ***cardinality*** (number of distinct elements) of a set with very little memory. It does not store actual elements — instead, it uses a hash function and statistical properties of a ***Bernoulli process*** to approximate the count.

### The Bernoulli Process Behind HyperLogLog

#### What is a Bernoulli Process?

A Bernoulli process is a sequence of independent binary trials, each with probability $p = 0.5$ of success (1) or failure (0) — like flipping a fair coin repeatedly.

The key property: the probability of seeing $k$ consecutive failures (leading zeros) before the first success is:

$$\qquad\displaystyle P(\text{leading zeros} = k) = \left(\frac{1}{2}\right)^{k+1}$$

#### The Core Intuition

When we hash an element, the output is a binary string where each bit behaves like an independent fair coin flip. HyperLogLog counts the ***position of the leftmost 1-bit*** (i.e., the number of leading zeros + 1) in this hash.

For example:

```text
hash(element_A) = 00010110...   → 3 leading zeros → position = 4
hash(element_B) = 01101001...   → 1 leading zero  → position = 2
hash(element_C) = 00001010...   → 4 leading zeros → position = 5
```

#### Why Leading Zeros Estimate Cardinality?

If we observe a maximum of $k$ leading zeros across all hashed elements, the probability of that happening by chance is $\left(\frac{1}{2}\right)^k$. This means we are likely to need to hash roughly $2^k$ distinct elements before hitting such a rare outcome.

Formally, if $R$ is the maximum number of leading zeros seen:

$$\qquad \hat{n} \approx 2^R$$

where $\hat{n}$ is the estimated number of distinct elements.

#### Example

Each element has a $\left(\frac{1}{2}\right)^k$ probability of producing $k$ leading zeros. So the expected number of elements we need to hash before seeing $k$ leading zeros for the first time is $2^k$.

Conversely, after hashing $n$ distinct elements, the ***maximum*** leading zeros $R$ we have observed is expected to satisfy:

$$\qquad 2^R \approx n \quad \Longrightarrow \quad R \approx \log_2 n$$

For example, with $n = 1{,}000{,}000$ distinct users:

$$\qquad R \approx \log_2(1{,}000{,}000) \approx 19.93 \approx 20$$

So we'd expect the maximum leading zeros across all hashed elements to be around 20. Plugging back in:

$$\qquad \hat{n} \approx 2^{20} = 1{,}048{,}576$$

This is close to the actual count of 1,000,000 — computed using only a few kilobytes of memory regardless of input size.

#### From Single Estimate to HyperLogLog


##### Dangerous Single Estimate

A single $2^R$ estimate has dangerously high variance. Consider this failure case:

- We have $n = 1{,}000{,}000$ distinct elements
- By pure bad luck, the ***very first*** element we hash has already produced 30 leading zeros
- Our estimate: $\hat{n} \approx 2^{30} = 1{,}073{,}741{,}824$, which is a $1000$ times over-estimate from one unlucky hash

The solution is to not rely on a single global max. Instead, collect many ***independent*** estimates of $R$ and average them, then the outliers cancel out.

##### Modification 1: Multiple hash functions, but too expensive

This is used in older algorithms like Flajolet-Martin, 1985.

For each input we run $m$ independent hash functions on each element, producing $m$ independent values of $R_1, R_2, \ldots, R_m$. Average them. 

The downside: we must compute $m$ hash functions per element, which is expensive.

##### Modification 2: Bit splitting, our final choice

This is used in HyperLogLog, Flajolet et al. 2007 (see [#ref]).

We use a ***single*** hash function, but split its output into two parts:
- The ***first $b$ bits*** → register index (which slot to update)
- The ***remaining bits*** → count leading zeros in this part

For example, with $b = 2$ we have $m = 2^2 = 4$ registers (one for each 2-bit value: `00`, `01`, `10`, `11`). Say each hash output is 8 bits:

```text
hash(userA) = 10|001101   first 2 bits = "10" = register 2,  remaining "001101" → 2 leading zeros
hash(userB) = 01|000010   first 2 bits = "01" = register 1,  remaining "000010" → 4 leading zeros
hash(userC) = 10|110001   first 2 bits = "10" = register 2,  remaining "110001" → 0 leading zeros
hash(userD) = 00|000111   first 2 bits = "00" = register 0,  remaining "000111" → 3 leading zeros
hash(userE) = 11|000001   first 2 bits = "11" = register 3,  remaining "000001" → 5 leading zeros
```

Each register keeps only the ***max*** leading zeros seen so far among elements routed to it:

```text
Register 0: max = 3       (only userD)
Register 1: max = 4       (only userB)
Register 2: max = 2       (userA gave 2, userC gave 0 → keep max = 2)
Register 3: max = 5       (only userE)
```

The final estimate combines all 4 registers via harmonic mean — instead of one unreliable global max, we now have 4 independent estimates averaged together.

Each slot independently tracks its own maximum leading zeros. Since hash bits are statistically independent, the first $b$ bits are independent from the remaining bits — this is mathematically equivalent to running $m$ separate hash functions, but only requires one hash call per element.



With 

$$\qquad m = 2^b$$ 

registers, the variance from any single ***outlier*** is ***diluted*** across all $m$ independent estimates. HyperLogLog combines them using a **harmonic mean**, which is chosen because it is less sensitive to ***outliers*** (estimates that are extraordinarily larger) than arithmetic mean:

$$\qquad\displaystyle \hat{n} = \alpha_m \cdot m^2 \cdot \left( \sum_{j=1}^{m} 2^{-M_j} \right)^{-1}$$

where $M_j$ is the max leading zeros in register $j$, and $\alpha_m$ is a bias correction constant. We discuss the detail of the multiplicative bias term $\alpha_m$ in [#alpha_m]. 

The formula of $\hat n$ is derived as follows:


- Each register $j$ sees roughly $n/m$ elements (spread evenly, since we assume the hash function is purely random). Its leading-zero count estimates the ***local*** count:

  $$\qquad\displaystyle 2^{M_j} \approx \frac{n}{m}$$

- In slot (register) $j$ we approximately estimate the global cardinality by $\hat{n}_j$:

  $$\qquad\hat{n}_j = m \cdot 2^{M_j}$$

- Take the harmonic mean of all $m$ per-register estimates $\hat{n}_j = m \cdot 2^{M_j}$:

  $$\qquad\hat{n} = \frac{m}{\displaystyle\sum_{j=1}^{m} \frac{1}{m \cdot 2^{M_j}}} = \frac{m}{\dfrac{1}{m}\displaystyle\sum_{j=1}^{m} 2^{-M_j}} = \frac{m^2}{\displaystyle\sum_{j=1}^{m} 2^{-M_j}}$$

So the ***first $m$*** is from the harmonic mean formula ($m$ values averaged), and the ***second $m$*** is from scaling each register's local estimate up to a global one. $\alpha_m$ then corrects the remaining systematic bias.




#### The Bias Correction Constant $\alpha_m$ {#alpha_m}

The raw harmonic mean estimator is systematically biased ***high***. Rare large values of $2^{M_j}$ pull the estimate up more than common small values pull it down — an asymmetry arising from Jensen's inequality applied to the convex function $2^x$.

Flajolet et al. derived the correction factor analytically by modelling the expected value of the raw estimator and solving:

$$\qquad\displaystyle \alpha_m = \left( m \int_0^\infty \left( \log_2 \frac{2+u}{1+u} \right)^m du \right)^{-1}$$

This integral has no closed form, but can be evaluated numerically for each $m$. The paper provides these hardcoded values:

| $m$ | $\alpha_m$ |
|-----|------------|
| 16 | 0.673 |
| 32 | 0.697 |
| 64 | 0.709 |
| ≥ 128 | $\approx \dfrac{0.7213}{1 + 1.079/m}$ |

For Redis ($m = 16384$):

$$\qquad\displaystyle \alpha_{16384} \approx \frac{0.7213}{1 + 1.079/16384} \approx 0.7213$$

$\alpha_m$ is solved once offline. Redis simply embeds `0.7213...` as a hardcoded constant in its [C source code](https://github.com/redis/redis/blob/unstable/src/hyperloglog.c#L404):

![](/assets/img/2026-03-04-10-54-01.png)

This factor is introduced in the paper [PEOF] listed in [#ref].

Redis uses $b = 14$, giving $m = 16384$ registers × 6 bits each = **12 KB** of memory, with a standard error of only **~0.81%**, regardless of whether we have 1,000 or 1,000,000,000 unique elements.

#### The Hash Function: `MurmurHash2`

HyperLogLog doesn't need a specially constructed hash function — it just requires:
1. **Uniform output.** Each output bit is equally likely 0 or 1 (bits behave like independent coin flips)

2. **Deterministic.** Same input always produces the same output

Redis uses `MurmurHash2` (64-bit variant), a fast non-cryptographic hash. The 64-bit output maps directly onto the bit-splitting scheme:

```text
input: "userA"
         ↓
   MurmurHash64
         ↓
output: 64-bit integer
        [  14 bits  |       50 bits        ]
         register       count leading
           index         zeros here
```

**Why not SHA256 or MD5?** They would work mathematically, but are far slower. HyperLogLog is called millions of times — cryptographic strength is unnecessary. MurmurHash is much faster while providing sufficient uniformity.



### Reference {#ref}

- [**[PEOF]** Philippe Flajolet, Éric Fusy, Olivier Gandouet, Frédéric Meunier, *HyperLogLog: the analysis of a near-optimal cardinality estimation algorithm*, DMTCS Proceedings, 2007](https://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf)