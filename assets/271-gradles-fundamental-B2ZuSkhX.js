const n=`---
title: "Gradle Fundamentals: Modularization of Spring Boot Project and Dependencies Control"
date: 2024-06-22
id: blog0271
tag: kotlin, gradle, springboot
intro: "This is a study on gradle to help understand how to manage a project by modules. In java this helps separate the dependencies precisely, i.e., no one can access resource from incorrect layer. This makes creating unit tests much more easily (in case you have written queries directly in controller layer, you know what I mean)."
toc: true
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Repository

- https://github.com/machingclee/2024-06-25-Modularized-Springboot-JOOQ

### Setp up Modules

#### Set Where to find Repositories 

For every \`build.gradle.kts\` in each of modules we can add:

\`\`\`text
// build.gradle.kts

repositories {
    google()
    mavenCentral()
}
\`\`\`
#### Transform Spring boot Project into a Module Called \`springboot-restapi\`

1. Create a \`sprintboot-restapi\` folder
2. Move \`src/\`, \`build.gradle.kts\` into that folder
3. In \`settings.gradle.kts\` at the root level, write:
    \`\`\`text
    rootProject.name = "course-catelog-service"

    pluginManagement {
        repositories.gradlePluginPortal()
    }

    dependencyResolutionManagement{
        repositories.mavenCentral()
    }

    include("springboot-restapi")
    \`\`\`
    - Now gradle understands there is a build task in \`springboot-restapi\`.
    - Suppose that we have a custom build task named \`generate\` in \`springboot-restapi/build.gradle.kts\`, then we can execute 
      \`\`\`text
      gradle :springboot-restapi:generate
      \`\`\`
      to run that build task.



#### Add springBoot mainClass for Modularized Spring boot Application

Now to successfully run the task \`bootRun\` and the build \`bootJar\` we still need extra configruation.

\`\`\`text{11-13}
// springboot-restapi/build.gradle.kts
...
sourceSets {
    test {
        java {
            setSrcDirs(listOf("src/test/integration", "src/test/unit"))
        }
    }
}

springBoot  {
    mainClass = "com.kotlinspring.CourseCatelogServiceApplicationKt"
}
\`\`\`
Note the extra **Kt** as a suffix of our main application classname.

#### Create Another Module Called \`domain\`

1.  In root level let's create a directory named \`domain/\`
2.  In that folder let's create a file in 
    \`\`\`text
    domain/src/main/kotlin/com.<root-project-name>.domain/main.kt
    \`\`\`
3.  Also, create a \`build.gradle.kts\` at the same level of \`domain/src/\` and write
    \`\`\`text
    repositories {
        google()
        mavenCentral()
    }

    plugins {
        kotlin("jvm") version "1.9.24"
    }
    \`\`\`
4.  Include this module in root's \`settings.gradle.kts\`
    \`\`\`text
    rootProject.name = "course-catelog-service"

    pluginManagement {
        repositories.gradlePluginPortal()
    }

    dependencyResolutionManagement{
        repositories.mavenCentral()
    }

    include("springboot-restapi")
    include("domain")
    \`\`\`
    Now our folder icons are not just a directory, we are done:

    ![](/assets/img/2024-06-23-13-15-14.png)


#### Include \`domain\` in the \`springboot-restapi\` (i.e., restapi depends on domain) and try to run bootRun and bootJar

Add the following in \`springboot-restapi/build.gradle.kts\`:

\`\`\`text{2}
dependencies {
    implementation(project(":domain"))
    ...
}
\`\`\`



Now we are free to run these two gradle commands:

![](/assets/img/2024-06-23-16-50-53.png)


#### Try to Import and Unimport Other Modules to Check Dependencies Constraint

Let's experiment! Suppose that I have created a \`User\` class in \`domain.model\`: 

![](/assets/img/2024-06-23-13-35-58.png)

We can import User from \`domain.model\`!

![](/assets/img/2024-06-23-13-38-51.png)

Suppose that I remove the dependency as follows:

![](/assets/img/2024-06-23-13-39-23.png)

Look we cannot import \`User\` from \`domain.model\` any more:

![](/assets/img/2024-06-23-13-40-02.png)


### Custom Gradle Plugin

#### Plugin Project Sturcture

Let's create the following structure for adding plugins:

![](/assets/img/2024-06-23-22-54-29.png)

#### Gradle Config

##### Global settings.gradle.kts

Add the following in the ***global*** \`settings.gradle.kts\`

\`\`\`text{5}
rootProject.name = "course-catelog-service"

pluginManagement {
    repositories.gradlePluginPortal()
    includeBuild("gradle/plugins")
}

dependencyResolutionManagement{
    repositories.mavenCentral()
}

include("springboot-restapi")
include("domain")
\`\`\`

##### Local settings.gradle.kts in \`gradle/plugins/\`

Next create \`gradle/plugins/\` and then \`gradle/plugins/settings.gradle.kts\` with

\`\`\`kotlin
// gradle/plugins/settings.gradle.kts
dependencyResolutionManagement{
    repositories.gradlePluginPortal()
}

include("java-plugins")
\`\`\`

##### build.gradle.kts

1. We then aims at creating a module \`java-plugins\` with the following structure:

    ![](/assets/img/2024-06-23-23-04-23.png)

4.  As directory \`java-plugins\` is included as a (candidate of) module, we create \`gradle/plugins/java-plugins/\`, let's turn this \`java-plugins\` into a module by adding

    \`\`\`kotlin
    // gradle/plugins/java-plugins/build.gradle.kts
    plugins{
        \`kotlin-dsl\`
    }
    \`\`\`

5.  Let's add a file in this module:

    \`\`\`text
    gradle/plugins/java-plugins/src/main/kotlin/custom-java-base.gradle.kts
    \`\`\`

    ***custom-java-base*** will be our new ***plugin name***.

7.  Add the logic into this new plugin that we want to share ***across all modules***:

    \`\`\`text
    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }

    plugins{
        id("java-library")
    }

    java {
        toolchain {
            languageVersion = JavaLanguageVersion.of(21)
        }
    }
    \`\`\`

8.  Finally, we import this plugin into our \`domain\` module:
    \`\`\`kotlin
    // domain/build.gradle.kts
    plugins{
        id("custom-java-base")
    }
    \`\`\`


### More Simple way to Create Modules via IntelliJ

After solid understanding on how gradle works, let's investigate how intelliJ provides shortcuts for generating new modules:

1.  Look at project structure:

    ![](/assets/img/2024-06-24-00-32-13.png)

2.  New Module:

    ![](/assets/img/2024-06-24-00-32-31.png) 

3.  Choose gradle with kotlin DSL, choose suitable groupId, and click create:

    ![](/assets/img/2024-06-24-00-33-53.png)

4.   Note that \`domain\` has been added automatically in \`settings.gradle.kts\`:

      ![](/assets/img/2024-06-24-00-35-03.png)

5.  Unforturnately we don't have \`dependency control\` UI among modules, we need to add 
    \`\`\`text{2}
    dependencies {
        implementation(project(":module-name"))
        testImplementation(kotlin("test"))
    }
    \`\`\`
    ourselves in \`build.gradle.kts\`.
`;export{n as default};
