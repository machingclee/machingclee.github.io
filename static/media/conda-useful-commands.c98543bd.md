title: Useful Conda Commands
date: 2021-07-19
intro: Record the common commands that is needed to create a new virtual environment with conda.

##### Commands

* Create an virtual environment: 
  ```bash
  conda create --name <env-name> python=3.8
  ```
* `activate` into your vir-env, register your vir-env to jupyter by
  ```bash
  python -m ipykernel install --user --name=<env-name>
  ```
* List all existing virtual environments:
  ```bash
  conda env list
  ```
* List all libraries inside your activated virtual environment:
  ```bash
  conda list
  ```
