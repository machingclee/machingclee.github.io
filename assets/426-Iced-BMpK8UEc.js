const e=`---
title: "Iced: First Trial to GUI Application in Rust"
date: 2025-10-13
id: blog0426
tag: rust, iced
toc: true
intro: We introduce the message system in iced.
img: /assets/img/2025-10-14-02-25-45.png
offsety: 4
---


### Result 



This project aims at ***experimenting*** GUI framework in Rust ecosystem.

<customvideo src="/assets/videos/006.mp4" width="100%"></customvideo>

### Repository

- [2025-10-13-shell-script-gui-app](https://github.com/machingclee/2025-10-13-shell-script-gui-app)

### Why Iced?


#### It is like Redux


- Iced depends everything in ***messages***, which means that we can apply traditional command/event for the frontend (which is also a pattern in WPF where each button in the XAML file has a \`commmand\` props). 

- In frontend we can even arrange the app as \`View\`s and \`Slice\`s as in react-redux application. Let's see it in the next section.

#### Everything is Message (Event)

For each subdomain/subpage logic we define new \`struct\` as a separated state, as if it is in redux state management. 

The app listens to messages to execute different action (UI state change, data persistence, data fetching, etc):


##### app_slice.rs

\`\`\`rust
impl ShellScriptsAppRootState {
    pub fn update(&mut self, message: Message) -> Task<Message> {
        match message {
            Message::DatabaseConnected(db) => {
                self.db = Some(db.clone());
                self.folder_state.folder_script_repository =
                    Some(Arc::new(ScriptFolderRepository::new(db.clone())));
                self.folder_state.shell_script_repository =
                    Some(Arc::new(ShellScriptRepository::new(db.clone())));
                self.loading = false;
                println!("Database connected successfully!");
                Task::perform(async {}, |_| Message::Folder(FolderMessage::LoadFolders))
            }
            // forward message to subdomain
            Message::Folder(folder_msg) => {
                self.folder_state.update(folder_msg).map(Message::Folder)
            }
            ...
        }
    }
}
\`\`\`

##### folder_slice.rs

\`\`\`rust
impl FolderState {
    pub fn update(&mut self, message: FolderMessage) -> Task<FolderMessage> {
        match message {
            FolderMessage::SelectFolder(folder) => {
                self.selected_folder = Some(folder.clone());
                Task::perform(async {}, move |_| {
                    FolderMessage::FolderSelected(folder.clone())
                })
            }
            FolderMessage::FolderSelected(selected_folder) => {
                if let Some(repo) = &self.shell_script_repository {
                    let repo = repo.clone();
                    let folder_id = selected_folder.id;
                    let folder_name = selected_folder.name.clone();

                    Task::perform(
                        async move { repo.get_all_scripts_of_folder(folder_id) },
                        move |scripts| {
                            println!(
                                "Loaded {} scripts for folder {}",
                                scripts.len(),
                                folder_name
                            );
                            FolderMessage::ScriptsLoaded(scripts)
                        },
                    )
                } else {
                    Task::none()
                }
            }
            ...
        }
    }
}
\`\`\`


### Limitation

#### Standard UI element is not supported

Iced's layout system doesn't natively support absolute positioning, so standard stuff as simple as a context menu cannot be positioned at the point I make a right-click.

#### Every side effect must come from \`Message\`, it might be too complicated

Though everything is handled by messages, I would love to have local state that don't need to update by messages at all. But by default every button must dispatch events, that forces us to do everything via messages:

\`\`\`rust
// on_delete: Message
button(text("Delete").size(14)).on_press(on_delete)
\`\`\`

It might be good or bad, as a react developer I would love to have:

- Separated states that are ***simply local*** (no messages needed) and 
- Some states are ***global*** via redux-toolkit, updated by message so that everyone who subscribe the changes can notice.


`;export{e as default};
