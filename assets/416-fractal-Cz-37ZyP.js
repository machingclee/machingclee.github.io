const e=`---
title: "Drawing Fractal (Mandelbrot Set) in Rust"
date: 2025-09-23
id: blog0416
tag: rust, math
toc: true 
intro: Practice the syntax of rust by drawing fractal derived from simple mathematics.
img: /assets/img/2025-09-23-18-47-14.png
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>

### Result

<center>

[![](/assets/img/2025-09-23-18-47-14.png)](/assets/img/2025-09-23-18-47-14.png)


</center>

### Methametical Definition

For each $c\\in \\mathbb C$, define $f_c(z)=z^2+c$, we say that $c$ is in a  ***Mandelbrot set*** if the sequence 
$$
\\{(\\underbrace{f_c\\circ\\cdots\\circ f_c}_\\text{$n$ times})(0)\\}
$$
is bounded, which is the same as saying the seqeunce of complex numbers defined by $z_{n+1} = f_c(z_n)$ is bounded with $z_0 := f_c(0)$. 


### Coding

Since we have a sequential definition, in coding which is the same as saying

\`\`\`rust
let mut z = Complex { re: 0.0, im: 0.0 };

for i in 0..n {
  z = z * z + c
}
\`\`\`
is bounded for however large $n$.


#### Preliminary Functions

##### Crates

\`\`\`rust
use image::codecs::png::PngEncoder;
use image::{ExtendedColorType, ImageEncoder, ImageError};
use num::Complex;
use std::fs::File;
use std::time::Instant;
\`\`\`

##### ecape_time


\`\`\`rust
fn escape_time(c: Complex<f64>, limit: usize) -> Option<usize> {
    let mut z = Complex { re: 0.0, im: 0.0 };
    for i in 0..limit {
        if z.norm_sqr() > 4.0 {
            return Some(i);
        }
        z = z * z + c
    }
    None
}
\`\`\`

A theorem in fractal analysis says that 

>  **Theorem.** A point $c\\in \\mathbb C$ belongs to the Mandelbrot set if and only if $|z_n|\\leq 2$ for all $n \\ge 0$.

To plot the graph of Mandelbrot set, it is enough to loop through a set of points in a complex plane and for each point $c\\in \\mathbb C$ we consider it as a point in Mandelbrot set if \`let mut z = c;\`, \`z = z * z + c;\` has norm smaller than 2 for each of 255 loops. If it is bigger than 2 for some iteration, we end the loop.


##### pixel_plane_to_complex_plane

\`\`\`rust
fn pixel_plane_to_complex_plane(
    pixel_img_dim: (usize, usize),
    pixel_coordinate: (usize, usize),
    complex_plane_upper_left: Complex<f64>,
    complex_plane_lower_right: Complex<f64>,
) -> Complex<f64> {
    let complex_plane_width = complex_plane_lower_right.re - complex_plane_upper_left.re;
    let compelx_palne_height = complex_plane_upper_left.im - complex_plane_lower_right.im;
    let pixel_img_width = pixel_img_dim.0 as f64;
    let pixel_img_height = pixel_img_dim.1 as f64;
    let new_re = complex_plane_upper_left.re
        + (pixel_coordinate.0 as f64) * complex_plane_width / pixel_img_width;
    let new_im = complex_plane_lower_right.im
        + (pixel_img_height - pixel_coordinate.1 as f64) * compelx_palne_height / pixel_img_height;
    Complex {
        re: new_re,
        im: new_im,
    }
}
\`\`\`



##### render 

\`\`\`rust
fn render(
    pixels: &mut [u8],
    image_dim: (usize, usize),
    complex_upper_left: Complex<f64>,
    complex_bottom_right: Complex<f64>,
) {
    assert!(pixels.len() == image_dim.0 * image_dim.1);
    for row in 0..image_dim.1 {
        for col in 0..image_dim.0 {
            let z = pixel_plane_to_complex_plane(
                image_dim,
                (col, row),
                complex_upper_left,
                complex_bottom_right,
            );
            pixels[row * image_dim.0 + col] = match escape_time(z, 255) {
                Some(count) => 255 - (count as u8),
                None => 0,
            }
        }
    }
}
\`\`\`

##### write_png

\`\`\`rust
fn write_png(file_name: &str, pixels: &[u8], dimension: (usize, usize)) -> Result<(), ImageError> {
    let output = File::create(file_name)?;
    let encoder = PngEncoder::new(output);
    encoder.write_image(
        pixels,
        dimension.0 as u32,
        dimension.1 as u32,
        ExtendedColorType::L8,
    )?;
    Ok(())
}
\`\`\`


#### run_in_single_thread

\`\`\`rust
fn run_in_single_thread() -> Result<(), ImageError> {
    let image_dim = (3000, 2000);
    let mut pixels = vec![0; image_dim.0 * image_dim.1];
    let z_upper_left = Complex {
        re: -1.20,
        im: 0.35,
    };
    let z_lower_right = Complex { re: -1.0, im: 0.20 };
    render(&mut pixels, image_dim, z_upper_left, z_lower_right);
    write_png("fractal.png", &pixels, image_dim)?;
    Ok(())
}
\`\`\``;export{e as default};
