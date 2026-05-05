const e=`---
title: "Study Notes of \`egui\` Part I: Architecture of \`egui\` Application"
date: 2025-10-19
id: blog0428
tag: rust, egui
toc: true
intro: Record egui study from the point of view of react.
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px !important;
  }
</style>


<Center>

[![](/assets/img/2025-10-26-17-29-12.png)](/assets/img/2025-10-26-17-29-12.png)

</Center>



### Project Repository

- https://github.com/machingclee/2025-10-15-egui-experiment


### Introduction to \`egui\`

#### How to get Started {#get-started}

- \`egui\` has official github page: https://github.com/emilk/egui

- For beginner it is suggested to start with their [eframe_template](https://github.com/emilk/eframe_template/). Just clone it and \`cargo run\` to see a very basic single component:

     [![](/assets/img/2025-10-20-01-58-09.png)](/assets/img/2025-10-20-01-58-09.png)

- We can check out their [web demo](https://www.egui.rs/#demo), where you can play around with the well-classified components. For component that appeals to you, you can view the source code and study how to achieve the ui.

  ![](/assets/img/2025-10-20-01-53-19.png)




#### Entrypoint
##### \`main.rs\`, for resource initialization
Note that \`main.rs\` is the binary crate, which starts as the entrypoint of our \`egui\` application. 

It is a good place to start ***initialization*** of resources that is not related to \`egui\` framework such as 
- database connection;
- spawn of \`tokio\` runtime (for doing async tasks), etc.

##### \`lib.rs\`, for app state initialization

For our application logic, we will "enable" custom packages in \`lib.rs\` by using \`mod <package-name>\` several times. We can also define static resources, or methods that manage static resources,  in \`lib.rs\`.



#### Integration with SQLite Database via \`Prisma\` 
##### \`prisma.rs\`
We have mentioned how to install \`prisma\` in *any project* in [Prisma with SQLite for GUI Application in Rust](/blog/article/Prisma-with-SQLite-for-GUI-Application-in-Rust).  

A successful installation of \`prisma\` into the project will create you a \`prisma.rs\` in \`src/\` via \`cargo build\`. After that, add a line \`mod prisma\` in \`lib.rs\` and we are all set to use \`prisma\`.

##### Connect to database on the launch of the application {#launch}

Now back to \`eframe_tempalte\` project (mentioned in section [#get-started]), in \`main.rs\` we have the following block of code:

\`\`\`rust{3-61}
fn main() -> eframe::Result<()> {
    // Choose database location based on build mode
    let db_path = if cfg!(debug_assertions) {
        // In debug mode, use current directory for easier development
        std::env::current_dir().unwrap().join("database.db")
    } else {
        // In release mode, use proper app data directory
        let app_data_dir = dirs::data_dir()
            .unwrap_or_else(|| std::env::current_dir().unwrap())
            .join("ShellScriptManager");

        // Create directory if it doesn't exist
        std::fs::create_dir_all(&app_data_dir).ok();

        app_data_dir.join("database.db")
    };

    let db_url = format!("file:{}", db_path.display());

    let rt = tokio::runtime::Runtime::new().unwrap();
    shell_script_manager::RT_HANDLE
        .set(rt.handle().clone())
        .unwrap();

    rt.block_on(async {
        match shell_script_manager::prisma::new_client_with_url(&db_url).await {
            Ok(client) => {
                // Initialize database schema automatically for desktop app
                if let Err(e) = shell_script_manager::db::get_db::initialize_database(&client).await
                {
                    eprintln!("Failed to initialize database: {}", e);
                    eprintln!("Please check database permissions or file path");
                    std::process::exit(1);
                }

                shell_script_manager::PRISMA_CLIENT.set(client).unwrap();
                println!("Database connection established successfully");
            }
            Err(e) => {
                eprintln!("Failed to connect to database: {}", e);
                eprintln!("Please ensure the database exists by running: npm run migrate:dev");
                eprintln!(
                    "If deploying to production, run migrations as part of your deployment process."
                );
                std::process::exit(1);
            }
        }
    });

    // Spawn a task to keep the runtime alive
    std::thread::spawn(move || {
        rt.block_on(async {
            // Keep alive until signal
            let _ = tokio::signal::ctrl_c().await;
        });
    });

    // Initialize event system
    let (tx, rx) = crossbeam::channel::unbounded();
    shell_script_manager::EVENT_SENDER.set(tx).unwrap();
    shell_script_manager::EVENT_RECEIVER.set(rx).unwrap();

    let native_options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 720.0])
            .with_min_inner_size([800.0, 400.0])
            .with_icon(
                // NOTE: Adding an icon is optional
                eframe::icon_data::from_png_bytes(&include_bytes!("../assets/icon-256.png")[..])
                    .expect("Failed to load icon"),
            ),
        ..Default::default()
    };

    eframe::run_native(
        "Shell Script Managers",
        native_options,
        Box::new(|cc| Ok(Box::new(shell_script_manager::App::new(cc)))),
    )
}
\`\`\`
The highlighted lines are ***new code*** added to \`fn main\`, the intention is clearly stated in the comment, where we have:
- Connected to database;

- Kept the \`tokio\` runtime, i.e., executor polls, alive to schedule futures (async tasks).

#### Initialize Static Resources

In [#launch] we have the following:

\`\`\`rust
    let (tx, rx) = crossbeam::channel::unbounded();
    shell_script_manager::EVENT_SENDER.set(tx).unwrap();
    shell_script_manager::EVENT_RECEIVER.set(rx).unwrap();
\`\`\`

These are the static resources that we have declared in \`lib.rs\`:

\`\`\`rust{18,19}
// lib.rs
#[derive(Debug)]
pub enum AppCommand {
    Folder(FolderCommand),
}

#[derive(Debug)]
pub enum AppEvent {
    Folder(FolderEvent),
}

#[derive(Debug)]
pub enum AppMessage {
    Command(AppCommand),
    Event(AppEvent),
}

pub static EVENT_SENDER: OnceLock<Sender<AppMessage>> = OnceLock::new();
pub static EVENT_RECEIVER: OnceLock<Receiver<AppMessage>> = OnceLock::new();

pub fn send_event(message: AppMessage) {
    let _ = EVENT_SENDER.get().unwrap().send(message);
}

pub fn dispatch_folder_event(event: FolderEvent) {
    println!("Dispatching folder event: {:?}", event);
    send_event(AppMessage::Event(AppEvent::Folder(event)));
}

pub fn dispatch_folder_command(command: FolderCommand) {
    println!("Dispatching folder command: {:?}", command);
    send_event(AppMessage::Command(AppCommand::Folder(command)));
}
\`\`\`

There are ***many more*** static resources by searching \`pub static\` in the project.

### Architecture

#### State Management


\`Script Folders Management\` is the major domain (and possibly the only domain) in our application. Let's organize our state in a separate folder:

[![](/assets/img/2025-10-21-14-10-33.png)](/assets/img/2025-10-21-14-10-33.png)



##### Declare global state

Since our state will be accessed in both main thread running UI as well as threads used by \`tokio\` runtime. For thread safty most of our state are wrapped inside an ***atomic reference count*** pointer \`Arc\`, avoiding our states being killed when parent resource gets ***dropped***:

In addition to \`Arc\`, we also protect our data by ***Read-Write Lock*** \`Rwlock\`:

1. On one hand, we don't want to block access for reading data during other \`read\`;

2. On the other hand, we don't want to allow read access to a data that is being written (use of write lock), or vice versa (no write while reading by read lock). 

    i.e., \`Read\` and \`Write\` are ***exclusive*** to each other.
\`\`\`rust-1
#[derive(Default)]
pub struct FoldersState {
    pub selected_folder_id: RwLock<Option<i32>>,
    pub app_state: RwLock<Arc<Option<prisma::application_state::Data>>>,
    pub folder_list: RwLock<Arc<Vec<prisma::scripts_folder::Data>>>,
    pub scripts_of_selected_folder: RwLock<Arc<Vec<prisma::shell_script::Data>>>,
    pub folder_to_delete: RwLock<Option<Arc<prisma::scripts_folder::Data>>>,
    pub folder_to_rename: RwLock<Option<Arc<prisma::scripts_folder::Data>>>,
    pub rename_text: RwLock<Option<String>>,
    pub script_to_edit: RwLock<Option<Arc<prisma::shell_script::Data>>>,
}

pub static FOLDER_STATE: LazyLock<FoldersState> = LazyLock::new(|| FoldersState::default());
\`\`\`

##### Reducer

For sure we can mutate the state by dereferencing the pointer and assign it a value ***anywhere***. This is both ***good*** and ***bad*** for immidiate mode gui application. 

As in \`redux\`, we should restrict outself to mutate the state only via ***reducer***. In this way we have ***decoupled*** the state-update logic from ui-view logic. Which easily causes scope issue by directly 


\`\`\`rust-14
pub struct FolderReducer<'a> {
    pub state: &'a FoldersState,
}

impl<'a> FolderReducer<'a> {
    pub fn select_folder(&self, id: i32) {
        *self.state.selected_folder_id.write().unwrap() = Some(id);
    }

    pub fn delete_folder(&self, id: i32) {
        let mut folders = self.state.folder_list.write().unwrap();
        let updated_folders: Vec<_> = folders.iter().filter(|f| f.id != id).cloned().collect();
        *folders = Arc::new(updated_folders);
    }

    pub fn rename_folder(&self, id: i32, new_name: &str) {
        let mut folders = self.state.folder_list.write().unwrap();
        let folders_vec = Arc::make_mut(&mut *folders);
        for folder in folders_vec.iter_mut() {
            if folder.id == id {
                folder.name = new_name.to_string();
                break;
            }
        }
    }

    pub fn set_folder_list(&self, folders: Vec<prisma::scripts_folder::Data>) {
        *self.state.folder_list.write().unwrap() = Arc::new(folders);
    }

    pub fn set_scripts_of_selected_folder(&self, scripts: Vec<prisma::shell_script::Data>) {
        *self.state.scripts_of_selected_folder.write().unwrap() = Arc::new(scripts);
    }

    pub fn set_app_state(&self, app_state: Option<prisma::application_state::Data>) {
        *self.state.app_state.write().unwrap() = Arc::new(app_state);
    }
}
\`\`\`

##### The \`with_\` hook via closure

In react repeated pattern of ***state extraction*** can be reused in react via \`hook\`, which is always of the form 

\`\`\`ts
const { someState } = useSomeHook(someParam);
\`\`\`

However, in \`Rust\`, we need to consider the lifespan of  a \`RwLockReadGuard\`, it would be much better to get access to a state ***via closure*** to ensure the \`guard\` is released at an appropriate time to prevent locking:

\`\`\`rust
// src/lib.rs

pub fn with_folder_state<F, R>(f: F) -> R
where
    F: FnOnce(&crate::state::folder_state::FoldersState) -> R,
{
    f(&crate::state::folder_state::FOLDER_STATE)
}

pub fn with_folder_state_reducer<F, R>(f: F) -> R
where
    F: FnOnce(&crate::state::folder_state::FolderReducer<'static>) -> R,
{
    // FOLDER_STATE is a 'static LazyLock, so we can create a FolderReducer<'static> safely
    let reducer = crate::state::folder_state::FolderReducer {
        state: &crate::state::folder_state::FOLDER_STATE,
    };
    f(&reducer)
}
\`\`\`

#### Event-Driven Design based on Rust Messaging System

##### Initialize messaging system

In \`src/lib.rs\` we define static variable for our own project library:

\`\`\`rust
pub static EVENT_SENDER: OnceLock<Sender<AppMessage>> = OnceLock::new();
pub static EVENT_RECEIVER: OnceLock<Receiver<AppMessage>> = OnceLock::new();
\`\`\`


In \`src/main.rs\` we initialize resources before we start the \`egui\` application:



\`\`\`rust
    // Initialize event system
    let (tx, rx) = crossbeam::channel::unbounded();
    shell_script_manager::EVENT_SENDER.set(tx).unwrap();
    shell_script_manager::EVENT_RECEIVER.set(rx).unwrap();
\`\`\`
##### Backend State Part I: Commands

As in usual architecture in DDD, our backend state changes are ***all*** handled by \`Command\` handlers (***single responsibility***), which (they) as a whole serve as an ***application layer*** that interacts directly with our UI interface. 


For UI state change we will be delegating it to our event handlers, again for the purpose of separation of concerns.



\`\`\`rust-1
#[derive(Debug)]
pub enum FolderCommand {
    CreateFolder {},
    SelectFolder {
        folder_id: i32,
    },
    DeleteFolder {
        folder_id: i32,
    },
    AddScriptToFolder {
        folder_id: i32,
        name: String,
        command: String,
    },
    UpdateScript {
        script_id: i32,
        new_command: String,
    },
    UpdateScriptName {
        script_id: i32,
        new_name: String,
    },
    RenameFolder {
        folder_id: i32,
        new_name: String,
    },
}

pub struct FolderCommandHandler {
    folder_repository: Arc<FolderRepository>,
    script_repository: Arc<ScriptRepository>,
}
\`\`\`
Here we need \`Arc\` pointer as we need to *move* pointers into threads created by tokio runtime.

\`\`\`rust-33{45}
impl FolderCommandHandler {
    pub fn new() -> Self {
        Self {
            folder_repository: Arc::new(FolderRepository::new()),
            script_repository: Arc::new(ScriptRepository::new()),
        }
    }

    pub fn handle(&self, command: FolderCommand) {
        let folder_repository = self.folder_repository.clone();
        let script_repository = self.script_repository.clone();
        match command {
            FolderCommand::CreateFolder {} => {
                crate::spawn_task(async move {
                    let total_num_folders =
                        folder_repository.get_folder_count().await.to_i64().unwrap();
                    let folder_name = format!("Folder {}", total_num_folders + 1);

                    match folder_repository.create_script_folder(&folder_name).await {
                        Ok(_) => {
                            crate::dispatch_folder_event(FolderEvent::FolderAdded {
                                name: folder_name.clone(),
                            });
                        }
                        Err(e) => eprintln!("Failed to add folder: {:?}", e),
                    }
                });
            }
\`\`\`
Here once our backend state change has been finished, we dispatch the corresponding event to notice our system. We will be updating our UI state when the relevant event is received. 

When our application gets more complicated, we might also handle additional side effects from our event handler.

\`\`\`rust-61{61}
            FolderCommand::SelectFolder { folder_id } => crate::spawn_task(async move {
                match folder_repository
                    .upsert_app_state_last_folder_id(folder_id)
                    .await
                {
                    Ok(_) => {
                        crate::dispatch_folder_event(FolderEvent::FolderSelected { folder_id });
                        println!(
                            "Successfully updated last opened folder id to {}",
                            folder_id
                        );
                    }
                    Err(e) => eprintln!("Failed to update last opened folder id: {:?}", e),
                }
            }),
        // many more ...
    }
}
\`\`\`



##### Backend State Part II: Repository

To interact with database, we create a special kind of service for this purpose:

\`\`\`rust
pub struct FolderRepository {
    db: &'static PrismaClient,
}
\`\`\`
We have declared a 
\`\`\`rust
pub static PRISMA_CLIENT: OnceLock<prisma::PrismaClient> = OnceLock::new();
\`\`\`
in \`lib.rs\` and instantiated one in \`main.rs\`. Therefore it is accessible in the whole life-time of the application.

Next let's list out a few simple methods in this repository:
\`\`\`rust
impl FolderRepository {
    pub fn new() -> Self {
        let db = crate::db::get_db::get_db();
        Self { db }
    }

    pub async fn get_folder_count(&self) -> i64 {
        let total_num_folders = self.db.scripts_folder().count(vec![]).exec().await.unwrap();
        total_num_folders
    }

    pub async fn get_all_folders(&self) -> prisma_client_rust::Result<Vec<Data>> {
        self.db.scripts_folder().find_many(vec![]).exec().await
    }

    pub async fn create_script_folder(
        &self,
        folder_name: &String,
    ) -> prisma_client_rust::Result<Data> {
        self.db
            .scripts_folder()
            .create(folder_name.clone(), 0, vec![])
            .exec()
            .await
    }
    ...
}
\`\`\`



##### UI State: Events

In \`folder_event_handler.rs\` we have defined the following events:

\`\`\`rust-1
pub enum FolderEvent {
    FolderAdded { name: String },
    FolderSelected { folder_id: i32 },
    FolderDeleted { folder_id: i32 },
    ScriptAdded { folder_id: i32 },
    ScriptUpdated { script_id: i32 },
    FolderRenamed { folder_id: i32, new_name: String },
}
\`\`\`

Basically they correspond to \`AddFolderCommand\`, \`SelectFolderCommand\`, ..., the verbs at the heads are moved to the tails in past tense.

Once a command is finished, we receive an event and do the subsequent action for the application:

\`\`\`rust-9{35}
pub struct FolderEventHandler {
    folder_repository: Arc<FolderRepository>,
    script_repository: Arc<ScriptRepository>,
}

impl FolderEventHandler {
    pub fn new() -> Self {
        Self {
            folder_repository: Arc::new(FolderRepository::new()),
            script_repository: Arc::new(ScriptRepository::new()),
        }
    }

    pub fn handle(&self, event: FolderEvent) {
        let folder_repository = self.folder_repository.clone();
        let script_repository = self.script_repository.clone();
        match event {
            FolderEvent::FolderAdded { name } => {
                // fetch all folder and set it into the state
                println!(
                    "Folder added event received for folder: {}, now refetch all folders",
                    name
                );
                crate::spawn_task(async move {
                    match folder_repository.get_all_folders().await {
                        Ok(folders) => {
                            crate::with_folder_state_reducer(|r| r.set_folder_list(folders));
                        }
                        Err(e) => eprintln!("Failed to load folders: {:?}", e),
                    }
                });
            }
            ...
        }
    }
}
\`\`\`

Our event handlers have a single responsibility of maintaining UI state by fetching the data from our database. 

Note that in traditional backend, event handlers (in policies) are responsible only to determine whether we need to dispatch another command for the reaction to domain business rules.


`;export{e as default};
