const e=`---
title: "Lazy Loading"
date: 2023-07-05
id: blog0152
tag: react
intro: "Record the detailed implementation of lazy loading."
toc: true
---

### Visual Demo of a Users Page

<video type="video/webm" width="100%" controls>
    <source src="/assets/tech/135/01.mp4" type="video/mp4">
</video>

### Implementation of the Users Page with Lazy Loading

1. Construct the following element in the bottom:

   \`\`\`html
   <div id="bottom-element" ref="{bottomEleRef}" />
   \`\`\`

2. Construct an observer and let it observe this bottom element in the whole life:

   \`\`\`jsx
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
   \`\`\`

   We will give the detail of wbuserThunkActions.getNextBatchOfUsers in a while.

3. Register the listener to observe the bottom element:

   \`\`\`jsx
   useEffect(() => {
     if (bottomEleRef.current && observerRef.current) {
       observerRef.current.observe(bottomEleRef.current);
     }
   }, []);
   \`\`\`

4. Once bottom is scrolled into view, the thunk action that we will dispatch:

   \`\`\`js
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
   \`\`\`

5. We then save the result in \`extraReducers\` into redux store.

   \`\`\`js
   extraReducers: (builder) => {
       ...

       builder.addCase(wbuserThunkActions.getNextBatchOfUsers.fulfilled, (state, action) => {
           const _users = lodash.cloneDeep(state.users);
           const newUsers = reformatRightAndRole(action.payload);
           state.users = _users.concat(newUsers);
       })
   }
   \`\`\`

### Complete Code

\`\`\`jsx
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
\`\`\`

### Generlization into a useLazyload Hook with Search Params

#### Hook Implementation

\`\`\`typescript
// useLazyloading.tsx

import { ReactNode, useCallback, useEffect, useRef } from "react";
import { AsyncThunkAction } from "@reduxjs/toolkit";

export type LimitPageAnd<SearchType> = {
  limit: number;
  page: number;
  search?: SearchType;
};
export default function useLazyLoading<SearchType>({
  preDispatchOnce = async () => {},
  dispatchGetWithSearchParam,
  getSearchParamHook,
  limit,
}: {
  preDispatchOnce?: () => Promise<void>;
  dispatchGetWithSearchParam: (
    param: LimitPageAnd<SearchType>
  ) => Promise<any[] | null | undefined>;
  getSearchParamHook: () => SearchType;
  limit: number;
}) {
  const search = getSearchParamHook();
  const observerRef = useRef<IntersectionObserver>();
  const bottomEleRef = useRef<HTMLDivElement>(null);
  const prefetchDone = useRef(false);
  const firstFetchDispatched = useRef(false);
  const nextPageShouldReadyRef = useRef(false);
  const page = useRef<number>(1);

  const unsubscribeLazyLoader = () => {
    if (bottomEleRef.current && observerRef.current) {
      observerRef.current.unobserve(bottomEleRef.current);
    }
  };

  const subscribeLazyLoader = () => {
    if (bottomEleRef.current) {
      observerRef.current = new IntersectionObserver((entries) => {
        console.log(
          "firstInitedByUseEffectRef.current",
          nextPageShouldReadyRef.current
        );
        if (!nextPageShouldReadyRef.current) {
          return;
        }
        if (entries.length > 0 && entries[0].intersectionRatio > 0) {
          page.current += 1;
          if (search) {
            dispatchGetWithSearchParam({
              page: page.current,
              limit,
              search,
            });
          } else {
            dispatchGetWithSearchParam({
              page: page.current,
              limit,
            });
          }
        }
      });
      observerRef.current.observe(bottomEleRef.current);
    }
  };

  useEffect(() => {
    firstFetchDispatched.current = false;
    nextPageShouldReadyRef.current = false;
    const init = async () => {
      page.current = 1;
      unsubscribeLazyLoader();
      let shouldCallNextPage = false;

      if (!prefetchDone.current) {
        await preDispatchOnce();
        prefetchDone.current = true;
      }

      let results: any[] | null | undefined;

      if (search) {
        results = await dispatchGetWithSearchParam({
          page: page.current,
          limit,
          search,
        });
      } else {
        results = await dispatchGetWithSearchParam({
          page: page.current,
          limit,
        });
      }

      if (results && results.length == limit) {
        subscribeLazyLoader();
        shouldCallNextPage = true;
      }

      return shouldCallNextPage;
    };
    if (!firstFetchDispatched.current && !nextPageShouldReadyRef.current) {
      init().then((shouldCallNextPage) => {
        if (shouldCallNextPage) {
          nextPageShouldReadyRef.current = true;
        }
      });
      firstFetchDispatched.current = true;
    }
  }, [search]);

  const listener = () => <div id="bottom-element" ref={bottomEleRef} />;
  return {
    listener,
    subscribeLazyLoader,
    unsubscribeLazyLoader,
  };
}
\`\`\`

Note that our \`dispatchGetWithSearchParam\` not only dispatches a \`GET\` request event, it also returns the resulting array, which is used to determine whether we should continue to dispatch next batch of scrapping (the next page).

#### Usage

\`\`\`typescript-1
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
        const res = await dispatch(projectThunkAction.getProjects({
            limit,
            page,
            search
        })).unwrap();
        return res.projects;
    }
\`\`\`

Note that here our \`res.projects\` is of type:

\`\`\`typescript
(property) projects: RespondedProject[]
\`\`\`

\`\`\`typescript-23
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
\`\`\`

- Our search param mostly comes form redux store, but we can also use local state (as search result may be influenced by local UI state) by instantiating them in \`SomeOtherHook\`, and import them into \`GetSearchParamHook\`, such as
  \`\`\`typescript
  const GetSearchParamHook = () => {
    const { someState } = SomeOtherHook();
    const search = useAppSelector((s) => s.projects.search);
    return { someState, ...search };
  };
  \`\`\`
- Note that \`listener\` is nothing but a \`div\` element, we don't want it to have any life cycle, therefore we use \`{listner()}\` to "place it there" instead of writing \`<listener />\`.
`;export{e as default};
