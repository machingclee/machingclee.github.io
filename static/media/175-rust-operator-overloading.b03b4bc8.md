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

#### Utility Struct to Perform Arithmatics on $\mathbb Z/ p \mathbb Z$ for `BigUint`

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

#### Operator Overloading

##### New Struct `F_p`

We wish to convert `BigUint` into our own struct `F_p` and define all the usual operation on $\mathbb Z/p \mathbb Z$, i.e., among the `F_p` objects.

That is, we wish to overload the operators:

```text
+ - * /
```

without the utility struct `Fp`.

```rust
struct F_p<'a> {
    value: BigUint,
    p: &'a BigUint,
}

impl<'a> Add<&'a F_p<'a>> for &F_p<'a> {
    type Output = F_p<'a>;

    fn add(self, rhs: &F_p<'a>) -> Self::Output {
        let value = (&self.value + &rhs.value).modpow(&BigUint::from(1u32), self.p);
        F_p { value, p: self.p }
    }
}

impl<'a> Sub<&'a F_p<'a>> for &F_p<'a> {
    type Output = F_p<'a>;

    fn sub(self, rhs: &F_p<'a>) -> Self::Output {
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

impl<'a> Mul<BigUint> for &F_p<'a> {
    type Output = F_p<'a>;
    fn mul(self, rhs: BigUint) -> Self::Output {
        let a = &self.value;
        let value = a * &rhs;
        return F_p { value, p: self.p };
    }
}

impl<'a> Mul<&'a F_p<'a>> for &F_p<'a> {
    type Output = F_p<'a>;

    fn mul(self, rhs: &F_p<'a>) -> Self::Output {
        let value = (&self.value * &rhs.value).modpow(&BigUint::from(1u32), self.p);
        F_p { value, p: self.p }
    }
}

impl<'a> Div<&'a F_p<'a>> for &F_p<'a> {
    type Output = F_p<'a>;

    fn div(self, rhs: &F_p<'a>) -> Self::Output {
        let left = &self.value;
        let right = &rhs.value;
        let p_minus_2 = (self.p - BigUint::from(2u32)).modpow(&BigUint::from(1u32), self.p);

        let multiplicative_inverse_right = right.modpow(&p_minus_2, &self.p);
        let value = (left * &multiplicative_inverse_right).modpow(&BigUint::from(1u32), self.p);
        F_p { value, p: &self.p }
    }
}
```

##### Rewrite of EllipticCurve::double

```rust
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
                let xp = F_p {
                    value: x.clone(),
                    p: &self.p,
                };
                let yp = F_p {
                    value: y.clone(),
                    p: &self.p,
                };

                let ap = F_p {
                    value: self.a.clone(),
                    p: &self.p,
                };

                let two_times_yp = &yp * BigUint::from(2u32);
                let s = &(&(&(&xp * &xp) * BigUint::from(3u32)) + &ap) / &two_times_yp;
                let two_times_x = (&xp) * BigUint::from(2u32);
                let new_x = &(&s * &s) - &two_times_x;
                let x_minus_new_x = &xp - &new_x;
                let new_y = &(&s * &x_minus_new_x) - &yp;

                Point::Coor(new_x.value.clone(), new_y.value)
            }
        }
    }
```

##### Rewrite of EllipticCurve::add

```rust
    fn add(&self, h: &Point, k: &Point) -> Point {
        let h_on_curve = self.is_on_curve(h);
        let k_on_curve = self.is_on_curve(k);
        assert!(*h != *k, "two points should not be the same");
        assert!(h_on_curve, "point h is not on the curve");
        assert!(k_on_curve, "point k is not on the curve");
        match (h, k) {
            (Point::Identity, _) => k.clone(),
            (_, Point::Identity) => h.clone(),
            (Point::Coor(x1, y1), Point::Coor(x2, y2)) => {
                if x1 == x2 && (y1 + y2) == BigUint::from(0u32) {
                    return Point::Identity;
                }
                // s = (y2-y1)/(x2-x1)
                // x3 = s^2 - x1 - x2
                // y3 = s*(x1-x3) - y1
                let x1p = F_p {
                    value: x1.clone(),
                    p: &self.p,
                };
                let y1p = F_p {
                    value: y1.clone(),
                    p: &self.p,
                };
                let x2p = F_p {
                    value: x2.clone(),
                    p: &self.p,
                };
                let y2p = F_p {
                    value: y2.clone(),
                    p: &self.p,
                };

                let x2p_minus_x1p = &x2p - &x1p;
                let s = &(&y2p - &y1p) / &x2p_minus_x1p;
                let x3p = &(&((&s) * (&s)) - &x1p) - &x2p;
                let x1p_minus_x3p = &x1p - &x3p;
                let y3p = &(&s * &x1p_minus_x3p) - &y1p;

                Point::Coor(x3p.value.clone(), y3p.value)
            }
        }
    }
```

#### Caveat

- There are necessary copyings because our enum variant is defined as

  - `Point::Coor(BigUint, BigUint)`

  but not

  - `Point::Coor(F_p, F_p)`.

- Make sure to choose correct data type from the begining, if we were to convert

  - `original_type` (`BigUint` in our case)

  into

  - `convenient_type` (`F_p` in our case)

  later, we will need to do copying for that kind of types transfer.

- Worse still, that kind of copying operations will accumulate.
