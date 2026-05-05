const n=`---
title: "Elliptic Curve and Operator Overloading"
date: 2023-09-09
id: blog0175
tag: rust, elliptic-curve, math
intro: "Let's define operator overloading on finite field Z/pZ for prime p."
toc: true
img: blockchain
---

<style>
  img {
    max-width: 100%
  }
</style>

### Repository
- https://github.com/machingclee/2023-09-10-Elliptic-Curve-in-Rust/tree/main/ECC/src/modules

### Prefered Headers to Ignore Annoying Warnings:

\`\`\`rust
#![allow(unused)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]
\`\`\`

### Utility Struct to Perform Arithmetic on $\\mathbb Z/ p \\mathbb Z$ for \`BigUint\`

\`\`\`rust
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
\`\`\`

### Definition of Addition and Double on Elliptic Curve

\`\`\`rust
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
\`\`\`

### Operator Overloading

#### New Struct \`Field\`

We wish to convert \`BigUint\` into our own struct \`Field\` and define all the usual operation on $\\mathbb Z/p \\mathbb Z$, i.e., among the \`Field\` objects.

That is, we wish to overload the operators:

\`\`\`text
+ - * /
\`\`\`

without the utility struct \`Fp\`.

\`\`\`rust
#[derive(PartialEq, Clone, Debug)]
pub struct Field<'a> {
    value: BigUint,
    p: &'a BigUint,
}
\`\`\`

#### New Definition of Point and EllipticCurve base on \`Field\`

\`\`\`rust
pub enum Point<'a> {
    Coor(Field<'a>, Field<'a>),
    Identity,
}

pub struct EllipticCurve<'a> {
    a: Field<'a>,
    b: Field<'a>,
}
\`\`\`

#### Operator Overloadings on \`Field\`

##### Implementations

\`\`\`rust
pub struct Field<'a> {
    pub value: BigUint,
    pub p: &'a BigUint,
}
impl<'a> Field<'a> {
    pub fn new(i: u32, p: &'a BigUint) -> Self {
        Field {
            value: BigUint::from(i),
            p,
        }
    }
}

impl<'a> Add<&Field<'a>> for &Field<'a> {
    type Output = Field<'a>;

    fn add(self, rhs: &Field) -> Self::Output {
        let value = (&self.value + &rhs.value).modpow(&BigUint::from(1u32), self.p);
        Field { value, p: self.p }
    }
}

impl<'a> Sub<&Field<'a>> for &Field<'a> {
    type Output = Field<'a>;

    fn sub(self, rhs: &Field) -> Self::Output {
        let value: BigUint;
        let a = &self.value;
        let b = &rhs.value;
        if a > b {
            value = a - b;
        } else {
            value = (self.p + a) - b;
        }
        Field { value, p: &self.p }
    }
}

impl<'a> Mul<BigUint> for &Field<'a> {
    type Output = Field<'a>;
    fn mul(self, rhs: BigUint) -> Self::Output {
        let a = &self.value;
        let value = (a * &rhs).modpow(&BigUint::from(1u32), &self.p);
        return Field { value, p: self.p };
    }
}

impl<'a> Mul<&Field<'a>> for &Field<'a> {
    type Output = Field<'a>;

    fn mul(self, rhs: &Field) -> Self::Output {
        let value = (&self.value * &rhs.value).modpow(&BigUint::from(1u32), self.p);
        Field { value, p: self.p }
    }
}

impl<'a> Div<&Field<'a>> for &Field<'a> {
    type Output = Field<'a>;

    fn div(self, rhs: &Field) -> Self::Output {
        let left = &self.value;
        let right = &rhs.value;
        let p_minus_2 = (self.p - BigUint::from(2u32)).modpow(&BigUint::from(1u32), self.p);

        let multiplicative_inverse_right = right.modpow(&p_minus_2, &self.p);
        let value = (left * &multiplicative_inverse_right).modpow(&BigUint::from(1u32), self.p);
        Field { value, p: &self.p }
    }
}
\`\`\`

##### Rewrite of EllipticCurve::double With \`Field\` in Place of \`BigUint\`

\`\`\`rust
impl<'a> EllipticCurve<'a> {
		pub fn double(&self, h: &Point<'a>) -> Point {
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
                let two_times_yp = yp * BigUint::from(2u32);
                let s = xp * xp;
                let s = &s * BigUint::from(3u32);
                let s = &s + &self.a;
                let s = &s / &two_times_yp;

                let two_times_x = xp * BigUint::from(2u32);
                let new_x = &s * &s;
                let new_x = &new_x - &two_times_x;

                let new_y = xp - &new_x;
                let new_y = &s * &new_y;
                let new_y = &new_y - yp;

                Point::Coor(new_x, new_y)
            }
        }
    }
}
\`\`\`

##### Rewrite of EllipticCurve::add With \`Field\` in Place of \`BigUint\`

\`\`\`rust
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
                if x1p == x2p && (y1p + y2p).value == BigUint::from(0u32) {
                    return Point::Identity;
                }
                // s = (y2-y1)/(x2-x1)
                // x3 = s^2 - x1 - x2
                // y3 = s*(x1-x3) - y1

                let s = y2p - y1p;
                let x2_minus_x1 = x2p - x1p;
                let s = &s / &x2_minus_x1;
                let s_square = &s * &s;

                let x3p = &s_square - &x1p;
                let x3p = &x3p - &x2p;

                let y3p = &s * &(x1p - &x3p);
                let y3p = &y3p - &y1p;

                Point::Coor(x3p, y3p)
            }
        }
    }
}
\`\`\`

##### Rewrite of EllipticCurve::is_on_curve With \`Field\` in Place of \`BigUint\`

\`\`\`rust
impl<'a> EllipticCurve<'a> {
		fn is_on_curve(&self, point: &Point) -> bool {
				if let Point::Coor(x, y) = point {
						let y2 = y * y;
						let x3 = x * x;
						let x3 = &x3 * x;
						let ax = x * &self.a;
						y2 == &(&x3 + &ax) + &self.b
				} else {
						true
				}
		}
}
\`\`\`

##### EllipticCurve::scalar_mul --- the Double and Add Algorithm under \`Field\`

\`\`\`rust
impl<'a> EllipticCurve<'a> {
    pub fn scalar_mul(&'a self, q: &Point<'a>, k: &Field<'a>) -> Point<'a> {
        let mut t = q.clone();
        for i in (0..(k.value.bits() - 1)).rev() {
            t = self.double(&t);
            if k.value.bit(i) {
                t = self.add(&t, q);
            }
        }
        t
    }
}
\`\`\`

### Test Cases

The following 3 cases can pass successfully:

\`\`\`text
running 4 tests
test test::test_ec_point_add_identity ... ok
test test::test_ec_point_addition ... ok
test test::test_double ... ok
test test::test_scalar_mul ... ok
\`\`\`

\`\`\`rust
#[cfg(test)]
mod test {
    use super::*;
    #[test]
    fn test_ec_point_addition() {
        let p = BigUint::from(17u32);
        let ec = EllipticCurve {
            a: Field::new(2, &p),
            b: Field::new(2, &p),
        };

        // (6, 3) + (5, 1) = (10, 6);
        let p1 = Point::Coor(Field::new(6, &p), Field::new(3, &p));
        let p2 = Point::Coor(Field::new(5, &p), Field::new(1, &p));
        let r = Point::Coor(Field::new(10, &p), Field::new(6, &p));

        let res = ec.add(&p1, &p2);
        assert_eq!(r, res);
    }
    #[test]
    fn test_ec_point_add_identity() {
        let p = BigUint::from(17u32);
        let ec = EllipticCurve {
            a: Field::new(2, &p),
            b: Field::new(2, &p),
        };

        // (6, 3) + (5, 1) = (10, 6);
        let p1 = Point::Coor(Field::new(6, &p), Field::new(3, &p));
        let p2 = Point::Identity;
        let expect = Point::Coor(Field::new(6, &p), Field::new(3, &p));

        let result = ec.add(&p1, &p2);
        assert_eq!(expect, result);
    }

    #[test]
    fn test_scalar_mul() {
        let p = BigUint::from(17u32);
        let ec = EllipticCurve {
            a: Field::new(2, &p),
            b: Field::new(2, &p),
        };
        let q = Point::Coor(Field::new(5, &p), Field::new(1, &p));
        let k = BigUint::from(16u32);
        let result = ec.scalar_mul(&q, &k);

        let expected = Point::Coor(Field::new(10, &p), Field::new(11, &p));
        assert_eq!(result, expected);
    }

    #[test]
    fn test_double() {
        let p = BigUint::from(17u32);
        let ec = EllipticCurve {
            a: Field::new(2, &p),
            b: Field::new(2, &p),
        };

        let p = Point::Coor(Field::new(6, &p), Field::new(3, &p));
        let double = ec.double(&p);
        let p_on_curve = ec.is_on_curve(&double);
        assert!(p_on_curve);
    }
}
\`\`\`

### Specific case: The \`Secp256k1\`

Configuration of the values: \`n(order), p, a, b\` can be found [in this wiki page](https://en.bitcoin.it/wiki/Secp256k1).

We test our algorithm by the following test case:

\`\`\`rust
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

		let point = Point::Coor(Field { value: x, p: &p }, Field { value: y, p: &p });

		let ec = EllipticCurve {
				a: Field { value: a, p: &p },
				b: Field { value: b, p: &p },
		};

		let result = ec.scalar_mul(&point, &n);

		assert_eq!(Point::Identity, result);
}
\`\`\`

### The Elliptic Curve Digital Signature Algorithm (ECDSA)

#### Statement of the Theorem and Proof

Note that the group of **_all points_** on an elliptic curve is not always cyclic. There are some necessary conditions for that group to be cyclic [in this post](https://math.stackexchange.com/questions/2323595/under-what-conditions-do-all-the-points-on-an-elliptic-curve-form-a-cyclic-group).

> **Theorem.** Let $G$ be a cyclic subgroup of points on an elliptic curve
>
> $$
> C: y^2 = x^3+ax+b\\quad\\text{over  }\\,\\mathbb Z_p
> $$
>
> and $g\\in \\mathbb Z_p\\times \\mathbb Z_p$ a given generator of $G$. For a fixed $k_\\text{pri}\\in \\mathbb  Z_p$, define $K_\\text{pub} = k_\\text{pri} g$, then for every $k,z\\in \\mathbb Z_{|G|}$, there holds
>
> $$
>
> \\begin{aligned}
> &\\qquad \\,\\,\\,\\,\\begin{cases}
> R := \\pi_x(kg), \\\\
> S := k^{-1}\\big(z +\\pi_x(kg) k_\\text{pri}\\big )
> \\end{cases}\\\\
> &\\implies\\pi_x\\bigg(\\big[S^{-1}z\\big]g + \\big[S^{-1}R\\big]K_\\text{pub}\\bigg)\\equiv \\pi_x(kg)\\pmod{|G|}.
> \\end{aligned}
>
>
> $$
>
> Where $\\pi_x$ denotes the canonical projection to the first coordinate.
>
> In other words, if $(R,S)$ defined above is given to the target receiver, then **_necessarily_**
>
> $$
>
> \\pi_x\\bigg(\\big[S^{-1}z\\big]g + \\big[S^{-1}R\\big]K_\\text{pub}\\bigg)\\equiv R \\pmod{|G|}.
>
>
> $$
>
> - This **necessary** condition is defined to be the **_valid_** condition of a message, where $z=h(m)$ for some hash $h:\\texttt{&str}\\to\\texttt{u32}$ and string $m: \\texttt{&str}$ the message.
> - The tuple $(R,S)$ is called the **_signature_** of the message.

Note that here $K_\\text{pub}$ is called a **_public key_**, $k_\\text{pri}$ a **_private key_** and $k$ a **_random number_**.

<proof>

**_Proof._** The proof is a direct transformation from the definition over field $\\mathbb Z_p$:

$$
\\begin{aligned}
S&= k^{-1}(z + \\pi_x(kg)k_\\text{pri})\\\\
k &\\equiv S^{-1}(z + \\underbrace{\\pi_x(kg)}_{=:R}k_\\text{pri}) \\pmod{|G|}\\\\
 kg &\\equiv [S^{-1}z]g + [S^{-1}R]k_\\text{pri}g \\pmod{|G|}\\\\
 kg  &\\equiv [S^{-1}z]g + [S^{-1}R]K_\\text{pub} \\pmod{|G|}\\\\
R &\\equiv \\pi_x\\big( [S^{-1}z]g + [S^{-1}R]K_\\text{pub}\\big ). \\pmod{|G|}
\\end{aligned}
$$

The $(\\Longleftarrow)$ direction of the last line is incorrect because $\\pi_x(k_1g) = \\pi_x(k_2g)$ **_cannot_** imply $k_1=k_2$.

For example, recall that $g$ is a generator of $G$, if $k_1 g=(x_0, y_0)$, then since $G$ is cyclic, there must be a unique $k_2\\neq k_1$ in $\\mathbb Z_{|G|}$ such that $k_2g = ({\\boldsymbol x_{\\boldsymbol 0}}, -y_0) \\in G$.

</proof>

It has to be careful that $k\\cdot g$ is calculated on $\\mathbb Z_p$ but the message validation above are operated on $\\mathbb Z_{|G|}$.

<!-- ##### How to use This Theorem? -->

#### Coding

\`\`\`rust
#![allow(unused)]
#![allow(non_snake_case)]

use core::panic;

use crate::modules::elliptic_curve::{EllipticCurve, Field, Point};
use crate::modules::field_utils::Futil;
use num_bigint::{BigUint, RandBigInt};
use rand::{self, Rng};
use sha256::{digest, try_digest};

#[derive(PartialEq, Clone, Debug)]
pub struct ECDSA<'a> {
    pub elliptic_curve: EllipticCurve<'a>,
    pub generator: Point<'a>,
    pub order: BigUint,
}

impl<'a> ECDSA<'a> {
    pub fn generate_key_pair(&'a self) -> (BigUint, Point<'a>) {
        let priv_key = self.generate_private_key();
        let pub_key = self.generate_public_key(&priv_key);
        return (priv_key, pub_key);
    }

    pub fn generate_private_key(&self) -> BigUint {
        self.generate_random_positive_number_less_than(&self.order)
    }

    pub fn generate_random_positive_number_less_than(&self, max: &BigUint) -> BigUint {
        let mut rng = rand::thread_rng();
        rng.gen_biguint_range(&BigUint::from(1u32), &max)
    }

    pub fn generate_public_key(&'a self, priv_key: &BigUint) -> Point<'a> {
        self.elliptic_curve.scalar_mul(&self.generator, priv_key)
    }

    pub fn sign(&'a self, hash: &BigUint, priv_key: &BigUint, k_random: &BigUint) -> (BigUint, BigUint) {
        assert!(hash < &self.order, "Hash is bigger than the order of Elliptic Curve");
        assert!(
            priv_key < &self.order,
            "Private key has value bigger than the order of Elliptic Curve"
        );
        assert!(k_random < &self.order, "k_random has value bigger than the order of Elliptic Curve");
        let g = &self.generator;
        let z = hash;
        let k_pri = priv_key;
        let kg = self.elliptic_curve.scalar_mul(g, &k_random);

        match kg {
            Point::Identity => panic!("Public key should not be an identity."),
            Point::Coor(kg_x, _) => {
                let R = kg_x.value;

                let S = Futil::mul(&R, &priv_key, &self.order);
                let S = Futil::add(&z, &S, &self.order);
                let S = Futil::mul(&Futil::mul_inverse(k_random, &self.order), &S, &self.order);
                (R, S)
            }
        }
    }

    pub fn verify(&self, hash: &BigUint, pub_key: &Point, signature: &(BigUint, BigUint)) -> bool {
        assert!(hash < &self.order, "Hash is bigger than the order of the elliptic curve");
        let (R, S) = signature;
        let z = hash;
        let P = self.elliptic_curve.add(
            // &self.elliptic_curve.scalar_mul(&self.generator, (z / S)),
            &self
                .elliptic_curve
                .scalar_mul(&self.generator, &Futil::mul(&z, &Futil::mul_inverse(S, &self.order), &self.order)),
            &self
                .elliptic_curve
                .scalar_mul(pub_key, &Futil::mul(R, &Futil::mul_inverse(S, &self.order), &self.order)),
        );

        if let Point::Coor(X, Y) = &P {
            (&X.value - R).modpow(&BigUint::from(1u32), &self.order) == BigUint::from(0u32)
        } else {
            false
        }
    }

    pub fn generate_hash_less_than(&self, message: &str, max: &BigUint) -> BigUint {
        let digested = digest(message);
        let bytes = hex::decode(&digested).expect("Cannot convert to Vec<u8>");
        let one = BigUint::from(1u32);
        let hash = BigUint::from_bytes_be(&bytes).modpow(&one, &(max - &one));
        let hash = hash + one;
        hash
    }
}
\`\`\`

#### Tests

\`\`\`rust
#[cfg(test)]
mod test {
    use crate::modules::curves::{Curve, CurveConfig};

    use super::*;
    #[test]
    fn test_sign_verify() {
        let p = BigUint::from(17u32);
        let ec = EllipticCurve {
            a: Field::new(2, &p),
            b: Field::new(2, &p),
        };
        let gp_order = BigUint::from(19u32);
        let g = Point::Coor(Field::new(5, &p), Field::new(1, &p));

        let ecdsa = ECDSA {
            elliptic_curve: ec,
            generator: g,
            order: gp_order,
        };

        let priv_key = BigUint::from(7u32);
        let pub_key = ecdsa.generate_public_key(&priv_key);

        let hash = Field::new(10, &p);
        let k_random = BigUint::from(18u32);

        let message = "Bob -> 1BTC -> Alice";
        let hash_ = ecdsa.generate_hash_less_than(message, &ecdsa.order);
        let hash = BigUint::from(hash_);
        let signature = ecdsa.sign(&hash, &priv_key, &k_random);
        let verify_result = ecdsa.verify(&hash, &pub_key, &signature);
        assert!(verify_result);
    }

    #[test]
    fn test_sign_tempered_verify() {
        let p = BigUint::from(17u32);
        let ec = EllipticCurve {
            a: Field::new(2, &p),
            b: Field::new(2, &p),
        };
        let gp_order = BigUint::from(19u32);
        let g = Point::Coor(Field::new(5, &p), Field::new(1, &p));

        let ecdsa = ECDSA {
            elliptic_curve: ec,
            generator: g,
            order: gp_order,
        };

        let priv_key = BigUint::from(7u32);
        let pub_key = ecdsa.generate_public_key(&priv_key);

        let hash = Field::new(10, &p);
        let k_random = BigUint::from(18u32);

        let message = "Bob -> 1BTC -> Alice";
        let hash_ = ecdsa.generate_hash_less_than(message, &ecdsa.order);
        let hash = BigUint::from(hash_);
        let signature = ecdsa.sign(&hash, &priv_key, &k_random);
        let (R, S) = signature;
        let R = R + BigUint::from(1u32);
        let R = Futil::power(&R, 1, &ecdsa.order);

        let tempered_signature = (R, S);
        let verify_result = ecdsa.verify(&hash, &pub_key, &tempered_signature);
        assert!(!verify_result);
    }

    #[test]
    fn test_secp256_sign_verify_tempered<'a>() {
        let CurveConfig { a, b, generator, order, p } = Curve::get_Secp256k1_config();
        let (x, y) = generator;
        let generator = Point::Coor(Field { value: x, p: &p }, Field { value: y, p: &p });
        let ec = Curve::get_elliptic_cuve(&p, &a, &b);
        let ecdsa = Curve::get_ecdsa(&ec, &generator, &order);

        // modifiied from the order n
        let priv_key = BigUint::parse_bytes(b"FFFFF0000FFF0F0F0F0F0F0F0F0F0F0EBAAEDCE6AF48A03BBFD25E8CD0364141", 16)
            .expect("Cannot parse into interger");
        let pub_key = ecdsa.generate_public_key(&priv_key);

        let hash = Field::new(10, &p);
        let k_random = ecdsa.generate_random_positive_number_less_than(&order);

        let message = "Bob -> 1BTC -> Alice";
        let hash_ = ecdsa.generate_hash_less_than(message, &ecdsa.order);
        let hash = BigUint::from(hash_);
        let signature = ecdsa.sign(&hash, &priv_key, &k_random);

        // let verify_result = ecdsa.verify(&hash, &pub_key, &signature);
        // println!("hash: {}", hash);
        // assert!(verify_result);

        let (R, S) = signature;
        let R = R + BigUint::from(1u32);
        let R = Futil::power(&R, 1, &ecdsa.order);

        let tempered_signature = (R, S);
        let verify_result = ecdsa.verify(&hash, &pub_key, &tempered_signature);
        assert!(!verify_result);
    }
}
\`\`\`

### Reference

- Udemy course: [Elliptic Curve Cryptography in Rust](https://www.udemy.com/course/elliptic-curve-cryptography-in-rust/)
- [一文读懂 ECDSA 算法如何保护数据](https://zhuanlan.zhihu.com/p/97953640?fbclid=IwAR0MMbQbGXVTAcErHNlHWRU1lUnpzqHTGdmB7rUxiD-xfFgguh_czX-gm50)
`;export{n as default};
