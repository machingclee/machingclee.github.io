---
title: "Gradle Fundamentals"
date: 2024-06-22
id: blog0271
tag: kotlin, gradle
intro: "This is a study on gradle to help understand spring boot projects."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Setp up subprojects

##### Step 1. Set where to find Repositories 

```text
// settings.gradle.kts

dependencyResolutionManagement {
    repositories.mavenCentral()
    repositories.google()
}
```
##### Step 2. Let's Transform spring boot project into a subproject called `springboot-restapi`

1. Create a `sprintboot-restapi` folder
2. Move `src/`, `build.gradle.kts` into that folder
3. In `settings.gradle.kts` at the root level, write:
    ```text
    rootProject.name = "course-catelog-service"

    pluginManagement {
        repositories.gradlePluginPortal()
    }

    include("springboot-restapi")
    ```
    - Now gradle understands there is a build task in `springboot-restapi`.
    - Suppose that we have a custom build task named `generate` in `springboot-restapi/build.gradle.kts`, then we can execute 
      ```text
      gradle :springboot-restapi:generate
      ```
      to run that build task.

##### Step 3. Create another subproject called `domain`

1.  In root level let's create a directory named `domain/`
2.  In that folder let's create a file in 
    ```text
    domain/src/main/kotlin/com.<root-project-name>.domain/main.kt
    ```
3.  Also, create a `build.gradle.kts` at the same level of `domain/src/` and write
    ```text
    repositories {
        google()
        mavenCentral()
    }

    plugins {
        kotlin("jvm") version "1.9.24"
    }
    ```
4.  Include this subproject in root's `settings.gradle.kts`
    ```text
    rootProject.name = "course-catelog-service"

    pluginManagement {
        repositories.gradlePluginPortal()
    }

    include("springboot-restapi")
    include("domain")
    ```
    Now our folder icons are not just a directory, we are done:

    ![](/assets/img/2024-06-23-13-15-14.png)


##### Step 4. Include `domain` in the `springboot-restapi` (i.e., restapi depends on domain)

Add the following in `springboot-restapi/build.gradle.kts`:

```text
dependencies {
    implementation(project(":domain"))
    ...
}
```

##### Try to import from other subprojects

Let's experiment! Suppose that I have created a `User` class in `domain.model`: 

![](/assets/img/2024-06-23-13-35-58.png)

We can import User from `domain.model`!

![](/assets/img/2024-06-23-13-38-51.png)

Suppose that I remove the dependency as follows:

![](/assets/img/2024-06-23-13-39-23.png)

Look we cannot import `User` from `domain.model` any more:

![](/assets/img/2024-06-23-13-40-02.png)

#### DDD (WIP)

Let's refer to this diagram of layers in our DDD model:

![](/assets/img/2024-06-22-22-38-50.png)

For concrete example of each layer we can refer to the following repository:

> [Leave-Application](https://github.com/xlorne/springboot-ddd-examples/tree/master/12-leave-parent)

- `User Interface Module` This is like our controllers in MVC. The entrypoint of our spring boot application is also here.
- `Application Module` This is like our services in MVC, you may implement it as `command` + `command-executor`. We may also add a service layer here which in turn pulls the logic from our domain-module.
- `Domain Module` This module provides domain-specific logic such as 
  - domain events, 
  - domain event handlers,
  - domain services (that contains logic that cannot be part of the aggregate root),
  - and the interfaces of repositories for infrastructure module.

  Note that the ***logic*** of domain modules also depend on the infrastructures (yes, from the arrows domain module just provides interface, but it uses the interface to programme the logic domain logic, and the resulting code uses dependency injection to get a repository instance).




- `Infrastructure Module` It depends on the domain module because our domain object will be created here. Each domain object will be equipped with functionalities that rely on the domain module.

  In this layer we implement both `DAO`'s and `Respository`'s. Most of the time we would see that `Repository` $\to$ `DAO`'s and we call the objects obtained from `DAO` as `POJO`. The User Interface layer also directly return `DAO` to the frontend. 
  
  In case more complex query is needed, we extent `JOOQ`'s auto-generated `DAO` and add extra query method.
