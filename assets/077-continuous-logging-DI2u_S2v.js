const n=`---
title: Logging Without Printing New Lines
date: 2022-05-23
id: blog077
tag: python
intro: Create a console log that freeze the position but keep updating the numerics in training.
---

### What we can Achieve:

<center>
<img src="/assets/tech/054.gif"/>
</center>

### Update Log Without new line in Console

In the image above, only the numerical values are changing, no new line will be further created. For this, we need to know <a href="https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797"><b><i>ANSI Escape Sequences</i></b></a>.

We usually use the following:
|code|purpose|
|---|---|
|<img width=100/>|<img style="width:calc(100%)"/>|
|\`ESC[#A\` | moves cursor ups|
| \`ESC[#B\`| moves cursor down |
| \`ESC[#C\`| moves cursor right |
| \`ESC[#D\`| moves cursor left |
| \`ESC[#E\`| moves cursor to beginning of next line, # lines down |
| \`ESC[#F\`| moves cursor to beginning of previous line, # lines up |
| \`ESC[0K\` | clears line|

<p></p>

<center></center>

In python the **escape code** is prefixed by Hexadecimal: \`\\x1B\` (in nodejs we use \`\\u001b\`).

### Procesure to Create Continuous Log

Suppose that we want to print 8 lines of log continuosly, then:

- **Step 1.** Printed 8 lines by \`print("\\n\\n\\n\\n\\n\\n\\n\\n")\`.
- **Step 2.** Go up by 8 lines, for this, we need:
  \`\`\`python
  print("\\x1B[8A")
  \`\`\`
- **Step 3.** Now we can \`print\` our own 8 lines of log.

  We need to append \`ESC[0K\` at the end of each string to print to make sure no extra character survives.

  Why? We can see what happends when \`print("1 2 3 4", end="\\r")\` and \`print("5 6", end="\\r")\`, since the first line is longer, the result becomes \`5 6 3 4\` instead of \`5 6\`.

- **Step 4.** Upon completion of logging, we move cursor up by 8 rows again (step 2).

### Example of Continuous Logger

We summarize this workflow in \`print\` method below:

\`\`\`python
from pydash.objects import get, set_

class ConsoleLog():
    def __init__(self, lines_up_on_end=0):
        self.CLR = "\\x1B[0K"
        self.lines_up_on_batch_end = lines_up_on_end
        self.record = {}

    def UP(self, lines):
        return "\\x1B[" + str(lines + 1) + "A"

    def DOWN(self, lines):
        return "\\x1B[" + str(lines) + "B"

    def on_print_end(self):
        print(self.UP(self.lines_of_log))
        print(self.UP(self.lines_up_on_batch_end))

    def print(self, key_values):
        lines_of_log = len(key_values)
        self.lines_of_log = lines_of_log


        # for the first time,
        # print self.lines_of_log number of lines to occupy the space
        print("".join(["\\n"] * (self.lines_of_log)))
        print(self.UP(self.lines_of_log))

        for key, value in key_values:
            if key == "" and value == "":
                print()
            else:
                if key != "" and value != "":
                    prev_value = get(self.record, key, 0.)
                    curr_value = value
                    diff = curr_value - prev_value
                    sign = "+" if diff >= 0 else ""
                    print("{0: <35} {1: <30}".format(key, value) + sign + "{:.5f}".format(diff) + self.CLR)
                    set_(self.record, key, value)

        self.on_print_end()

    def clear_log_on_epoch_end(self):
        # usually before calling this line, print() has been run, therefore we are at the top of the log.
        for _ in range(self.lines_of_log):
            # clear lines
            print(self.CLR)
        # ready for next epoch
        print(self.UP(self.lines_of_log))
\`\`\`

Now we can call it at the end of the for loop:

\`\`\`python
console_log = ConsoleLog(lines_up_on_end=1)

for ... in tqdm(data_gen,
                total=n_batches,
                desc="Epoch {}".format(epoch),
                bar_format=config.bar_format):

    console_log.print(
        [
            ("", ""),
            ("d_loss", d_loss.item()),
            ("- d_wgan_gp_loss", d_wgan_gp_loss.item()),
            ("- d_cls_loss_on_real", cls_loss_on_real.item()),
            ("", ""),
            ("g_loss", g_loss.item()),
            ("- g_spatial_cat_similarity_loss", g_spatial_cat_similarity_loss.item()),
            ("- g_cycle_loss", g_cycle_loss.item()),
            ("- g_mask_cycle_loss", g_mask_cycle_loss.item()),
            ("- g_mask_vanishing_loss", g_mask_vanishing_loss.item()),
            ("- g_mask_spatial_constraint_loss", g_mask_spatial_constraint_loss.item()),
            ("- g_cls_loss_on_gened", g_cls_loss_on_gened.item()),
            ("- g_wgan_gp_loss", g_wgan_gp_loss.item())
        ])
# depends on whether we have next for loop:
# console_log.clear_log_on_epoch_end()
\`\`\`

Here \`lines_up_on_end\` is provided because \`tqjm\` also needs to upate on its line, so we will need \`lines_up_on_end\` to be \`1\`, normally it is \`0\`.
`;export{n as default};
