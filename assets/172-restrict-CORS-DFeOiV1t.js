const n=`---
title: "Restrict CORS to Limited Origins"
date: 2023-09-03
id: blog0172
tag: express
intro: "Record how to implement CORS in express to allow certain origins to get access instead of allowing all origins"
toc: false
---

<style>
  img {
    max-width: 100%
  }
</style>

\`\`\`js
import express from "express";
import cors from 'cors';

const allowlist = ['http://localhost:3000']

const corsOptionsDelegate = (req, callback) => {
  var corsOptions;

  if (allowlist.indexOf(req.header('Origin')) > -1) {
    // reflect (enable) the requested origin in the CORS response
    corsOptions = { origin: true };
  } else {
    // disable CORS for this request
    corsOptions = { origin: false }; 
  }
  // callback expects two parameters: (error, options)
  callback(null, corsOptions) 
}

app.use(cors(corsOptionsDelegate));
\`\`\``;export{n as default};
