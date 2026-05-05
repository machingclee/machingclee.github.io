const n=`---
title: "How to \`node your-script.js --env=some_env\`"
date: 2024-03-02
id: blog0245
tag: nodejs
intro: "We record how to make custom script with custom predefined variable in command line via running js script."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Usage

We execute the script via 

\`\`\`text
node env-to-eas-json.js --env=uat --debug=false --store=true
\`\`\`
then the parameters will be passed into function as \`string\`'s

### How to Implement

We use an npm package called [minimist](https://www.npmjs.com/package/minimist). 


#### The Main Part


\`\`\`js
// script.js
const fs = require("fs");
var argv_ = require("minimist")(process.argv.slice(2));

const main = (argv) => {
  const { env, debug, store } = argv; // e.g., env = "dev_voice_only"
  const debug_ = debug === "true";
  const publish = store === "true";

  // end of this topic, you can implement your own logic below:
}

main(argv_);
\`\`\`

#### A Complete Example

The following script will copy variables inside \`.env-cmdrc\` described by [this post](/blog/article/Environment-Variable-by-env-cmdrc), to the corresponding fields inside \`eas.json\` for \`expo\` projects.


\`\`\`js
const fs = require("fs");
var argv_ = require("minimist")(process.argv.slice(2));

const main = (argv) => {
  const { env, debug, store } = argv; // e.g., env = "dev_voice_only"
  const debug_ = debug === "true";
  const publish = store === "true";

  console.log("Copying environment variables from .env-cmdrc to eas.json");

  // then the reamining are messy logics of copying custom.env 
  // into eas.json for expo project

  const envFile = fs.readFileSync(".env-cmdrc", { encoding: "utf-8" });
  const envJson = JSON.parse(envFile);
  const defaultConfig = envJson["default"];
  const envConfig = envJson[env];

  // json to be copied to eas.json at "[env]" key
  const easConfig = { ...defaultConfig, ...envConfig };
  // in case debug == true, we inject the following attributes to debug development build
  const debugAttributes = {
    android: {
      gradleCommand: ":app:assembleDebug",
    },
    ios: {
      buildConfiguration: "Debug",
    },
  };
  // load the existing eas.json
  const easJsonToBeAdjusted = JSON.parse(
    fs.readFileSync("eas.json", { encoding: "utf-8" })
  );

  // adjust the target build environment (prod, dev, uat, ..., etc)
  easJsonToBeAdjusted["build"][env] = {
    distribution: publish ? "store" : "internal",
    env: easConfig,
    ...(debug_ ? debugAttributes : {}),
  };
  const adjustedEasJsonString = JSON.stringify(easJsonToBeAdjusted, null, 2);
  fs.writeFileSync("eas.json", adjustedEasJsonString);
};

main(argv_);
\`\`\``;export{n as default};
