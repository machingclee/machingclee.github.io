---
title: Redux Toolkit Quick Setup
date: 2022-11-15
id: blog0107
tag: react
intro: Record the setup for redux toolkit.
---

#### Dependency

```text
yarn add @reduxjs/toolkit react-redux @types/react-redux
```

#### Folder Structures

<Center>
  <img src="/assets/tech/107-reduxtoolkit/2022-11-15_040250.png"/>
</Center>

<p/>

##### hooks.ts

```js
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

##### store.ts

```js
import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import dictSlice from "../slices/dictSlice";

export const store = configureStore({
  reducer: {
    dict: dictSlice.reducer,
  },
  devTools: true,
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
```

##### dictSlice.ts

The following is a simple start-up template:

```js
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type DictState = {
  selectedNoteId: string,
  selectedPageId: string,
  selectedVocabId: string,
  imageText: string,
  searchText: string,
};

const initialState: DictState = {
  selectedNoteId: "",
  selectedPageId: "",
  selectedVocabId: "",
  imageText: "",
  searchText: "",
};

const dictSlice = createSlice({
  name: "dict",
  initialState,
  reducers: {
    setSearchText: (state, action: PayloadAction<string>) => {
      state.searchText = action.payload;
    },
  },
});

export default dictSlice;
```
