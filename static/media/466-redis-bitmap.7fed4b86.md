---
title: "Redis Bitmap: Statistics Tracking"
date: 2026-03-03
id: blog0466
tag: redis
toc: true
intro: "Master Redis Bitmap for space-efficient boolean tracking. Learn SETBIT, GETBIT, BITPOS, and BITFIELD commands for implementing user activity tracking, login status, and efficient statistics over millions of users with minimal memory usage."
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
  table th:first-child,
  table td:first-child {
    min-width: 200px;
  }
</style>

### What is a Redis Bitmap?

A Redis Bitmap is not a separate data type but a set of bit-oriented operations on Redis Strings. Since strings are binary-safe and can contain up to 512 MB, you can work with 2^32 bits (4,294,967,296 bits or ~536 million bytes).

Key characteristics:

- Each bit can be 0 or 1
- Bits are addressed by offset (position), starting from 0
- Extremely memory-efficient for boolean tracking
- Example: Track 1 million users' daily login status = ~122 KB (1,000,000 bits / 8 bits per byte)

Common use cases:

- User login/activity tracking
- Feature flags for users
- Real-time analytics
- Online/offline status
- Daily active users (DAU) calculation

### Basic Operations: `SETBIT` and `GETBIT`

#### `SETBIT`

Sets the bit at a given offset to 0 or 1.

Syntax:
```text
SETBIT key offset value
```

Parameters:
- `key`: The bitmap key name
- `offset`: Bit position (0-based index)
- `value`: 0 or 1

Returns: Previous bit value at that offset (0 or 1)

Example:

```bash
# Set bit at position 0 to 1
SETBIT user:login:20260301 0 1
# Returns: 0 (previous value was 0)

# Set bit at position 5 to 1
SETBIT user:login:20260301 5 1
# Returns: 0

# Set bit at position 0 again to 1
SETBIT user:login:20260301 0 1
# Returns: 1 (previous value was already 1)

# Set bit at position 5 to 0
SETBIT user:login:20260301 5 0
# Returns: 1 (previous value was 1)
```

Memory allocation:

```bash
# Setting bit at large offset automatically allocates memory
SETBIT user:login:20260301 1000000 1
# Redis allocates enough bytes to hold bit at position 1,000,000
# Memory used: ceil(1000001 / 8) = 125,001 bytes
```

#### `GETBIT`

Returns the bit value at a given offset.

Syntax:
```text
GETBIT key offset
```

Returns: 0 or 1

Example:

```bash
# Set some bits
SETBIT user:login:20260301 10 1
SETBIT user:login:20260301 25 1

# Read bits
GETBIT user:login:20260301 10
# Returns: 1

GETBIT user:login:20260301 25
# Returns: 1

GETBIT user:login:20260301 50
# Returns: 0 (unset bits default to 0)

# Reading beyond allocated memory returns 0
GETBIT user:login:20260301 999999999
# Returns: 0
```
### Examples
#### User Login Status Tracking

Track which users logged in on a specific date. Each user ID maps to a bit offset.

```bash
# Date: March 1, 2026
# User IDs: 100, 250, 1000, 5000 logged in

SETBIT user:login:20260301 100 1
SETBIT user:login:20260301 250 1
SETBIT user:login:20260301 1000 1
SETBIT user:login:20260301 5000 1

# Check if user 100 logged in
GETBIT user:login:20260301 100
# Returns: 1 (yes)

# Check if user 500 logged in
GETBIT user:login:20260301 500
# Returns: 0 (no)

# Check if user 5000 logged in
GETBIT user:login:20260301 5000
# Returns: 1 (yes)
```

Python implementation:

```python
import redis
from datetime import datetime

r = redis.Redis(decode_responses=True)

def mark_user_login(user_id: int, date: str):
    """Mark user as logged in on specific date"""
    key = f"user:login:{date}"
    previous = r.setbit(key, user_id, 1)
    print(f"User {user_id} login on {date} - Previous: {previous}")
    return previous

def check_user_login(user_id: int, date: str) -> bool:
    """Check if user logged in on specific date"""
    key = f"user:login:{date}"
    status = r.getbit(key, user_id)
    return bool(status)

# Usage
date = datetime.now().strftime('%Y%m%d')

mark_user_login(100, date)
mark_user_login(250, date)
mark_user_login(1000, date)

print(check_user_login(100, date))   # True
print(check_user_login(500, date))   # False
print(check_user_login(1000, date))  # True
```

Memory efficiency comparison:

```bash
# Traditional approach: Store user IDs in a Set
SADD user:login:20260301 100 250 1000 5000
MEMORY USAGE user:login:20260301
# Returns: ~500 bytes (overhead per element)

# Bitmap approach: Store as bits
SETBIT user:login:bitmap:20260301 100 1
SETBIT user:login:bitmap:20260301 250 1
SETBIT user:login:bitmap:20260301 1000 1
SETBIT user:login:bitmap:20260301 5000 1
MEMORY USAGE user:login:bitmap:20260301
# Returns: ~650 bytes (625 bytes for 5000 bits + overhead)

# For 1 million users with 50% login rate:
# Set approach: ~500,000 elements × ~50 bytes = ~24 MB
# Bitmap approach: 1,000,000 bits / 8 = 125 KB
# Bitmap is 192x more memory efficient!
```

#### User Statistics - Daily Active Users

Track daily active users across multiple days and calculate statistics.

```bash
# March 1-5, 2026 login data
SETBIT dau:20260301 100 1
SETBIT dau:20260301 200 1
SETBIT dau:20260301 300 1

SETBIT dau:20260302 100 1
SETBIT dau:20260302 300 1
SETBIT dau:20260302 400 1

SETBIT dau:20260303 200 1
SETBIT dau:20260303 300 1
SETBIT dau:20260303 500 1

SETBIT dau:20260304 100 1
SETBIT dau:20260304 200 1
SETBIT dau:20260304 300 1
SETBIT dau:20260304 400 1

SETBIT dau:20260305 100 1
SETBIT dau:20260305 500 1

# Count total active users per day
BITCOUNT dau:20260301
# Returns: 3 (users 100, 200, 300)

BITCOUNT dau:20260302
# Returns: 3 (users 100, 300, 400)

BITCOUNT dau:20260303
# Returns: 3 (users 200, 300, 500)

# Find users active on BOTH March 1 AND March 2
BITOP AND dau:mar1_and_mar2 dau:20260301 dau:20260302
BITCOUNT dau:mar1_and_mar2
# Returns: 2 (users 100 and 300)

# Find users active on March 1 OR March 2
BITOP OR dau:mar1_or_mar2 dau:20260301 dau:20260302
BITCOUNT dau:mar1_or_mar2
# Returns: 4 (users 100, 200, 300, 400)

# Find users active in March 1-5 (union)
BITOP OR dau:march_week1 dau:20260301 dau:20260302 dau:20260303 dau:20260304 dau:20260305
BITCOUNT dau:march_week1
# Returns: 5 (users 100, 200, 300, 400, 500)

# Find users active ALL 5 days (intersection)
BITOP AND dau:active_all_5days dau:20260301 dau:20260302 dau:20260303 dau:20260304 dau:20260305
BITCOUNT dau:active_all_5days
# Returns: 1 (only user 300 logged in all 5 days)
```

Python implementation for analytics:

```python
import redis
from datetime import datetime, timedelta

r = redis.Redis(decode_responses=True)

def calculate_dau(date: str) -> int:
    """Calculate Daily Active Users for a specific date"""
    key = f"dau:{date}"
    return r.bitcount(key)

def calculate_wau(start_date: str, num_days: int = 7) -> int:
    """Calculate Weekly Active Users"""
    keys = []
    start = datetime.strptime(start_date, '%Y%m%d')
    
    for i in range(num_days):
        date = (start + timedelta(days=i)).strftime('%Y%m%d')
        keys.append(f"dau:{date}")
    
    result_key = f"wau:{start_date}"
    r.bitop('OR', result_key, *keys)
    wau = r.bitcount(result_key)
    r.expire(result_key, 3600)  # Expire temporary key in 1 hour
    
    return wau

def calculate_retention(cohort_date: str, check_date: str) -> float:
    """Calculate retention rate from cohort_date to check_date"""
    cohort_key = f"dau:{cohort_date}"
    check_key = f"dau:{check_date}"
    result_key = f"retention:{cohort_date}_to_{check_date}"
    
    # Users active on both days
    r.bitop('AND', result_key, cohort_key, check_key)
    retained = r.bitcount(result_key)
    
    # Total users in cohort
    cohort_size = r.bitcount(cohort_key)
    
    r.expire(result_key, 3600)
    
    if cohort_size == 0:
        return 0.0
    
    return (retained / cohort_size) * 100

# Usage
print(f"DAU on 2026-03-01: {calculate_dau('20260301')}")
print(f"WAU starting 2026-03-01: {calculate_wau('20260301', 7)}")
print(f"Retention from 2026-03-01 to 2026-03-05: {calculate_retention('20260301', '20260305'):.2f}%")
```

### `BITPOS` - Find First Set Bit

Returns the position of the first bit set to 0 or 1.

Syntax:
```text
BITPOS key bit [start [end [BYTE|BIT]]]
```

Parameters:
- `key`: Bitmap key
- `bit`: 0 or 1 (which bit value to find)
- `start`: Optional start offset
- `end`: Optional end offset
- `BYTE|BIT`: Unit for start/end (default: BYTE)

Returns: Position of first bit, or -1 if not found

Examples:

```bash
# Create bitmap
SETBIT mybitmap 0 0
SETBIT mybitmap 1 0
SETBIT mybitmap 2 1
SETBIT mybitmap 10 1
SETBIT mybitmap 100 1

# Find first bit set to 1
BITPOS mybitmap 1
# Returns: 2 (first 1 is at position 2)

# Find first bit set to 0
BITPOS mybitmap 0
# Returns: 0 (first 0 is at position 0)

# Create another bitmap
SETBIT users 0 1
SETBIT users 1 1
SETBIT users 2 1
SETBIT users 5 0

# Find first 0 bit
BITPOS users 0
# Returns: 3 (positions 0,1,2 are 1, position 3 is 0)

# Find first 1 starting from byte 0
BITPOS users 1 0
# Returns: 0
```

Range search:

```bash
# Set bits at various positions
SETBIT range:test 8 1
SETBIT range:test 16 1
SETBIT range:test 24 1

# Find first 1 in byte 0
BITPOS range:test 1 0 0 BYTE
# Returns: 8 (first 1 in byte 0)

# Find first 1 in byte 1
BITPOS range:test 1 1 1 BYTE
# Returns: 8 (byte 1 starts at bit 8)

# Find first 1 in byte 2
BITPOS range:test 1 2 2 BYTE
# Returns: 16 (byte 2 starts at bit 16)
```

Practical example - Find first available slot:

```python
import redis

r = redis.Redis(decode_responses=True)

def find_next_available_slot(key: str) -> int:
    """Find next available slot (first 0 bit) in a bitmap"""
    position = r.bitpos(key, 0)
    if position == -1:
        # All bits are 1, return next position
        length = r.strlen(key)
        return length * 8
    return position

def reserve_slot(key: str) -> int:
    """Reserve next available slot and return its position"""
    slot = find_next_available_slot(key)
    r.setbit(key, slot, 1)
    print(f"Reserved slot {slot}")
    return slot

def release_slot(key: str, slot: int):
    """Release a reserved slot"""
    r.setbit(key, slot, 0)
    print(f"Released slot {slot}")

# Usage
key = "parking:slots"

# Reserve 3 slots
slot1 = reserve_slot(key)  # Returns: 0
slot2 = reserve_slot(key)  # Returns: 1
slot3 = reserve_slot(key)  # Returns: 2

# Release slot 1
release_slot(key, slot1)

# Reserve again
slot4 = reserve_slot(key)  # Returns: 0 (reuses released slot)
```

### `BITFIELD` - Advanced Bitmap Operations

BITFIELD allows you to treat a bitmap as an array of integers of arbitrary bit width. You can set, get, and increment integer values at specific bit offsets.

Syntax:
```text
BITFIELD key [GET type offset] [SET type offset value] [INCRBY type offset increment] [OVERFLOW WRAP|SAT|FAIL]
```

#### Data Types: `u\<N\>` and `i\<N\>`

BITFIELD works with integer types encoded in N bits:

- `u<N>`: Unsigned integer with N bits
  - `u1`: 0 to 1 (1 bit)
  - `u8`: 0 to 255 (8 bits)
  - `u16`: 0 to 65535 (16 bits)
  - `u32`: 0 to 4,294,967,295 (32 bits)
  - Maximum: `u63` (unsigned 63-bit)

- `i<N>`: Signed integer with N bits (two's complement)
  - `i1`: -1 to 0 (1 bit)
  - `i8`: -128 to 127 (8 bits)
  - `i16`: -32768 to 32767 (16 bits)
  - `i32`: -2,147,483,648 to 2,147,483,647 (32 bits)
  - Maximum: `i64` (signed 64-bit)

N represents the number of bits used to encode the integer. For example:
- `u8` uses 8 bits and can store values 0-255
- `i8` uses 8 bits and can store values -128 to 127
- `u3` uses 3 bits and can store values 0-7

#### Subcommand: `SET`

Sets an integer value at a specific bit offset.

Syntax:
```text
BITFIELD key SET type offset value
```

Returns: Previous value at that offset

Example:

```bash
# Set an unsigned 8-bit integer (value 100) at bit offset 0
BITFIELD mykey SET u8 0 100
# Returns: [0] (previous value)

# Set unsigned 8-bit integer at bit offset 8 (next byte)
BITFIELD mykey SET u8 8 200
# Returns: [0]

# Set unsigned 8-bit integer at bit offset 16
BITFIELD mykey SET u8 16 255
# Returns: [0]

# Read current state
BITFIELD mykey GET u8 0 GET u8 8 GET u8 16
# Returns: [100, 200, 255]

# Overwrite first value
BITFIELD mykey SET u8 0 50
# Returns: [100] (previous value was 100)
```

Using different bit widths:

```bash
# Store small values efficiently with u4 (4 bits, range 0-15)
BITFIELD compact SET u4 0 15
# Returns: [0]

BITFIELD compact SET u4 4 12
# Returns: [0]

BITFIELD compact SET u4 8 7
# Returns: [0]

# 3 values stored in 12 bits (1.5 bytes) instead of 12 bytes (3x 32-bit integers)

# Read them back
BITFIELD compact GET u4 0 GET u4 4 GET u4 8
# Returns: [15, 12, 7]
```

#### Subcommand: `GET`

Retrieves an integer value from a specific bit offset.

Syntax:
```text
BITFIELD key GET type offset
```

Returns: Value at that offset

Example:

```bash
# Set some values first
BITFIELD data SET u16 0 1000
BITFIELD data SET u16 16 2000
BITFIELD data SET u16 32 3000

# Get individual values
BITFIELD data GET u16 0
# Returns: [1000]

BITFIELD data GET u16 16
# Returns: [2000]

# Get multiple values in one command
BITFIELD data GET u16 0 GET u16 16 GET u16 32
# Returns: [1000, 2000, 3000]

# Use signed integers
BITFIELD signed SET i8 0 -50
BITFIELD signed SET i8 8 100

BITFIELD signed GET i8 0 GET i8 8
# Returns: [-50, 100]
```

#### Subcommand: `INCRBY`

Increments an integer value at a specific bit offset.

Syntax:
```text
BITFIELD key INCRBY type offset increment
```

Returns: New value after increment

Example:

```bash
# Initialize counter at bit offset 0
BITFIELD counter SET u8 0 10
# Returns: [0]

# Increment by 5
BITFIELD counter INCRBY u8 0 5
# Returns: [15] (10 + 5)

# Increment by 10
BITFIELD counter INCRBY u8 0 10
# Returns: [25] (15 + 10)

# Decrement (negative increment)
BITFIELD counter INCRBY u8 0 -5
# Returns: [20] (25 - 5)

# Multiple operations in one command
BITFIELD counter INCRBY u8 0 5 INCRBY u8 8 3 INCRBY u8 16 -2
# Returns: [25, 3, -2]
```

Overflow behavior with unsigned integers:

```bash
# Set u8 to maximum value (255)
BITFIELD overflow_test SET u8 0 255
# Returns: [0]

# Increment by 1 (overflow!)
BITFIELD overflow_test INCRBY u8 0 1
# Returns: [0] (wraps around to 0 by default)

# Set to 0 and decrement
BITFIELD overflow_test SET u8 0 0
BITFIELD overflow_test INCRBY u8 0 -1
# Returns: [255] (wraps around to max value)
```

#### `OVERFLOW` Handling: `WRAP`, `SAT`, `FAIL`

Controls what happens when an operation would cause overflow or underflow.

Syntax:
```text
BITFIELD key OVERFLOW WRAP|SAT|FAIL ...subsequent operations...
```

Modes:

- `WRAP`: Wrap around on overflow (default behavior)
  - Unsigned: 255 + 1 = 0, 0 - 1 = 255
  - Signed: 127 + 1 = -128, -128 - 1 = 127

- `SAT`: Saturate at min/max value
  - Unsigned: 255 + 1 = 255, 0 - 1 = 0
  - Signed: 127 + 1 = 127, -128 - 1 = -128

- `FAIL`: Return nil and don't modify value
  - Returns null when overflow would occur

Examples:

```bash
# WRAP mode (default)
BITFIELD wrap SET u8 0 255
BITFIELD wrap OVERFLOW WRAP INCRBY u8 0 1
# Returns: [0] (wraps to 0)

BITFIELD wrap SET u8 0 0
BITFIELD wrap OVERFLOW WRAP INCRBY u8 0 -1
# Returns: [255] (wraps to max)

# SAT mode (saturate)
BITFIELD sat SET u8 0 255
BITFIELD sat OVERFLOW SAT INCRBY u8 0 10
# Returns: [255] (saturates at max, doesn't overflow)

BITFIELD sat SET u8 0 0
BITFIELD sat OVERFLOW SAT INCRBY u8 0 -10
# Returns: [0] (saturates at min, doesn't underflow)

# FAIL mode
BITFIELD fail SET u8 0 255
BITFIELD fail OVERFLOW FAIL INCRBY u8 0 1
# Returns: [nil] (operation fails, value unchanged)

BITFIELD fail GET u8 0
# Returns: [255] (value not modified)
```

Signed integer overflow:

```bash
# WRAP with signed integers
BITFIELD signed SET i8 0 127
BITFIELD signed OVERFLOW WRAP INCRBY i8 0 1
# Returns: [-128] (wraps to minimum signed value)

BITFIELD signed SET i8 0 -128
BITFIELD signed OVERFLOW WRAP INCRBY i8 0 -1
# Returns: [127] (wraps to maximum signed value)

# SAT with signed integers
BITFIELD signed SET i8 0 127
BITFIELD signed OVERFLOW SAT INCRBY i8 0 10
# Returns: [127] (saturates at max)

BITFIELD signed SET i8 0 -128
BITFIELD signed OVERFLOW SAT INCRBY i8 0 -10
# Returns: [-128] (saturates at min)
```

Multiple operations with different overflow modes:

```bash
BITFIELD multi SET u8 0 100 SET u8 8 200

# Apply different overflow modes to different operations
BITFIELD multi \
  OVERFLOW WRAP INCRBY u8 0 200 \
  OVERFLOW SAT INCRBY u8 8 100
# Returns: [44, 255]
# (100 + 200 = 300, wraps to 44)
# (200 + 100 = 300, saturates at 255)
```

#### Example: 31-Day User Activity Statistics

Track whether a user was active each day of the month using a single 31-bit bitmap per user. Each bit represents one day.

Setup:

```bash
# User 1000: Active on days 1, 3, 5, 7, 9, 11, 13, 15
SETBIT activity:march:1000 0 1
SETBIT activity:march:1000 2 1
SETBIT activity:march:1000 4 1
SETBIT activity:march:1000 6 1
SETBIT activity:march:1000 8 1
SETBIT activity:march:1000 10 1
SETBIT activity:march:1000 12 1
SETBIT activity:march:1000 14 1

# Check activity
BITCOUNT activity:march:1000
# Returns: 8 (active 8 days)
```

Using BITFIELD for efficient storage and retrieval:

```bash
# Alternative: Store 31 days as a single u31 integer
# Each bit = 1 day, LSB = day 1, MSB = day 31

# Day 1: Set bit 0
# Day 2: Set bit 1
# Day 3: Set bit 2
# ...
# Day 31: Set bit 30

# Example: User active on days 1, 2, 3, 10
# Binary: ...0001000000111 = 519 in decimal

BITFIELD user:1000:march SET u31 0 519

# Get entire month's activity as integer
BITFIELD user:1000:march GET u31 0
# Returns: [519]
```

Increment daily activity counter:

```bash
# Track activity count per day for a user
# Each day gets 8 bits (0-255 activities per day)

# Day 1: User performed 5 activities
BITFIELD user:2000:march:counts SET u8 0 5

# Day 1: User performs 3 more activities
BITFIELD user:2000:march:counts INCRBY u8 0 3
# Returns: [8] (5 + 3)

# Day 2: User performs 10 activities  
BITFIELD user:2000:march:counts INCRBY u8 8 10
# Returns: [10]

# Day 3: User performs 7 activities
BITFIELD user:2000:march:counts INCRBY u8 16 7
# Returns: [7]

# Get all daily counts
BITFIELD user:2000:march:counts \
  GET u8 0 \
  GET u8 8 \
  GET u8 16 \
  GET u8 24 \
  GET u8 32 \
  GET u8 40 \
  GET u8 48
# Returns: [8, 10, 7, 0, 0, 0, 0] (first 7 days)
```

Complete Python implementation for 31-day statistics:

```python
import redis
from datetime import datetime, timedelta

r = redis.Redis(decode_responses=True)

def mark_user_active(user_id: int, year: int, month: int, day: int):
    """Mark user as active on specific day of month"""
    key = f"activity:{year}{month:02d}:{user_id}"
    bit_offset = day - 1  # Day 1 = bit 0, Day 2 = bit 1, etc.
    r.setbit(key, bit_offset, 1)
    print(f"User {user_id} active on day {day}")

def get_monthly_activity(user_id: int, year: int, month: int) -> list:
    """Get list of days user was active in a month"""
    key = f"activity:{year}{month:02d}:{user_id}"
    active_days = []
    
    for day in range(1, 32):  # Days 1-31
        bit_offset = day - 1
        is_active = r.getbit(key, bit_offset)
        if is_active:
            active_days.append(day)
    
    return active_days

def count_active_days(user_id: int, year: int, month: int) -> int:
    """Count total active days in month"""
    key = f"activity:{year}{month:02d}:{user_id}"
    # Count set bits (up to bit 30 for 31 days)
    return r.bitcount(key)

def get_activity_as_integer(user_id: int, year: int, month: int) -> int:
    """Get entire month activity as single integer using BITFIELD"""
    key = f"activity:{year}{month:02d}:{user_id}"
    result = r.bitfield(key, 'GET', 'u31', 0)
    return result[0] if result else 0

def increment_daily_counter(user_id: int, year: int, month: int, day: int, count: int = 1):
    """Increment activity counter for specific day (using u8 per day)"""
    key = f"activity:counts:{year}{month:02d}:{user_id}"
    bit_offset = (day - 1) * 8  # Each day uses 8 bits
    result = r.bitfield(key, 'INCRBY', 'u8', bit_offset, count)
    return result[0]

def get_daily_counters(user_id: int, year: int, month: int, num_days: int = 31) -> list:
    """Get activity counters for all days in month"""
    key = f"activity:counts:{year}{month:02d}:{user_id}"
    
    # Build BITFIELD command with GET for each day
    operations = []
    for day in range(num_days):
        bit_offset = day * 8
        operations.extend(['GET', 'u8', bit_offset])
    
    if operations:
        result = r.bitfield(key, *operations)
        return result
    return []

# Usage Example
user_id = 1000
year = 2026
month = 3

# Mark user active on some days
for day in [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]:
    mark_user_active(user_id, year, month, day)

# Get statistics
active_days = get_monthly_activity(user_id, year, month)
print(f"User {user_id} was active on days: {active_days}")
print(f"Total active days: {count_active_days(user_id, year, month)}")

activity_int = get_activity_as_integer(user_id, year, month)
print(f"Activity as integer: {activity_int}")
print(f"Activity as binary: {bin(activity_int)}")

# Track daily activity counts
for day in range(1, 8):
    count = (day * 3) % 10  # Random activity count
    new_total = increment_daily_counter(user_id, year, month, day, count)
    print(f"Day {day}: {count} activities (total: {new_total})")

# Get all daily counters
counters = get_daily_counters(user_id, year, month, 7)
print(f"First 7 days activity counts: {counters}")
```

Output:
```text
User 1000 active on day 1
User 1000 active on day 3
User 1000 active on day 5
User 1000 active on day 7
User 1000 active on day 9
User 1000 active on day 11
User 1000 active on day 13
User 1000 active on day 15
User 1000 active on day 17
User 1000 active on day 19
User 1000 active on day 21
User 1000 active on day 23
User 1000 active on day 25
User 1000 active on day 27
User 1000 active on day 29
User 1000 active on day 31
User 1000 was active on days: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]
Total active days: 16
Activity as integer: 1431655765
Activity as binary: 0b1010101010101010101010101010101
Day 1: 3 activities (total: 3)
Day 2: 6 activities (total: 6)
Day 3: 9 activities (total: 9)
Day 4: 2 activities (total: 2)
Day 5: 5 activities (total: 5)
Day 6: 8 activities (total: 8)
Day 7: 1 activities (total: 1)
First 7 days activity counts: [3, 6, 9, 2, 5, 8, 1]
```

### Summary

Redis Bitmaps provide memory-efficient boolean tracking through bit-level operations:

Core commands:
- `SETBIT`: Set individual bits
- `GETBIT`: Read individual bits  
- `BITCOUNT`: Count set bits
- `BITPOS`: Find first 0 or 1 bit
- `BITOP`: Perform AND, OR, XOR, NOT operations
- `BITFIELD`: Work with multi-bit integers

Key advantages:
- Extreme memory efficiency (1 bit per boolean)
- Fast bitwise operations
- Track millions of users with minimal memory
- Atomic operations for concurrent access

Common patterns:
- User activity tracking (daily, weekly, monthly)
- Feature flags and permissions
- Real-time analytics (DAU, MAU, retention)
- Resource allocation (parking slots, seats)
- A/B testing cohorts

`BITFIELD` use cases:
- Compact integer arrays
- Activity counters with overflow protection
- Multi-day statistics in single key
- Space-efficient time series data