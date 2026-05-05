const n=`---
title: Simple Introduction to CMake Files
date: 2022-12-15
id: blog0118
tag: C++
intro: "Record some experience and the \`CMakeLists.txt\`'s that I have used."
---

### Resource to Learn CMake

- [An Introduction to Modern CMake](https://cliutils.gitlab.io/modern-cmake/)

### Starting Template

\`\`\`cmake
cmake_minimum_required(VERSION 3.22)

set(This SuperHelloWorld)

project(
    \${This}
    VERSION 1.0.0
    LANGUAGES C CXX
)

list(APPEND CMAKE_MODULE_PATH \${CMAKE_BINARY_DIR})
list(APPEND CMAKE_PREFIX_PATH \${CMAKE_BINARY_DIR})

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARDCONFIGURED_FILE_INCLUDE_DIR_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(LIBRARY_MY_LIB my_lib)
set(EXE_APP app)

# include(FetchContent)
add_subdirectory(src)

# message("Using FetchContent")
# FetchContent_Declare(
#     nlohmann_json
#     GIT_REPOSITORY https://github.com/nlohmann/json.git
#     GIT_TAG v3.11.2
#     GIT_SHALLOW TRUE
# )
# FetchContent_MakeAvailable(nlohmann_json)
\`\`\`

### Common Commands

- \`\`\`cmake
  add_library(one two.cpp three.h)
  \`\`\`

  - Declare a target called \`one\` that refers to the current directory, and list all sources files to be compiled. Only the compilation unit \`two.cpp\` will be compiled, we include the headers **_for IDE only_**.

- \`\`\`cmake
  add_executable(\${THIS}_exe main.cpp)
  \`\`\`

  - Same as \`add_library\`, it adds a target that refers to the current directory, and that target points to an executable.
  - We cannot use \`add_library\` and \`add_target\` at the same time. In other words, we should separate \`main.cpp\` and "source files" in separate folder.

  - For example, we can separate like
    - \`some_proj/app/main.cpp\` and
    - \`some_proj/src/some_lib/some_file.cpp\`
      Then write
    - \`some_proj/app/CMakeLists.txt\`
    - \`some_proj/src/CMakeLists.txt\`
    - \`some_proj/src/some_lib/CMakeLists.txt\` separately.
      Note that \`some_proj/src/CMakeLists.txt\` can be as simple as just one line
    \`\`\`cmake
    add_subdirectory(some_lib)
    \`\`\`
    as it helps point out which directory contains a \`CMakeLists.txt\` to look at.

- \`\`\`cmake
  add_subdirectory(src)
  \`\`\`

  - It tells cmake compiler which directory to look for and execute a \`CMakeLists.txt\`. If the directory \`src\` contains no \`CMakeLists.txt\` file, \`cmake\` will give an exception.

- \`\`\`cmake
  # src/one/CMakeLists.txt
  target_include_directories(one PUBLIC ../../include)
  \`\`\`

  - It tells cmake our source files in the target \`one\` have included header files in **_other diectory_** such as \`../../include\`.
  - We don't need to include it again in other target that links to \`one\`, by simply \`target_link_libraries\` (we introduce it right below) we can directly include header files in source code that \`one\` have already included.
  - If the include dir contains \`include/four/five.h\`, then we can include \`four/five.h\` in our source code.

    Note that the string to include our header file is independent of the target name we name in cmake.

  - In general, \`target_include_directories\` is used when the header files are from other directory.

- \`\`\`cmake
  target_link_libraries(another PUBLIC one)
  \`\`\`

  - This is to build dependency between different targets. Which means that the target \`another\` and its downstream linkers will need library \`one\` in the compilation process.

  - Ya we have included the \`include\` directory but very likely it just contains function declarations, we need the function body definitions by linking those libraries $\\iff$ linking the source files.

  - if \`PUBLIC\` is replaced by \`PRIVATE\`, it indicates that the downstream linkers of \`another\` do not need the library \`one\`, and \`another\` is the only target that needs \`one\`.

- \`\`\`cmake
  target_compile_definitions(one PRIVATE SOME_CONSTANT="\${SOME_CONSTANT}")
  \`\`\`

  - Target library \`one\` we have a constant \`SOME_CONSTANT\` defined by using \`#define\` in the header.

- \`\`\`cmake
  target_compile_features(one INTERFACE cxx_std_20)
  \`\`\`

  - Require specific feature for a target.

- \`\`\`cmake
  set(
    SOME_CONSTANT
    ""  # <value>
    CACHE
    STRING
    "Description of the cached constant"
  )
  \`\`\`

  - \`SOME_CONSTANT\` is the variable name.
  - We set \`""\` as a default value.
  - The value \`<value>\` can also be passed by \`-D\` argument:

    \`\`\`none
    cmake -B build -DSOME_CONSTANT=ABCDEFG
    \`\`\`

  - \`STRING\` defined the data type of the cached value \`<value>\`.

- \`\`\`cmake
  if(SOME_CONSTANT STREQUAL "")
    message(SEND_ERROR "SOME_CONSTANT" must not be empty)
  endif()
  \`\`\`

  - This is a standard if statement.

- \`\`\`cmake
  option(COMPILE_EXECUTABLE "Whether to compile to executable" OFF)
  \`\`\`

  - It defines a boolean for cmake files to use.
  - We can pass this variable in command line by
    \`\`\`text
    cmake .. -DCOMPILE_EXECUTABLE=ON
    \`\`\`

### Include Predefined CMake Functions

Usually every cmake project contains a \`cmake/\` folder that contains custom cmake script:

\`\`\`cmake
# project_root/CMakeLists.txt
set(CMAKE_MODULE_PATH "\${PROJECT_SOURCE_DIR}/cmake/")
include(AddGitSubModule)
\`\`\`

- \`CMAKE_MODULE_PATH\` points to that cmake folder
- \`include\` is used to include the cmake file \`cmake/AddGitSubmodule.cmake\`.
  Exmaple of a \`.cmake\` file:

\`\`\`cmake
# project_root/cmake/AddGitSubmodule.cmake
function(add_git_submodule install_destination)
    find_package(Git REQUIRED)

    if (NOT EXISTS \${install_destination}/CMakeLists.txt)
        execute_process(COMMAND \${GIT_EXECUTABLE}
            submodule update --init --recursive -- \${install_destination}
            WORKING_DIRECTORY \${PROJECT_SOURCE_DIR}
        )
    endif()

    add_subdirectory(\${dir})
endfunction(add_git_submodule)
\`\`\`

### Which Folder to Create \`CMakeLists.txt\`?

- **Root directory.**
  - Set all necessary variables and add appropriate \`add_subdirectory\`'s to look for \`CMakeLists.txt\`.
- **Source file directory \`src\`.**
  - It can consists of simply the \`add_subdirectory\` commands.
- **Source file subdirectories \`src/one\`, \`src/two\`, ....**
  - Each of the subdirectory should consists of \`add_library\` for linkage and \`target_include_directories\` to include corresponding header files.
  - If the project structure is simpler, the rules to \`src/<lib_name>/CMakeLists.txt\` can be moved down to \`src/CMakeLists.txt\`.
- **Directory that does not need \`CMakeLists.txt\`.**
  - Directory that contains just header files **_needs no_** \`CMakeLists.txt\`, as they will be included in \`target_include_directories\` somewhere else once needed.

### Show all Constants in a CMake Project

\`\`\`cmake
cmake -LAH
\`\`\`

### Special Functions to Check Variables in CMakeLists.txt

\`\`\`cmake
cmake_minimum_required(VERSION 3.22)

project(CMakeTutorial LANGUAGES CXX)
set(FOO "test")

add_executable(CMakeTutorial main.cpp)

function(print)
  foreach(var \${ARGN})
    message("[\${var}]: \${\${var}}")
  endforeach()
endfunction()

function(print_env)
  foreach(var \${ARGN})
    message("[\${var}]: $ENV{\${var}}")
  endforeach()
endfunction()

print(PROJECT_NAME FOO)
\`\`\`

- The \`print\` function will print defined constant and \`print_env\` will print the defined environment variable.

### Graph Visualization of Dependencies Between \`cmake\` Files

#### Install \`graphviz\`

For windows we can download a \`.msi\` file for installation [HERE](http://www.graphviz.org/). For mac we run \`brew install graphviz\`.

#### MakeFile

##### Scrips

We create a file called \`MakeFile\`:

\`\`\`makefile
# MakeFile
dependency:
	cd build && cmake .. --graphviz=graph.dot && \\
    dot -Tpng graph.dot -o ../dep_graph.png
prepare:
	rm -rf build
	mkdir build
\`\`\`

and run \`cmake dependency\`.

The \`prepare\` script is also included here, it is a default command that can be run by simply calling \`cmake\`.

From my own experience on a simple hello-world project I have:

<Center>
<a href="/assets/tech/118-cmake/dep_graph.png" target="_blank">
<img width="680" src="/assets/tech/118-cmake/dep_graph.png"/>
</a>
</Center>

##### Cmake Erorr: \`incompatible versions of the cygwin DLL\`

It is a known problem in windows, go to \`C:\\Program Files\\Git\\usr\\bin\` and rename \`msys-2.0.dll\` to \`_msys-2.0.dll\` to temporarily mitigate the problem.

Later you may need to rename it back since it affects commands such as \`npm\` and \`yarn\`.

### Cross Platform Built Command

#### Source of Study

- [An Introduction to Mdern CMake](https://cliutils.gitlab.io/modern-cmake/)

#### How to Build a CMake Project

\`\`\`text
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64 -DCMAKE_BUILD_TYPE=Debug
VERBOSE=1 cmake --build .
\`\`\`

#### How to Know Which Generator (specified by \`-G\`) is Available?

By

\`\`\`text
cmake --help
\`\`\`

apart from the list of available arguments, it also prints a list of available generators for us.

In my case, I get

\`\`\`none
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
\`\`\`

### External Library (CMake Project)

#### By Direct Cloning

\`\`\`text
git submodule add https://target/repo.git external/some_name
\`\`\`

and then \`add_subdirectory(external/some_name)\` to seek for and execute the \`CMakeLists.txt\`.

#### By FetchContent

By adding \`include(FetchContent)\` in our \`CMakeLists.txt\` we can import functions

- \`FetchContent_Declare\`
- \`FetchContent_MakeAvailable\`

For example, suppose that we want to import the following CMake projects hosted in github:

\`\`\`cmake
include(FetchContent)

FetchContent_Declare(
    nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.2
    GIT_SHALLOW TRUE
)
FetchContent_Declare(
    fmt
    GIT_REPOSITORY https://github.com/fmtlib/fmt
    GIT_TAG 9.1.0
    GIT_SHALLOW TRUE
)
FetchContent_Declare(
    spdlog
    GIT_REPOSITORY https://github.com/gabime/spdlog
    GIT_TAG v1.11.0
    GIT_SHALLOW TRUE
)
FetchContent_Declare(
    cxxopts
    GIT_REPOSITORY https://github.com/jarro2783/cxxopts
    GIT_TAG v3.0.0
    GIT_SHALLOW TRUE
)
FetchContent_Declare(
    Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2
    GIT_TAG v2.13.9
    GIT_SHALLOW TRUE
)

FetchContent_MakeAvailable(nlohmann_json)
FetchContent_MakeAvailable(fmt)
FetchContent_MakeAvailable(spdlog)
FetchContent_MakeAvailable(cxxopts)
FetchContent_MakeAvailable(Catch2)
\`\`\`

where the \`GIT_TAG\` can be found in the release page of the corresponding repository. These library will be downloaded in \`build/_deps\` directory when we execute cmake build command.

To let our target (executable target or library target) link to these library, we run

\`\`\`cmake
target_link_libraries(
    \${LIBRARY_MY_LIB}
PUBLIC
    cxxopts::cxxopts
    nlohmann_json::nlohmann_json
    fmt::fmt
    spdlog::spdlog
    Catch2::Catch2
)
\`\`\`

The naming convention of the target is

- \`<project_name>:<library_name>\`
  The \`<project_name>\` and \`<library_name>\` can be traced by looking the \`CMakeLists.txt\` of the repo.

Now our target \`LIBRARY_MY_LIB\` or any target that links to it can run the following preprocessor directives:

\`\`\`cpp
#include "nlohmann/json.hpp"
#include "cxxopts.hpp"
#include "fmt/format.h"
#include "spdlog/spdlog.h"
#include "catch2/catch.hpp"
\`\`\`

#### By \`conan\`

##### Files to Create

Create a virtual environment in Python, which I name it \`conan\`, then \`conda activate conan\` and \`pip install conan\`.

As if \`requirements.txt\` in Python we have an analog in conan, we create a text file \`conanfile.txt\` in project root and add the following content:

- \`project_root/conanfile.txt\`

  \`\`\`conan
  [requires]
  nlohmann_json/3.11.2
  fmt/9.1.0
  spdlog/1.11.0
  catch2/2.13.9
  cxxopts/3.0.0

  [generators]
  cmake_find_package
  cmake_paths
  \`\`\`

- \`project_root/CMakeLists.txt\`
  \`\`\`cmake
  message("Using Conan")
  include(\${CMAKE_BINARY_DIR}/conan_paths.cmake)
  find_package(nlohmann_json)
  find_package(fmt)
  find_package(spdlog)
  find_package(Catch2)
  find_package(cxxopts)
  \`\`\`

In \`Makefile\` of project root directory we add

\`\`\`text
ifeq '$(findstring ;,$(PATH))' ';'
  CONAN_FLAGS = -s compiler='Visual Studio' -s compiler.version=17 -s cppstd=20 --build missing
else
  CONAN_FLAGS = -s cppstd=17 --build missing
endif

prepare_conan:
	rm -rf build
	mkdir build
	cd build && conan install .. $(CONAN_FLAGS)
\`\`\`

and run \`make prepare_conan\`.

##### Remarks to \`conan\`

I myself fail to work with \`conan\` in windows, maybe unix based system can make it work.

In general the database of \`conan\` usually lag behind to the latest release for at least half year, it is suggested not to use it when \`FetchContent\` suffices to serve the purpose.

### CMake Examples

#### ChatClient TCP Server

##### Repo and Video

The whole project implementes a chatting function between multiple clients.

- [Repo Link](https://github.com/machingclee/2022-12-12-CMake-TCP-Server-Study)
- [Video Link](https://www.youtube.com/watch?v=Bz38jjFB3H8)

This blog post focuses on the \`CMakeLists.txt\` files.

##### Outermost CMakeLists.txt, the Project Level

<Center>
<img src="/assets/tech/118-cmake/outermost.png"/>
</Center>

<p/>

\`\`\`cmake
cmake_minimum_required(VERSION 3.22.2)
set(CMAKE_CXX_STANDARD 20)

add_subdirectory(MOYFNetworking)
add_subdirectory(MOYFClient)
add_subdirectory(MOYFServer)
\`\`\`

##### The Main Library: Networking

<Center>
<img src="/assets/tech/118-cmake/networking.png"/>
</Center>

\`\`\`cmake
cmake_minimum_required(VERSION 3.22.2)
project(MOYFNetworking)

set(CMAKE_CXX_STANDARD 20)

set(BOOST_ROOT "C:\\\\Users\\\\user\\\\Repos\\\\C++Libraries\\\\boost_1_80_0")


find_package(Boost REQUIRED)
file(GLOB_RECURSE SOURCES src/*.cpp)
add_library(\${PROJECT_NAME} \${SOURCES})

# this says when building \${PROJECT_NAME} library, what follows must also be included
target_include_directories(
  \${PROJECT_NAME}
  PUBLIC
    $<INSTALL_INTERFACE:include>
    $<BUILD_INTERFACE:\${CMAKE_CURRENT_SOURCE_DIR}/include>
    \${Boost_INCLUDE_DIRS}
  PRIVATE
)

# PRIVATE means downstream linkers that link to \${PROJECT_NAME}
# library will not have access to \${Boost_LIBRARIES}
# in other words, \${Boost_LIBRARIES} is
# only used by the library \${PROJECT_NAME}.

# If PRIVATE is replaced by PUBLIC, the downstream linkers that links
# \${PROJECT_NAME} will be able to use those libraries (\${Boost_LIBRARIES} in this case).
target_link_libraries(
  \${PROJECT_NAME} PRIVATE
  \${Boost_LIBRARIES}
)
\`\`\`

##### NetClient

<Center>
<img src="/assets/tech/118-cmake/client.png"/>
</Center>

<p/>

\`\`\`cmake
cmake_minimum_required(VERSION 3.22.2)
project(MOYFClient)

set(CMAKE_CXX_STANDARD 20)

add_executable(\${PROJECT_NAME} main.cpp)

target_include_directories(
  \${PROJECT_NAME} PUBLIC
    MOYFNetworking
)
target_link_libraries(
  \${PROJECT_NAME} PUBLIC
    MOYFNetworking
)
\`\`\`

##### NetServer

<Center>
<img src="/assets/tech/118-cmake/server.png"/>
</Center>

\`\`\`cmake
cmake_minimum_required(VERSION 3.22.2)
project(MOYFServer)

set(CMAKE_CXX_STANDARD 20)

add_executable(\${PROJECT_NAME} main.cpp)

target_include_directories(
  \${PROJECT_NAME} PUBLIC
  MOYFNetworking
)
target_link_libraries(
  \${PROJECT_NAME} PUBLIC
  MOYFNetworking
  ws2_32
)
\`\`\`

#### Examples from Other Project

##### Sockets

> **Repo.** https://github.com/rhymu8354/SocketTutorial

<center></center>

This is a \`CMakeLists.txt\` file inside a directory called \`Sockets\`.

\`\`\`cmake-1
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

add_library(\${This} \${Sources})
set_target_properties(\${This} PROPERTIES FOLDER Libraries)
target_include_directories(\${This} PUBLIC include)
if(UNIX)
    target_link_libraries(\${This} PUBLIC pthread)
endif(UNIX)
\`\`\`

From the section [The-Main-Library:-Networking](#The-Main-Library:-Networking) we have read a use case

\`\`\`cmake
file(GLOB_RECURSE SOURCES src/*.cpp)
\`\`\`

and plugged this into \`add_library\`. However, the [Do's and Don'ts](https://cliutils.gitlab.io/modern-cmake/chapters/intro/dodonot.html) states that **_Don't GLOB files_** because:

> Make or another tool will not know if you add files without rerunning CMake. Note that CMake 3.12 adds a \`CONFIGURE_DEPENDS\` flag that makes this far better if you need to use it.

In other words, listing the source files explicitly will be a better practice.
`;export{n as default};
