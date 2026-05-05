const n=`---
title: pathlib and json in Python
date: 2022-04-07
id: blog058
tag: python
intro: Record simple usages of \`pathlib\` and \`json\` in python
---

### pathlib

- \`pathlib.Path\` object can be fed into \`open()\`.
- \`Path.touch(exist_ok=True)\` creates a new file if \`file_path\` does not exist, otherwise do nothing.
- Example:

  \`\`\`python
  from pathlib import Path

  file_path = 'batches.json'
  json_filepath = Path(file_path)
  json_filepath.touch(exist_ok=True)

  with open(json_filepath, "w+") as json_io:
    pass
  \`\`\`

### json

- We use \`json.load(IODevice)\` to load json data into a dictionary.
- We use \`json.loads(String)\` to convert json string into a python object.
- We use \`json.dumps(Object)\` to convert python object into a string.
- Examples:
  \`\`\`python
  with open(json_file, "w+") as json_io:
    data = json.load(f)
  \`\`\`
  \`\`\`python
  json_file = Path('batches.json')
  json_file.touch(exist_ok=True)
  with open(json_file, "w+") as json_io:
    json_io.write(json.dumps(trip_batches, indent=4))
  \`\`\`
`;export{n as default};
