const n=`---
title: "Function Literals with Receiver"
date: 2024-09-16
id: blog0323
tag: kotlin
toc: true
intro: "Study the syntax for function literals which helps construct DSL-like syntax."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Introduction of Function Literals

- Function literals are frequently used **_as a constructor_** of objects.

- Well known examples are \`build.gradle.kts\` and \`jetpack-compose\` for Andriod or Desktop UIs.

In the sequel let's consider the following builder function, a **_function literal_** takes the form

\`\`\`kotlin
fun builder(dummyName: ClassA.() -> Unit) {
    ...
}
\`\`\`

which means that:

1. We define a lambda function that can be treated as a method of \`ClassA\`
2. This lambda function takes the signature \`() -> Unit\`.
3. To call this lambda function, we invoke \`classA.dummyName()\`.
4. \`builder\` orchestrates the execution of the above defined operations.

### Example

\`\`\`kotlin
class Properties {
    var time: String? = null
}

class BuildInfo {
    private var properties: Properties? = null

    fun withProperties(configure: Properties.() -> Unit) {
        val _properties = Properties()
        _properties.configure()
        properties = _properties
    }
}

class SpringBootExtension {
    private var buildInfo: BuildInfo? = null

    fun withBuildInfo(configure: BuildInfo.() -> Unit) {
        val _buildInfo = BuildInfo()
        _buildInfo.configure()
        this.buildInfo = _buildInfo
    }
}
\`\`\`

Let's create a builder function which builds a \`SpringBootExtension\` object.

\`\`\`kotlin
// builder function
fun springBootEextension(build: SpringBootExtension.() -> Unit): SpringBootExtension {
    val extension = SpringBootExtension()
    extension.build()
    return extension
}
\`\`\`

Which means that

1. \`springBootEextension\` accepts a lambda function which is defined **_as if we are inside of_** the class definition of \`SpringBootExtension\`,
2. The name \`build\` is in fact dummy and can be anything we want, it is just a name to invoke the execution of the lambda.

\`\`\`kotlin
fun createExtension() {
    val extension = springBootEextension { // trailing closure without input params
        withBuildInfo { // it is a method inside of SpringBootEextension
                        // it is accessible by the closure because our context is now SpringBootEextension
            withProperties { // accepts another closure for configuration
                time = null  // context is now Property class, can make changes to the created Property object
            }
        }
    }
}
\`\`\`

- In short, \`ClassA.() -> Unit\` can be read as configuration of \`ClassA\` in many cases (and bear in mind that it is a lambda function defined inside of \`ClassA\`).

- In terms of this terminology:
  - \`springBootEextension(_: SpringBootExtension.() -> Unit)\` accepts a configuration of \`SpringBootExtension\`
  - \`withBuildInfo(_: BuildInfo.() -> Unit)\` accepts a configuration of \`BuildInfo\`
  - \`withProperties(_: Properties.() -> Unit)\` accepts a configuration of \`Properties\`
`;export{n as default};
