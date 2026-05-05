const n=`---
title: Inequality
date: 2025-12-21
id: math005
tag: math
intro: Record a mathematical problem from thread
wip: true
toc: false
---


### The Statement

![](/assets/img/2025-12-21-18-53-14.png)

### Results so far

#### Direction 1

Rewrite it as $\\sum_{cyc} \\frac{a^3}{b^2+c^2} \\ge \\frac{\\sum_{cyc} a}{2}$, WLOG we can assume that $\\sum_{cyc} a^2=1$, the desired inequliaty to prove becomes: 

$$
\\sum_{cyc} \\frac{a^3}{1-a^2} \\ge \\frac{1}{2}\\sum_{cyc} a
$$


Now 

$$
\\sum_{cyc} a \\sum_{cyc} \\frac{a^3}{1-a^2} \\ge \\left( \\sum_{cyc}\\frac{a^2}{\\sqrt{1-a^2}}\\right)^2

$$

Next we also have 

$$
\\sum_{cyc}\\frac{a^2}{\\sqrt{1-a^2}} \\sum_{cyc} \\sqrt{1-a^2}  \\ge \\left( \\sum_{cyc} a \\right)^2
$$`;export{n as default};
