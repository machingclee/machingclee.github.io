const n=`---
title: Two Methods to Read Excel Files in Python
date: 2022-03-24
id: blog052
tag: python, excel
intro: Record two methods to read excel files in Python
---

### Description of an Unusual Excel File

Assume that we are going to process the following "unstructured" (or structured in an unusual way) excel file:

<a href="/assets/tech/031.png">
  <img src="/assets/tech/031.png" width="100%">
</a>
<p/>

The image displays an excel organized:

- with some row being categories,
- with some row being items of categories right above, and regarded as the true header of the table,
- with some row meaning True and False (colored or not).
- with some column even being empty.

It cannot be regarded as a usual table, we have to carefully handle it case by case. That means we have to be very familiar with package that handle the excel files.

### Pandas

#### Read Lines for Pandas

\`\`\`python
import pandas as pd

excel_file = "Program_Details.xlsx"
df = pd.read_excel(excel_file, engine="openpyxl", sheet_name="Raw Data")

symp_row = df.iloc[2, 6:]
print(symp_row)
\`\`\`

\`\`\`text
Unnamed: 6                              Anxiety
Unnamed: 7                          Bereavement
Unnamed: 8                        Cool Emotions
Unnamed: 9                     Debility 虛弱 \\n虛弱
Unnamed: 10                          Depression
                             ...
Unnamed: 220                                US$
Unnamed: 221                   HK$\\n(US$1=HK$8)
Unnamed: 222    Discount /\\nShipping /\\nSurplus
Unnamed: 223                     price per drop
Unnamed: 224                                NaN
\`\`\`

- Regardless of the behaviour of how pandas handle empty rows, we can experiment on
  \`\`\`python
  df.iloc[i, 6:]
  \`\`\`
  to test which row index \`i\` we should start with.
- Empty cells have value \`nan\` when we cast to \`string\`.
- To iterate over the row, we use
  \`\`\`python
  # generator that gives (col_name, value):
  df.iloc[i, 6:].items()
  \`\`\`
- we can also use

  \`\`\`python
  datas_df = df.iloc[0:, 1:4]

  for index, value in datas_df.iterrows():
    col1, col2, col3 = value
  \`\`\`

  to unpack the values.

### openpyxl

However, there is no way for pandas to get the color of a cell, we resort to \`openpyxl\` which \`pandas\` base on in order to read \`.xlsx\` (another extension for excel file).

#### Read Lines for openpyxl

\`\`\`python
import openpyxl
from openpyxl import load_workbook

excel_file = "Program_Details.xlsx"
wb = load_workbook(excel_file, data_only=True)
sheet = wb['Raw Data']
\`\`\`

- The cell of the \`i\`-th row and \`j\`-th column is \`sheet[i][j]\`, the values is read by
  \`\`\`python
  cell = sheet[i][j]
  cell.value
  \`\`\`
- The background color of the cell can be obtained by
  \`\`\`python
  cell.fill.start_color.index
  \`\`\`

### Conclusion

- If we just want to read an excel file, then \`openpyxl\` is enough.

- If we want to manipulate the data in an excel file, then we use \`pandas\` as the syntax
  \`\`\`python
  df.iloc[i:j, h:k]
  \`\`\`
  is very handy compared to \`openpyxl\`.
`;export{n as default};
