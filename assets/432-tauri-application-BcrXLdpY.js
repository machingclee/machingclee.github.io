const n=`---
title: "Offline Tauri Application with Local Spring Boot Backend via GraalVM"
date: 2025-11-02
id: blog0432
tag: tauri, springboot
toc: true
intro: Study how to bundle an application.
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>

### Video Results

#### Version 1: Launch Application via \`OpenJDK\` and \`java -jar\`

This video also demonstrate a spring boot backend being launched at a random port via \`java -jar\` command when the application get started.

The backend took 5s to complete the startup process.

This also requires user to have \`openJDK\` (or any other JDK) pre-installed, which is not reasonable:

<customvideo src="/assets/videos/demo-jar.mp4"></customvideo>

#### Version 2: Improvement, Launch Application via Executable by \`GraalVM\`

We go to the next step to build an executable to launch the backend, resulting in much faster launch speed (0.3s).

<customvideo src="/assets/videos/demo-graalvm.mp4"></customvideo>

### Project Repository

- https://github.com/machingclee/2025-10-27-shell-script-manager-tauri

### How to get Started with Tauri

Detail documentation can be found in:

- [Official website](https://v2.tauri.app/start/)

But for us it is enough to know:

- how to **_instantiate_** the project and
- how to **_communicate_** with the Tauri backend.

Most of the documentation is more about how \`tauri\` is working under the hood, which is not of our interest if we just want to quickly build an app using this framework.

We start by executing

\`\`\`bash
yarn create tauri-app
\`\`\`

then we can follow the CLI to create a project using \`React\` in \`Typescript\`.

### About the Tauri Application

#### Class and Entity Relational Diagram (Combined) {#schema_diagram}

[![](/assets/img/2025-11-04-05-44-29.png)](/assets/img/2025-11-04-05-44-29.png)

#### Project Structure

##### The frontend structure

\`\`\`bash
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
\`\`\`

- We use \`redux-toolkit/rtk-query\` to manage our server (backend) state and use **_slices_** in \`redux-toolkit\` to manage our app state (like the _selected folder_, _boolean_ to trigger UI animation, etc).

- We also bring \`shadcn\` into the application as it provides us with customizable fancy components.

Now in this application we have two backends, we introduce them in [#tauri_backend] and [#spring_backend] respectively.

##### The Tauri backend structure {#tauri_backend}

\`\`\`bash
├── src-tauri/                # Rust native layer
│ ├── src/lib.rs              # Core Tauri application logic
│ ├── prisma/schema.prisma    # Database schema definition
│ └── Cargo.toml              # Rust dependencies
\`\`\`

- This backend is in charge of OS-level interaction bewteen our desktop application and the system.

- For example, the menu bar, the tray icons, and even the permission to drag our custom title bar, etc, are configed in our Tauri backend.

- It also handles commands sent from the frontend when there is system-level request from the frontend (e.g., I need to execute shell script displayed in the frontend).

##### The spring boot backend structure {#spring_backend}

\`\`\`bash
├── backend-spring/           # Spring Boot backend
│ ├── src/main/kotlin/
│ │ └── com/scriptmanager/
│ │ ├── controller/           # REST API endpoints
│ │ ├── common/
│ │ │ ├── entity/             # JPA entities
│ │ │ └── dto/                # Data transfer objects
│ │ └── repository/           # Spring Data repositories
│ └── build.gradle.kts        # Gradle build configuration
\`\`\`

###### Tedious association table manipulation in Rust

This spring boot layer is previously a basic CRUD repository layer in Tauri backend. However, doing CRUD without good ORM in rust is **_very tedious_**, even with query builder it eventually looks:

- [folder_repository.rs](https://github.com/machingclee/2025-10-15-shell-script-manager/blob/main/src/db/repository/folder_repository.rs)

Handling domain models **_is not the strength_** of rust, instead our good old friend \`JPA\` in \`Spring Boot\` shines in this area.

###### No more assocation manipulation in JPA with DDD

Therefore we add a new layer to handle state-related domain logic. We **_don't even need to write query_** when our \`@OneToMany\` and \`@ManyToOne\` are properly written:

- [FolderController.kt](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/backend-spring/src/main/kotlin/com/scriptmanager/controller/FolderController.kt)

Each request to a controller **_should have_** been handled by an application service layer (some may call it \`usecase\` in the \`dotnet\` community). For now since our application is in POC stage, the ugly pattern here will be refactored when our application grows.

Because of Spring Boot, now we can bring \`Domain Model\` and \`Value Object\` into the application, which is beneficial in maintaining the code base in the long run.

#### Communication between React Frontend and Tauri Backend

##### Dispatch command from React frontend

Suppose that I want to execute a command displayed in the frontend, we execute:

\`\`\`ts{6}
import { listen } from "@tauri-apps/api/event";

const handleRun = async () => {
  try {
    // Opens terminal and executes script
    await invoke("run_script", { command: script.command });
  } catch (error) {
    console.error("Failed to run script:", error);
  }
};
\`\`\`

Next we handle this command in the Tauri backend:

##### Receive command in Tauri backend

In Tauri backend we define a command handler

\`\`\`rust
#[tauri::command]
async fn run_script(command: String) {
    println!("Running script: {}", command);
    open_terminal_with_command(command);
}
\`\`\`

and register it globally:

\`\`\`rust{4}
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
\`\`\`

##### Tricky naming convention when backend's parameter name has an "\\_"

When we have the following command handler:

\`\`\`rust{3,4}
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
\`\`\`

In frontend we need to write:

\`\`\`ts{3}
await invoke(
  'reorder_folders',
  { fromIndex, toIndex }
);
\`\`\`

This is because the popular serialization and deserialization crate in Rust \`serde\` expects **_the inputs to be in camal case_**, and it will automatically translate the variables into snake_case.

### Schema Managment and LLM Tooling

#### Schema Definition

##### What LLM can do

For existing schema migration tools in spring boot ecosystem we mainly have

- Flyway
- Liquibase

Both require **_manual scripting_** for any changes in the database schema and make corresponding code changes in the entity model.

But with \`prisma\` we can focus on schema design, we benefit from this approach by now being able to:

1. Feed LLM model our clear schema definition;
2. Let LLM generate/modify our entity model in spring boot and;
3. Let \`prisma\` generate the script of database migration for the incremental update of the schema

##### Define schema and embed it into Rust script {#schemadef}

Now our \`schema.prisma\` serves as a good documentation **_for LLM model_** of all of our tables:

\`\`\`prisma-1{2,3}
generator client {
  provider = "cargo prisma"
  output   = "../src/prisma.rs"
}
\`\`\`

As long as we understand what is the auto-generated sql migration script doing, it is no harm to let the framework generate it. We can even **_refine_** the sql to match what we need.

Let's translate the diagram drawn in section [#schema_diagram] into a schema definition:

\`\`\`prisma-5
datasource db {
  provider = "sqlite"
  url      = "file:../database.db"
}

model application_state {
  id                    Int     @id @default(autoincrement())
  last_opened_folder_id Int?
  dark_mode             Boolean @default(false)
  created_at            Float   @default(dbgenerated("(CAST((julianday('now') - 2440587.5) * 86400000.0 AS REAL))"))
  created_at_hk         String  @default(dbgenerated("(strftime('%Y-%m-%d %H:%M:%S', datetime('now', '+8 hours')))"))
}

model scripts_folder {
  id                            Int                             @id @default(autoincrement())
  name                          String
  ordering                      Int
  created_at                    Float                           @default(dbgenerated("(CAST((julianday('now') - 2440587.5) * 86400000.0 AS REAL))"))
  created_at_hk                 String                          @default(dbgenerated("(strftime('%Y-%m-%d %H:%M:%S', datetime('now', '+8 hours')))"))
  rel_scriptsfolder_shellscript rel_scriptsfolder_shellscript[]

  @@index([id])
}

model rel_scriptsfolder_shellscript {
  id                Int            @id @default(autoincrement())
  scripts_folder_id Int
  shell_script_id   Int
  created_at        Float          @default(dbgenerated("(CAST((julianday('now') - 2440587.5) * 86400000.0 AS REAL))"))
  created_at_hk     String         @default(dbgenerated("(strftime('%Y-%m-%d %H:%M:%S', datetime('now', '+8 hours')))"))
  shell_script      shell_script   @relation(fields: [shell_script_id], references: [id])
  scripts_folder    scripts_folder @relation(fields: [scripts_folder_id], references: [id])

  @@index([scripts_folder_id])
  @@index([shell_script_id])
}

model shell_script {
  id                            Int                             @id @default(autoincrement())
  name                          String
  command                       String
  ordering                      Int
  created_at                    Float                           @default(dbgenerated("(CAST((julianday('now') - 2440587.5) * 86400000.0 AS REAL))"))
  created_at_hk                 String                          @default(dbgenerated("(strftime('%Y-%m-%d %H:%M:%S', datetime('now', '+8 hours')))"))
  rel_scriptsfolder_shellscript rel_scriptsfolder_shellscript[]

  @@index([id])
}
\`\`\`

#### Embed Schema Migration via \`prisma.rs\`

Also note that we require \`cargo prisma\` in line 2-3 of section [#schemadef] to generate the schema related definition in \`"../src/prisma.rs"\`.

This will create an embedded SQL migration method in the \`prisma.rs\` file, and we can execute it to instantiate/update the database (see \`init_db\` below) in the startup script of our \`Tauri\` backend:

\`\`\`rust{16-20}
mod prisma;

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let db_path = get_database_path(app_handle)?;
    let database_url = format!("file:{}", db_path);
    std::env::set_var("DATABASE_URL", &database_url);
    let rt_handle = RT_HANDLE
        .get()
        .ok_or_else(|| "Runtime not initialized".to_string())?;

    rt_handle.block_on(async move {
        let client = prisma::new_client_with_url(&database_url)
            .await
            .expect("Failed to create Prisma client");
        println!("Syncing database schema...");
        client
            ._db_push()
            .accept_data_loss()
            .await
            .expect("Failed to sync database schema");
    ...
\`\`\`

#### Let LLM Generate Entity Classes from \`schema.prisma\`

Now simply ask our agent to generate the entity classes. For example:

\`\`\`kotlin{25-31}
@Entity
@GenerateDTO
@DynamicInsert
@Table(name = "shell_script", indexes = [Index(columnList = "id")])
data class ShellScript(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int? = null,

    @Column(name = "name", nullable = false)
    var name: String = "",

    @Column(name = "command", nullable = false)
    var command: String = "",

    @Column(name = "ordering", nullable = false)
    var ordering: Int = 0,

    @Column(name = "created_at")
    val createdAt: Double? = null,

    @Column(name = "created_at_hk")
    val createdAtHk: String? = null,
) {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinTable(
        name = "rel_scriptsfolder_shellscript",
        joinColumns = [JoinColumn(name = "shell_script_id", referencedColumnName = "id")],
        inverseJoinColumns = [JoinColumn(name = "scripts_folder_id", referencedColumnName = "id")]
    )
    var scriptsFolder: ScriptsFolder? = null
}
\`\`\`

Here we manually add the \`@ManyToOne\` annotations as well as the aggregate relations as LLM cannot easily understand it without knowing the class diagram (which we draw in section [#schema_diagram]).

### Bundling of the Application with Spring Boot Integration

#### Overview of Build Steps

\`\`\`text
┌─────────────────────────────────────────────────┐
│  1. Write Kotlin Code (Spring Boot Backend)     │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  2. Gradle Plugin: org.graalvm.buildtools.native│
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│  3. Run: ./gradlew nativeCompile                 │
│     - Analyzes all reachable code                │
│     - Resolves reflection/resources              │
│     - Compiles to native machine code            │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│  4. Output: backend-native (executable)          │
│     Size: ~100MB                                 │
│     Location: build/native/nativeCompile/        │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│  5. Copy to Tauri Resources                      │
│     → src-tauri/resources/backend-spring/        │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│  6. Bundle with Tauri App                        │
│     → Final .app includes native binary          │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  7. Run in Production                               │
│     Rust executes: ./backend-native --server.port=X │
│     No Java required!                               │
└─────────────────────────────────────────────────────┘
\`\`\`

#### The Build (Bundling) Script

- https://github.com/machingclee/2025-10-27-shell-script-manager-tauri/blob/main/build-production.sh

#### GraalVM for Building Spring Boot as an Executable

##### The gradle task

\`\`\`kotlin
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    ...
    id("org.graalvm.buildtools.native") version "0.10.1"
}

tasks.withType<KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs += "-Xjsr305=strict"
        jvmTarget = "17"
    }
}

// GraalVM Native Image configuration
graalvmNative {
    binaries {
        named("main") {
            imageName.set("backend-native")
            mainClass.set("com.scriptmanager.ApplicationKt")

            buildArgs.add("--verbose")
            buildArgs.add("-H:+ReportExceptionStackTraces")
            buildArgs.add("--initialize-at-build-time=org.slf4j")
            buildArgs.add("--initialize-at-run-time=io.netty.handler.ssl")
            buildArgs.add("-H:+AddAllCharsets")
            buildArgs.add("-H:EnableURLProtocols=http,https")
        }
    }
}
\`\`\`

The inclusion of the gradle plugin will create a gradle task for us:

\`\`\`bash
export JAVA_HOME="/Library/Java/JavaVirtualMachines/graalvm-jdk-17/Contents/Home" && \\\\
      ./gradlew clean nativeCompile
\`\`\`

Note that we must have \`graalvm\` installed, for mac, we \`brew install --cask graalvm-jdk\`, as stated in [brew page](https://formulae.brew.sh/cask/graalvm-jdk).

##### Registration for Class Reflection

###### What to include manually

In \`src/main/resources/META-INF/native-image/reflect-config.json\` we add:

\`\`\`json
[
  {
    "name": "org.sqlite.JDBC",
    "allDeclaredConstructors": true,
    "allPublicConstructors": true,
    "allDeclaredMethods": true,
    "allPublicMethods": true
  },
  {
    "name": "org.sqlite.SQLiteConnection",
    "allDeclaredConstructors": true,
    "allDeclaredMethods": true
  },
  {
    "name": "org.hibernate.community.dialect.SQLiteDialect",
    "allDeclaredConstructors": true,
    "allPublicConstructors": true,
    "allDeclaredMethods": true
  }
]
\`\`\`

These are the external library that spring's (Ahead-of-Time) processing cannot see at compile time. By adding these classnames into \`reflect-config.json\`, we are telling GraalVM:

> "Please include the actual compiled machine code for this class AND keep all the metadata needed for reflection"

###### What is already included in the native version of \`reflect-config.json\`?

Spring Boot's AOT (Ahead-of-Time) processing sees the annotations and generates reflection configuration automatically:

\`\`\`bash
@RestController  // <--- Spring sees this annotation
@RequestMapping("/scripts")
class ScriptController(  // <--- Spring sees this class name directly!
    private val scriptRepository: ShellScriptRepository,  // ← Direct reference!
    private val folderRepository: ScriptsFolderRepository  // ← Direct reference!
) {
    @GetMapping  // <--- Spring sees this
    fun getAllScripts(): ApiResponse<List<ShellScriptDTO>> {  // ← Direct return type!
        val list = scriptRepository.findAllByOrderByOrderingAsc().map { it.toDTO() }
        return ApiResponse(list)  // ← Direct class usage!
    }
}
\`\`\`

\`GraalVM\` can see the spring-managed \`reflect-config.json\` at compile time:

[![](/assets/img/2025-11-04-07-51-03.png)](/assets/img/2025-11-04-07-51-03.png)

When combining two \`reflect-config.json\`'s, we have registered:

\`\`\`bash
backend-native (native image)
├── Your application code
│   ├── Application.kt → machine code ✅
│   ├── ScriptController.kt → machine code ✅
│   └── ShellScript.kt → machine code ✅
│
├── Spring Boot
│   └── Core framework → machine code ✅
│
└── SQLiteDialect → ✅ NOW INCLUDED!
    ├── Class bytecode compiled to native machine code ✅
    ├── Constructor signatures (metadata) ✅
    ├── Method signatures (metadata) ✅
    ├── Field information (metadata) ✅
    └── Reflection registry entry ✅
\`\`\`

#### Dynamic Port and Path for \`DataSource\` in Spring Boot

Our frontend will access to spring boot backend for state mangement differently in \`DEBUG\` and \`RELEASE\` mode.

\`\`\`ts{1-5,14}
function getBackendUrl(getState: () => unknown): string {
  const state = getState() as RootState;
  const port = state.config.backendPort;
  return \`http://localhost:\${port}\`;
}

export const httpBaseQuery = (): BaseQueryFn<
  HttpQueryArgs,
  unknown,
  HttpQueryError
> => {
  return async ({ url, method = 'GET', body, params }, api) => {
    try {
      const backendUrl = getBackendUrl(api.getState);
      const fullUrl = new URL(\`\${backendUrl}\${url}\`);
      ...
\`\`\`

where **_in release mode_** the \`backendPort\` will be obtained from Tauri backend's \`lib.rs\`, which is responsible to:

1. Search for available port for our spring boot backend
2. Emit the available port to the frontend via IPC event system and let frontend update the redux store, where frontend listens via the API
   \`\`\`ts
   import { listen } from "@tauri-apps/api/event";
   \`\`\`

Moreover in our frontend redux store:

\`\`\`ts
const initialState: ConfigState = {
  backendPort: import.meta.env.DEV ? 7070 : 0,
};
\`\`\`

Therefore:

1. In \`DEBUG\` mode we always have a fixed port \`7070\`
2. In \`RELEASE\` mode our port will be **_varying_**.

Also, in Tauri backend we start our spring boot application via:

\`\`\`rust
    let child = Command::new(&native_binary)
        .arg(format!("--server.port={}", port))
        .arg(format!("--spring.datasource.url=jdbc:sqlite:{}", db_path))
        .spawn()
        .map_err(|e| format!("Failed to start Spring Boot backend: {}", e))?;
\`\`\`

and eventually our spring boot application get this \`server.port\` and \`db_path\` at its launching process.

#### Start Bundling

Let's

\`\`\`bash
yarn bundle
\`\`\`

### Appendix

#### On Various Sizes of the Application

##### File Size

- **Without Spring Boot.** The applicatin is roughly 20MB.

- **With Spring Boot.** The application now grows to 200MB:

  [![](/assets/img/2025-11-05-06-59-02.png)](/assets/img/2025-11-05-06-59-02.png)

##### Memory Consumption

[![](/assets/img/2025-11-05-07-00-31.png)](/assets/img/2025-11-05-07-00-31.png)

#### On Getting App Icon

##### My suggestion

I got my icon from https://icons8.com/

##### Trick to get the icon of various sizes

Once you have spotted your favourite icon, click on \`Download\`:

[![](/assets/img/2025-11-05-07-12-41.png)](/assets/img/2025-11-05-07-12-41.png)

You will find many download restrictions, but of which you can choose \`Link (CDN)\`:

[![](/assets/img/2025-11-05-07-11-21.png)](/assets/img/2025-11-05-07-11-21.png)

You can find the link \`https://img.icons8.com/keek/100/documents-folder.png\`

![](/assets/img/2025-11-05-07-16-19.png)

Now you can adjust the value from \`100\` $\\to$ \`1000\` 😂:

\`https://img.icons8.com/keek/1000/documents-folder.png\`

![](/assets/img/2025-11-05-07-16-42.png)
`;export{n as default};
