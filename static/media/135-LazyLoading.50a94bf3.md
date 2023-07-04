---
title: "Lazy Loading"
date: 2023-07-05
id: blog0152
tag: react
intro: "Record the detailed implementation of lazy loading."
toc: true
---

#### Visual Demo of a Users Page

<video type="video/webm" width="100%" controls>
    <source src="/assets/tech/135/01.mp4" type="video/mp4">
</video>

#### Implementation of the Users Page with Lazy Loading

1. Construct the following element in the bottom:

   ```html
   <div id="bottom-element" ref="{bottomEleRef}" />
   ```

2. Construct an observer and let it observe this bottom element in the whole life:

   ```jsx
   const bottomEleRef = useRef < HTMLDivElement > null;
   const observerRef =
     useRef <
     IntersectionObserver >
     new IntersectionObserver((entries) => {
       if (entries.length > 0 && entries[0].intersectionRatio > 0) {
         page.current += 1;
         dispatch(
           wbuserThunkActions.getNextBatchOfUsers({
             page: page.current,
             limit: config.usersPerPage,
           })
         );
       }
     });
   ```

   We will give the detail of wbuserThunkActions.getNextBatchOfUsers in a while.

3. Register the listener to observe the bottom element:

   ```jsx
   useEffect(() => {
     if (bottomEleRef.current && observerRef.current) {
       observerRef.current.observe(bottomEleRef.current);
     }
   }, []);
   ```

4. Once bottom is scrolled into view, the thunk action that we will dispatch:

   ```js
   export const wbuserThunkActions = {
       ...,

       getNextBatchOfUsers: createAsyncThunk(
           "get-next-batch-users",
           async (
               { page, limit }: { page: number, limit: number },
               thunkAPI
           ) => {
               const res = await apiClient.get<GetWBUsersResponse>(GET_USERS(page, limit));
               const { result } = res.data;
               const { users } = result;
               return users;
           }
       )
   }
   ```

5. We then save the result in `extraReducers` into redux store.

   ```js
   extraReducers: (builder) => {
       ...

       builder.addCase(wbuserThunkActions.getNextBatchOfUsers.fulfilled, (state, action) => {
           const _users = lodash.cloneDeep(state.users);
           const newUsers = reformatRightAndRole(action.payload);
           state.users = _users.concat(newUsers);
       })
   }
   ```

#### Complete Code

```jsx
export default function Users() {
    const classes = useStyles();
    const dispatch = useAppDispatch();
    const page = useRef<number>(1);
    useEffect(() => {
        dispatch(wbuserThunkActions.getUsers({ page: 1, limit: config.usersPerPage, search: "" }));
        dispatch(wbuserThunkActions.fetchCompanyCodeNameDictionary());
    }, []);
    const users = useAppSelector(s => s.wbusers.users);
    const searchField = useAppSelector(s => s.wbusers.searchField);
    const bottomEleRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver>()

    useEffect(() => {
        if (bottomEleRef.current && observerRef.current) {
            observerRef.current.unobserve(bottomEleRef.current);
        }
        if (bottomEleRef.current) {
            observerRef.current = new IntersectionObserver(entries => {
                if (entries.length > 0 && entries[0].intersectionRatio > 0) {
                    page.current += 1;
                    dispatch(wbuserThunkActions.getUsers({ page: page.current, limit: config.usersPerPage, search: searchField }))
                }
            })
            observerRef.current.observe(bottomEleRef.current);
        }
    }, [searchField])


    useEffect(() => {
        return () => {
            dispatch(wbuserSlice.actions.reset());
        }
    }, [])

    useEffect(() => {
        page.current = 1;
        dispatch(wbuserThunkActions.getUsers({ page: page.current, limit: config.usersPerPage, search: searchField }))
    }, [searchField])



    return (<div className={classnames(classes.userTable)}>
        <Spacer height={5} />
        <WBUserSearchField />
        <Spacer height={40} />
        <WbTable style={{ marginRight: 10 }}>
            <tr>
                <th>First Name</th>
                <th>Last Name</th>
                <th className="roles">Role</th>
                <th>Company </th>
                <th className="username">User Name</th>
                <th>Unofficial</th>
                <th>Admin Portal</th>
                <th>Public</th>
            </tr>
            <tbody>
                {users.map(u => <WBUserRow user={u} />)}
            </tbody>
        </WbTable >
        <div id="bottom-element" ref={bottomEleRef} />
    </div>);
}
```

#### Generlization into a useLazyload Hook

##### Hook Implementation
```typescript
// useLazyloading.tsx

import { ReactNode, useCallback, useEffect, useRef } from "react";
import { AsyncThunkAction } from "@reduxjs/toolkit";


export type LimitPageAnd<SearchType> = {
    limit: number,
    page: number,
    search?: SearchType,
}
export default function useLazyLoading<SearchType>({
    preDispatchOnce = async () => { },
    dispatchGetWithSearchParam: dispatchGetWithParam,
    getSearchParamHook,
    limit,
}: {
    preDispatchOnce?: () => Promise<void>,
    dispatchGetWithSearchParam: (param: LimitPageAnd<SearchType>) => Promise<void>,
    getSearchParamHook: () => SearchType,
    limit: number,
}) {
    const search = getSearchParamHook();
    const observerRef = useRef<IntersectionObserver>();
    const bottomEleRef = useRef<HTMLDivElement>(null);
    const prefetchDone = useRef(false);
    const firstInitedByUseEffectRef = useRef(false);
    const page = useRef<number>(1);

    const unsubscribeLazyLoader = () => {
        if (bottomEleRef.current && observerRef.current) {
            observerRef.current.unobserve(bottomEleRef.current);
        };
    }

    const subscribeLazyLoader = () => {
        if (bottomEleRef.current) {
            observerRef.current = new IntersectionObserver(entries => {
                console.log("firstInitedByUseEffectRef.current", firstInitedByUseEffectRef.current);
                if (!firstInitedByUseEffectRef.current) {
                    return;
                }
                if (entries.length > 0 && entries[0].intersectionRatio > 0) {
                    page.current += 1;
                    if (search) {
                        dispatchGetWithParam({
                            page: page.current,
                            limit,
                            search
                        });
                    } else {
                        dispatchGetWithParam({
                            page: page.current,
                            limit
                        });
                    }
                }
            })
            observerRef.current.observe(bottomEleRef.current);
        }
    }

    useEffect(() => {
        firstInitedByUseEffectRef.current = false;
        const init = async () => {

            page.current = 1;
            unsubscribeLazyLoader();

            if (!prefetchDone.current) {
                await preDispatchOnce();
                prefetchDone.current = true;
            }


            if (search) {
                await dispatchGetWithParam({
                    page: page.current,
                    limit,
                    search
                });
            } else {
                await dispatchGetWithParam({
                    page: page.current,
                    limit
                });
            }
            subscribeLazyLoader();

        }
        init().then(() => {
            firstInitedByUseEffectRef.current = true;
        });
    }, [search || {}]);

    const listener = () => <div id="bottom-element" ref={bottomEleRef} />;
    return {
        listener
    }
}
```

##### Usage
```typescript
// a user page

const GetSearchParamHook = () => {
    return useAppSelector(s => s.projects.search);
}

const Users = () => {
    ...    

    const preDispatchOnce = async () => {
        await dispatch(projectThunkAction.fetchCompanyName());
    }

    const dispatchGetWithSearchParam = async (param: LimitPageAnd<SearchType>) => {
        const { limit, page, search } = param;
        await dispatch(projectThunkAction.fetchProjects({
            limit,
            page,
            search
        }))
    }

    const { listener } = useLazyLoading({
        preDispatchOnce,
        dispatchGetWithSearchParam,
        getSearchParamHook: GetSearchParamHook,
        limit: config.projectsPerPage
    })

    return (
        <div>
            ...
            {listener()}
        </div>
    )
}
```
- Our search param mostly comes form redux store, but we can also use local state (as search result may be influenced by local UI state) by instantiating them in `SomeOtherHook`, and import them into `GetSearchParamHook`, such as 
  ```typescript
  const GetSearchParamHook = () => {
      const { someState } = SomeOtherHook();
      const search = useAppSelector(s => s.projects.search);
      return { someState, ...search };
  }
  ```
- Note that `listener` is nothing but a `div` element, we don't want it to have any life cycle, therefore we use `{listner()}` to "place it there" instead of writing `<listener />`.