---
title: "ChatClient TCP Server: CMake Files Record"
date: 2022-12-15
id: blog0118
tag: C++
intro: "Record the CMakeList.txt that I have used."
---

#### Repo and Video

The whole project implementes a chatting function between multiple clients.

- [Repo Link](https://github.com/machingclee/2022-12-12-CMake-TCP-Server-Study)
- [Video Link](https://www.youtube.com/watch?v=Bz38jjFB3H8)

This blog post focuses on the `CMakeLists.txt` files.

#### Outermost CMakeLists.txt, the Project Level

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

#### The Main Library: Networking

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

#### NetClient

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

#### NetServer

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
