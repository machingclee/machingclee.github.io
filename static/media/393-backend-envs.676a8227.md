---
title: Environment Variables via Secret Managers in Backend using Expo Approach
date: 2025-05-01
id: blog0393
tag: env
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

#### How Expo works with Environment Variables?

This is how EXPO works when using `eas` commands:

```json
"scripts": {
    "env:pull:dev": "eas env:pull --environment development --non-interactive",
    "env:pull:uat": "eas env:pull --environment preview --non-interactive",
    "env:pull:prod": "eas env:pull --environment production --non-interactive"
}
```

It pulls the variable defined in expo account:

[![](/assets/img/2025-05-01-16-59-05.png)](/assets/img/2025-05-01-16-59-05.png)

into local file called `.env.local`.

That means whenever we want to debug/develop in `dev` environement, we simply `yarn env:pull:dev` and start our task.

The same can be applied to backend and in the sequel we explain an approach applicable to both express and spring boot application.

#### Secret Managers

##### Define Variables

Simply create a secret and save the key-value pairs into it:

[![](/assets/img/2025-05-01-17-05-47.png)](/assets/img/2025-05-01-17-05-47.png)

- Note that our variable are deliberately defined by `a.b.c` because on one hand this is a standard definition in application.properties, and on the other hand there is no way to define nested key-value pair.

- We will use nodejs script to download the secret as a json string.
- We will also use `lodash` to rewrite that json string into a json object with nested properites. From that we are free to translate this nested json into `yml` or keep it as it is.

##### Objective

Take spring boot as an example. For developers our resources folder is very clean:

[![](/assets/img/2025-05-01-17-21-52.png)](/assets/img/2025-05-01-17-21-52.png)

we just have a globally shared variables (application.yml). We will pull `application-local.yml` for DEV, UAT and PROD respectively for development purpose

Yes, they have the **_same filename_**, as is the pattern in expo service.

##### Nodejs Scripts in package.json

###### Make sure you have correct credentials

Assume that we have configured an account using aws cli in our machine (if not, install the cli and execute `aws configure`, then our credentials will be stored in `~/.aws`).

Assume also that we have appropriate policy to read-write value in secret managers, then we can extract the secret in the by the following:

###### package.json

Here we define a set of `env:pull:{stage}`.

```json
{
  "license": "MIT",
  "scripts": {
    "env:pull:dev": "yarn && npx tsm env-pull.ts --secret_name billie-backend-dev --format yml --save_at src/main/resources/application-local.yml",
    "env:pull:dev-internal": "yarn && npx tsm env-pull.ts --secret_name billie-backend-dev-internal --format yml --save_at src/main/resources/application-local-internal.yml",
    "env:pull:uat": "yarn && npx tsm env-pull.ts --secret_name billie-backend-uat --format yml --save_at src/main/resources/application-local.yml",
    "env:pull:uat-internal": "yarn && npx tsm env-pull.ts --secret_name billie-backend-uat-internal --format yml --save_at src/main/resources/application-local-internal.yml",
    "env:pull:prod": "yarn && npx tsm env-pull.ts --secret_name billie-backend-prod --format yml --save_at src/main/resources/application-local.yml",
    "env:pull:prod-internal": "yarn && npx tsm env-pull.ts --secret_name billie-backend-prod-internal --format yml --save_at src/main/resources/application-local-internal.yml"
  },
  "devDependencies": {
    "tsm": "^2.3.0".
    ...
  },
}
```

We will explain the `env-pull.ts` right below this sub-section.

Note that we have `yarn add tsm` which is a light-weight binary to execute typescript files without writing any `tsconfig.json`.

The `internal` variants are for lambda functions which use internal resource rather than publicly accessible resources and are simply for deployment purpose.

###### env-pull.ts

I have written an [**_npm package_**](https://www.npmjs.com/package/secrets-manager-to-config) on pulling variables from a secret in aws secrets-manager into `json | yml | flat_env` format, let's

```ts
yarn add secrets-manager-to-config
```

then create a file called `env-pull.ts`:

```ts
import { downloadConfig, SecretConfig } from "secrets-manager-to-config";

const secretConfig: SecretConfig = {
  awsRegion: "ap-southeast-2",
};

downloadConfig(secretConfig);
```

###### For spring boot, we define gradle tasks in build.gradle.kts

```kotlin
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
        println("❌ Failed to pull env variables. Exit code: ${execTask.executionResult.get().exitValue}")
    }
}
```

which gives us a list of nice command to execute:

[![](/assets/img/2025-05-02-01-05-32.png)](/assets/img/2025-05-02-01-05-32.png)

#### Result

After executing the gradle task to pull `dev` variables (or equivalently we run `yarn env:pull:dev`), we get:

[![](/assets/img/2025-05-01-17-28-51.png)](/assets/img/2025-05-01-17-28-51.png)

Now execute the spring boot project with profile `local`, we have run the application with combined "environment variables".
