---
title: " Quick Setup to make a Reducer Persist its data"
date: 2024-01-01
id: blog0229
tag: redux, react
intro: "Record the detail to make a persisent redux store."
toc: false
---

<center></center>

First we `npm install redux-persist`, then we create our store as usual.

```javascript
export const store = configureStore({
  reducer: {
    user: userSlice.reducer,
  },
  devTools: true,
  //@ts-ignore
  middleware: (gDM) => gDM().concat(userMiddleware.middleware),
});
```

For reducer whose data we want to persist, we add the corresponding config one by one:

```js
import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import authSlice from "../slices/authSlice";
import storage from 'redux-persist/lib/storage'
// in case for mobile, replace storage by AsyncStorage:
// import AsyncStorage from '@react-native-async-storage/async-storage';

import autoMergeLevel2 from "redux-persist/es/stateReconciler/autoMergeLevel2";

const userPersistConfig = {
  key: "user",
  storage,
  stateReconciler: autoMergeLevel2,
};
```

Next we change the root reducer part in the `configreStore` accordingly:

```js
import persistStore from "redux-persist/es/persistStore";

export const store = configureStore({
  reducer: {
    user: persistReducer<ReturnType<typeof userSlice.reducer>>(userPersistConfig, userSlice.reducer),
  },
  devTools: true,
  //@ts-ignore
  middleware: (gDM) => gDM().concat(userMiddleware.middleware),
});

export const persistor = persistStore(store);
```

Finaly we wrap our main view component in `App.tsx` by using the `PersistGate`

```jsx
// App.tsx
<Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
        <AppRoutes />
    </PersistGate>
</Provider>
```
