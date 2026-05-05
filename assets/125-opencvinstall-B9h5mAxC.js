const e=`---
title: "Install Opencv and Libtorch for CMake Project"
date: 2023-03-20
id: blog0125
tag: C++, deep-learning
intro: Record the flow of including opencv and libtorch into CMake project.
---

### Windows

#### OpenCV

- In the [official guide](https://docs.opencv.org/4.x/d3/d52/tutorial_windows_install.html) we can download the pre-built library, for example, we choose 4.6.0 and download the exe file

  <Center>
  <img src="/assets/tech/125/001.png" width="600"/>
  </Center>
  <p></p>
  <center></center>

  By running this \`.exe\` file we can decompress and extract files into a single folder that follows this structure:

  <Center>
  <img src="/assets/tech/125/002.png" width="600"/>
  </Center>
  <p></p>
  <center></center>

  As a routine I will save all libraries like \`opencv\`, \`libtorch\` and \`boost\`, etc, into a folder called \`C++Library\`. These libraries will be shared among different projects.

- Next in the root level \`CMakelists.txt\` we include

  \`\`\`cmake
  set(CMAKE_CXX_STANDARD 14)
  set(CPACK_PROJECT_NAME \${PROJECT_NAME})
  set(CPACK_PROJECT_VERSION \${PROJECT_VERSION})
  set(OpenCV_DIR "C:\\\\Users\\\\user\\\\Repos\\\\C++Libraries\\\\opencv\\\\build\\\\x64\\\\vc16")
  find_package(OpenCV REQUIRED)
  message(STATUS "OpenCV_INCLUDE_DIRS = \${OpenCV_INCLUDE_DIRS}")
  message(STATUS "OpenCV_LIBS = \${OpenCV_LIBS}")
  \`\`\`

  Change the path for \`OpenCV_DIR\` when needed.

- Then we can use
  \`\`\`cmake
  target_link_libraries(some_target PUBLIC ... \${OpenCV_LIBS} ...)
  \`\`\`
  to link the library when the project needs it.

#### libtorch

- We can download the libtorch pre-built library from official pytorch website. The structure is like this:

  <Center>
  <img src="/assets/tech/125/003.png" width="600"/>
  </Center>
  <p></p>
  <center></center>

- In the root level \`CMakeLists.txt\` we include

  \`\`\`cmake
  set(CMAKE_PREFIX_PATH "C:\\\\Users\\\\user\\\\Repos\\\\C++Libraries\\\\libtorch")
  find_package(Torch REQUIRED)
  set(CMAKE_CXX_FLAGS "\${CMAKE_CXX_FLAGS} \${TORCH_CXX_FLAGS}")
  if (MSVC)
    message("copying dll files")
    file(GLOB TORCH_DLLS "\${TORCH_INSTALL_PREFIX}/lib/*.dll")
    add_custom_command(TARGET EyeCatching
                      POST_BUILD
                      COMMAND \${CMAKE_COMMAND} -E copy_if_different
                      \${TORCH_DLLS}
                      $<TARGET_FILE_DIR:EyeCatching>)
  endif (MSVC)
  \`\`\`

- Then we can link the library by

  \`\`\`cmake
  target_link_libraries(some_target PUBLIC ... \${TORCH_LIBRARIES} ...)
  \`\`\`

### Mac

#### OpenCV\\_

We install opencv directly by homebrew:

\`\`\`text
brew install opencv
\`\`\`

Then the pre-built library can be found in \`/opt/homebrew/Cellar/opencv/\`. It remains to link it in our cmake project.

The cmake instruction remains the same as windows, in my case my path to the libary is \`/opt/homebrew/Cellar/opencv/4.7.0_1\`.

#### libtorch\\_

We can still download pre-built libtorch library in official pytorch website. The cmake instruction remains the same as windows.
`;export{e as default};
