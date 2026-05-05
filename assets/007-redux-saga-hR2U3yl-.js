const n=`---
title: On Redux-Saga
date: 2021-07-19
id: blog0007
tag: react
intro: Record a functional Redux-Saga setup.
---

#### Folder Structure and Scripts

<center>
  <img width="220" src="/assets/tech/01.png"/>
</center>
<br/>

Let me take the action in this blog as an example.

\`\`\`javascript
// app.action.ts
export const UPDATE_BLOG = "UPDATE_BLOG";

export type UpdateBlog = ReturnType<typeof updateBlog>;
export const updateBlog = (update: Partial<TAppState["blog"]>) => {
  return {
    type: UPDATE_BLOG,
    payload: update,
  };
};
\`\`\`

We can do our api-related logic in the \`.saga\` below! Later whenever we want to modify our api, saga is the only place we need to look at:

\`\`\`javascript
// app.saga.ts
import { takeEvery, fork } from 'redux-saga/effects';
import * as appActions from "../actions/app.actions";

function* watchUpdateBlog() {
  yield takeEvery(appActions.UPDATE_BLOG, updateBlog);
}

function* updateBlog(action: appActions.UpdateBlog) {
  console.log("I am saga");
  yield put(your action, if any);
}

export default [
  fork(watchUpdateBlog)
]
\`\`\`

\`\`\`javascript
// root.saga.ts
import { all } from "redux-saga/effects";
import appSaga from "./app.saga";

function* rootSaga() {
  yield all([...appSaga]);
}

export default rootSaga;
\`\`\`

\`\`\`javascript
// app.reducer.ts
import * as appActions from "../actions/app.actions";

export default (state: TAppState = initialState, action: AnyAction): TAppState => {
  switch (action.type) {
    case appActions.UPDATE_BLOG: {
      const update = (action as appActions.UpdateBlog).payload;
      return {
        ...state, blog: {
          ...state.blog, ...update
        }
      }
      default:
      return state;
  }
}
\`\`\`

\`\`\`javascript
// root.reducer.ts
import { combineReducers } from "redux";
import appReudcer from "./app.reducer";

const rootReducer =
  combineReducers <
  any >
  {
    app: appReudcer,
  };

export default rootReducer;
\`\`\`

Finally:

\`\`\`javascript
// store.ts
import { createStore, applyMiddleware } from "redux";
import { createLogger } from "redux-logger";
import createSagaMiddleware from "redux-saga";
import rootReducer from "../reducers/root.reducer";
import rootSaga from "../sagas/root.saga";

const logger = createLogger({ collapsed: true });
const sagaMiddleware = createSagaMiddleware();

const store = createStore(rootReducer, applyMiddleware(logger, sagaMiddleware));

sagaMiddleware.run(rootSaga);

export default store;
\`\`\`

Now

\`\`\`javascript
import { Provider } from "react-redux";
ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById("root")
);
\`\`\`

and happy saga!

<center>
  <img src="/assets/tech/02.png"/>
</center>

#### Intercept the Async Actions and Error Handling

\`\`\`javascript
import { put, call } from "redux-saga/effects";

export const safe = (showLoading: boolean, saga: any, ...args: any) =>
  function* (action: any) {
    try {
      if (showLoading) {
        // yield put(loadingActions.setLoading(true));
      }
      console.log("intercepted");
      yield call(saga, ...args, action);
    } catch (error) {
      switch (error.request.status) {
        case 400:
          console.log(\`\${error.response.status}: Bad Request\`);
          break;
        case 401:
          break;
        case 404:
          console.log(\`\${error.response.status}: Not Found\`);
          break;
        case 405:
        case 500:
          console.log(\`\${error.response.status}: Internal Server Error\`);
          break;
        default:
          console.log(\`\${error.response.status}: Service Unavailable\`);
          break;
      }
      const response = error.response.data;
      // yield put(showAlert([response.message], 'error'));
    } finally {
      if (showLoading) {
        // yield delay(500);
        // yield put(loadingActions.setLoading(false));
      }
    }
  };
\`\`\`

In \`app.saga.ts\` now we can replace our controller \`updateBlog\` by

\`\`\`javascript
// app.saga.ts
import { safe } from "./middlewares/safe";

function* watchUpdateBlog() {
  // if true, do whatever you want, like displaying loading popover
  yield takeEvery(appActions.UPDATE_BLOG, safe(true, updateBlog);
}
\`\`\`

Result:

<center>
<img src="/assets/tech/03.png"/>
</center>
`;export{n as default};
