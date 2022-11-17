title: Visual Studio Solution Configuration
date: 2022-11-16
id: blog0109
tag: C++
toc: none
intro: Record solution setup for cleaner folder structure

1.  Right click the name of current solution
2.  Click on `Properties`
3.  Click on `General`
4.  On the top, change `Configuration` to `All Configuration`;
5.  change `Platform` to `All Platforms`
6.  In `General Properties > Output Directory`, type
    ```none
    $(SolutionDir)bin\$(Platform)\$(Configuration)\
    ```
7.  In `General Properties > Intermediate Directory`, type
    ```none
    $(SolutionDir)bin\intermediates\$(Platform)\$(Configuration)\
    ```
