const e=`---
title: "Quick Step to Make a Reducer Persist its Data"
date: 2023-06-21
id: blog0145
tag: react, redux
intro: "Record the use of \`redux-persist\` for persisting data in redux store."
toc: false
---

### Step 1

First we \`npm install redux-persist\`, then we create our store as usual.

\`\`\`typescript-1
export const store = configureStore({
  reducer: {
    user: userSlice.reducer,
    application: appSlice.reducer,
    projects: projectSlice.reducer,
    companies: companySlice.reducer,
    template: templateSlice.reducer,
    fakeTime: fakeTimeSlice.reducer,
    wbusers: wbuserSlice.reducer,
    wbcategories: categorySlice.reducer
  },
  devTools: true,
  //@ts-ignore
  middleware: (gDM) => gDM().concat(
    templateMiddleware.middleware,
    projectMiddleware.middleware,
    fakeTimeMiddleware.middleware,
    wbuserMiddlwares.middleware,
    categoryMiddleware.middleware,
    companyMiddleware.middleware
  )
});
\`\`\`

### Step 2

For reducer whose data we want to persist, we add the corresponding config one by one:

\`\`\`typescript
const userPersistConfig = {
  key: "user",
  storage,
  stateReconciler: autoMergeLevel2,
};
\`\`\`

Next we change the root reducer part in line 5 accordingly:

\`\`\`typescript-1
import persistStore from "redux-persist/es/persistStore";

export const store = configureStore({
  reducer: {
    user: persistReducer<ReturnType<typeof userSlice.reducer>>(userPersistConfig, userSlice.reducer),
    application: applicationPersistConfig, appSlice.reducer,
    projects: projectSlice.reducer,
    companies: companySlice.reducer,
    template: templateSlice.reducer,
    fakeTime: fakeTimeSlice.reducer,
    wbusers: wbuserSlice.reducer,
    wbcategories: categorySlice.reducer
  },
  devTools: true,
  //@ts-ignore
  middleware: (gDM) => gDM().concat(
    templateMiddleware.middleware,
    projectMiddleware.middleware,
    fakeTimeMiddleware.middleware,
    wbuserMiddlwares.middleware,
    categoryMiddleware.middleware,
    companyMiddleware.middleware
  )
});

export const persistor = persistStore(store);
\`\`\`

### Step 3

Finaly we wrap our main view component in \`App.tsx\` by using the \`PersistGate\` and the exported \`persistor\`:

\`\`\`typescript
//App.tsx

<Provider store={store}>
  <PersistGate loading={null} persistor={persistor}>
    ...
    <AppRoutes />
    ...
  </PersistGate>
</Provider>
\`\`\`
`;export{e as default};
