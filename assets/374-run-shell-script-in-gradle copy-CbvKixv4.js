const n=`---
title: "Run npm Script Using Gradle Task"
date: 2025-03-19
id: blog0374
tag: gradle, springboot
toc: true
intro: We record how to define gradle task to run npm script and how to ensure the gradle can recognize our npm binary
img: spring
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Define an \`npm\` Script

Assume our springboot project is also an \`npm\` project, then we may define arbitary task inside \`script\` portion of \`package.json\`, let's call this

\`\`\`json
{
  "script": {
    "swagger": "openapi-typescript http://localhost:4000/v3/api-docs -o src/types/api.ts"
  }
}
\`\`\`

This script can transform all the schemas defined in swagger UI into typescript interfaces, and save all that interfaces into \`src/types/api.ts\`.

### Define a Gradle Task

Next our shell script that runs the script above is

\`\`\`text
yarn swagger
\`\`\`

For this, we define:

\`\`\`kotlin
tasks.register<Exec>("generateApiTypes") {
    description = "Generate TypeScript types from OpenAPI using yarn"
    group = "typescript"

    workingDir = projectDir

    // Use shell to execute command
    if (System.getProperty("os.name").toLowerCase().contains("windows")) {
        commandLine("cmd", "/c", "yarn", "swagger")
    } else {
        // For macOS/Linux - use the full path to yarn
        commandLine("sh", "-c", "/usr/local/bin/yarn swagger")
    }

    // Continue even if there's an error
    isIgnoreExitValue = true

    doLast {
        if (executionResult.get().exitValue == 0) {
            println("✅ Successfully generated TypeScript types")
        } else {
            println("❌ Failed to generate TypeScript types. Exit code: \${executionResult.get().exitValue}")
        }
    }
}
\`\`\`
`;export{n as default};
