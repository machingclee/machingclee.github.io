---
title: Egui Study Notes
date: 2025-10-16
id: blog0428
tag: rust, egui
toc: true
intro: Record egui study from the point of view of react.
wip: true
---

#### Repository

- https://github.com/machingclee/2025-10-15-egui-experiment

#### Standard Elements



main entry point:
```rust
fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
    top_menu(ctx);
    folder_col(ctx);
    scripts_col(ctx);
}
```



```rust
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
```
left sizable column:
```rust
pub fn folder_col(ctx: &egui::Context) {
    egui::SidePanel::left("Folders Panel")
        .resizable(true)
        .default_width(300.0)
        .width_range(200.0..=600.0)
        .show(ctx, |ui| {
            ui.label("Scripts Folders");
            ui.separator();
            egui::ScrollArea::vertical().show(ui, |ui| {
                ui.label("Folders to be shown ... WIP");
            });

            ui.horizontal_wrapped(|ui| {
                ui.spacing_mut().item_spacing.x = 0.0;
                ui.label("This demo showcases how to use ");
                ui.code("Ui::response");
                ui.label(
                    " to create interactive container widgets that may contain other widgets.",
                );
            });
        });
}
```
right column
```rust
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

        // Example 2: Using group() - has default styling with background
        ui.group(|ui| {
            ui.label("This is inside a group() - has background and padding");
        });

        ui.add_space(10.0);

        // Example 3: Frame with background and stroke (most like a styled div)
        egui::Frame::new()
            .fill(ui.visuals().window_fill())
            .stroke(ui.visuals().window_stroke())
            .corner_radius(4.0)
            .inner_margin(12.0)
            .show(ui, |ui| {
                ui.label("Frame with background, border, rounded corners, and 12px margin");
            });
        ui.add_space(10.0);

        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.label("Scripts to be shown ... WIP");
        });
    });
}
```

this acts like div with display flex:
```rust 
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
```

theme-aware div

```rust
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
```