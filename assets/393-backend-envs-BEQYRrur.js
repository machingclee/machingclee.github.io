const n=`---
title: Environment Variables via Secret Managers in Backend using Expo Approach
date: 2025-05-06
id: blog0393
tag: env, aws, secrets-manager
toc: true
intro: "We immitate the expo approach for all of our backend applications, here is how!"
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### How Expo works with Environment Variables?

This is how EXPO works when using \`eas\` commands:

\`\`\`json
"scripts": {
    "env:pull:dev": "eas env:pull --environment development --non-interactive",
    "env:pull:uat": "eas env:pull --environment preview --non-interactive",
    "env:pull:prod": "eas env:pull --environment production --non-interactive"
}
\`\`\`

It pulls the variable defined in expo account:

[![](/assets/img/2025-05-01-16-59-05.png)](/assets/img/2025-05-01-16-59-05.png)

into local file called \`.env.local\`.

- That means whenever we want to debug/develop in \`dev\` environement, we simply \`yarn env:pull:dev\` and start our task.

- The same can be applied to backend and in the sequel we explain an approach applicable to both express and spring boot application.

### Secrets Manager

#### Define variables part I: manual approach

Simply create a secret and save the key-value pairs into it:

[![](/assets/img/2025-05-01-17-05-47.png)](/assets/img/2025-05-01-17-05-47.png)

- Note that our variable are deliberately defined by \`a.b.c\` because on one hand this is a standard definition in application.properties, and on the other hand there is no way to define nested key-value pair.

- We will use nodejs script to download the secret as a json string.
- We will also use \`lodash\` to rewrite that json string into a json object with nested properites. From that we are free to translate this nested json into \`yml\` or keep it as it is.
- This approach is ***not ideal*** as we need to add and manage these variables in aws console, which is intractable when our projects grow, especially when these variables are shared to all projects. 

  We will introduce ***type-safe*** approach in [***Define variables part II***](#Define-variables-part-II:-type-safe-approach-via-config-in-ts-files).

#### Objective

- Take spring boot as an example. For developers our resources folder is very clean:

  [![](/assets/img/2025-05-01-17-21-52.png)](/assets/img/2025-05-01-17-21-52.png)

  we just have a globally shared variables (\`application.yml\`). We will pull \`application-local.yml\` for DEV, UAT and PROD respectively for development purpose

- Yes, they have the **_same filename_** for all environments: \`application-local.yml\`, as is the pattern in expo service.

- Next we will create an \`npm\` script so that when we run \`yarn env:pull:uat\`:

  ![](/assets/img/2025-05-07-23-10-10.png)

  we get the \`application-local.yml\` for \`UAT\`, which unifies the scripts in development and deployment.

  For spring we can further execute this \`npm\` script via ***gradle task***, we will introduce it in the upcoming sections. 

#### Nodejs scripts in package.json

##### Make sure you have correct credentials

Assume that we have configured an account using aws cli in our machine (if not, install the cli and execute \`aws configure\`, then our credentials will be stored in \`~/.aws\`).

Assume also that we have appropriate policy to read-write value in secret managers, then we can extract the secret in the by the following:

##### package.json

Here we define a set of \`env:pull:{stage}\`.

\`\`\`json
{
  "license": "MIT",
  "scripts": {
    "env:pull:dev": "yarn && npx tsm download.ts --secret_name billie-backend-dev --format yml --save_at src/main/resources/application-local.yml",
    "env:pull:dev-internal": "yarn && npx tsm download.ts --secret_name billie-backend-dev-internal --format yml --save_at src/main/resources/application-local-internal.yml",
    "env:pull:uat": "yarn && npx tsm download.ts --secret_name billie-backend-uat --format yml --save_at src/main/resources/application-local.yml",
    "env:pull:uat-internal": "yarn && npx tsm download.ts --secret_name billie-backend-uat-internal --format yml --save_at src/main/resources/application-local-internal.yml",
    "env:pull:prod": "yarn && npx tsm download.ts --secret_name billie-backend-prod --format yml --save_at src/main/resources/application-local.yml",
    "env:pull:prod-internal": "yarn && npx tsm download.ts --secret_name billie-backend-prod-internal --format yml --save_at src/main/resources/application-local-internal.yml"
  },
  "devDependencies": {
    "tsm": "^2.3.0".
    ...
  },
}
\`\`\`

We will explain the \`download.ts\` right below this sub-section.

Note that we have \`yarn add tsm\` which is a light-weight binary to execute typescript files without writing any \`tsconfig.json\`.

The \`internal\` variants are for lambda functions which use internal resource rather than publicly accessible resources and are simply for deployment purpose.

##### download.ts

I have written an [**_npm package_**](https://www.npmjs.com/package/secrets-manager-to-config) on pulling variables from a secret in aws secrets-manager into \`json | yml | flat_env\` format, let's

\`\`\`ts
yarn add secrets-manager-to-config
\`\`\`

then create a file called \`download.ts\`:

\`\`\`ts
// download.ts

import { downloadConfig, SecretConfig } from "secrets-manager-to-config";

const secretConfig: SecretConfig = {
  awsRegion: "ap-southeast-2",
};

downloadConfig(secretConfig);
\`\`\`

now rom secrets manager in the f
\`\`\`sh
ts-node download.ts --secret_name <secret-name> \\
  --format <format> \\
  --save_at <filepath>
\`\`\`
will download the secret \`secret-name\` from secrets manager in the \`format\` of \`json | yml | flat_env\` at \`filepath\`.

##### For spring boot, we define gradle tasks in \`build.gradle.kts\`

\`\`\`kotlin
// build.gradle.kts

tasks.register<Exec>("dev") {
    description = "pull dev environment variables"
    group = "environement variables"
    configureNpmCommand(this, "env:pull:dev")
    doLast {
        handleCommandResult(this as Exec)
    }
}

tasks.register<Exec>("dev-internal") {
    description = "pull dev VPC internal variables"
    group = "environement variables"
    configureNpmCommand(this, "env:pull:dev-internal")
    doLast {
        handleCommandResult(this as Exec)
    }
}

tasks.register<Exec>("uat") {
    description = "pull uat environment variables"
    group = "environement variables"
    configureNpmCommand(this, "env:pull:uat")
    doLast {
        handleCommandResult(this as Exec)
    }
}

tasks.register<Exec>("uat-internal") {
    description = "pull uat VPC internal variables"
    group = "environement variables"
    configureNpmCommand(this, "env:pull:uat-internal")
    doLast {
        handleCommandResult(this as Exec)
    }
}

tasks.register<Exec>("prod") {
    description = "pull prod environment variables"
    group = "environement variables"
    configureNpmCommand(this, "env:pull:prod")
    doLast {
        handleCommandResult(this as Exec)
    }
}

tasks.register<Exec>("prod-internal") {
    description = "pull prod environment variables"
    group = "environement variables"
    configureNpmCommand(this, "env:pull:prod-internal")
    doLast {
        handleCommandResult(this as Exec)
    }
}


fun configureNpmCommand(exec: ExecSpec, npmScript: String) {
    // Use shell to execute command
    if (System.getProperty("os.name").toLowerCase().contains("windows")) {
        exec.commandLine("cmd", "/c", "yarn $npmScript")
    } else {
        // For macOS/Linux - use the full path to npm
        exec.commandLine("sh", "-c", "/usr/local/bin/yarn $npmScript")
    }

    // Continue even if there's an error
    exec.isIgnoreExitValue = true
}

// Function to handle the command result
fun handleCommandResult(execTask: Exec) {
    if (execTask.executionResult.get().exitValue == 0) {
        println("✅ Env variables pulled successfully")
    } else {
        println("❌ Failed to pull env variables. Exit code: \${execTask.executionResult.get().exitValue}")
    }
}
\`\`\`

which gives us a list of nice command to execute:

[![](/assets/img/2025-05-02-01-05-32.png)](/assets/img/2025-05-02-01-05-32.png)


##### Result: pull a \`yml\` file from secrets manager

After executing the gradle task to pull \`dev\` variables (or equivalently we run \`yarn env:pull:dev\`), we get:

[![](/assets/img/2025-05-01-17-28-51.png)](/assets/img/2025-05-01-17-28-51.png)

Now execute the spring boot project with profile \`local\`, we have run the application with combined "environment variables".


### Define variables part II: type-safe approach via config in ts-files
#### NPM package we use: secrets-manager-to-config
I will rely heavily on my own [\`npm\` package](https://www.npmjs.com/package/secrets-manager-to-config), let's 
\`\`\`bash 
yarn add secrets-manager-to-config
\`\`\`

#### \`upload.ts\`: Upload the default export from \`ts\`-file as a secret

I have designed the following API:

\`\`\`sh
ts-node upload.ts --secret_name some-test-config --ts_path config/test.ts
\`\`\`
where 
- \`\`\`ts
  // upload.ts

  import { SecretConfig, uploadConfig } from "secrets-manager-to-config";

  const secretConfig: SecretConfig = {
    awsRegion: "ap-southeast-2",
  };

  uploadConfig(secretConfig);
  \`\`\`

- and the \`config/test.ts\`:

  \`\`\`ts
  // config/test.ts

  const someConfig: {
    hihi: string;
    ohMy: {
      value: string;
      someArray: string[];
    };
  } = {
    hihi: "bye",
    ohMy: {
      value: "gosh",
      someArray: ["hihi", "hjaaaaaaa"],
    },
  };

  export default someConfig;
  \`\`\`

#### The uploaded result in secrets manager

The uploaded secret in secrets manager now becomes:

![](/assets/img/2025-05-07-23-53-43.png)

Note that we can convert this into nested json/yml format by \`download.ts\`, you may recall it [***from here***](#download.ts).

#### Manage real projects across different environments
##### Define variables with type-safty
Now we simply define variables in \`DEV\`, and for \`UAT\` and \`PROD\` we infer the type from \`typeof devObject\`:

[![](/assets/img/2025-05-07-23-59-35.png)](/assets/img/2025-05-07-23-59-35.png)

in this way there is no mismatch on the number of variables across different environments.

##### Sync all variables to secrets manager

Finally we run \`"sync": "ts-node index.ts"\` to upload all secrets.

\`\`\`ts
// index.ts

import { exec, ExecException } from "child_process";

function runCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
            if (error) {
                reject(\`Error: \${error.message}\`);
                return;
            }
            if (stderr) {
                reject(\`stderr: \${stderr}\`);
                return;
            }
            resolve(stdout);
        });
    });
}

const envFiles: { secretName: string, tsFilePath: string }[] = [
    {
        secretName: "some-project-dev",
        tsFilePath: "some-project/dev/dev.ts"
    },
    {
        secretName: "some-project-uat",
        tsFilePath: "some-project/uat/uat.ts"
    },
]

// Secrets manager is blocking, so promise.all has no advantage
async function main() {
    for (const env of envFiles) {
        const { secretName, tsFilePath } = env;
        const cmd = \`ts-node upload.ts --secret_name \${secretName} --ts_path \${tsFilePath}\`
        console.log("executing", cmd)
        await runCommand(cmd)
    }
}

main();
\`\`\``;export{n as default};
