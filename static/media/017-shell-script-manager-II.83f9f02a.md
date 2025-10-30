---
id: portfolio017
title: "GUI Desktop Application II: Shell Script Manager in _Tauri_"
intro: Rewrite the previous project that was written in egui, this application is now written in Tuari.
thumbnail: /assets/img/2025-10-31-02-17-10.png
tech: Rust, React, Tauri
thumbTransX: 0
thumbTransY: 0
hoverImageHeight: 160
date: 2025-10-30

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




<Center>

[![](/assets/img/2025-10-31-02-19-13.png)](/assets/img/2025-10-31-02-19-13.png)

</Center>


#### About the Project

##### Demo Video


In the following we ***Double click*** to ***execute*** the script for launching application:

<customvideo src="/assets/videos/demo-video-ssm-tauri.mp4"></customvideo>





##### Project Repository


- [2025-10-27-shell-script-manager-tauri](https://github.com/machingclee/2025-10-27-shell-script-manager-tauri)


##### Tech Stack

<taurissmtechstack></taurissmtechstack>


##### Why this Project?

- This project is a continuation of [my previous project](/portfolio/GUI-Desktop-Application-I:-Shell-Script-Manager-in-_Egui_) of the same application which was written in `egui`.

- Since I am going to extend this project, with `Tauri` I can free my mental resource for the frontend using `React` and focus more on the entire architecture of this application.


#### What's the Difference with `Egui` Version? 

1. `Tailwind` was used to polish the UI into a more modern fashion.

2. ***No distinction*** in terms of ***functionality*** as I directly reused the repository (database) logic form the `egui` project.

3. More ***clean separation*** of frontend and backend. 

    - The UI handles vision level logic;

    - The rust backend focuses more on OS level logic, such as the application title bar, the position of the close-max-min buttons, the application-menu, etc.


#### Future Plan: Move the Domain Logic to `Spring Boot`

##### The Proposed new Architecture

```text
Tauri Frontend (TypeScript/React)
        ↓
Tauri Backend (Rust) - Only OS operations:
  - File system access
  - Window management  
  - Native notifications
  - System tray
  - Auto-updates
        ↓ HTTP/gRPC
Spring Boot Backend - All business logic: (maybe jar file)
  - Domain models
  - Aggregates
  - Repositories
  - Domain events
  - Business rules
        ↓
Database (SQLite)
```

##### Reasons for the Changes

With Rust I have encountered difficulty in writing SQLs (although with the help of query builder via `Prisma`). I still found the pain that:

1. Rust has no ***mature*** `ORM` in its ecosystem that is ***comparable*** to `JPA` in `Spring` world.

2. When an application is not graphics-intensive, performance should not be placed at higher priority than the rigour of backend domain logic.

3. Without ORM, maintaining domain logic is painful and easily reduced to unmaintainable messy side effects.

4. Spring has a set of ***annotations*** that suit Domain Driven Design which help build solid domain models, while the ecosystem in Rust does not.