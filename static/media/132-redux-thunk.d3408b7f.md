---
title: "Write Middleware in Redux-Toolkit"
date: 2023-05-24
id: blog0132
tag: react
intro: "We list sample usage of createThunkAction provided by redux-toolkit in order to single out the logic of data-fetching away from the UI component."
toc: true
---

#### Write Data-Fetching in Slices

As a usual practice we create `ThunkAction` in the corresponding slice file, for example:

```typescript
// projectSlice.ts

export const fetchProjects = createAsyncThunk(
  "posts/fetchProjects",
  async () => {
    // apiClient: an axio instance with baseUrl configured
    const response = await apiClient.get<ProjectResponse[]>(GET_PROJECTS);
    return response.data;
  }
);
```

#### Problem of Using ExtraReducer to Listen `fetchProjects.pending`

When reading documentation ([link](https://redux-toolkit.js.org/api/createAsyncThunk)) we are instructed to create listener as follows:

```typescript
// sample code from official tutorial

extraReducers: (builder) => {
  // Add reducers for additional action types here, and handle loading state as needed
  builder.addCase(fetchUserById.fulfilled, (state, action) => {
    // Add user to the state array
    state.entities.push(action.payload);
  });
};
```

However, this approach does not allow dispatching additional action that influences the state in other slice.

For example, we want to open a `<Loading/>` dialog during data-fetching, but the `open` state lives in another `applicationSlice`. We cannot simply import `store` object and dispatch the open-dialog action because `store` needs to be created by our current `slice`, namely, circular import will occur.

#### Work Around: Write a Middleware for fetchProjects.pending

We instead listen to `fetchProjects.pending` by creating a middleware as follows, this is very similar to `redux-saga` (but mutch easier):

```typescript
// projectSlice.ts

const fetchProjectMiddleware = createListenerMiddleware();
fetchProjectMiddleware.startListening({
  actionCreator: fetchProjects.pending,
  effect: (action, listenerApi) => {
    listenerApi.dispatch(
      appSlice.actions.updateNotification({ open: true, content: "Loading..." })
    );
  },
});

const endFetchProjectMiddleware = createListenerMiddleware();
fetchProjectMiddleware.startListening({
  actionCreator: fetchProjects.fulfilled,
  effect: (action, listenerApi) => {
    listenerApi.dispatch(appSlice.actions.updateNotification({ open: false }));
  },
});

export const projectMiddlwares = [
  fetchProjectMiddleware.middleware,
  endFetchProjectMiddleware.middleware,
];
```

Now we are free to dispatch any action that adjusts the state of other slices.

#### Add Middlewares to Store

```typescript
// store.ts;
// real use case, ignore the other slices

export const store = configureStore({
  reducer: {
    user: persistedUserReducer,
    application: appSlice.reducer,
    projects: projectSlice.reducer,
    template: templateSlice.reducer,
    fakeTime: fakeTimeSlice.reducer,
  },
  devTools: true,
  //@ts-ignore, as we don't need to maintain this piece of code:
  middleware: (
    gDM //gDM stands for getDefaultMiddleware
  ) => gDM().concat(...templateMiddlewares, ...ProjectMiddlwares),
});
```

#### Share a Middleware for Multiple Actions by `matcher` and `isAnyOf`

In the section <a href="#Work-Around:-Write-a-Middleware-for-fetchProjects.pending">Work Around: Write a Middleware for fetchProjects.pending</a> we:

- wrote a single middleware for a `fetchProjects.pending` action,

But the same effect should be shared amount actions like `updateProjects.pending`, `deleteProject.pending`, and even CRUD for all other entities. We can collect all those thunk actions in `store.ts` and create middlewares specifically for all data-fetching logic:

```typescript
//store.ts

const fetchMiddleware = createListenerMiddleware();
const finishFetchingMiddleware = createListenerMiddleware();

const pendingActions = [
  fetchProjects.pending,
  fetchPages.pending,
  fetchStudents.pending,
  fetchCompanies.pending,
];

const fulfilledActions = [
  fetchProjects.fulfilled,
  fetchPages.fulfilled,
  fetchStudents.fulfilled,
  fetchCompanies.fulfilled,
];

fetchMiddleware.startListening({
  matcher: isAnyOf(...pendingActions),
  effect: (action, listenerApi) => {
    listenerApi.dispatch(
      appSlice.actions.updateNotification({ open: true, content: "Loading..." })
    );
  },
});

finishFetchingMiddleware.startListening({
  matcher: isAnyOf(...fulfilledActions),
  effect: (action, listenerApi) => {
    listenerApi.dispatch(
      appSlice.actions.updateNotification({ open: true, content: "Loaded" })
    );
  },
});

export const store = configureStore({
  ...
  //@ts-ignore
  middleware: (
    gDM //gDM stands for getDefaultMiddleware
  ) => gDM().concat(
    fetchMiddleware.middleware,
    finishFetchingMiddleware.middleware
  )
});
```
