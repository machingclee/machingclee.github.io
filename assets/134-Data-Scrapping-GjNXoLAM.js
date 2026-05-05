const e=`---
title: "Data Scrapping for Data that Requires Click by Click "
date: 2023-05-27
id: blog0134
tag: python, selenium
intro: "*Click and then get detail* is a very routine practice for data scrapping. We record how to do that by selenium in python."
toc: true
---

### Imports

The following is what we need in the script. Basically we just use \`selenium\` and \`re\` for regular expression.

\`\`\`python
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
import re
\`\`\`

### The \`driver\` Object with \`eager\` Mode

\`\`\`python
caps = DesiredCapabilities().CHROME
caps["pageLoadStrategy"] = "eager"
driver = webdriver.Chrome(
    desired_capabilities=caps,
    executable_path="C:\\\\dev\\\\chrome-driver\\\\chromedriver.exe"
)
\`\`\`

Here \`pageLoadStrategy\` is set to \`eager\` in order to speed up the scrapping process. The \`eager\` mode will let us stop loading the page when the dom element is completely loaded (we don't wait for other kind of data such as images, audio, etc)

### Utility Functions

\`\`\`python
def control_and_click(anchor):
    ActionChains(driver).key_down(Keys.CONTROL)\\
        .click(anchor)\\
        .key_up(Keys.CONTROL)\\
        .perform()

def wait_element(search_txt, by_method=By.CSS_SELECTOR, seconds=10):
    return WebDriverWait(driver, seconds)\\
        .until(EC.presence_of_all_elements_located((by_method, search_txt)))

def load_page_and_get_reports(url):
    driver.get(url)
    reports = wait_element("#reports-table a[href*='/reports']")
    print("Number of reports in this page: {}".format(len(reports)))
    return reports

def refresh_page_and_get_reports():
    driver.refresh()
    reports = wait_element("#reports-table a[href*='/reports']")
    print("Number of reports in this page: {}".format(len(reports)))
    return reports
\`\`\`

- \`control_and_click\` will press control key and click the target element, this is to open a link in new tab.
- \`wait_element\` will wait for an element to be locatable, this is to make sure no problem occurs when a page is slow (e.g. server side rendering takes some time to return a web page).
- Once there is problem, we try to refresh \`refresh_page_and_get_reports\` to see whether we can resolve it.

### The Scrapping Function

- The strategy is to identify all the anchors in the page that we need to click (line 9 with css selector).

  \`\`\`python-1
  def start_fflog_scrapping(urls, target_player_names, file_location="omega_kills_record.txt"):
      names_matching_regex = re.compile("|".join(target_player_names))

      current_page_index = 0

      for page_index, url in enumerate(urls):
          current_page_index = page_index
          try:
              reports = load_page_and_get_reports(url)
  \`\`\`

- Not only we click it, we \`ctrl + click\` in order to open the page in new tab.

  \`\`\`python-10
              for i in range(0, len(reports)):
                  print("handing report", reports[i].text)
                  report_anchor = reports[i]
                  control_and_click(report_anchor)
  \`\`\`

- When \`ctrl + click\` succeeds, the number of tabs: \`len(driver.window_handles)\` must be $\\ge 2$. However, it used to fail for some reason, we may record those unread reports and study it later on:

  \`driver.switch_to.window(driver.window_handles[1])\` will switch the brower to next tab.

  \`\`\`python-14
                  if len(driver.window_handles) <= 1:
                      print("report {} cannot be read due to some problem".format(report_anchor.get_attribute("href")))
                      with open("report_not_read.txt", "a+") as _f:
                          _f.write(report_anchor.get_attribute("href") + "\\n")
                      continue

                  driver.switch_to.window(driver.window_handles[1])
  \`\`\`

- Depends on the number of click we need, when we are done with the scrapping:

  - We close the current tab by \`driver.close()\`
  - We switch to previous tab by \`driver.switch_to.window(driver.window_handles[i])\`
  - In case we have clicked anchors twice, we need to \`close()\` and \`switch\` twice, see line 39 for example.

- The reamining scrapping logic is page-specific. We use regular expression to match desired results and make a record.

  \`\`\`python-21
                  # detail of bosses related, we are only interested in those omega kill log:
                  rows = wait_element("a[class*='report-overview-boss']")

                  omega_kills = [row for row in rows if re.search("TheOmegaProtocolKill", re.sub("\\\\s", "", row.text)) is not None]

                  if len(omega_kills) > 0:
                      control_and_click(omega_kills[0])
                      driver.switch_to.window(driver.window_handles[2])
                      name_anchors = wait_element("#summary-damage-done-scroller-0 tr[role='row'] a.tooltip")
                      names = "".join([anchor.text for anchor in name_anchors])
                      matched_names = names_matching_regex.findall(names)
                      if len(matched_names) > 0:
                          with open(file_location, "a+", encoding="utf-8") as f:
                              line_1 = "target player(s):\\t" + ", ".join(matched_names) + "\\n"
                              line_2 = "link: \\t\\t\\t\\t\\t\\t" + driver.current_url + "\\n"
                              line_3 = "---\\n"
                              f.writelines(line_1 + line_2 + line_3)
                          print("Player { "+ ", ".join(matched_names) + " } has been found")
                      driver.close()
                      driver.switch_to.window(driver.window_handles[1])
                      driver.close()
                      driver.switch_to.window(driver.window_handles[0])
                  else:
                      driver.close()
                      driver.switch_to.window(driver.window_handles[0])
          except Exception as e:
              urls = urls[current_page_index:]
              print(e)
              print("Exception was caught, retry from page: " + urls[0])
              start_fflog_scrapping(urls, target_player_names)
  \`\`\`
`;export{e as default};
