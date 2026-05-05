const t=`---
title: Datetime Object in Python
date: 2021-11-20
id: blog037
tag: python
intro: Record a list of useful utility functions in handling date-time object in python.
---

### Datetime Object Construction

#### From Constructor

\`\`\`python
from datetime import datetime

datetime(year, month, day, hour)
datetime(year, month, day, hour, minute)
datetime(year, month, day, hour, minute, secons)
...
\`\`\`

are all valid method overloading for \`datetime\` object construction.

#### From String

##### From Local Time String to Local Datetime

\`\`\`python
from datetime import datetime

hk_time = "2021-11-11 10:32:34.126377"
hk_time_datetime = datetime.strptime(hk_time, '%Y-%m-%d %H:%M:%S.%f')
\`\`\`

##### From Local Time String to UTC Datetime

\`\`\`python
from datetime import datetime, timezone

local_time = "2021-11-11 10:32:34.126377"
local_time_datetime = datetime.strptime(local_time, '%Y-%m-%d %H:%M:%S.%f')  # local datetime object
utc_time_datetime = local_time_datetime.astimezone(timezone.utc)

print(local_time_datetime.hour, utc_time_datetime.hour)
# output: 10, 2
\`\`\`

##### From UTC Time String to Local Datetime

\`\`\`python
from datetime import datetime, timezone
from dateutil import tz

utc_time = "2021-11-11 10:32:34.126377"
utc_time = datetime.strptime(utc_time, '%Y-%m-%d %H:%M:%S.%f')  # This is still a local datetime
utc_time_datetime = utc_time.replace(tzinfo=timezone.utc)  # correct time-zone info

local_zone = tz.tzlocal()
hk_time_datetime = utc_time_datetime.astimezone(local_zone)
\`\`\`

#### From Timestamp

No matter which timezone we use, we still get the unique timestamp as below:

\`\`\`python
local = local_time_datetime.timestamp
utc = utc_time_datetime.timestamp

print(local, utc)
# result: 1636597954.126377, 1636597954.126377
\`\`\`

Therefore timestamp is also a good data normalization of time, and the following script will do:

\`\`\`python
local_datetime_obj = datetime.fromtimestamp(timestamp)
\`\`\`

Also note that we have the following conversion as timestamp may be generated from frontend which use javascript:

\`\`\`python
js_timestamp = int(py_timestamp * 1000)
py_timestamp = js_timestamp / 1000
\`\`\`

### Datetime Object Manipulation

#### Timedelta as Summand

Sometimes we want to **_calculate_** the offset time of a given time.

For example in a GPS track recording project, a trip may start at datetime \`start_time\` and end at datetime \`end_time\`. We need GNSS base stations data that are within two hours before \`start_time\` and 1 hour after \`end_time\`, then we do the following operations:

\`\`\`python
from datetime import timedelta

offset_start_time = start_time - timedelta(hours=2)
offset_end_time = end_time + timedelta(hours=1)
\`\`\`

the resulting object is still a \`datetime\` object.

Now we can download the base stations data from Geodetic Survey of Hong Kong (GSHK) by converting them to utc+0 format (we can use \`.astimezone(timezone.utc)\` to generate utc \`datetime\`) and getting the corresponding hours.

#### Timedelta from Subtraction

Since base stations data are not immediately available at the time we stop our trip. We need to check whether the current time (the time we download the differential data) is far enough from datetime object \`end_time\`, say 15 minutes.

\`\`\`python
from datetime import datetime

difference = datetime.now() - end_time  # This is a Timedelta object
diff_in_min = difference.total_seconds() / 60 # difference.seconds is not always what we want

if diff_in_min >= 15:
    # download data
    pass
\`\`\`
`;export{t as default};
