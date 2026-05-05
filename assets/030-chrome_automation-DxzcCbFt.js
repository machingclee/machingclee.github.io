const e=`---
title: Automation Task for Chrome
date: 2021-10-02
id: blog030
tag: python, selenium
intro: Simple click and download (and wait for its completion!) tasks that are achieved in python.
---

### Chrome Options and Driver

A \`ChromOptions\` object is instantiated as follows:

\`\`\`python
from selenium import webdriver
options = webdriver.ChromeOptions()
\`\`\`

Available methods of \`ChromeOption\` object can be found in the <a href="https://selenium-python.readthedocs.io/api.html?highlight=option#selenium.webdriver.chrome.options.Options.add_experimental_option">documentation of Selenium </a>. Common usages:

- for \`.add_argument\`, for a list of arguments we refer to <a href="https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/common/chrome_switches.cc">here</a>.

  For example, if we want to maximize the window on chrome launched, then write \`option.add_argument("--start-maximized")\`.

- for preference, we use \`.add_experimental_option\`, for a list of preferences we refer to <a href="https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/common/pref_names.cc">here</a>. I am not sure whether \`.set_preference\` would override the default preference.

In our case we want to specify the default download directory (which cannot be changed after the \`Driver\` object is instantisated):

\`\`\`python
options = webdriver.ChromeOptions()
prefs = {"download.default_directory" : f"{os.getcwd()}/download"}
options.add_experimental_option("prefs", prefs)
\`\`\`

Now we build our driver using our options.

\`\`\`python
browser = webdriver.Chrome(executable_path=DRIVER_PATH, chrome_options=options)
\`\`\`

### Implicit Wait

From the <a href="https://selenium-python.readthedocs.io/waits.html">documentation of Selenium</a> implicit-wait is:

> An implicit wait tells WebDriver to poll the DOM for a certain amount of time when trying to find any element (or elements) not immediately available. The default setting is 0 (zero). Once set, the implicit wait is set for the life of the WebDriver object.

We will discuss **_explicit-wait_** later in the discussion of downloading files.

In my situation I choose to wait for 10 seconds as dom elements may take time to render:

\`\`\`python
browser.implicitly_wait(10)
\`\`\`

### Select Element and Click

In case an automation task can be done where every desired dom element can be selected by \`id\` attribute, we define the following util function:

\`\`\`python
def get_el_by_id(id):
  el = browser.find_element_by_id(id)
  assert el is not None, f"Element of id: {id} cannot be found"
  return el
\`\`\`

A list of methods to find dom element(s) can be found <a href="https://selenium-python-zh.readthedocs.io/en/latest/locating-elements.html">here</a>.

#### Buttons

Selecting a button and click is as simple as:

\`\`\`python
submit_btn = get_el_by_id("butSubmit")
submit_btn.click()
\`\`\`

#### Dropdown List and Selection

We can select an element in dropdown list by using their \`value\` attribute:

\`\`\`python
from selenium.webdriver.support.select import Select

# dropdown_id: the id of the dropdown dom element
# target_value: the value attribute of our target
selection_list = Select(get_el_by_id(dropdown_id))
selection_list.select_by_value(target_value)
\`\`\`

### Download Files and Explicit Wait

As usual we select an element that would trigger download action and click it:

\`\`\`python
confirm_btn = get_el_by_id("downloadBtn")
confirm_btn.click()
\`\`\`

Next we look at the download directory:

\`\`\`python
import time

def every_downloads_chrome(browser):
  if not browser.current_url.startswith("chrome://downloads"):
    browser.get("chrome://downloads/")
  return browser.execute_script("""
    var items = document.querySelector('downloads-manager')
        .shadowRoot.getElementById('downloadsList').items;

    if (items.length == 0) {
      return ["no_download"]
    }

    if (items.every(e => e.state === "COMPLETE")) {
        return items.map(e => e.fileUrl || e.file_url);
    }
    """)
# waits for all the files to be completed and returns the paths

time.sleep(4)
# timeout for 2 minutes
paths = WebDriverWait(browser, 120, 1).until(every_downloads_chrome)
assert len(paths) >= 1 and paths[-1] != "no_download", "No file is being downloaded"
# get the name of lastly downloaded file:
latest_download_filename = paths[-1].split("/")[-1]

# print the downloaded file
for filepath in paths:
  print(f"Files donwloaded: {filepath}")
\`\`\`

Points to note:

- Since website may have a delay after clicking the download button, we wait for 4 seconds to make sure there is a file to be downloaded.

- We also handle the case that the server has an internal error that ruins our download process. In this case, we return \`["no_download"]\` when \`items.length == 0\`.

  Note that the return value \`[]\` wouldn't stop the waiting process by experiment.

Documentation for \`WebDriverWait\`: https://selenium-python.readthedocs.io/api.html?highlight=WebDriverWait.

### References

- <a href="https://stackoverflow.com/questions/38335671/where-can-i-find-a-list-of-all-available-chromeoption-arguments">Stackoverflow - List of possible options for chrome driver</a>

- <a href="https://stackoverflow.com/questions/48263317/selenium-python-waiting-for-a-download-process-to-complete-using-chrome-web/48267887">Stackoverflow - Explit-wait for downloading files</a>
`;export{e as default};
