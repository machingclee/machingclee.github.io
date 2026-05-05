const e=`---
title: Scrapping Images with Selenium and Beautifulsoup on Chrome
date: 2021-08-30
id: blog0024
tag: python
intro: Record a flow of data-scrapping.
---

### Introduction I: Scrap Elements by Tagname and ClassName

We start off by importing three libraries:

\`\`\`python
from selenium import webdriver
from bs4 import BeautifulSoup
import time
\`\`\`

We will browse our webpage by \`webdriver.Chrome\`. We will then use \`BeautifulSoup\` to extract data based on HTML file structure such as \`tag\` name, such as \`class\`, etc.

We use open rice as a data source as an example:

\`\`\`python
url = "https://www.openrice.com/zh/hongkong/restaurants?what=%E5%8F%B0%E9%A2%A8"
\`\`\`

We sleep for 10 seconds to make sure all datas have been loaded before getting \`page_source\`:

\`\`\`python
browser = webdriver.Chrome("C:/Users/user/Repos/Python/2021-07-20-TrySelenium/chromedriver.exe")
browser.get(url)
time.sleep(10)
html = browser.page_source
\`\`\`

Here \`html\` is a string of HTML source. We can now parse it using \`BeautifulSoup\` as follows

\`\`\`python
soup = BeautifulSoup(html, "html.parser")
\`\`\`

We now scrap all \`div\` elements that bear the classname \`content-cell-wrapper\`:

\`\`\`python
print(len(soup.find_all("div", {"class": "content-cell-wrapper"})))
\`\`\`

And we get \`8\`. If we further study the HTML structure, we can distill the data by using regular expression.

### Introduction II: Automatic Images Scrapping Through Google

#### Discussion and Pattern

We note that searching \`name\` in google images is the same as having GET-request to the \`https://www.google.com/search?q=name&tbm=isch&hl=en&sa=X\`, therefore we can combine \`selenium\` and \`BeautifulSoup\` to scrap all \`img\` elements.

We also note that each \`img\` grasps the \`src\` attribute to detemine the image source. However, not every \`src\` is of the form \`http://....jpg, .png, .gif\`, etc which provides a direct GET-request to the image. Indeed the frontend may create an \`url\`(which is to be specified in \`src\`) using \`URL.createObjectURL()\`. This \`url\` is not a direct link to the image anymore, instead this will become a binary data represented by base-64 encoded string.

For example, an image may require access tokens in cookie/local storage, for which the frontend developer cannot put an image link to \`src\` as it will create a get request **_without_** header.

#### Code Implementation

We divide the steps by functions from top to bottom. The method \`scrap\` accepes \`labels\`, which is used to

- create GET-requests for image scrapping and;
- create a folder \`./download_dir/{label}\` which stores all the scrapped images.

\`\`\`python
# download ChromeDriver first according to your chrome version
# we need the path for .exe file.
from selenium import webdriver
from bs4 import BeautifulSoup
import time
import requests
import re
import base64
import os
import sys

class GoogleScrapper:
  def __init__(
    self,
    query_url="https://www.google.com/search?q={}&tbm=isch&hl=en&sa=X",
    download_dir="./scrapped_birds",
    chromedriver_path="C:/Users/jameslcc/Desktop/chromedriver.exe"
  ):
    self.query_url = query_url
    self.download_dir = download_dir
    self.chromedriver_path = chromedriver_path

  def scrap_img_els(self, label, wait_before_scrapping=0):
    url = self.query_url.format(label)
    browser = webdriver.Chrome(self.chromedriver_path)
    browser.get(url)
    time.sleep(wait_before_scrapping)
    html = browser.page_source
    browser.close()

    soup = BeautifulSoup(html, "html.parser")

    return soup.find_all("img")

  def download_imgs(self, img_els, label):
    class_dir = f"{self.download_dir}/{label}"

    if not os.path.exists(class_dir):
      os.mkdir(class_dir)

    for i, img_el in enumerate(img_els):
      img_src = img_el.get('src', '')
      try:
        # if src refers to external link
        if img_src.startswith("http"):
          r = requests.get(img_src)
          if r.status_code == 200:
            contype_type = r.headers.get('content-type')
            # image/png, image/jpeg, etc
            if contype_type.startswith("image/"):
              file_ext = re.sub("image/", "",contype_type)
              file_path = f"{class_dir}/{label}-{i}." + file_ext
              with open(file_path, 'wb') as f:
                f.write(r.content)
                print(f"{file_path} has been saved")

        # if src refers to internal link
        if img_src.startswith("data:"):
          # example: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ ...
          head, data = img_src.split(',', 1)
          file_ext = head.split(';')[0].split('/')[1]
          plain_data = base64.b64decode(data)

          with open(f"{class_dir}/{label}-{i}." + file_ext, 'wb') as f:
            f.write(plain_data)
            print(f"{class_dir}/{label}-{i}." + file_ext+ " has been saved")

      except:
        error_msg = sys.exc_info()[1]
        # raise Exception(error_msg)
        print(error_msg)

  def scrap(self, labels, wait_before_scrapping = 0):
    # catter for the case when labels is simply a string,  we want a list of labels
    if isinstance(labels, str):
      labels = [labels]

    for label in labels:
      img_els = self.scrap_img_els(label, wait_before_scrapping)
      self.download_imgs(img_els, label)

scrapper = GoogleScrapper()
\`\`\`
`;export{e as default};
