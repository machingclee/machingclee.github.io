const n=`---
title: "Customization on build.gradle.kts"
date: 2024-09-12
id: blog0320
tag: kotlin, gradle
toc: true
intro: "\`build.gradle.kts\` is like a Makefile with powerful feature that you can write kotlin code on it, let's study useful customization."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### \`bootRun\` with Custom Active Profiles

\`\`\`kotlin
tasks.register("bootRun-UAT-James-LocalDB-JamesStripe") {
    group = "application"
    description = "bootRun with James self-localhosted-DB and James Stripe Account"

    doFirst {
        tasks.bootRun.configure {
            args("--spring.profiles.active=uat,james_db_and_james_stripe")
        }
    }
    finalizedBy("bootRun")
}
\`\`\`

Result:

![](/assets/img/2024-09-15-13-44-28.png)

**Known Issue.** If we run debugger using a custom task, the process ***will not be killed*** by ending the debug process.



### Set MainClass for \`boorJar\` Created \`jar\` file

\`\`\`kotlin
tasks.getByName<Jar>("jar") {
    manifest {
        attributes["Main-Class"] = "com.billie.payment.PaymentApplicationKt"
    }
}
\`\`\`

### Skip Running Tests

\`\`\`kotlin
tasks.named<Test>("test") {
    enabled = false
}
\`\`\`

### Skip Compiling Test Files, i.e., Skip \`compileTestKotlin\`

\`\`\`kotlin
tasks.named<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>("compileTestKotlin") {
    enabled = false
}
\`\`\`

### Customize the Jar Name for bootRun

\`\`\`kotlin
tasks.bootJar {
    archiveFileName.set("application.jar")
}
\`\`\`
`;export{n as default};
