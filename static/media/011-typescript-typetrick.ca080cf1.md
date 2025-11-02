---
title: Typescript Type Tricks
date: 2021-07-14
id: blog0011
tag: typescript
intro: Useful custom type and last resort to get correct type that we may encounter in typescript.
---

### Special Types

#### Infer `T` from `T[]`

```typescript
type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;
```

#### Combine T1["fields"] = T2[] and S1["fields"] = S2[] to get T with T["fields"] = (T2 & S2)[]

This is a record of real use case in my project:

Both frontend and backend receive `csvConfig` with type `CSVConfig`. For code sharing purpose, this type is not repeatedly defined in both front- and back-end separately, rather it is defined in a custom npm-package installed from our local npm-registry.

However, as business logic grows, there are **_additional_** properties in the `ArrayType` of `CSVConfig["fields"]` (i.e., the `S` in `S[]`) that are redundant to the backend and make sense to the frontend only.

We can of course add additional property in the type definition inside our npm-package project, but why don't we just augment our `ArrayType` of `CSVConfig["fields"]` if these additional properties have nothing to do with the backend? This gets rid of the hessels of `npm link` and `npm unlink --no-save` to our npm-package locally (by the way, `npm unlink` without `--no-save` can be disastrous).

Suppose that the type `CSVConfig["fields"]` is `T[]`. We want to augment `T` by intersecting `T` with the `ArrayType` (again, that means the `S` in `S[]`) of

```typescript
// not a valid syntax
TDataProcessorConfig['fields'] = { defaultValue?: string, processors?: IDataProcessor[] }[].
```

Heuristically we want our augmented `fields` to be like `{ [k: keyof T]: T[k], defaultValue?: string, processors?: IDataProcessor[] }[]`. Now we can augment our `CSVConfig` by

```typescript
type TCSVConfigFields = ArrayElement<CSVConfig["fields"]>;
type TDataProcessorField = ArrayElement<TDataProcessorConfig["fields"]>;

type TAugmentedCSVConfig = Omit<CSVConfig, "fields"> & {
  fields: (TCSVConfigField & TDataProcessorField)[];
};
```

By experiment `Omit` is necessary, otherwise for any variable that inherits type `TAugmentedCSVConfig`, its array element of `fields` property is still accessible to keys in `TCSVConfigField` only.

It seems that property's type is not overridable by intersection at the moment.
