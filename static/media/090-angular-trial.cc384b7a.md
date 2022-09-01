title: Angular Fundamental
date: 2022-08-18
id: blog090
tag: angular
toc: none
intro: Record the basic syntax in learning angular.

#### Points to note, will be organized later

- To create a project component:
  ```text
  ng new angular-crash-course
  ```
- To create a new component:
  ```text
  ng generate component components/button
  ```
- To create a new service that is to be used by a component:
  ```text
  ng generate service services/task
  ```
- For loop in angular's xxx.component.html
  ```javascript
  <div *ngFor="let task of tasks"> {{ task.text }} </div>
  ```
- Pass object as a props:
  ```javascript
  <app-task *ngFor="let task of tasks" [task]="task"> </app-task>
  ```
- ```javascript
  import { Observable, of } from "rxjs";
  ```
- **json server.**
  After `yarn add json-server` we add the following in `package.json` as our script:
  ```text
  "server": "json-server --watch db.json --port 5000"
  ```
- `import { HttpClient, HttpHeaders } from "@angular/common/http"`
  then
  ```javascript
  import { HttpClientModule } from "@angular/common/http";
  ```
  and add that into `app.module.ts`'s `imports` field. Next we can add `HttpClient` in the `TaskService`, then we can call the get method to get `Observable`.
- To call a function in a view model, we use `<div (click)="onClick()">`, where `onClick` is a method in `xxx.component.ts`, the view model.
- Suppose we have
  ```javascript
  import { Input, Output, EventEmitter } from "@angular/core";
  ```
  then:
  - `@Input()` is used to define **_object_** as a props from parent to its child.
  - `@Output()` is used to define **_function_** that pass data from child to parent, which is usually an `EventEmitter<T>`.
  - Suppose that we have defined
    ```javascript
    @Output() onDeleteTask: EventEmitter<Task> = new EventEimitter()
    ```
    inside `<app-task-item></app-task-item>`, then we can define
    ```js
    deleteTask(task) { this.onDeleteTask.emit(task)}
    ```
    inside that item component.
    - In task-item (child) level, we can define `(click)=deleteTask(task)`, which will emit the event that ship with data `task`.
    - In tasks (parent) level, we can define `<app-tasks (onDeleteTask)=doSth(task)></app-tasks>` to subscribe for the `Event`.
- We add conditional class `reminder` based on `shouldRemind: boolean`:
  ```js
  <div class="task" [ngClass]="{ reminder: shouldRemind }">...</div>
  ```
  Once `shouldRemind === true`, the `div` element will be of class `task reminder`, otherwise it is merely be of class `task`.
- Apart from the usual `EventEmitter`: `(click)`, we have `(dblclick)` for double-click.
- To enable two-way data binding (bind data between both view-model and UI), we:
  ```js
  // src/app/app.module.ts
  import { BrowserModule } from "@angular/platform-browser";
  ...
  @NgModule({
    ...
    imports: [
      BrowserModule,
      FormsModule
    ],
    ...
  })
  ```
  Then we can use `ngModel` directive as follows:
  ```jsx
  <input [(ngModel)]="text"/>
  <div>
      {{ text }}
  </div>
  ```
  where `text` is an attribute defined in `xxx.component.ts`.
- To conditionally show an element, we use `*ngIf="classAttribute"`.
