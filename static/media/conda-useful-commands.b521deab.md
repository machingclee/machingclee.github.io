title: Useful Conda Commands
date: 2021-07-18
id: blog0005
tag: python
intro: Record the common commands that is needed to create a new virtual environment with conda.

#### Basic Commands

* Create an virtual environment: 
  ```bash
  conda create --name ENV_NAME python=3.8
  ```
* Remove an virtual environment
  ```bash
  conda env remove -n ENV_NAME
  ```

* Register `ENV` to jupyter by
  ```bash
  python -m ipykernel install --user --name=ENV_NAME
  ```
* Remove `ENV` in jupyter by
  ```bash
  jupyter kernelspec uninstall ENV_NAME
  ```
* List all existing virtual environments:
  ```bash
  conda env list
  ```
* List all libraries inside your activated virtual environment:
  ```bash
  conda list
  ```

* Create a `requirements.txt`
  ```bash
  conda list -e > requirements.txt
  ```


* `conda/pip` install the packages in requirements.txt
  ```bash
  conda install --file requirements.txt
  pip install -r requirements.txt
  ```


#### Common Packages
```bash
conda install -c conda-forge jupyterlab
conda install -c conda-forge tensorflow
conda install pytorch torchvision torchaudio cudatoolkit=10.2 -c pytorch
```
