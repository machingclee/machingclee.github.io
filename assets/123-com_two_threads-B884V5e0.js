const n=`---
title: "Commuication Between Two Threads"
date: 2023-02-27
id: blog0123
tag: C++
intro: "Discuss how two threads communiate with each other."
---

# Conditional Variable

We intentionally init a \`write_thread\`, sleep for 2s, and the init a \`read_thread\` to make sure \`write_thread\` has made notification before the \`read_thread\` wait for it.

Without the boolean \`condition\`, the \`read_thread\` will wait indefinitely and we need to close the program forcefully, which is called a **lost wakeup**. This can be solved by introducing a shared boolean \`condition\` (which will be locked by our mutex \`guard\`, no data race)

Then \`cv.wait(guard, [] { return condition; })\`, apart form waiting for \`cv.notify_one\`, will also check whether the notification as been published (by checking \`condition\`).

\`\`\`cpp
#include <iostream>
#include <thread>
#include <condition_variable>
#include <string>

using namespace std;
using namespace std::chrono;

// Global variables
mutex mut;
condition_variable cv;
string sdata{"Empty"};
bool condition{false};

// Waiting thread
void reader() {
    unique_lock<std::mutex> guard(mut);       // Acquire lock
    cv.wait(guard, [] { return condition; }); // Wait for condition variable to be notified
    cout << "Data is " << sdata << endl;      // Wake up and use the new value
}

// Modyifing thread
void writer() {
    cout << "Writing data..." << endl;
    {
        lock_guard<std::mutex> lg(mut);  // Acquire lock
        std::this_thread::sleep_for(1s); // Pretend to be busy...
        sdata = "Populated";
        condition = true; // Modify the data
    }
    cv.notify_one(); // Notify the condition variable
}

int main() {
    cout << "Data is " << sdata << endl;

    thread write_thread{writer};
    std::this_thread::sleep_for(2s);
    thread read_thread{reader};

    write_thread.join();
    read_thread.join();
}
\`\`\`

# Promise and Future

\`\`\`cpp
#include <future>
#include <iostream>
#include <thread>

using namespace std;

void produce(promise<int>& px) { // Producer function with promise
    int x{42};
    this_thread::sleep_for(1s);
    cout << "Promise sets shared state to " << x << endl;
    px.set_value(x); // Set the result
}

void consume(future<int>& fx) { // Consumer function with future
    cout << "Future calling get()..." << endl;
    int x = fx.get(); // Get the result
    cout << "Future returns from calling get()" << endl;
    cout << "The answer is " << x << endl;
}

int main() {
    promise<int> p;
    future<int> f = p.get_future();

    thread prom{produce, std::ref(p)};
    thread fut{consume, std::ref(f)};

    fut.join();
    prom.join();
}
\`\`\`
`;export{n as default};
