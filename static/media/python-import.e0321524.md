---
title: How to Include Project Directory in sys.path when Running pytest
date: 2021-10-20
id: blog032
tag: python
intro: As titled.
toc: false
---

When performing unit tests we usually import modules in `project-directory/src`. For this to work, we have to make sure `sys.path` contains our `project-directory` when running `pytest`, so that

```python
from src.utils.module_name import SomeClass
```

becomes possible. It is as simple as executing (instead of `pytest -vv test/...`)

```text
python -m pytest -vv test/...
```

and make sure we have `cd`ed into project directory when running this script.
