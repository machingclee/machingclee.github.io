const n=`---
title: Multi-Threading
date: 2021-10-27
id: blog036
tag: python
wip: true
toc: false
intro: wip
---

\`\`\`python
import time
from threading import Event, Thread, Lock

counter = []
thread_lock = Lock()


"""
threading.Lock is to make sure no two of the locked tasks can be
run at the same time

Lock may help in racing condition
in this case we put the acquire and release inside for loop
"""

event = Event()


def count(n, interval=0.2):
    thread_lock.acquire()

    for i in range(n):
        counter.append(f"1-{i}")
        print(f"count1: append {i} to counter")
        time.sleep(interval)

    print("thread count done, release thread")
    thread_lock.release()


def count2(n, interval=0.4):
    thread_lock.acquire()
    thread_lock.release()
    for i in range(n):
        counter.append(f"2-{i}")
        print(f"count2: append {i} to counter")
        time.sleep(interval)


def count3(n, interval=0.4):
    thread_lock.acquire()
    thread_lock.release()
    for i in range(n):
        counter.append(f"3-{i}")
        print(f"count3: append {i} to counter")
        time.sleep(interval)


def test_threading():
    # both count2, count3 wait for count1
    # count2, count3 emit at the same time,
    event.wait()

    t1 = Thread(target=count, args=(10,))
    t2 = Thread(target=count2, args=(5,))
    t3 = Thread(target=count3, args=(5,))
    t1.start()
    t2.start()
    t3.start()
    t1.join()
    t2.join()
    t3.join()

    print(counter)


Thread(target=test_threading).start()
print("event will be trigger after 5 seconds")

for i in range(5):
    print(5-i)
    time.sleep(1)

event.set()
\`\`\`
`;export{n as default};
