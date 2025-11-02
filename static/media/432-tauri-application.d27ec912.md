---
title: "Tauri Application with Local Spring Boot Backend via GraalVM"
date: 2025-11-02
id: blog0431
tag: rust, egui, springboot
toc: true
intro: Study how to bundle an application.
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px !important;
  }
</style>



### How to get Started

Detail documentation can be found in:


- [Official website](https://v2.tauri.app/start/)

But for us it is enough to know:
- how to ***instantiate*** the project and 
- how to ***communicate*** with the Rust backend. 

Most of the documentation is more about how `tauri` is working under the hood, which is not of our interest if we just want to quickly build an app using this framework.

We start by executing

```bash
yarn create tauri-app
``` 

then we can follow the CLI to create a project using `React` in `Typescript`.

### Structure of the Application


#### Project Structure
##### The Frontend Structure
```bash
shell-script-manager-tauri/
├── src/                      # React frontend
│ ├── app-component/          # Main UI components
│ │ ├── FolderColumn/         # Folder list & management
│ │ └── ScriptsColumn/        # Script list & execution
│ ├── components/             # Reusable UI components
│ ├── store/                  # Redux store & API slices
│ │ ├── api/                  # RTK Query endpoints
│ │ └── slices/               # Redux state slices
│ └── hooks/                  # Custom React hooks
```
- We  use  `rtk-query` to manage our server (backend) state and `redux-toolkit` to manage our app state (like the *selected folder*, *boolean* to trigger UI animation, etc). 

- We also bring `shadcn` into the application as it provides us with customizable fancy components.

Now in this application we have two backends:

##### The Rust Backend Structure

```bash
├── src-tauri/                # Rust native layer
│ ├── src/lib.rs              # Core Tauri application logic
│ ├── prisma/schema.prisma    # Database schema definition
│ └── Cargo.toml              # Rust dependencies
```
- This backend is in charge of OS-level interaction bewteen our desktop application and the system. 

- For example, the menu bar, the tray icons, and even the permission to drag our custom title bar, etc, are configed in our rust backend.

- It also handles commands sent from the frontend when there is system-level request from the frontend (e.g., I need to execute shell script displayed in the frontend).


##### The Spring Boot Backend Structure
```bash
├── backend-spring/           # Spring Boot backend
│ ├── src/main/kotlin/
│ │ └── com/scriptmanager/
│ │ ├── controller/           # REST API endpoints
│ │ ├── common/
│ │ │ ├── entity/             # JPA entities
│ │ │ └── dto/                # Data transfer objects
│ │ └── repository/           # Spring Data repositories
│ └── build.gradle.kts        # Gradle build configuration
```


###### Difficult SQL in Rust

This spring boot layer is originally one of the layer in rust backend. However, doing CRUD in rust is not easy, even with query builder it eventually looks:

- [folder_repository.rs](https://github.com/machingclee/2025-10-15-shell-script-manager/blob/main/src/db/repository/folder_repository.rs)


Handling domain models ***is not*** the strength of rust, instead our good old friend `Spring Boot` shines in this area. 

###### Ease of CRUD in Spring; Design Patterns from DDD

Therefore we add a new layer to handle app-related domain logic. We ***don't even need to write query*** when our `@OneToMany` and `@ManyToOne` are properly written:

- [FolderController.kt](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/controller/FolderController.kt)

Each request to a controller ***should have*** been handled by an application service layer (some may call it `usecase` in the `dotnet` community). For now since our application is in POC stage, the ugly pattern here will be refactored when our application grows.

Because of Spring Boot, now we can bring `Domain Model` and `Value Object` into the application, which is beneficial in maintaining the code base in the long run.



#### Communication between React Frontend and Rust Backend

##### Dispatch Command to Rust Backend

Suppose that I want to execute a command displayed in the frontend, we execute:

```ts{6}
import { listen } from "@tauri-apps/api/event";

const handleRun = async () => {
  try {
    // Opens terminal and executes script
    await invoke("run_script", { command: script.command });
  } catch (error) {
    console.error("Failed to run script:", error);
  }
};
```




##### Receive Command from React Frontend

In rust backend we define a command handler

```rust
#[tauri::command]
async fn run_script(command: String) {
    println!("Running script: {}", command);
    open_terminal_with_command(command);
}
```
and register it globally:

```rust{4}
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            run_script,
            ...
        ])
        .setup(|app| {
            // ... initialization logic
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

##### Tricky Point when Parameter Name has "_"

When we have the following command handler:

```rust{3,4}
#[tauri::command]
async fn reorder_folders(
    from_index: usize, 
    to_index: usize
) -> Result<(), String> {
    let repo = FolderRepository::new();
    repo.reorder_folders(from_index, to_index)
        .await
        .map_err(|e| format!("Failed to reorder folders: {}", e))?;
    Ok(())
}
```
we need to write:
```ts{3}
await invoke(
  'reorder_folders', 
  { fromIndex, toIndex }
);
```
this is because the popular serialization and deserialization crate in Rust `serde` expects the ***inputs to be in camal case***, and it will automatically translate the variables into snake_case.


### Schema Managment (WIP)

#### We still need Prisma For Embedded Binary for Schema Migration  (WIP)

#### Workflow: From Schema Definition to Entity Classes (WIP)


### Bundling of the Application with Spring Boot Integration (WIP)
#### Infeasibility of Embedding `JRE` Runtime for `.jar` Files (WIP)
#### GraalVM for Building Spring Boot as an Executable (WIP)
#### Dynamic Path for `DataSource` in Spring Boot (WIP)
#### Spawn a Spring Boot Backend with Random Port in 0.3s (WIP)
##### Difference in `Debug` and `Release` Mode (WIP)

