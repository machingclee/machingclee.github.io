const e=`---
title: "React-Query Fundamentals"
date: 2025-01-01
id: blog0356
tag: react, react-query
toc: true
intro: "Record the basic usage of react-query."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Installation

\`\`\`text
yarn add @tanstack/react-query @tanstack/react-query-devtools
\`\`\`

### Configuration



\`\`\`js
// App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
        ...
    </QueryClientProvider>
  )
}
\`\`\`
### React Query DevTool

By default React Query Devtools are only included in bundles when 
\`\`\`js
process.env.NODE_ENV === "development"
\`\`\`
And to *activate* the devtools, we simply import and add:
\`\`\`js
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from  "@tankstack/react-query-devtools"
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
        ...
        <ReactQueryDevtools />
    </ QueryClientProvider>
  )
}
\`\`\`

### useQuery

#### Basic Example for Queries

\`\`\`js
const getData = async  () => { 
        const res = await apiClient.get("..."); 
        // do data transformation here
        const transformedData = ...
        return transformedData
}

const { data, isError, isLoading } = useQuery({
    queryKey: ["my-list", <some-id>],
    queryFn: getData,
    staleTime: 30* 1000,
    gcTime: 5 * 60 * 1000
})
\`\`\`

#### \`isLoading\` and \`isFetching\`

Here \`isLoading\` means the following happen: 
1. No Cahched Data (i.e., all data have been staled)
2. \`isFetching\`
Therefore (think of events of ***one*** data as a sample space)
$$
\\{\\texttt{isLoading}\\}=\\{\\texttt{isFetching}\\} \\cap 
\\{\\texttt{noCachedData}\\}\\subseteq \\{\\texttt{isFetching}\\}
$$
where 
- \`isFetching\`: \`staleTime\` exceeded and
- \`noCachedData\`: \`gcTime\` exceeded


#### \`stateTime\` vs \`gcTime\`

- \`stateTime\` This is for ***when*** data needs to be ***refetched***
- \`gcTime\` This is for ***how long*** to keep data that might be ***reused*** later (like offline / before fetching new data)
  - query goes into *cold storage* if there is no active \`useQuery\`
  - cache data expires after \`gcTime\` (default: \`5mins\`), data is not available any more

We say that a data is \`cached\` until \`gcTime\` is not reached.

#### prefetchQuery 

For better UX sometimes we prefetch data before user nevigating to that page:

\`\`\`js{7,11}
export default function SomeContent () {
    const queryClient = useQueryClient();
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
       const nextPage = currentPage + 1;
       queryClient.prefetchQuery({ queryKey: ["posts", nextPage]})
    }, [currnetPage]);

    const { data } = useQuery({
        queryKey: ["post", currentPage],
        ...
    });
}

\`\`\`

### useMutation
#### Basic Example for Mutations

\`\`\`js-1{12}
const deleteMutation = useMutation({
    mutationFn: (postId: string) => deletePost(postId)
});

const { isSuccess, isPending } = deleteMutation;

const deletePost = (postId: string) => {
    deleteMutation.mutate(postId);
}

const selectSomething = (someId: string) => {
    deleteMutation.reset()
    ...
}
\`\`\`

#### Reset Mutations

- Note that after mutation the booleans \`isSuccess\` and \`isPending\` will be persistent ***unless*** we manually reset it
- This could be a problem because when we try to select something new, we don't wish the failed / loading message remaining there
- So in line 12 above we must ***reset*** it

#### Optimistic Update
\`\`\`js
import { useMutation, useQueryClient } from '@tanstack/react-query'

function useUpdateTodo() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateTodo, // your API call

    onMutate: async (newTodo) => {
      // cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['todos'] })
      const previousTodos = queryClient.getQueryData(['todos'])
      queryClient.setQueryData(['todos'], (oldTodos) => {
        return oldTodos.map(todo => 
          todo.id === newTodo.id ? newTodo : todo
        )
      })
      return { previousTodos }
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['todos'], context.previousTodos)
    },
    onSettled: () => {
      // always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}
\`\`\`

### Cache Invalidations

\`\`\`js
export default function SomeComponent() {
    const queryClient = useQueryClient();
    // invalidate exact query
    queryClient.invalidateQueries({ queryKey: ['todos', 1] });
    // invalidate multiple queries using prefix
    queryClient.invalidateQueries({ queryKey: ['todos'], exact: false });
}
\`\`\`
- \`exact\` by ***default*** is \`false\`. That means it automatically invalidates all caches by prefix
- by default it ***only*** marks the data as \`stale\` (not \`gcTime exceeded\`)
- it does not remove the data from cache

`;export{e as default};
