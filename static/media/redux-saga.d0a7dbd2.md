title: Functional Template of Redux-Saga
date: 2021-07-19
intro: Record a functional Redux-Saga setup.


##### Folder Structure
<center>
  <img width="220" src="redux-saga/01.png" style="margin-bottom:18px"/>
</center>

Let me take the action in this blog as an example. 

```javascript
// app.action.ts
export const UPDATE_BLOG = "UPDATE_BLOG";

export type UpdateBlogState = ReturnType<typeof updateBlog>;
export const updateBlog = (update: Partial<TAppState["blog"]>) => {
  return {
    type: UPDATE_BLOG,
    payload: update
  }
}
```
We can do our api-related logic in the `.saga` below! Later whenever we want to modify our api, saga is the only place we need to look at:
```javascript
// app.saga.ts
import { takeEvery, fork } from 'redux-saga/effects';
import * as appActions from "../actions/app.actions";

function* watchUpdateBlog() {
  yield takeEvery(appActions.UPDATE_BLOG, updateBlog);
}

function* updateBlog() {
  console.log("I am saga");
  yield put(your action, if any);
}

export default [
  fork(watchUpdateBlog)
]
```
```javascript
// root.saga.ts
import { all } from 'redux-saga/effects';
import appSaga from "./app.saga";

function* rootSaga() {
  yield all([
    ...appSaga
  ]);
}

export default rootSaga;
```
```javascript
// app.reducer.ts
import * as appActions from "../actions/app.actions";

export default (state: TAppState = initialState, action: AnyAction): TAppState => {
  switch (action.type) {
    case appActions.UPDATE_BLOG: {
      const update = (action as appActions.UpdateBlogState).payload;
      return {
        ...state, blog: {
          ...state.blog, ...update
        }
      }
      default:
      return state;
  }
}
```

```javascript
// root.reducer.ts
import { combineReducers } from 'redux'
import appReudcer from "./app.reducer";

const rootReducer = combineReducers<any>({
  app: appReudcer
});

export default rootReducer;
```
Finally:

```javascript
// store.ts
import { createStore, applyMiddleware } from "redux";
import { createLogger } from "redux-logger";
import createSagaMiddleware from "redux-saga";
import rootReducer from "../reducers/root.reducer";
import rootSaga from "../sagas/root.saga";

const logger = createLogger({ collapsed: true });
const sagaMiddleware = createSagaMiddleware();

const store = createStore(
  rootReducer,
  applyMiddleware(logger, sagaMiddleware),
)

sagaMiddleware.run(rootSaga);

export default store;
```
Now 
```javascript
import { Provider } from "react-redux";
ReactDOM.render(
  <Provider store={store}>
      <App />
  </Provider>,
  document.getElementById('root')
);
```
and happy saga!

<center>
  <img src="redux-saga/02.png"/>
</center>