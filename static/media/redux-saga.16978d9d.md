title: Functional Template of Redux-Saga
date: 2021-07-19
intro: Record a functional Redux-Saga setup.



##### Why
When we try to build a slightly more complex application with data-fetching, as a newbie, we usually write a bulky component by  having the logic of our api-call, the logic of handling fetched data, and the states inside a single component all stuffed inside a single component.

Later, we learn that we should move some of our states to context to make our component less coupled with one another and make it more easy to maintain.

Sooner we are concerned about the performance issue with context, we learn that redux can make precise rerendering only for the component that has state change (as the selector `state => state.sth` subscribes to redux-store dispatch action, on every dispatch, the selector returns the state from the store, finally redux determines if the states are different, if not, stay still, otherwise, rerender).

Therefore when we grow up, we naturally separated the responsibility of each module:

* State change by reducer
* Display data by functional component

But yet there is **no** specific area for async tasks. Where should I fetch the data? Should I fetch it in `useEffect`? Should I fetch data by simply defining a function inside a component? One of the suitable choices is to do all the async tasks in saga to make all the api-related logic grouped in a unified way.

In fact, we can make data-fetching in frontend become a controller-handler structure.


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