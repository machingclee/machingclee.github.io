title: Angular Fundamental
date: 2022-08-18
id: blog090
tag: angular
intro: Record the basic syntax in learning angular.


#### Basic Syntax

- ```text
  ng generate component components/button
  ```
- ```text
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
  import { HttpClientModule } from "@angular/common/http"
  ```
  and add that into `app.module.ts`'s `imports` field. Next we can add `HttpClient` in the `TaskService`, then we can call the get method to get `Observable`.
- To call a function in a view model, we use `<div (click)="onClick()">`, where `onClick` is a method in `xxx.component.ts`, the view model.