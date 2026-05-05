const n=`---
title: Customized Logger in Python and Javascript
date: 2022-03-07
id: blog046
tag: python, javascript
intro: Logging is undoubtedly the most important part of an application. We study how to create a logger that tells us a message comes from which file and which line.
---

### In Python

This python logger not only log the message in the console, it also pipes all the message inside a file which we can review as long as this file is saved in a volume.

\`\`\`python
import logging
import datetime
import os
from utils.get_config import get_config

def create_logger(log_dir,logging_level=logging.INFO):
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    logger = logging.getLogger()
    logger.setLevel(logging_level)
    formatter = logging.Formatter(
        '[%(levelname)1.1s %(asctime)s %(module)s:%(lineno)d] %(message)s',
        datefmt='%Y%m%d %H:%M:%S')

    sh = logging.StreamHandler()
    sh.setLevel(logging_level)
    sh.setFormatter(formatter)

    log_filename = datetime.datetime.now().strftime("%Y-%m-%d_%H_%M_%S.log")
    fh = logging.FileHandler(os.path.sep.join([log_dir, log_filename]))
    fh.setLevel(logging_level)
    fh.setFormatter(formatter)

    logger.addHandler(sh)
    logger.addHandler(fh)

    return logger

logger_dir = get_config("log_dir", "sbg-logs")
logger = create_logger(logger_dir)
\`\`\`

### In javascript

Unlike python, we will use npm package \`tracer\` to customize the logger as follows:

\`\`\`javascript
import tracer from "tracer";
import fs from "fs";
import path from "path";
const date = new Date();
const year = date.getFullYear();
const month = date.getMonth();
const day = date.getDate();
const hour = date.getHours();
const mins = date.getMinutes();
const seconds = date.getSeconds();
const dateString = \`\${year}-\${month}-\${day}_\${hour}-\${mins}-\${seconds}\`;
const logFileDir = "./logs";
const logFileLocation = path.join(logFileDir, \`\${dateString}.log\`);

if (!fs.existsSync(logFileDir)) {
  fs.mkdirSync(logFileDir);
}
if (!fs.existsSync(logFileLocation)) {
  fs.open(logFileLocation, "w", () => {});
}

const logger = tracer.colorConsole({
  transport: function (data) {
    fs.createWriteStream(logFileLocation, {
      flags: "a",
      encoding: "utf-8",
      mode: 0o666,
    }).write(data.rawoutput + "\\n");
  },
  format: [
    "[{{timestamp}}-<{{title}}>-{{file}}:{{line}}] {{message}}", //default format
    {
      error:
        "[{{timestamp}}-<{{title}}>-{{file}}:{{line}}] {{message}} \\nCall Stack:\\n{{stack}}", // error format
    },
  ],
  dateformat: "HH:MM:ss.L",
  preprocess: function (data) {
    data.title = data.title.toUpperCase();
  },
});

export default logger;
\`\`\`
`;export{n as default};
