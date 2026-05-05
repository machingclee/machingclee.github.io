const e=`---
title: "Study Notes of \`egui\` Part II: UI Components"
date: 2025-10-20
id: blog0430
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

### Standard UI Elements

#### Global Separated Layout
\`\`\`rust
fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
    top_menu(ctx);
    self.folder_col.view(ctx);
    self.scripts_col.view(ctx);
}
\`\`\`

#### Top Menu

<customimage src="/assets/img/2025-10-18-19-25-00.png" width="660"></customimage>

\`\`\`rust
pub fn top_menu(ctx: &egui::Context) {
    egui::TopBottomPanel::top("top_panel").show(ctx, |ui| {
        // The top panel is often a good place for a menu bar:

        egui::MenuBar::new().ui(ui, |ui| {
            // NOTE: no File->Quit on web pages!
            let is_web = cfg!(target_arch = "wasm32");
            if !is_web {
                ui.menu_button("File", |ui| {
                    if ui.button("Quit").clicked() {
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }
                });
                ui.add_space(16.0);
            }

            // egui::widgets::g lobal_theme_preference_buttons(ui);
        });
    });
}
\`\`\`

#### Left sizable column:

##### Left Panel

<customimage src="/assets/img/2025-10-18-19-23-18.png" width="400"></customimage>

\`\`\`rust
pub fn view(&self, ctx: &egui::Context) {
    egui::SidePanel::left("Folders Panel")
        .resizable(true)
        .default_width(300.0)
        .width_range(200.0..=600.0)
        .show(ctx, |ui| {
            ui.label("Scripts Folders");

            ui.separator();

            Self::add_folder_button(ui);

            ui.add_space(10.0);

            Self::folders(ui);
        });
}
\`\`\`


##### Loop a list of Struct

<customimage src="/assets/img/2025-10-22-03-15-13.png" width="400"></customimage>

\`\`\`rust{22,23}
fn folders(ui: &mut Ui) {
    egui::ScrollArea::vertical().show(ui, |ui| {
        crate::with_folder_state(|state| {
            let folders_vec = (*state.folder_list.read().unwrap()).clone();
            let selected_id = *state.selected_folder_id.read().unwrap();
            let rename_folder = state.folder_to_rename.read().unwrap().as_ref().cloned();
            let rename_text = state.rename_text.read().unwrap().as_ref().cloned();

            if folders_vec.is_empty() {
                ui.label("No folders yet...");
            } else {
                for folder in &*folders_vec {
                    let is_renaming = rename_folder
                        .as_ref()
                        .map(|f| f.id == folder.id)
                        .unwrap_or(false);
                    let display_name = if is_renaming {
                        rename_text.as_ref().unwrap_or(&folder.name)
                    } else {
                        &folder.name
                    };
                    let mut folder_item = FolderItem::new(folder, selected_id, display_name);
                    folder_item.view(ui);
                }
            }
        });
    });
}
\`\`\`


The highlighted is the \`egui\`-way modularize part of the code into a component. We explain more detail of folder item in section [#folder-item].

#### Component with Local State {#folder-item}

We break down the component into several sections:

<customimage src="/assets/img/2025-10-22-03-23-20.png" width="400"></customimage>

##### flex-1 clickable button with indicator as "selected label"

<customimage src="/assets/img/2025-10-22-03-24-02.png" width="400"></customimage>

\`\`\`rust
struct FolderItem<'a> {
    folder: &'a crate::prisma::scripts_folder::Data,
    selected_id: Option<i32>,
    display_name: &'a str,
}

impl<'a> FolderItem<'a> {
    fn view(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            let is_selected = self.selected_id == Some(self.folder.id);

            // Calculate space for label (available width minus estimated menu space)
            let available_width = ui.available_width();
            let dots_menu_width = 40.0; // Estimate for menu button
            let label_width = (available_width - dots_menu_width).max(0.0);

            // Make label expand to fill calculated space
            ui.add_sized(
                [label_width, ui.available_height() + 5.0],
                |ui: &mut egui::Ui| {
                    let response = ui.selectable_label(is_selected, self.display_name);
                    if response.clicked() {
                        dispatch_folder_command(FolderCommand::SelectFolder {
                            folder_id: self.folder.id,
                        });
                    }
                    response
                },
            );

            self.dots_menu(ui, self.folder);
        });
    }
}
\`\`\`

##### Dots menu

<customimage src="/assets/img/2025-10-22-03-00-42.png" width="400"></customimage>

\`\`\`rust-1
struct FolderItem<'a> {
    folder: &'a crate::prisma::scripts_folder::Data,
    selected_id: Option<i32>,
    display_name: &'a str,
}

impl<'a> FolderItem<'a> {
    fn dots_menu(&mut self, ui: &mut egui::Ui, folder: &crate::prisma::scripts_folder::Data) {
        let (delete_folder, rename_folder) = crate::with_folder_state(|state| {
            let delete_folder = state.folder_to_delete.read().unwrap().as_ref().cloned();
            let rename_folder = state.folder_to_rename.read().unwrap().as_ref().cloned();
            (delete_folder, rename_folder)
        });

        ui.menu_button("...", |ui| {
            if ui
                .add_sized([120.0, 20.0], |ui: &mut egui::Ui| {
                    ui.button("Rename Folder")
                })
                .clicked()
            {
                let folder_ = Arc::new(folder.clone());
                crate::with_folder_state(|state| {
                    *state.folder_to_rename.write().unwrap() = Some(folder_.clone());
                    *state.rename_text.write().unwrap() = Some(folder_.name.clone());
                });
            }
            if ui
                .add_sized([120.0, 20.0], |ui: &mut egui::Ui| {
                    ui.button("Delete Folder")
                })
                .clicked()
            {
                let folder_ = Arc::new(folder.clone());
                crate::with_folder_state(|state| {
                    *state.folder_to_delete.write().unwrap() = Some(folder_);
                });
            }
        });
\`\`\`

##### Confirm Delete Dialog

<customimage src="/assets/img/2025-10-22-03-05-38.png" width="400"></customimage>

\`\`\`rust-40
        // Show delete confirmation if this folder is selected for deletion
        if let Some(folder_) = delete_folder
            && folder_.id == folder.id
        {
            egui::Window::new("Confirm Delete")
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, egui::Vec2::ZERO)
                .show(ui.ctx(), |ui| {
                    ui.label(format!(
                        "Are you sure you want to delete this folder: {}?",
                        folder.name
                    ));
                    ui.add_space(20.0);
                    ui.horizontal(|ui| {
                        if ui.button("Cancel").clicked() {
                            crate::with_folder_state(|state| {
                                *state.folder_to_delete.write().unwrap() = None;
                            });
                        }
                        if ui.button("Delete").clicked() {
                            dispatch_folder_command(FolderCommand::DeleteFolder {
                                folder_id: folder.id,
                            });
                            crate::with_folder_state(|state| {
                                *state.folder_to_delete.write().unwrap() = None;
                            });
                        }
                    });
                });
        }
\`\`\`



##### Rename Folder Dialog

<customimage src="/assets/img/2025-10-22-03-06-10.png" width="400"></customimage> 
\`\`\`rust-71
        if let Some(folder_) = rename_folder
            && folder_.id == folder.id
        {
            egui::Window::new("Rename Folder")
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, egui::Vec2::ZERO)
                .show(ui.ctx(), |ui| {
                    ui.label("Input new folder name:");
                    ui.add_space(10.0);
                    let mut text = crate::with_folder_state(|state| {
                        state
                            .rename_text
                            .read()
                            .unwrap()
                            .as_ref()
                            .cloned()
                            .unwrap_or_default()
                    });
                    ui.text_edit_singleline(&mut text);
                    crate::with_folder_state(|state| {
                        *state.rename_text.write().unwrap() = Some(text.clone());
                    });
                    ui.add_space(20.0);
                    ui.horizontal(|ui| {
                        if ui.button("Cancel").clicked() {
                            crate::with_folder_state(|state| {
                                *state.folder_to_rename.write().unwrap() = None;
                                *state.rename_text.write().unwrap() = None;
                            });
                        }
                        if ui.button("Rename").clicked() {
                            dispatch_folder_command(FolderCommand::RenameFolder {
                                folder_id: folder_.id,
                                new_name: text,
                            });
                            crate::with_folder_state(|state| {
                                *state.folder_to_rename.write().unwrap() = None;
                                *state.rename_text.write().unwrap() = None;
                            });
                        }
                    });
                });
        }
    }
}
\`\`\` 


#### Right column (Automatically Resizable)

<customimage src="/assets/img/2025-10-18-19-24-23.png" width="400"></customimage>

\`\`\`rust
pub fn scripts_col(ctx: &egui::Context) {
    egui::CentralPanel::default().show(ctx, |ui| {
        ui.add_space(-6.0); // Reduce top padding
        ui.label("Scripts");
        ui.separator();

        // Example 1: Using Frame with uniform margin
        egui::Frame::new()
            .inner_margin(16.0) // Same margin on all sides
            .show(ui, |ui| {
                ui.label("This is inside a Frame with 16px margin on all sides");
            });

        ui.add_space(10.0);
        ...
    });
}
\`\`\`

#### Div like Element

This acts like div with display flex:

<customimage src="/assets/img/2025-10-18-19-22-01.png" width="400"></customimage>

\`\`\`rust 
egui::Frame::new()
    .fill(egui::Color32::from_rgb(240, 240, 240)) // Light gray background, like a div
    .stroke(egui::Stroke::new(
        1.0,
        egui::Color32::from_rgb(200, 200, 200),
    )) // Subtle border
    .corner_radius(4.0) // Rounded corners
    .inner_margin(8.0) // Padding inside the frame
    .show(ui, |ui| {
        ui.horizontal_wrapped(|ui| {
            ui.spacing_mut().item_spacing.x = 0.0;
            ui.label("This demo showcases how to use ");
            ui.code("Ui::response");
            ui.label(" to create interactive container widgets that may contain other widgets.");
        });
    });
\`\`\`

#### Theme-aware Div

<customimage src="/assets/img/2025-10-18-19-20-57.png" width="400"></customimage>

\`\`\`rust
Frame::canvas(ui.style())
    .fill(visuals.bg_fill.gamma_multiply(0.3))
    .stroke(visuals.bg_stroke)
    .inner_margin(ui.spacing().menu_margin)
    .show(ui, |ui| {
        ui.set_width(ui.available_width());

        ui.add_space(32.0);
        ui.vertical_centered(|ui| {
            Label::new(
                RichText::new(format!("{}", self.count))
                    .color(text_color)
                    .size(32.0),
            )
            .selectable(false)
            .ui(ui);
        });
        ui.add_space(32.0);

        ui.horizontal(|ui| {
            if ui.button("Reset").clicked() {
                self.count = 0;
            }
            if ui.button("+ 100").clicked() {
                self.count += 100;
            }
        });
    });
\`\`\`
#### Group 
<customimage src="/assets/img/2025-10-18-19-18-15.png" width="660"></customimage>

\`\`\`rust
ui.group(|ui| {
    ui.label("This is inside a group() - has background and padding");
});
\`\`\`
#### Frame with Border Radius
<customimage src="/assets/img/2025-10-18-19-18-31.png" width="660"></customimage>

\`\`\`rust
egui::Frame::new()
    .fill(ui.visuals().window_fill())
    .stroke(ui.visuals().window_stroke())
    .corner_radius(4.0)
    .inner_margin(12.0)
    .show(ui, |ui| {
        ui.label("Frame with background, border, rounded corners, and 12px margin");
    });
ui.add_space(10.0);
\`\`\`

#### Frame with Margin

<customimage src="/assets/img/2025-10-18-19-19-35.png" width="660"></customimage>

\`\`\`rust
egui::Frame::new()
    .inner_margin(16.0) // Same margin on all sides
    .show(ui, |ui| {
        ui.label("This is inside a Frame with 16px margin on all sides");
    });

ui.add_space(10.0);
\`\`\`


 

#### Space-between Layout
  
<customimage src="/assets/img/2025-10-22-03-07-25.png" width="660"></customimage>

\`\`\`rust
frame.show(ui, |ui| {
    ui.horizontal(|ui| {
        ui.label(format!("Name: {}", script.name));
        if ui.button("Rename").clicked() {
            self.renaming_script_id = Some(script.id);
            self.renaming_name = script.name.clone();
        }
        ui.with_layout(
            egui::Layout::right_to_left(egui::Align::Center),
            |ui| {
                if ui.button("Execute").clicked() {
                    // Execute the script command
                    crate::run_terminal_command(script.command.clone());
                }
                if ui.button("Edit").clicked() {
                    self.editing_script_id = Some(script.id);
                    self.editing_command = script.command.clone();
                }
                if ui.button("Copy").clicked() {
                    ui.ctx().copy_text(script.command.clone());
                }
            },
        );
    });
  }
)
\`\`\`

#### Text Editor

<customimage src="/assets/img/2025-10-22-03-11-51.png" width="400"></customimage>

\`\`\`rust
fn edit_script_window(&mut self, ui: &mut Ui, script_id: i32) {
    egui::Window::new("Edit Script")
        .collapsible(false)
        .resizable(true)
        .default_height(400.0)
        .default_width(600.0)
        .anchor(egui::Align2::CENTER_CENTER, egui::Vec2::ZERO)
        .show(ui.ctx(), |ui| {
            ui.add(
                egui::TextEdit::multiline(&mut self.editing_command)
                    .font(egui::TextStyle::Monospace)
                    .code_editor()
                    .desired_rows(20)
                    .desired_width(580.0),
            );
            ui.add_space(20.0);
            ui.horizontal(|ui| {
                if ui.button("Cancel").clicked() {
                    self.editing_script_id = None;
                }
                if ui.button("Save").clicked() {
                    dispatch_folder_command(FolderCommand::UpdateScript {
                        script_id,
                        new_command: self.editing_command.clone(),
                    });
                    self.editing_script_id = None;
                }
            });
        });
}
\`\`\``;export{e as default};
