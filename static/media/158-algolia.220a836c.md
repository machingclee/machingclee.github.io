---
title: "Building Search Functionality"
date: 2023-07-26
id: blog0158
tag: java, react
intro: "We introduce a service called Algolia which provides an easy search engine integration that helps build quick and accurate search functionality."
toc: true
---

#### What Approaches do we Have when it Comes to Search Engine?

Recently I am responsible for building search functions in frontend. I come up with the following in my mind:

- We create a list of `{type: string, key: string}`'s, for different matched `key` we create a query based on different `type` (where data may come from different tables or collections).

- We sends **_everything_** we want from backend to frontend, and we may either use standard regular expression or dedicated library like `Fuse.js` to query for desired results. This works perfectly fine for static web pages (such as this blog).

- We build Elastic Stack, such as Elastic Search and Kibana, which in essense also save results in `Document` and index the fields for searching the documents.

And after struggling for tutorials in youtube, I came across:

- We use **_Algolia_** by feeding our json files (wich consists of search targets) and setting the field names we want to use as search indexes.

#### Code Implementation for Fuse.js

First we build our `nlog.json` file which serves as a search resource.

```json
[
    ...
    {
        "content": "..."
        "title": "Write Middleware in Redux-Toolkit",
        "date": "2023-06-20T00:00:00.000Z",
        "id": "blog0132",
        "tag": "react",
        "intro": "We list sample usage of ..."
        "toc": true
    },
    ...
]
```

Next in the our search component:

```tsx
import searchJson from "../../../mds/blog.json";

export default function SearchComponent() {
  const fuse = useRef(
    new Fuse(searchJson, {
      keys: ["content", "tag", "tags", "title", "intro"],
      threshold: config.fuzzySearchThreshold,
    })
  );
  const [searchResults, setSearchedResults] = useState<
    { title: string; intro: string; tag: string; tags: string }[]
  >([]);
  const [searchText, setSearchText] = useState("");
  const searchBarRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = debounce((e: ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    const searchValue = e.target.value;
    if (searchValue) {
      const result = fuse.current.search(searchValue);
      setSearchedResults(
        result.map((r) => {
          const { title, intro, tag, tags } = r.item;
          return { title, intro, tag: tag || "", tags: tags || "" };
        })
      );
    } else {
      setSearchedResults([]);
    }
  }, 300);

  return (
    <SearchBar
      placeholder="Tag, title or content"
      onChange={handleSearchChange}
      inputRef={searchBarRef}
    />
  );
}
```

- The `Fuse` object can be created anywhere and imported into the component.
- In my case I simply use `useRef` as it is going to be aways static and unchanged in the life cycle of the `SearchComponent`.

#### Code Implementation for Algolia

##### Backend

After registering an account in Algolia and creating an application there, we include the following two dependencies:

```xml
<dependency>
  <groupId>com.algolia</groupId>
  <artifactId>algoliasearch-core</artifactId>
  <version>3.16.5</version>
</dependency>
<dependency>
  <groupId>com.algolia</groupId>
  <artifactId>algoliasearch-java-net</artifactId>
  <version>3.16.5</version>
</dependency>
```

Then we start to work with uploading the search targets from backend

```java
import com.algolia.search.DefaultSearchClient;
import com.algolia.search.SearchClient;
import com.algolia.search.SearchIndex;
import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import com.wonderbricks.web.mongodb.CollectionNames;
import com.wonderbricks.web.mongodb.MongoDB;

public class SearchServiceImpl {
    @Data
    public static class Record extends Serializable {
        private String objectID;
        ...
    }

    private static SearchIndex<Record> index = null;
    public static SearchIndex<Record> getIndex() {
        if (SearchServiceImpl.index == null) {
            SearchClient client = DefaultSearchClient.create(
                    "application_id",
                    "admin_level_id");
            SearchServiceImpl.index = client.initIndex("correspondence", Record.class);
        }
        return SearchServiceImpl.index;
    }

    public static void clearObjects() {
        var index = SearchServiceImpl.getIndex();
        index.clearObjects();
    }

    public static void insertObjects(List<Record> objects) {
        var index = SearchServiceImpl.getIndex();
        index.saveObjects(objects);
    }
}
```

##### Frontend

- Algolia provides us with an npm package: `react-instantsearch`.
- However, if we use the UI component provided by that library, we will quickly use up our free quota for the api.
- It is because the change handler in the provided searchbar is intentionally designed not to have any debounce rule.

- Instead we create our own search component (with `<input/>`) and use debounced `onChange` handler with the following `search<T>` function.

```js
import algoliasearch, { SearchClient } from 'algoliasearch/lite';

export default class AlgoliaUtil {
	private static searchClient: SearchClient;
	private static getSearchClient(): SearchClient {
		if (!AlgoliaUtil.searchClient) {
			AlgoliaUtil.searchClient = algoliasearch(
				'application_id',
				'search_api_key'
			);
		}
		return AlgoliaUtil.searchClient;
	}
	private static getIndex() {
		const searchClient = AlgoliaUtil.getSearchClient();
		return searchClient.initIndex("correspondence");
	}
	public static search<T>(params: {
    queryString: string,
    attributesToRetrieve: Extract<keyof T, string>[]
    }) {
      const { attributesToRetrieve, queryString } = params;
      const index = AlgoliaUtil.getIndex();
      return index.search(queryString, { attributesToRetrieve });
  }
}
```
