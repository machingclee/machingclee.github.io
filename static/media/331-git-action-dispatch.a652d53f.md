---
title: "Github Action: workflow_dispatch"
date: 2024-10-24
id: blog0331
tag: github-actions
toc: true
intro: We can design a button to determine what and when to do something instead of automating the actions for each push / merge request.
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Workflow Dispatch Menu
##### String, Dropdown List and Boolean

```yml
on:
  workflow_dispatch:
    inputs:
      tag:
        type: string
        description: 'Release tag (e.g., v1.0.0)'
        required: true
        default: v1.0.0
      boolean:
        type: boolean
        description: True or False
      choice:
        type: choice
        description: Make a choice
        options:
        - foo
        - bar
        - baz
```

#### Work with inputs from workflow_dispatch

##### Retrieve the value

We get the value in shell script via 

```yml
    run: echo ${{ github.event.inputs.tag }}
```
##### Determine whether a step should be run (Like a Mapping)
The following can be treated as a "mapping" to determine which parameter to use if we have made a reusable github action.

A typical example is a javascript action because all of them must be reusable by nature, see [Fundamentals of Github Actions](/blog/article/Fundamentals-of-Github-Actions) and scroll to *Javascript Actions* section.

```yml
jobs:
  test:
   runs-on: ubuntu-latest
   steps:
    - name: "Checkout source code"
      uses: actions/checkout@v3
      with:
          fetch-depth: 0
          
  l-Service:
    runs-on: ubuntu-latest
    if: ${{ github.event.inputs.SERVICE_NAME == 'L Service'}}
    steps:
    - name: "Checkout source code"
      uses: actions/checkout@v3

  S-Service:
    runs-on: ubuntu-latest
    if: ${{ github.event.inputs.SERVICE_NAME   == 'S Service'}}
    steps:
    - name: "Checkout source code"
      uses: actions/checkout@v3
```

##### Validate tha inputs from workflow_dispatch
For example, we can enforce the tag to follow some specific pattern:

```yml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Check trigger type
        id: check-trigger
        run: |
          if ! [[ ${{ github.event.inputs.tag }} =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Tag must follow format v*.*.* (e.g., v1.0.0)"
            exit 1
          fi
  deployment:
    runs-on: ubuntu-latest
    environment: deployment
    ...
```

##### Add Tag to a branch Using Value from workflow_dispatch

Suppose that we have input a `tag` and want to tag a branch once a deployment succeeded, we add a final step to a job:

```yml![alt text](image.png)
      # ... other step  
      - name: Create tag
        run: |
          # Print current branch for verification
          echo "Current branch: $(git branch --show-current)"
          
          # Validate tag format
          if ! [[ ${{ github.event.inputs.tag }} =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Tag must follow format v*.*.* (e.g., v1.0.0)"
            exit 1
          fi
          
          # Create tag on current branch
          git tag ${{ github.event.inputs.tag }} ${{ github.ref_name }}
          git push origin ${{ github.event.inputs.tag }}
          
          echo "Created tag ${{ github.event.inputs.tag }} on branch ${{ github.ref_name }}"
```