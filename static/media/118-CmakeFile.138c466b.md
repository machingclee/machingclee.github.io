---
title: "On CMake Files"
date: 2022-12-15
id: blog0118
tag: C++
intro: "Record some experience and the `CMakeLists.txt`'s that I have used "
---

#### Resource to Learn CMake

- [An Introduction to Modern CMake](https://cliutils.gitlab.io/modern-cmake/)

#### Common Commands

- ```cmake
  add_library(one two.cpp three.h)
  ```

  - Declare a library called `one`, and list all sources files to be compiled. Only the compilation unit `two.cpp` will be compiled, we include the headers **_for IDE only_**.

- ```cmake
  # one/CMakeLists.txt
  target_include_directories(one PUBLIC include)
  ```

  - It tells CMake our target, the library `one` will need files in the directory `include` in compilation process. For example we might have used `#include "include/one/four.hpp"` in `one/main.cpp`.

- ```cmake
  target_link_libraries(another PUBLIC one)
  ```

  - This is to build dependency between different targets. Which means that the target `another` and its downstream linkers will need library `one` in the compilation process.

  - Ya we have included the `include` directory but very likely it just contains function declarations, will need the function body definitions by linking those libraries (and as seen above, we have mentioned them in our `add_library`).

  - if `PUBLIC` is replaced by `PRIVATE`, it indicates that the downstream linkers of `another` do not need the library `one`, and `another` is the only target that needs `one`.

Naively speaking, `target_include_directories` is for IDE, and `target_link_libraries` is for compiler.

- ```cmake
  set(
    SOME_CONSTANT
    ""  # <value>
    CACHE
    STRING
    "Description of the cached constant"
  )
  ```

  - `SOME_CONSTANT` is the variable name.
  - We set `""` as a default value.
  - The value `<value>` can also be passed by `-D` argument:

    ```none
    cmake -B build -DSOME_CONSTANT=ABCDEFG
    ```

  - `STRING` defined the data type of the cached value `<value>`.

- ```cmake
  if(SOME_CONSTANT STREQUAL "")
    message(SEND_ERROR "SOME_CONSTANT" must not be empty)
  endif()
  ```

  - This is a standard if statement.

- ```cmake
  target_compile_definitions(one PRIVATE SOME_CONSTANT="${SOME_CONSTANT}")
  ```

  - Target library `one` we have a constant `SOME_CONSTANT` defined by using `#define` in the header.

- ```cmake
  target_compile_features(one INTERFACE cxx_std_20)
  ```
  - Require specific feature for a target.

#### CMake Examples

##### ChatClient TCP Server

###### Repo and Video

The whole project implementes a chatting function between multiple clients.

- [Repo Link](https://github.com/machingclee/2022-12-12-CMake-TCP-Server-Study)
- [Video Link](https://www.youtube.com/watch?v=Bz38jjFB3H8)

This blog post focuses on the `CMakeLists.txt` files.

###### Outermost CMakeLists.txt, the Project Level

<Center>
<img src="/assets/tech/118-cmake/outermost.png"/>
</Center>

<p/>

```cmake
cmake_minimum_required(VERSION 3.22.2)
set(CMAKE_CXX_STANDARD 20)

add_subdirectory(MOYFNetworking)
add_subdirectory(MOYFClient)
add_subdirectory(MOYFServer)
```

###### The Main Library: Networking

<Center>
<img src="/assets/tech/118-cmake/networking.png"/>
</Center>

```cmake
cmake_minimum_required(VERSION 3.22.2)
project(MOYFNetworking)

set(CMAKE_CXX_STANDARD 20)

set(BOOST_ROOT "C:\\Users\\user\\Repos\\C++Libraries\\boost_1_80_0")


find_package(Boost REQUIRED)
file(GLOB_RECURSE SOURCES src/*.cpp)
add_library(${PROJECT_NAME} ${SOURCES})

# this says when building ${PROJECT_NAME} library, what follows must also be included
target_include_directories(
  ${PROJECT_NAME}
  PUBLIC
    $<INSTALL_INTERFACE:include>
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    ${Boost_INCLUDE_DIRS}
  PRIVATE
)

# PRIVATE means downstream linkers that link to ${PROJECT_NAME}
# library will not have access to ${Boost_LIBRARIES}
# in other words, ${Boost_LIBRARIES} is
# only used by the library ${PROJECT_NAME}.

# If PRIVATE is replaced by PUBLIC, the downstream linkers that links
# ${PROJECT_NAME} will be able to use those libraries (${Boost_LIBRARIES} in this case).
target_link_libraries(
  ${PROJECT_NAME} PRIVATE
  ${Boost_LIBRARIES}
)
```

###### NetClient

<Center>
<img src="/assets/tech/118-cmake/client.png"/>
</Center>

<p/>

```cmake
cmake_minimum_required(VERSION 3.22.2)
project(MOYFClient)

set(CMAKE_CXX_STANDARD 20)

add_executable(${PROJECT_NAME} main.cpp)

target_include_directories(
  ${PROJECT_NAME} PUBLIC
    MOYFNetworking
)
target_link_libraries(
  ${PROJECT_NAME} PUBLIC
    MOYFNetworking
)
```

###### NetServer

<Center>
<img src="/assets/tech/118-cmake/server.png"/>
</Center>

```cmake
cmake_minimum_required(VERSION 3.22.2)
project(MOYFServer)

set(CMAKE_CXX_STANDARD 20)

add_executable(${PROJECT_NAME} main.cpp)

target_include_directories(
  ${PROJECT_NAME} PUBLIC
  MOYFNetworking
)
target_link_libraries(
  ${PROJECT_NAME} PUBLIC
  MOYFNetworking
  ws2_32
)
```

##### Examples from Other Project

###### Sockets

> **Repo.** https://github.com/rhymu8354/SocketTutorial

<center></center>

This is a `CMakeLists.txt` file inside a directory called `Sockets`.

```cmake-1
set(This Sockets)
set(Sources
    include/Sockets/ClientSocket.hpp
    include/Sockets/DatagramSocket.hpp
    include/Sockets/ServerSocket.hpp
    src/Abstractions.hpp
    src/ClientSocket.cpp
    src/Connection.hpp
    src/Connection.cpp
    src/DatagramSocket.cpp
    src/ServerSocket.cpp
)
if(MSVC)
    list(APPEND Sources
        src/AbstractionsWin32.cpp
    )
else()
    list(APPEND Sources
        src/AbstractionsPosix.cpp
        src/PipeSignal.cpp
        src/PipeSignal.hpp
    )
endif()

add_library(${This} ${Sources})
set_target_properties(${This} PROPERTIES FOLDER Libraries)
target_include_directories(${This} PUBLIC include)
if(UNIX)
    target_link_libraries(${This} PUBLIC pthread)
endif(UNIX)
```

From the section [The-Main-Library:-Networking](#The-Main-Library:-Networking) we have read a use case

```cmake
file(GLOB_RECURSE SOURCES src/*.cpp)
```

and plugged this into `add_library`. However, the [Do's and Don'ts](https://cliutils.gitlab.io/modern-cmake/chapters/intro/dodonot.html) states that **_Don't GLOB files_** because:

> Make or another tool will not know if you add files without rerunning CMake. Note that CMake 3.12 adds a `CONFIGURE_DEPENDS` flag that makes this far better if you need to use it.

In other words, listing the source files explicitly will be a better practice.

#### Special Functions to Check Variables in CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.22)

project(CMakeTutorial LANGUAGES CXX)
set(FOO "test")

add_executable(CMakeTutorial main.cpp)

function(print)
  foreach(var ${ARGN})
    message("[${var}]: ${${var}}")
  endforeach()
endfunction()

function(print_env)
  foreach(var ${ARGN})
    message("[${var}]: $ENV{${var}}")
  endforeach()
endfunction()

print(PROJECT_NAME FOO)
```

- The `print` function will print defined constant and `print_env` will print the defined environment variable.

#### Cross Platform Built Command

##### Source of Study

- [An Introduction to Mdern CMake](https://cliutils.gitlab.io/modern-cmake/)

##### How to Build a CMake Project

```text
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64 -DCMAKE_BUILD_TYPE=Debug
VERBOSE=1 cmake --build .
```

##### How to Know Which Generator (specified by `-G`) is Available?

By

```text
cmake --help
```

apart from the list of available arguments, it also prints a list of available generators for us.

In my case, I get

```none
  Visual Studio 17 2022        = Generates Visual Studio 2022 project files.
                                 Use -A option to specify architecture.
  Visual Studio 16 2019        = Generates Visual Studio 2019 project files.
                                 Use -A option to specify architecture.
  Visual Studio 15 2017 [arch] = Generates Visual Studio 2017 project files.
                                 Optional [arch] can be "Win64" or "ARM".
  Visual Studio 14 2015 [arch] = Generates Visual Studio 2015 project files.
                                 Optional [arch] can be "Win64" or "ARM".
  Visual Studio 12 2013 [arch] = Generates Visual Studio 2013 project files.
                                 Optional [arch] can be "Win64" or "ARM".
  Visual Studio 11 2012 [arch] = Generates Visual Studio 2012 project files.
                                 Optional [arch] can be "Win64" or "ARM".
  Visual Studio 10 2010 [arch] = Deprecated.  Generates Visual Studio 2010
                                 project files.  Optional [arch] can be
                                 "Win64" or "IA64".
  Visual Studio 9 2008 [arch]  = Generates Visual Studio 2008 project files.
                                 Optional [arch] can be "Win64" or "IA64".
  Borland Makefiles            = Generates Borland makefiles.
  NMake Makefiles              = Generates NMake makefiles.
  NMake Makefiles JOM          = Generates JOM makefiles.
  ...
```
