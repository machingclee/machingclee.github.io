---
id: portfolio016
title: "Shell Script Manager"
intro: Manage all shell scripts by a single application
thumbnail: /assets/img/2025-10-26-13-26-23.png
tech: Rust, Egui
thumbTransX: 20
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



#### Result 


<customvideo src="/assets/videos/demo-video-ssm.mp4"></customvideo>


#### Tech Stack

- `Rust` 
- `egui`

#### Project Repository

- [2025-10-15-shell-script-manager](https://github.com/machingclee/2025-10-15-shell-script-manager)


#### Purpose of this Program
##### Switching between projects


It is annoying to navigate between multiple projects (also different IDEs) especially when I need to manage both the frontend and backend, and  when:

- There are ***multiple*** frontend projects (mobile and web) in the same project scope and
- There are ***multiple*** backend projects (as micro-services).

***Worse still***, I also need to navigate to their sourcetree (yes, I am much more used to GUI then the pure cmd-line interface). 

Each context switch of moving to a different project always takes me about 10 seoncds.


##### Rewrite of old Qt application

This project is initially my side project written in `Qt` 5.0:

- [Portfolio: Multiple Projects Starter](/portfolio/Multiple-Projects-Starter). 

That `Qt` application has a frontend layer (i.e., `QML`) as well as a core-backend layer in C++. But I have no knowledge in `Qt` any more so I decided to launch a new project.


#### Why `Egui`? Why not Other Choices such as `Tauri` and `Iced`?


##### `Iced` 

The official website of iced is linked [***here***](https://iced.rs/).

My first attemp to GUI application in rust starts with Iced:

- [2025-10-13-Iced-gui-experiment](https://github.com/machingclee/2025-10-13-Iced-gui-experiment)

To me `Iced` has the following disadvantages:

1. `Iced` is ***nice*** for the philosophy of mutating any application state by messages. But it is also ***bad*** in the sense that every tiny little UI state change must be processed by a message.

2. The variety of UI-components in `Iced` is relatively limited compared to other frameworks, a simple and standard component such as "context-menu" is even not a built-in component in the framework.


3. It is a relatively ***young*** framework.  Its first stable version was released in 2022.


##### `Tauri`


As a full-stack developer in web I am very used to `React`. 

However, when there are two languages involved (such as `Qt` we use `js` for `QML` and `C++` in backend) there is hardly the possibility of sharing type interfaces to both sides of the project.


Unlike `Electron` we can use typescript on both sides, when it comes to data from backend, unsharable type-interfaces also lead to maintenance cost of syncing the interfaces in typescript and rust for data deserialization.

`Tauri` would complexify the application when there is ***no need*** for sophisticated UI that we benefits from webviews.






##### What `egui` stands out




- [Rich UI components and Rich Documentation (click me)](https://www.egui.rs/)

  [![](/assets/img/2025-10-26-14-19-40.png)](/assets/img/2025-10-26-14-19-40.png)



- It is ***immediate mode*** GUI application. Meaning that it draws the GUI on every rerender and any change of the variable would be reflected in the UI immediately. It is very convenient for simple change in the UI-state.

  [***Here***](https://caseymuratori.com/blog_0001?fbclid=IwY2xjawNqnRRleHRuA2FlbQIxMABicmlkETFkMDNjM1FtVWlTSHhYSDk0AR6r52idJjc_z-1l57wyKPeh6X5eE8asIrYjF4IMaz93qC-wjil5Y6uqWdGJlQ_aem_Uz_6PQRZJBrIOuuVqd5W3g) is an article  which explains what is ***immediate*** and ***retained*** GUI code design. 

- Easy to learn, we copy the code from [official website](https://www.egui.rs/) and starts implementing our own logic.

- ***Same language*** in frontend and backend, enjoyable experience for the communication between frontend and backend.



Plus rust has built-in channel-and-message mechanism, making the ***domain driven design***  easy to implement.


#### References

- [Official Website](https://www.egui.rs/)

- NL Tech, [*First Look at Iced GUI Library 🦀 Rust's Elm-Inspired Framework for Desktop Apps*](https://www.youtube.com/watch?v=n7fyOuHNx0M&t=2937s), YouTube

- NL Tech, [*Rust Immediate Mode GUI with Egui ⚡ Building a Real Desktop App*](https://www.youtube.com/watch?v=DJVKNRN5avo), YouTube

