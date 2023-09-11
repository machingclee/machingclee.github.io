---
title: "Elliptic Curve and Operator Overloading"
date: 2023-09-09
id: blog0175
tag: rust
intro: "Let's define operator overloading on finite field Z/pZ for prime p."
toc: true
---

<style>
  img {
    max-width: 100%
  }
</style>

#### Utility Struct to Perform Arithmetic on $\mathbb Z/ p \mathbb Z$ for `BigUint`

```rust
struct Fp<'a> {
    p: &'a BigUint,
}

impl<'a> Fp<'a> {
    fn power(&self, u: &BigUint, i: u32) -> BigUint {
        u.modpow(&BigUint::from(i), &self.p)
    }

    fn add(&self, u: &BigUint, v: &BigUint) -> BigUint {
        (u + v).modpow(&BigUint::from(1u32), self.p)
    }
    fn mul(&self, u: &BigUint, v: &BigUint) -> BigUint {
        (u * v).modpow(&BigUint::from(1u32), self.p)
    }
    fn add_inverse(&self, u: &BigUint) -> BigUint {
        assert!(
            u < &self.p,
            "{}",
            format!("{} >= {} should not happen", u, &self.p)
        );
        self.p - u
    }
    fn mul_inverse(&self, u: &BigUint) -> BigUint {
        if self.p < &BigUint::from(2u32) {
            BigUint::from(1u32)
        } else {
            let two = BigUint::from(2u32);
            let power = self.add(&self.p, &self.add_inverse(&two));
            u.modpow(&power, &self.p)
        }
    }
}
```

#### Definition of Addition and Double on Elliptic Curve

```rust
use num_bigint::BigUint;

#[derive(PartialEq, Clone, Debug)]
enum Point {
    Coor(BigUint, BigUint),
    Identity,
}

struct EllipticCurve {
    a: BigUint,
    b: BigUint,
    p: BigUint,
}

impl EllipticCurve {
    fn double(&self, h: &Point) -> Point {
        let fp = Fp { p: &self.p };
        let h_on_curve = self.is_on_curve(h);
        assert!(h_on_curve, "point h is not on the curve");
        // s = (3*x^2 + a)/(2*y)
        // x_ = s^2 - 2*x
        // y_ = s*(x - x_) - y
        match h {
            Point::Identity => Point::Identity,
            Point::Coor(x, y) => {
                let three_times_xsq = fp.mul(&BigUint::from(3u32), &fp.power(x, 2));
                let two_times_y = fp.mul(&BigUint::from(2u32), &y);
                let inverse_two_times_y = fp.mul_inverse(&two_times_y);
                let s = fp.mul(&fp.add(&three_times_xsq, &self.a), &inverse_two_times_y);
                let x_ = fp.add(
                    &fp.power(&s, 2),
                    &fp.add_inverse(&fp.mul(&BigUint::from(2u32), x)),
                );
                let s_times_x_minus_x_ = fp.mul(&s, &fp.add(x, &fp.add_inverse(&x_)));
                let y_ = fp.add(&s_times_x_minus_x_, &fp.add_inverse(y));
                Point::Coor(x_, y_)
            }
        }
    }

    fn add(&self, h: &Point, k: &Point) -> Point {
        let fp = Fp { p: &self.p };
        let h_on_curve = self.is_on_curve(h);
        let k_on_curve = self.is_on_curve(k);
        assert!(*h != *k, "two points should not be the same");
        assert!(h_on_curve, "point h is not on the curve");
        assert!(k_on_curve, "point k is not on the curve");
        match (h, k) {
            (Point::Identity, _) => k.clone(),
            (_, Point::Identity) => h.clone(),
            (Point::Coor(x1, y1), Point::Coor(x2, y2)) => {
                // s = (y2-y1)/(x2-x1)
                // x3 = s^2 - x1 - x2
                // y3 = s*(x1-x3) - y1

                let y1_plus_y2 = fp.add(y1, y2);
                if x1 == x2 && y1_plus_y2 == BigUint::from(0u32) {
                    return Point::Identity;
                }

                let s = fp.mul(
                    &(y2 + &fp.add_inverse(y1)),
                    &fp.mul_inverse(&(x2 + &fp.add_inverse(x1))),
                );
                let x3 = fp.add(
                    &fp.add(&fp.power(&s, 2), &fp.add_inverse(x1)),
                    &fp.add_inverse(x2),
                );

                let y3 = fp.add(
                    &fp.mul(&s, &(x1 + &fp.add_inverse(&x3))),
                    &fp.add_inverse(y1),
                );
                Point::Coor(x3, y3)
            }
        }
    }

    fn scalar_mul(&self, c: &Point, d: &BigUint) -> Point {
        let mut t = c.clone();
        for i in (0..(d.bits() - 1)).rev() {
            t = self.double(&t);
            if d.bit(i) {
                t = self.add(&t, c);
            }
        }
        t
    }

    fn is_on_curve(&self, point: &Point) -> bool {
        let fp = Fp { p: &self.p };
        if let Point::Coor(x, y) = point {
            let y2 = fp.power(y, 2);
            let x3 = fp.power(x, 3);
            let ax = fp.mul(&self.a, x);
            y2 == fp.add(&x3, &fp.add(&ax, &self.b))
        } else {
            true
        }
    }
}
```

#### Operator Overloading

##### New Struct `F_p`

We wish to convert `BigUint` into our own struct `F_p` and define all the usual operation on $\mathbb Z/p \mathbb Z$, i.e., among the `F_p` objects.

That is, we wish to overload the operators:

```text
+ - * /
```

without the utility struct `Fp`.

```rust
#[derive(PartialEq, Clone, Debug)]
pub struct F_p<'a> {
    value: BigUint,
    p: &'a BigUint,
}
```

##### New Definition of Point and EllipticCurve base on `F_p`

```rust
pub enum Point<'a> {
    Coor(F_p<'a>, F_p<'a>),
    Identity,
}

pub struct EllipticCurve<'a> {
    a: F_p<'a>,
    b: F_p<'a>,
}
```

##### Operator Overloadings on `F_p`

###### Key to Note

- During the course of computatons we must let our final computational result to prosses ownership of the data.
- Therefore, we **_cannot_** perform computation **_merely by references_** if that computation will be being returned.
- Thus we must allow `move` to occur.
- In the sequel, all operator overloading are **_for_** an **_owned_** type, which plays the role `A` of:
  ```rust
  let A = B + C_1;
  let A = A + C_2;
  let A = A + C_3;
  ```
  and by design the data ownership moves downwards in the computation pipeline.

###### Implementations

```rust
#[derive(PartialEq, Clone, Debug)]
pub struct F_p<'a> {
    value: BigUint,
    p: &'a BigUint,
}

impl<'a> F_p<'a> {
    pub fn new(i: u32, p: &'a BigUint) -> Self {
        F_p {
            value: BigUint::from(i),
            p,
        }
    }
}

impl<'a> Add<&F_p<'a>> for F_p<'a> {
    type Output = F_p<'a>;

    fn add(self, rhs: &F_p) -> Self::Output {
        let value = (&self.value + &rhs.value).modpow(&BigUint::from(1u32), self.p);
        F_p { value, p: self.p }
    }
}

impl<'a> Sub<&F_p<'a>> for F_p<'a> {
    type Output = F_p<'a>;

    fn sub(self, rhs: &F_p) -> Self::Output {
        let value: BigUint;
        let a = &self.value;
        let b = &rhs.value;
        if a > b {
            value = a - b;
        } else {
            value = (self.p + a) - b;
        }
        F_p { value, p: &self.p }
    }
}

impl<'a> Mul<BigUint> for F_p<'a> {
    type Output = F_p<'a>;
    fn mul(self, rhs: BigUint) -> Self::Output {
        let a = &self.value;
        let value = (a * &rhs).modpow(&BigUint::from(1u32), &self.p);
        return F_p { value, p: self.p };
    }
}

impl<'a> Mul<&F_p<'a>> for F_p<'a> {
    type Output = F_p<'a>;

    fn mul(self, rhs: &F_p) -> Self::Output {
        let value = (&self.value * &rhs.value).modpow(&BigUint::from(1u32), self.p);
        F_p { value, p: self.p }
    }
}

impl<'a> Div<&F_p<'a>> for F_p<'a> {
    type Output = F_p<'a>;

    fn div(self, rhs: &F_p) -> Self::Output {
        let left = &self.value;
        let right = &rhs.value;
        let p_minus_2 = (self.p - BigUint::from(2u32)).modpow(&BigUint::from(1u32), self.p);

        let multiplicative_inverse_right = right.modpow(&p_minus_2, &self.p);
        let value = (left * &multiplicative_inverse_right).modpow(&BigUint::from(1u32), self.p);
        F_p { value, p: &self.p }
    }
}
```

##### Rewrite of EllipticCurve::double With `F_p` in Place of `BigUint`

```rust
impl<'a> EllipticCurve<'a> {
		pub fn double(&self, h: &'a Point) -> Point {
				let h_on_curve = self.is_on_curve(h);
				assert!(h_on_curve, "point h is not on the curve");
				// s = (3*x^2 + a)/(2*y)
				// x_ = s^2 - 2*x
				// y_ = s*(x - x_) - y
				match h {
						Point::Identity => Point::Identity,
						Point::Coor(xp, yp) => {
                if yp.value == BigUint::from(0u32) {
                    return Point::Identity;
                }
								let two_times_yp = yp.clone() * BigUint::from(2u32);
								let s = xp.clone() * xp;
								let s = s * BigUint::from(3u32);
								let s = s + &self.a;
								let s = s.clone() / &two_times_yp;

								let two_times_x = xp.clone() * BigUint::from(2u32);
								let new_x = s.clone() * &s;
								let new_x = new_x - &two_times_x;

								let new_y = xp.clone() - &new_x;
								let new_y = s * &new_y;
								let new_y = new_y - yp;

								Point::Coor(new_x, new_y)
						}
				}
		}
}
```

##### Rewrite of EllipticCurve::add With `F_p` in Place of `BigUint`

```rust
impl<'a> EllipticCurve<'a> {
		pub fn add(&self, h: &Point<'a>, k: &Point<'a>) -> Point {
        let h_on_curve = self.is_on_curve(h);
        let k_on_curve = self.is_on_curve(k);
        assert!(*h != *k, "two points should not be the same");
        assert!(h_on_curve, "point h is not on the curve");
        assert!(k_on_curve, "point k is not on the curve");
        match (h, k) {
            (Point::Identity, _) => k.to_owned(),
            (_, Point::Identity) => h.to_owned(),
            (Point::Coor(x1p, y1p), Point::Coor(x2p, y2p)) => {
                if x1p == x2p && (y1p.clone() + y2p).value == BigUint::from(0u32) {
                    return Point::Identity;
                }
                // s = (y2-y1)/(x2-x1)
                // x3 = s^2 - x1 - x2
                // y3 = s*(x1-x3) - y1

                let s = y2p.clone() - y1p;
                let x2_minus_x1 = x2p.clone() - x1p;
                let s = s / &x2_minus_x1;
                let s_square = s.clone() * &s;

                let x3p = s_square - x1p;
                let x3p = x3p - x2p;

                let y3p = s * &(x1p.clone() - &x3p);
                let y3p = y3p - y1p;

                Point::Coor(x3p, y3p)
            }
        }
    }
}
```

##### EllipticCurve::scalar_mul --- the Double and Add Algorithm under `F_p`

```rust
impl<'a> EllipticCurve<'a> {
    pub fn scalar_mul(&'a self, q: &Point<'a>, k: &BigUint) -> Point<'a> {
        let mut t = q.clone();
        for i in (0..(k.bits() - 1)).rev() {
            t = self.double(&t);
            if k.bit(i) {
                t = self.add(&t, q);
            }
        }
        t
    }
}
```

#### Test Cases

The following 3 cases can pass successfully:

```text
running 4 tests
test test::test_ec_point_add_identity ... ok
test test::test_ec_point_addition ... ok
test test::test_double ... ok
test test::test_scalar_mul ... ok
```

```rust
#[cfg(test)]
mod test {
    use super::*;
    #[test]
    fn test_ec_point_addition() {
        let p = BigUint::from(17u32);
        let ec = EllipticCurve {
            a: F_p::new(2, &p),
            b: F_p::new(2, &p),
        };

        // (6, 3) + (5, 1) = (10, 6);
        let p1 = Point::Coor(F_p::new(6, &p), F_p::new(3, &p));
        let p2 = Point::Coor(F_p::new(5, &p), F_p::new(1, &p));
        let r = Point::Coor(F_p::new(10, &p), F_p::new(6, &p));

        let res = ec.add(&p1, &p2);
        assert_eq!(r, res);
    }
    #[test]
    fn test_ec_point_add_identity() {
        let p = BigUint::from(17u32);
        let ec = EllipticCurve {
            a: F_p::new(2, &p),
            b: F_p::new(2, &p),
        };

        // (6, 3) + (5, 1) = (10, 6);
        let p1 = Point::Coor(F_p::new(6, &p), F_p::new(3, &p));
        let p2 = Point::Identity;
        let expect = Point::Coor(F_p::new(6, &p), F_p::new(3, &p));

        let result = ec.add(&p1, &p2);
        assert_eq!(expect, result);
    }

    #[test]
    fn test_scalar_mul() {
        let p = BigUint::from(17u32);
        let ec = EllipticCurve {
            a: F_p::new(2, &p),
            b: F_p::new(2, &p),
        };
        let q = Point::Coor(F_p::new(5, &p), F_p::new(1, &p));
        let k = BigUint::from(16u32);
        let result = ec.scalar_mul(&q, &k);

        let expected = Point::Coor(F_p::new(10, &p), F_p::new(11, &p));
        assert_eq!(result, expected);
    }

    #[test]
    fn test_double() {
        let p = BigUint::from(17u32);
        let ec = EllipticCurve {
            a: F_p::new(2, &p),
            b: F_p::new(2, &p),
        };

        let p = Point::Coor(F_p::new(6, &p), F_p::new(3, &p));
        let double = ec.double(&p);
        let p_on_curve = ec.is_on_curve(&double);
        assert!(p_on_curve);
    }
}
```

#### Specific case: The `Secp256k1`

Configuration of the values: `n(order), p, a, b` can be found [in this wiki page](https://en.bitcoin.it/wiki/Secp256k1).

We test our algorithm by the following test case:

```rust
fn test_secp256k1() {
		let p = BigUint::parse_bytes(
				b"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F",
				16,
		)
		.expect("Parsing fail for p");

		let a = BigUint::parse_bytes(
				b"0000000000000000000000000000000000000000000000000000000000000000",
				16,
		)
		.expect("Parsing fail for a");

		let b = BigUint::parse_bytes(
				b"0000000000000000000000000000000000000000000000000000000000000007",
				16,
		)
		.expect("Parsing fail for b");

		let n = BigUint::parse_bytes(
				b"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
				16,
		)
		.expect("Parsing fail for n");

		let x = BigUint::parse_bytes(
				b"79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798",
				16,
		)
		.expect("Parsing fail for x");

		let y = BigUint::parse_bytes(
				b"483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8",
				16,
		)
		.expect("Parsing fail for y");

		let point = Point::Coor(F_p { value: x, p: &p }, F_p { value: y, p: &p });

		let ec = EllipticCurve {
				a: F_p { value: a, p: &p },
				b: F_p { value: b, p: &p },
		};

		let result = ec.scalar_mul(&point, &n);

		assert_eq!(Point::Identity, result);
}
```

#### The Elliptic Curve Digital Signature Algorithm (ECDSA)

##### Statement of the Theorem and Proof

Let $G$ be the group of points on an elliptic curve $C: y^2 = x^3+ax+b$ over $\mathbb Z_p$.

> **Theorem.** Let $g\in \mathbb Z_p\times \mathbb Z_p$ be a given generator of the additive group $G$. For a fixed $k_\text{pri}\in \mathbb  Z_p$, define $K_\text{pub} = k_\text{pri} g$, then for every $k,z\in \mathbb Z$, there holds
>
> $$
> \begin{cases}
> R := \pi_x(kg), \\
> S := k^{-1}\big(z +\pi_x(kg) k_\text{pri}\big )
> \end{cases}
> \implies\pi_x\bigg(\big[S^{-1}z\big]g + \big[S^{-1}R\big]K_\text{pub}\bigg)= \pi_x(kg).
> $$
>
> Where $\pi_x$, denotes the canonical project to the first coordinate.

> In other words, if $(R,S)$ defined above is given to the target receiver, then **_necessarily_**
>
> $$
> \pi_x\bigg(\big[S^{-1}z\big]g + \big[S^{-1}R\big]K_\text{pub}\bigg)=R.
> $$
>
> This necessity condition is defined to be the **_valid_** condition of a message $z=h(m)$ for some hash $h$ and string $m$, and the tuple $(R,S)$ is called the **_signature_** of the message.

<proof>

**_Proof._** The proof is a direct transformation from the definition:

$$
\begin{aligned}
 &{\color{white}\iff}\,\,\, S= k^{-1}(z + \pi_x(kg)k_\text{pri})\\
&\iff k = S^{-1}(z + \underbrace{\pi_x(kg)}_{=:R}k_\text{pri})\\
&\iff kg = [S^{-1}z]g + [S^{-1}R]k_\text{pri}g\\
&\iff kg =  [S^{-1}z]g + [S^{-1}R]K_\text{pub}\\
&\implies R = \pi_x\big( [S^{-1}z]g + [S^{-1}R]K_\text{pub}\big ).
\end{aligned}
$$

</proof>

<!-- ##### How to use This Theorem? -->

#### Reference

- Udemy course: [Elliptic Curve Cryptography in Rust](https://www.udemy.com/course/elliptic-curve-cryptography-in-rust/)
- [一文读懂 ECDSA 算法如何保护数据](https://zhuanlan.zhihu.com/p/97953640?fbclid=IwAR0MMbQbGXVTAcErHNlHWRU1lUnpzqHTGdmB7rUxiD-xfFgguh_czX-gm50)
