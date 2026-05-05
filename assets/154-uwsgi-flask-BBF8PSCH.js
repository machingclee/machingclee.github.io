const n=`---
title: "Flask with Uwsgi and Docker Image Deployment"
date: 2023-07-10
id: blog0154
tag: react, aws
intro: "A full breakdown of steps deploying a react project to s3 with SSL encryption."
toc: true
---

### Repository

- [The Boilerplate](https://github.com/machingclee/2023-07-09-uwsgi-flask-boilerplate-with-docker-deployment)

### Project Structure

<Center>
  <a href="/assets/tech/154/001.png">
    <img src="/assets/tech/154/001.png"/>
  </a>
</Center>
<p/>

### Controllers

\`\`\`python
# src/controllers/script_controller.py

import os
import io
from flask import Blueprint, render_template, abort, send_file, request, jsonify

from src.wb_quotation_summary_excel_script.quotation_summary_excel_script \\
    import main as quotation_summary_excel_script

from src.wb_quotation_comparison_excel_script.quotation_comparison_excel_script \\
    import main as quotation_comparison_excel_script

from typing import Callable

script_controller = Blueprint('script_controller',
                              __name__)

def process(data_source: dict, exec_script: Callable[[dict], str]) -> str:
    ...

@script_controller.route("/script/quotation_summary_excel", methods=['GET', 'POST'])
def quotation_summary_excel():
    ...

@script_controller.route("/script/quotation_comparison_excel_script", methods=['GET', 'POST'])
def quotation_comparison_excel():
    ...
\`\`\`

### How Controller Access \`src.wb_quotation_summary_excel_script\`?

- Usually in python things become tricky if we want to access object defined in **arbitrary** diectory.
- It is very often to get \`ModuleNotFoundError\` and requires tricky step to get around it like appending desired directory path to \`sys.path\` that includes \`src\`.
- **_Alternatively_** we can simply define an environment variable \`PYTHONPATH\` to be the directory that is parent to our \`src/\`.
- This makes the import statement \`from src.wb_quotation_comparison_excel_script\` becomes possible without inserting weired logic like \`sys.path.append\`.
- In this way our debugger can work flawlessly:
  \`\`\`json
  {
    "version": "0.2.0",
    "configurations": [
      {
        "name": "Python: Current File",
        "type": "python",
        "request": "launch",
        "program": "\${file}",
        "console": "integratedTerminal",
        "env": {
          "PYTHONPATH": "\${workspaceRoot}"
        }
      }
    ]
  }
  \`\`\`

### Borrow the same Idea to Deploy Docker Image

We define \`RUN export PYTHONPATH="/project"\` and therefore no \`ModuleNotFoundError\` can occur.

\`\`\`dockerfile
FROM python:3.8

RUN apt-get update
RUN apt-get install -y --no-install-recommends \\
    libatlas-base-dev gfortran nginx supervisor

RUN pip3 install uwsgi

COPY ./requirements.txt /project/requirements.txt

RUN pip3 install -r /project/requirements.txt

RUN useradd --no-create-home nginx

RUN rm /etc/nginx/sites-enabled/default
RUN rm -r /root/.cache

COPY server_configs/nginx.conf /etc/nginx/
COPY server_configs/flask-site-nginx.conf /etc/nginx/conf.d/
COPY server_configs/uwsgi.ini /etc/uwsgi/
COPY server_configs/supervisord.conf /etc/

RUN mkdir -p /project/src
COPY /src /project/src

RUN mkdir -p /project/excel_files
RUN chmod 643 /project/excel_files
RUN export PYTHONPATH="/project"

WORKDIR /project

CMD ["/usr/bin/supervisord"]
\`\`\`
`;export{n as default};
