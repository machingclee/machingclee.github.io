---
title: "Build a Search Function"
date: 2023-07-26
id: blog0158
tag: java, react, algolia, fusejs, searching
intro: "We introduce a service called Algolia which provides an easy search engine integration that helps build quick and accurate search functionality."
toc: true
---

### What Approaches do we Have when it Comes to Search Engine?

Recently I am responsible for building search functions in frontend. I come up with the following in my mind:

- We sends **_everything_** we want from backend to frontend, and we may either use standard regular expression or dedicated library like `Fuse.js` or `lunr.js` to query for desired results. This works perfectly fine for static web pages (such as this blog).

- We build Elastic Stack, such as Elastic Search and Kibana, which in essense also save results in `Document` and index the fields for searching the documents.

And after struggling for tutorials in youtube, I came across:

- We use **_Algolia_** by feeding our json files (wich consists of search targets) and setting the field names we want to use as search indexes.

### Code Implementation for Fuse.js

#### Search Target

First we build our `blog.json` file which serves as a search resource.

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

#### Build a `blog.json` which Contains Documents to Search

In my case I use the following script:

```js
import fs from "fs";
import matter from "gray-matter";
import path from "path";

const mdDirs = ["./src/mds/articles/tech", "./src/mds/articles/math"];

const getAllMdFilePaths = (dir: string) => {
  const mdFiles: string[] = [];

  const getFiles = (dir: string) => {
    const paths = fs.readdirSync(dir);
    paths.forEach((p) => {
      const newPath = path.join(`${dir}/${p}`);
      const pathStat = fs.statSync(newPath);
      if (pathStat.isDirectory()) {
        getFiles(newPath);
      } else {
        if (newPath.endsWith(".md")) {
          mdFiles.push(newPath);
        }
      }
    });
  };

  getFiles(dir);
  return mdFiles;
};

const writeMdInJson = () => {
  const targetPaths = "./src/mds/blog.json";
  const blogJson: any[] = [];
  for (const dirpath of mdDirs) {
    const mdpaths = getAllMdFilePaths(dirpath);
    mdpaths.forEach((path) => {
      const mdText = fs.readFileSync(path, { encoding: "utf8", flag: "r" });
      const { data, content } = matter(mdText);
      const { wip = false } = data;
      if (!wip) {
        blogJson.push({ content, ...data });
      }
    });
  }
  fs.writeFileSync(
    targetPaths,
    JSON.stringify(blogJson, null, 0)
      .replace(/(\\r\\n)/g, " ")
      .replace(/`/g, "")
      .replace(/\s+/g, " ")
  );
};

const main = () => {
  writeMdInJson();
};

main();
```

#### Search Component

##### Fuse.js (Deprecated as the result is not satisfactory)

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

##### lunr.js, A much more Powerful Version of Fuse.js

The implementation is very similar to `Fuse.js`:

```js
import searchJson from "../../../mds/blog.json";

export default function SearchComponent() {
  const [searchResults, setSearchedResults] = useState<
    { title: string; intro: string; tag: string; tags: string }[]
  >([]);
  const [searchText, setSearchText] = useState("");
  const searchBarRef = useRef<HTMLInputElement>(null);
  const lunrSearch = useRef<lunr.Index | null>(null);
  const searchMapping = useRef<{
    [id: string]: {
      content: string,
      title: string,
      intro: string,
      tag: string,
      tags: string
    }
  }>({});

  useState(() => {
    lunrSearch.current = lunr(function () {
      this.field("tag");
      this.field("tags");
      this.field("title");
      this.field("intro");
      this.field("content");

      console.log("indexing ...");

      (searchJson as { content: string, title: string, date: string, id: string, tag?: string, tags?: string, intro: string, toc: boolean }[]).forEach(
        (searchTarget, index) => {
          const id = index.toString();
          const { intro, tag = "", tags = "", title, content } = searchTarget;
          const searchJson = { intro, tag, tags, title, content };
          searchMapping.current[id] = searchJson
          this.add({ ...searchJson, id })
        }
      );
    })})

  const handleSearchChange = debounce((e: ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    const searchValue = e.target.value;
    if (searchValue) {
      const result = lunrSearch?.current?.search(searchValue);
      const displayResult = result?.sort((r1, r2) => r2.score - r1.score).map(r => {
        const { ref } = r;
        const doc = searchMapping.current?.[ref];
        // we dont' need to return content in the search field
        return {
          intro: doc.intro,
          tag: doc.tag,
          tags: doc.tags,
          title: doc.title
        }
      }) || [];
        setSearchedResults(displayResult);
      }
      else {
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

### Code Implementation for Algolia

#### Backend Using Java

##### Responsibilities of Backend in Using Algolia

Our backend will take the following tasks:

- Provide `ALGOLIA_SEARCH_INDEX`

  ![](/assets/tech/158/001.png)

- Provide `applicationID`
- Provide frontend client with `searchApiKey`'s with differnent priviledges for searching, for example:
  - Admin users can search everything
  - Users of some organization can only search their own related remails
- Upload searchable targets (named `Record`) to Algolia database
- Add new search item into algolia when needed (like emails)

##### Dependencies

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

##### Record Object

- Algolia requires users define a `Record` object which at least contains a non-nullable field called `objectID`.
- Luckily we use mongodb in our java backend, we simply use a stringified `_id` and we use a `modelMapper.map()` to take a `Document` object into our desired `Record` object:

```java
package com.organization.web.service.dto;

import java.util.List;
import lombok.Data;

@Data
public class EmailChainRecord {

    @Data
    public static class Supplier {
        private List<String> material_manu_internal_codes;
    }

    @Data
    public static class NameField {
        private String name;
    }

    @Data
    public static class EmailField {
        private String body;
        private List<String> participant_emails;
    }

    @Data
    public static class SenderInDb {
        private Integer id;
        private String user_name;
        private String first_name;
        private String last_name;
        private String email;
    }

    @Data
    public static class Task {
        private String code;
        private String name;
    }

    @Data
    public static class Section {
        private String name;
        private List<Task> tasks;
    }

    @Data
    public static class ProgramDetail {
        private String prog_ref_no;
        private String name;
        private List<Section> sections;
    }

    private String oid;
    private String objectID;
    private String title;
    private String buyer_company_code;
    private String latest_gmail_snippet;
    private List<String> sender_emails;
    private List<SenderInDb> sendersInDb;
    private NameField buyerCompanyDetail;
    private NameField projectDetail;
    private List<ProgramDetail> programmesDetail;
    private List<EmailField> emails_body;
    private List<String> participant_emails;
}
```

##### SearchIndex Object

In both frontend and backend, the major api calls are all managed by the `SearchIndex` object:

```java
package com.organization.web.algolia;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Service;

import com.algolia.search.DefaultSearchClient;
import com.algolia.search.SearchClient;
import com.algolia.search.SearchIndex;
import com.organization.web.controller.err.CustomException;
import com.organization.web.service.dto.EmailChainRecord;

@Service
public class Algolia {
    @Value("${algolia.application.id}")
    private String applicationID;
    @Value("${algolia.api.key}")
    private String APIKEY;

    @Bean
    public SearchClient getSearchClient() throws CustomException {
        if (this.applicationID == null || this.APIKEY == null) {
            throw new CustomException("application id and apikey cannot be null for algolia");
        }
        return DefaultSearchClient.create(this.applicationID, this.APIKEY);
    }

    @Bean
    public SearchIndex<EmailChainRecord> getIndex() throws CustomException {
        SearchClient client = getSearchClient();
        var initedIndex = client.initIndex("correspondence", EmailChainRecord.class);
        return initedIndex;
    }
}
```

##### SearchService: All the Utility Functions

**Contructor Injection.** To facilitate unit testing, we use autowired constructor injection:

```java-1
package com.organization.web.service.impl;

import com.algolia.search.SearchClient;
import com.algolia.search.SearchIndex;
import com.algolia.search.models.apikeys.SecuredApiKeyRestriction;
import com.algolia.search.models.indexing.Query;
import com.algolia.search.models.settings.IndexSettings;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.organization.web.controller.codes.UserRoles;
import com.organization.web.controller.err.CustomException;
import com.organization.web.mongodb.CollectionNames;
import com.organization.web.mongodb.MongoDB;
import com.organization.web.mongodb.MongoDB.JsonPipeline;
import com.organization.web.service.SearchService;
import com.organization.web.service.dto.EmailChainRecord;
import com.organization.web.service.dto.EmailChainRecord.ProgramDetail;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.apache.commons.collections4.ListUtils;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

@Service
public class SearchServiceImpl implements SearchService {

    @Value("${algolia.public.search.api.key}")
    private String publicSearchAPIKey;

    private MongoDB mongodb;
    private ModelMapper modelMapper = new ModelMapper();
    private SearchIndex<EmailChainRecord> index;
    private SearchClient searchClient;
    // A search key that you keep private

    @Autowired
    public SearchServiceImpl(
            MongoDB mongodb,
            ModelMapper modelMapper,
            SearchIndex<EmailChainRecord> index,
            SearchClient searchClient) {
        this.mongodb = mongodb;
        this.modelMapper = modelMapper;
        this.index = index;
        this.searchClient = searchClient;
    }

    public void clearObjects() {
        this.index.clearObjects();
    }
```

**Insert Data Into Algolia.**

```java-59
    public void insertEmailsIntoAlgolia() {
        clearObjects();
        ...
        var searchDocuments = someCollection
                .aggregate(somePipeline)
                .map(u -> {
                    return modelMapper.map(u, EmailChainRecord.class);
                })
                .forEach(u -> {
                    // refine data in u for search logic
                })
                .into(new ArrayList<>());
        if (searchDocuments != null) {
            this.index.saveObjects(searchDocuments).waitTask();
        }
    }
```

**Define Attributes that Contributes to the Search.**

```java-75
    public void setKeyAndFacetsForQueryAndFilter() {
        var indexSettings = new IndexSettings();

        List<String> attributes = Arrays.asList(
                "latest_gmail_snippet",
                "sender_emails",
                "projectDetail.name",
                "searchabletitle",
                "title",
                "projectDetail.name",
                "senderInDb.user_name",
                "senderInDb.first_name",
                "senderInDb.last_name",
                "programmesDetail.name",
                "programmesDetail.sections.tasks.code",
                "buyerCompanyDetail.name",
                "emails_body.body",
                "emails_body.participant_emails",
                "participant_emails");
        indexSettings.setSearchableAttributes(attributes);
```

**Define Facets (configs to the search keys)**

```java-95
        List<String> filterFacets = Arrays.asList(
                "filterOnly(participant_emails)",
                "filterOnly(emails_body.participant_emails)");
```

```java-98
        List<String> searchFacets = attributes.stream()
                .map(key -> String.format("searchable(%s)", key))
                .collect(Collectors.toList());
```

**Add the Facets into Index Settings.** `ListUtils.union` is the same as `arr1 + arr2` in python:

```java-101
        indexSettings.setAttributesForFaceting(
                ListUtils.union(searchFacets, filterFacets));

        this.index.setSettings(indexSettings);
    }
```

**Impose Restrictions to Search Api Key.**

```java-107
    public String createSearchAPIKey(Document user) throws Exception {
        List<String> roles = user.getList("roles", String.class);

        if (roles.contains(UserRoles.MANAGER) || roles.contains(UserRoles.STAFF)) {
            return this.publicSearchAPIKey;
        }

        String userName = user.getString("user_name");
        SecuredApiKeyRestriction restriction = new SecuredApiKeyRestriction()
                .setQuery(new Query().setFilters(String.format(
                        "participant_emails:%s OR emails_body.participant_emails:%s",
                        userName,
                        userName)));

        String publicKey = this.searchClient.generateSecuredAPIKey(
                this.publicSearchAPIKey,
                restriction);

        return publicKey;
    }
```

**Save a Record into Algolia.**

```java-127
    public void saveObject(ObjectId someId) throws CustomException {
        // logics to fetch search targets

        EmailChainRecord record = modelMapper.map(
                targetMailchain,
                EmailChainRecord.class);

        if (record != null) {
            this.index.partialUpdateObject(record);
        }
    }
}
```

**Remark.** From [documentation](https://www.algolia.com/doc/api-reference/api-methods/partial-update-objects/?client=java) if a record exists in your database but does not exist in algolia, then:

```none
If the objectID is specified but doesn’t exist, Algolia creates a new record
```

That means an `upsert` operation is automatic.

#### Frontend

##### Responsibility of Frontend

The frontend needs to

- Get `applicationID` and `searchApiKey` from backend
- Call the search api to get
  - `target document`
  - `searchable facets` for search suggestions.

##### Frontend Implementation in React

- Algolia provides us with an npm package: `react-instantsearch`.
- However, if we use the UI component provided by that library, we will quickly use up our free quota for the api.
- It is because the change handler in the provided searchbar is intentionally designed not to have any debounce rule.

- Instead we create our own search component (with `<input/>`) and use debounced `onChange` handler with the following `search<T>` function.

```js
export default class AlgoliaUtil {
	public static instance: AlgoliaUtil | undefined;
	public algoliaEnabled: boolean | undefined;
	private algoliaSearchIndex: string | undefined;
	private searchClient: SearchClient | undefined;
	private searchIndex: SearchIndex | undefined;

	constructor(props: { applicationID: string, apiKey: string, initIndex: string, algoliaEnabled: boolean }) {
		this.algoliaEnabled = props.algoliaEnabled;
		this.algoliaSearchIndex = props.initIndex;
		this.searchClient = algoliasearch(
			props.applicationID,
			props.apiKey,
		);
	}

	public static getInstance() {
		if (!AlgoliaUtil.instance) {
			throw new Error("An algolia instance has not been instantiated yet.")
		}
		return AlgoliaUtil.instance;
	}

	private getSearchClient(): SearchClient {
		if (!this.searchClient) {
			throw new Error("Search Client is undefined");
		}
		return this.searchClient;
	}

	private getIndex() {
		if (!this.searchIndex) {
			const searchClient = this.getSearchClient();
			if (this.algoliaSearchIndex) {
				this.searchIndex = searchClient.initIndex(this.algoliaSearchIndex);
			}
		}
		return this.searchIndex;
	}

	public search<T>(params: { queryString: string, attributesToRetrieve: Extract<keyof T, string>[] }) {
		const { attributesToRetrieve, queryString } = params;
		const index = this.getIndex();
		return index?.search(queryString, {
			attributesToRetrieve, facets: constant.FACETS_TO_RECEIVE
		});
	}
}
```

We instantiate `AlgoliaUtil` object when some page is rendered. Sometimes when search feature is not ready yet, and we determine whether algolia is available by setting:

```js
useEffect(() => {
  if (dialogOpen) {
    const enabled = AlgoliaUtil.getInstance().algoliaEnabled;
    setAlgoliaEnabled(enabled || false);
  }
}, [dialogOpen]);
```

- Here the type `T` in `search<T>` is simply the target attribute to retrieve. In our case, we use `T = { oid: string }`.

- Also:
  ```js
  constant.FACETS_TO_RECEIVE = [
    "title",
    "latest_gmail_snippet",
    "programmesDetail.name",
    "emails_body.body",
    "projectDetail.name"
  ],
  ```
  are the results that were hit in the past, they are used as search suggestions.
