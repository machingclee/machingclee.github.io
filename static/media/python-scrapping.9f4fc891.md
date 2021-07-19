title: Web Scraping with Selenium and Beautifulsoup on Chrome
date: 2021-07-20
info: Record a simple flow of the data-scrapping.


##### Scripts
We start off by importing three libraries:
```python
from selenium import webdriver
from bs4 import BeautifulSoup
import time
```

We will browser our webpage by `webdriver.Chrome`. 

We will then use `BeautifulSoup` to extract data based on HTML file structure such as `tag` name, such as `class`, etc.

We use open rice as a data source as an example:
```python
url = "https://www.openrice.com/zh/hongkong/restaurants?what=%E5%8F%B0%E9%A2%A8"
```
We sleep for 10 seconds to make sure all datas have been loaded before getting `page_source`:
```python 
browser = webdriver.Chrome("C:/Users/user/Repos/Python/2021-07-20-TrySelenium/chromedriver.exe")
browser.get(url)
time.sleep(10)
html = browser.page_source
```
Here `html` is a string of HTML source. We can now parse it using `BeautifulSoup` as follows
```python
soup = BeautifulSoup(html, "html.parser")
```
We now scrap all `div` elements that bear the classname `content-cell-wrapper`:
```python 
print(len(soup.find_all("div", {"class": "content-cell-wrapper"})))
```
And we get `8`. If we further study the HTML structure, we can distill the data by using regular expression.
