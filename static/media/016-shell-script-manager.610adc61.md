---
id: portfolio016
title: "GUI Desktop Application I: Shell Script Manager in _Egui_"
intro: Manage all shell scripts by a single application. This project also aims at getting me more used to Rust programming.
thumbnail: /assets/img/2025-10-26-13-26-23.png
tech: Rust, Egui, Tauri
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




<Center>


[![](/assets/img/2025-10-26-17-29-12.png)](/assets/img/2025-10-26-17-29-12.png)


</Center>



#### About the Project

##### Demo Video



<customvideo src="/assets/videos/demo-video-ssm.mp4"></customvideo>


##### Project Repository



- [2025-10-15-shell-script-manager](https://github.com/machingclee/2025-10-15-shell-script-manager)




##### Tech Stack

<rustssmtechstack></rustssmtechstack>


##### Why this Project?


- When there are many projects opened at the same time, finding and switching between them is a nightmare. 
- Especially when I need to switch to ***different*** IDEs and sourcetree folders for pulling or creating merge requests.

- Plus I want a project to ***get me more used*** to Rust programming.



#### Decision between `Egui`, `Tauri` and `Iced`


##### `Iced` 

The official website of iced is linked [***here***](https://iced.rs/).

My first attemp to GUI application in rust starts with `Iced`:

- [2025-10-13-Iced-gui-experiment](https://github.com/machingclee/2025-10-13-Iced-gui-experiment)

To me `Iced` has the following ***disadvantages***:

1. `Iced` is ***nice*** for the philosophy of mutating any application state by messages. But it is also ***bad*** in the sense that every tiny little UI state change must be processed by a message.


2. It is a relatively ***young*** framework.  Its first stable version was released in 2022.

3. The ***variety*** of UI-components in `Iced` is relatively ***limited*** compared to other frameworks, a simple and standard component such as "context-menu" is even not a built-in component in the framework.



##### `Tauri`


As of the time I build this application I was trying `egui` and didn't study `Tauri` yet, I will definitely give it a try.






##### Why `egui` stands out for Rust Beginner

From the point of view of learning a language, I personally prefer `egui` for the following reasons when I make the study:

- [Rich UI components and Rich Documentation (click me)](https://www.egui.rs/)

  [![](/assets/img/2025-10-26-14-19-40.png)](/assets/img/2025-10-26-14-19-40.png)



- Easy to learn, we copy the code from [official website](https://www.egui.rs/) ***for whatever component*** we want and start implementing our own logic.

- ***Same language*** in frontend and backend, enjoyable experience for the communication between frontend and backend.


- Rust has built-in channel-and-message mechanism, making the ***Domain Driven Design***  easy to implement. Therefore we have clear separation of concerns by defining:

  - **Commands.** Only command can trigger backend/system state change.
  - **Event.** Only event can trigger UI state change
  - And each completion of a command will dispatch one or more events.





#### Future Plan: Rewrite in `Tauri`

- This project has already satisfied my learning purpose of getting familiar with Rust programming language.


- I will rewrite this project in `Tauri` as I am not going to write graphics-intensive applications  (game tools, 3D viewers, data visualization), which are what `egui` good at. 

- With my react skill I can get a more ***polished*** UI with $\frac{1}{10}$ the effort, and I can focus on features instead of fighting with UI implementation (in `egui` making an `egui::Frame` to have a "hover-and-highlight" effect is horribly difficult).


#### References

- [Official Website](https://www.egui.rs/)

- NL Tech, [*First Look at Iced GUI Library 🦀 Rust's Elm-Inspired Framework for Desktop Apps*](https://www.youtube.com/watch?v=n7fyOuHNx0M&t=2937s), YouTube

- NL Tech, [*Rust Immediate Mode GUI with Egui ⚡ Building a Real Desktop App*](https://www.youtube.com/watch?v=DJVKNRN5avo), YouTube

