---
id: portfolio016
title: "Tauri Desktop App with _Spring Boot_ Integration and _Automated Testing_"
intro: Manage all shell scripts by a single application. This project also aims at learning gui application in rust, from Iced, then egui, and finally in tauri.
thumbnail: /assets/img/2025-10-31-02-17-10.png
tech: Rust, Egui, Tauri, Spring Boot, Junit
thumbTransX: 0
thumbTransY: 0
hoverImageHeight: 160
date: 2025-10-25

---


<style>
    video {
      border-radius: 4px;
      max-width: 660px;
    }
    img{
        margin-top: 10px;
        margin-bottom: 10px;
        max-width: 660px;
    }
    /* Alternative solid color version */
    .download-btn-solid {
      background: #3b82f6;
      border: none;
      border-radius: 8px;
      color: white;
      cursor: pointer;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 16px;
      font-weight: 600;
      padding: 6px 24px;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
      margin-bottom: 20px;
    }

    .download-btn-solid:hover {
      background: #2563eb;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    }
    table{

      width: 100%;
      td, th {
        padding: 5px 10px;
      }
      tr:nth-child(2n){
        background-color: rgba(0,0,0,0.05);
      }
      td:nth-child(1) {
        vertical-align: top;
        width:170px;
      }
    }


</style>



###  Project Repository and Demo Video

<item>

**Repository.**

- [2025-10-27-shell-script-manager-tauri](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri)

</item>

<item>

**Demo Video.** In the following video we  ***Double click*** to ***execute*** the script for launching application:

<customvideo src="/assets/videos/demo-video-ssm-tauri.mp4"></customvideo>



</item>


<item>

**Evolved UI.** Recently the UI has evolved to have 

1. Workspaces and 
2. Script Execution Histories
3. Markdown Support

![](/assets/img/2026-03-08-06-28-27.png?border=none)

</item>





### Why this Project

<item>

**Reason.** One of my headaches as a full-stack developer is to debug a bunch of ***different*** micro-services:

<Example>

They have to be launched by using ***different*** IDEs, ***different*** scripts, and versioned by ***different*** SourceTree windows, and need to be ***grouped*** logically.

</Example>


I want to start debugging the target piece of service simply by one click, and this "click" should be easily searchable. The micro-services should also be grouped.

</item>


<item>

**Attempt In the Past.**


<item>

**Qt in C++.** Back to the day when I started ***my second year*** as a software developer, I made my first attempt using Qt in C++ with QML as the UI implementation, the project was named as

- [Multiple Projects Starter (with video demo)](/portfolio/Multiple-Projects-Starter)

</item>


<item>

**Why I Stopped.** Very soon I notice that the persistence of application state and the update of UI logic are becoming messy. At that time I was ***not skillful enough*** to handle it.

Desktop application is not as easy as it seems to be, it is a mixed breed of frontend and backend software, we need solid knowledge ***on both sides*** to make it robust.

</item>

</item>

<item>

**Decision on Tauri and RTK-Query.** After 5 years of experience I decided to build it again. The technical choices:
- Frontend by React
- UI-app-state management by Redux
- UI-server state management by RTK-Query
- Backend state management (yes, the SQLite database) by Spring Boot using Domain Driven Design

The idea of separating states into ***ui-state*** and ***server-state*** originates from 

- [*You still use Redux?* by Theo - t3․gg](https://www.youtube.com/watch?v=5-1LM2NySR0) 

At that time one popular pattern is to use Zustand (for ui state) and React-Query (for server state).

But nowadays Redux has caught up with this pattern and introduced RTK-Query (as a direct competitor to React-Query), resulting in my choices.


</item>

### Tauri Version with Automated Testing
<Center>

[![](/assets/img/2025-10-31-02-19-13.png)](/assets/img/2025-10-31-02-19-13.png)

</Center>






#### With Original Tauri Backend in Rust





##### Tech Stack

<taurissmtechstack></taurissmtechstack>


##### Purpose for this Stage

- This project is a continuation of my previous project (see [#deprecated]) of the same application which was written in `egui`.

- Since I am going to extend this project, with `Tauri` I can free my mental resource for the frontend using `React` and focus more on the entire architecture of this application.


##### What's the Difference with `Egui` Version? 

1. `Tailwind` was used to polish the UI into a more modern fashion.

2. ***No distinction*** in terms of ***functionality*** as I directly reused the repository (database) logic form the `egui` project.

3. More ***clean separation*** of frontend and backend. 

    - The UI handles vision level logic;

    - The rust backend focuses more on OS level logic, such as the application title bar, the position of the close-max-min buttons, the application-menu, etc.


##### Dicision to Move all Domain Logics to `Spring Boot`

<item>

**Separated Domains.** When developing desktop application very soon I realize the backend should be divided into ***two different*** domains. 

- One is for OS Operation and 
- One is for Application Logic.


Doing CRUD is not the strength of Rust. We choose suiable languages for suitable purposes.

```text
Tauri Frontend (TypeScript/React)
        ↓
Tauri Backend (Rust) - Only OS operations:
  - File system access
  - Window management  
  - Native notifications
  - System tray
  - Auto-updates
        ↓ HTTP
Spring Boot Backend - All business logic: (maybe jar file)
  - Domain models
  - Aggregates
  - Repositories
  - Domain events
  - Business rules
        ↓
Database (SQLite)
```

</item>

<item>

**Comparison of Rust and Spring Boot for CRUD.** With Rust I have encountered difficulty in handling SQLs. With the help of query builder via `Prisma`, I still found the pain point:

1. Rust has no ***mature*** `ORM` in its ecosystem that is ***comparable*** to `JPA` in `Spring` world. I am fed up with ***manually*** adding and deleting records in association table between two or more tables:
    
    [folder_repository.rs](https://github.com/machingclee/2025-10-15-shell-script-manager/blob/main/src/db/repository/folder_repository.rs)

2. When an application is not graphics-intensive, performance should not be placed at higher priority than the rigour of backend domain logic.

3. Without ORM, maintaining domain logic is painful and easily reduced to unmaintainable messy side effects (via lengthy SQLs).

4. Spring has a set of ***annotations*** that suit Domain Driven Design which help build solid domain models, while the ecosystem in Rust does not.

</item>

#### With Spring Boot Replacing the CRUD in Rust


##### Launch Spring Boot Backend on Startup Process

Since spring boot provides all the nice features to maintain the state of an application (system), I have moved all the backend state mangement from Tauri's rust backend to spring boot.

###### Result via GraalVM

On the launch of our `Tauri` app, it will also execute an ***executable*** that spins up the spring boot backend server at a random port:

<customimage src="/assets/img/2025-11-05-06-18-17.png" width="330"></customimage>

[![](/assets/img/2025-11-05-06-20-46.png)](/assets/img/2025-11-05-06-20-46.png)

###### Code implementation

We do it by executing our `init_spring_boot` function in the entry point of our `Tauri` backend:

```rust{19}
fn init_spring_boot(app_handle: tauri::AppHandle) -> Result<(), String> {
    SPRING_BOOT_PROCESS
        .set(Arc::new(Mutex::new(None)))
        .map_err(|_| "Failed to initialize Spring Boot process storage".to_string())?;

    #[cfg(debug_assertions)]
    let port = 7070;

    #[cfg(not(debug_assertions))]
    let port = find_available_port()?;

    BACKEND_PORT
        .set(port)
        .map_err(|_| "Failed to set backend port".to_string())?;

    #[cfg(not(debug_assertions))]
    {
        std::thread::spawn(move || {
            if let Err(e) = start_spring_boot_backend(app_handle, port) {
                eprintln!("Failed to start Spring Boot backend: {}", e);
            }
        });
    }

    Ok(())
}
``` 
where
```rust
#[cfg(not(debug_assertions))]
fn start_spring_boot_backend(app_handle: tauri::AppHandle, port: u16) -> Result<(), String> {
    println!("Starting Spring Boot backend on port {}...", port);

    let db_path = get_database_path(&app_handle)?;

    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource directory: {}", e))?;

    let backend_dir = resource_path.join("resources").join("backend-spring");
    let native_binary = backend_dir.join("backend-native");

    if !native_binary.exists() {
        return Err(format!("Native binary not found at {:?}", native_binary));
    }

    // Use GraalVM native image (no Java required!)
    let child = Command::new(&native_binary)
        .arg(format!("--server.port={}", port))
        .arg(format!("--spring.datasource.url=jdbc:sqlite:{}", db_path))
        .spawn()
        .map_err(|e| format!("Failed to start Spring Boot backend: {}", e))?;

    if let Some(process_mutex) = SPRING_BOOT_PROCESS.get() {
        *process_mutex.lock().unwrap() = Some(child);
    }

    Ok(())
}
```

The backend launches in 0.3s, it is fast enough as a desktop application:


<customvideo src="/assets/videos/demo-graalvm.mp4"></customvideo>


##### Full Detail of the Spring Boot Backed Version

More detail can be found in [this article](/blog/article/Offline-Tauri-Application-with-Local-Spring-Boot-Backend-via-GraalVM).



#### Event-based Testing in Spring Boot using Junit


##### Testcontainer

The detail of test container can be found in 

- [Command-Query Based System Part 2: Event based Testing in Spring Boot with Testcontainer Running PGSQL](/blog/article/Command-Query-Based-System-Part-2-Event-based-Testing-in-Spring-Boot-with-Testcontainer-Running-PGSQL/)

Basically we have done the following:

1. Create a `.sql` file based on `schema.prisma` file
2. Translate the `.sql` for `sqlite` into `pgsql` version
3. In spring boot we create a configuration class to use this `.sql` file when launching the test container

After that:
- When we run a test, a clean `pgsql` database will be launched in a container
- We can reuse this container on every subsequence tests



##### Specific exmaple: `DeleteFolderCommand`

###### Check for Entities {#check-for-entities}



```kotlin-1{9}
@Test
@Transactional
open fun `should delete folder, subfolders and all scripts inside`() {
    val deleteParentFolderId = parentFolder.id!!
    val subfolderId = subfolder.id!!
    val scriptIdInFolder = scriptInfolder.id!!
    val scriptIdInSubfolderId = scriptInSubfolder.id!!
    // Act
    commandInvoker.invoke(DeleteFolderCommand(deleteParentFolderId))

    // Assert - All entities deleted
    assertNull(
        folderRepository.findByIdOrNull(deleteParentFolderId),
        "Parent folder should be deleted"
    )
    assertNull(
        folderRepository.findByIdOrNull(subfolderId),
        "Subfolder should be deleted"
    )
    assertNull(
        shellScriptRepository.findByIdOrNull(scriptIdInFolder),
        "Script should be deleted"
    )
    assertNull(
        shellScriptRepository.findByIdOrNull(scriptIdInSubfolderId),
        "Script should be deleted"
    )
```


###### Check for Events {#check-for-events}

```kotlin-28
    // Assert - Events emitted
    val events = eventRepository.findAll()
    val folderCreatedEvents = events.filter { it.eventType == "FolderCreatedEvent" }
    val subfolderCreatedEvents = events.filter { it.eventType == "SubfolderAddedEvent" }
    val scriptCreatedEvents = events.filter { it.eventType == "ScriptCreatedEvent" }
    val folderDeletedEvents = events.filter { it.eventType == "FolderDeletedEvent" }
    val scriptDeletedEvents = events.filter { it.eventType == "ScriptDeletedEvent" }

    assertEquals(1, folderCreatedEvents.size, "Should have 1 FolderCreatedEvents from setup")
    assertEquals(1, subfolderCreatedEvents.size, "Should have 1 SubfolderAddedEvent from setup")
    assertEquals(2, scriptCreatedEvents.size, "Should have 2 ScriptCreatedEvent from setup")

    assertEquals(2, folderDeletedEvents.size, "Should emit 2 FolderDeletedEvents")
    assertEquals(2, scriptDeletedEvents.size, "Should emit 2 ScriptDeletedEvent")
}
```



###### Explanation for the Command and Event Mechanism

Our [DeleteFolderCommand](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/boundedcontext/scriptmanager/command/folder/DeleteFolderCommand.kt) is invoked as follows:


- This command is handled by [DeleteFolderHandler (click)](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/boundedcontext/scriptmanager/commandhandler/DeleteFolderHandler.kt)

- Note that this handler is `@Component` annotated, by reflection spring boot can identify which command it is going to handle at runtime, so we can create a mapping by dependencies injection:

    - [`Map<ICommand, ICommandHandler>` (click)](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/common/domainutils/CommandInvoker.kt#L263)

- In our handler each side effect will be recorded as an `Event`.

  - [Add ***Event*** into Event Queue (click)](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/boundedcontext/scriptmanager/commandhandler/DeleteFolderHandler.kt#L53C27-L53C33)

- By design each invokation of a command is handled by a command handler in a ***transaction*** shared from the parent scope:

  - [Reuse Existing Transaction if Possible (click)](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/common/domainutils/CommandInvoker.kt#L354)

- If further side effects need to be triggered, these events will be captured by our `Policy` classes and dispatch further command for the corresponding changes.

  For example, there is a list of rules that need to reset the default profile setting as well: [AIProfileDefaultPolicy](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/boundedcontext/ai/policy/AIProfileDefaultPolicy.kt).

  - These side effects can be handled in the ***same transaction*** by our definition:


    - [Handle event in the same transaction (click)](http://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/common/domainutils/CommandInvoker.kt#L118)

  - Or can be handled like a ***transactional event***:

    - [Handle event when transaction is committed (click)](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/common/domainutils/CommandInvoker.kt#L125)

  - That's why our `EventQueue` implementation has

    - [`add` and `addTransactional` implementation (click)](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/common/domainutils/CommandInvoker.kt#L62)


 
- We verify our backend is in correct state by checking 
  - The number of persisted entities are correct and 

  - The correct events are dispatched. 

  These are what we have done in [#check-for-entities] and [#check-for-events].


##### More Tests
Writing tests is fun, we can identify potential problem without integrated testing with the frontend.

More tests can be found in [this file](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/test/kotlin/com/scriptmanager/integration/domain/scriptmanager/FolderTest.kt).

### Deplicated {#deprecated}


I tried to create this software in Rust. I have made three attempts to try different existing GUI frameworks, and ***eventually*** I choose Tauri.

I leave a record of the remaining two trials here for future reference (in case I need them again):


#### Iced Version



This series of projects aims at ***experimenting*** GUI framework in Rust ecosystem. This `Iced` version is my first attempt:
##### Demo Video


<customvideo src="/assets/videos/006.mp4" width="100%"></customvideo>




##### Repository


- [2025-10-13-shell-script-gui-app](https://github.com/machingclee/2025-10-13-shell-script-gui-app)



##### Short Summary

I have recorded the detail in [this article](/blog/article/Iced-First-Trial-to-GUI-Application-in-Rust). 

As I quickly discovered the limitation and drawback of this Iced framework, this project (using Iced) was suspended.


I moved on to try another framework:


#### Egui Version


<Center>


[![](/assets/img/2025-10-26-17-29-12.png)](/assets/img/2025-10-26-17-29-12.png)


</Center>

##### About the Project in this Initial Stage

###### Demo Video



<customvideo src="/assets/videos/demo-video-ssm.mp4"></customvideo>





###### Tech Stack

<rustssmtechstack></rustssmtechstack>


###### Purpose for this Stage


- When there are many projects opened at the same time, finding and switching between them is a nightmare. 
- Especially when I need to switch to ***different*** IDEs and sourcetree folders for pulling or creating merge requests.

- Plus I want a project to ***get me more used*** to Rust programming.



##### Decision between `Egui`, `Tauri` and `Iced`


###### `Iced` 

The official website of iced is linked [***here***](https://iced.rs/).

My first attemp to GUI application in rust starts with `Iced`:

- [2025-10-13-Iced-gui-experiment](https://github.com/machingclee/2025-10-13-Iced-gui-experiment)

To me `Iced` has the following ***disadvantages***:

1. `Iced` is ***nice*** for the philosophy of mutating any application state by messages. But it is also ***bad*** in the sense that every tiny little UI state change must be processed by a message.


2. It is a relatively ***young*** framework.  Its first stable version was released in 2022.

3. The ***variety*** of UI-components in `Iced` is relatively ***limited*** compared to other frameworks, a simple and standard component such as "context-menu" is even not a built-in component in the framework.



###### `Tauri`


As of the time I build this application I was trying `egui` and didn't study `Tauri` yet, I later definitely gave it a try.






###### Why `egui` stands out for Rust Beginner

From the point of view of learning a language, I personally prefer `egui` for the following reasons when I make the study:

- [Rich UI components and Rich Documentation (click me)](https://www.egui.rs/)

  [![](/assets/img/2025-10-26-14-19-40.png)](/assets/img/2025-10-26-14-19-40.png)



- Easy to learn, we copy the code from [official website](https://www.egui.rs/) ***for whatever component*** we want and start implementing our own logic.

- ***Same language*** in frontend and backend, enjoyable experience for the communication between frontend and backend.


- Rust has built-in channel-and-message mechanism, making the ***Domain Driven Design***  easy to implement. Therefore we have clear separation of concerns by defining:

  - **Commands.** Only command can trigger backend/system state change.
  - **Event.** Only event can trigger UI state change
  - And each completion of a command will dispatch one or more events.





##### Future Plan: Rewrite in `Tauri`

- This project has already satisfied my learning purpose of getting familiar with Rust programming language.


- I will rewrite this project in `Tauri` as I am not going to write graphics-intensive applications  (game tools, 3D viewers, data visualization), which are what `egui` good at. 

- With my react skill I can get a more ***polished*** UI with $\frac{1}{10}$ the effort, and I can focus on features instead of fighting with UI implementation (in `egui` making an `egui::Frame` to have a "hover-and-highlight" effect is horribly difficult).


##### References

- [Official Website](https://www.egui.rs/)

- NL Tech, [*First Look at Iced GUI Library 🦀 Rust's Elm-Inspired Framework for Desktop Apps*](https://www.youtube.com/watch?v=n7fyOuHNx0M&t=2937s), YouTube

- NL Tech, [*Rust Immediate Mode GUI with Egui ⚡ Building a Real Desktop App*](https://www.youtube.com/watch?v=DJVKNRN5avo), YouTube

