---
title: PlantUML for EventSourcing (With Live-Preview)
date: 2025-08-17
id: blog0406
tag: puml
toc: true
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>

#### Install VSCode Plugin and PUML Definitions

##### VSCode Plugin 

Install the following plugin in VSCode

[![](/assets/img/2025-08-17-22-33-30.png)](/assets/img/2025-08-17-22-33-30.png)

#####  Clone Remote Repository for Special Definitions

In my case I clone the following repository into `/Users/chingcheonglee/plantuml-lib`

- https://github.com/tmorin/plantuml-libs

##### Modify Filepath to Refer Local Definition (Just Cloned)

Now create a file named `trial.puml`, we copy an example from [official repository](https://github.com/tmorin/plantuml-libs/tree/master/distribution/eventstorming) and change the highlighted line to the `distribution/` directory in your local file system:

```yml{4}
@startuml
' configures the library
!global $INCLUSION_MODE="local"
!global $LIB_BASE_LOCATION="/Users/chingcheonglee/plantuml-libs/distribution"

' Define necessary variables first (from main bootstrap)
!global $FONT_SIZE_XS=10
!global $FONT_SIZE_SM=12
!global $FONT_SIZE_MD=16
!global $FONT_SIZE_LG=20
!global $FONT_COLOR="#212121"
!global $FONT_COLOR_LIGHT="#757575"

' loads the package bootstrap
!include $LIB_BASE_LOCATION/eventstorming/bootstrap.puml

!include $LIB_BASE_LOCATION/eventstorming/Element/Person.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/System.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/FacadeCommand.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/Command.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/Aggregate.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/DomainEvent.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/Process.puml

Person("person")
System("system")
FacadeCommand("facade_command", "facade command")
Command("command123")
Aggregate("aggregate")
DomainEvent("domain_event", "domain event")
Process("process")
Process("process2")

person --> facade_command : invokes
system --> facade_command : invokes
facade_command --> command : invokes
command --> domain_event : generates
command . aggregate : invoked on
domain_event -> process : starts

@enduml
```
    
Note that we have included many syntaxes specifically for domain driven design, therefore we ***need*** the new definitions from the repository we just cloned.

##### The Visualized Result

Now we make use of the plugin we just installed in vscode to preview the `puml` file:

![](/assets/img/2025-08-21-04-34-22.png)

We get the live-preview visualized from the PlantUML definitions:

[![](/assets/img/2025-08-17-22-43-02.png)](/assets/img/2025-08-17-22-43-02.png)

#### PlantUML Fundamentals

##### Official Examples

- https://plantuml.com/


##### Some Commands and Aggregates:
###### Official Simple Examples
The following is some offical examples (commented out)
```puml-1
@startuml
' configures the library
!global $INCLUSION_MODE="local"
!global $LIB_BASE_LOCATION="/Users/chingcheonglee/plantuml-libs/distribution"

' Define necessary variables first (from main bootstrap)
!global $FONT_SIZE_XS=10
!global $FONT_SIZE_SM=12
!global $FONT_SIZE_MD=16
!global $FONT_SIZE_LG=20
!global $FONT_COLOR="#212121"
!global $FONT_COLOR_LIGHT="#757575"

' loads the package bootstrap
!include $LIB_BASE_LOCATION/eventstorming/bootstrap.puml

!include $LIB_BASE_LOCATION/eventstorming/Element/Person.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/System.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/FacadeCommand.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/Command.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/Aggregate.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/DomainEvent.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/Process.puml

' Person("person")
' System("system")
' FacadeCommand("facade_command", "facade command")
' Command("command123")
' Aggregate("aggregate")
' DomainEvent("domain_event", "domain event")
' ' Process("process")

' person --> facade_command : invokes
' system --> facade_command : invokes
' facade_command --> command : invokes
' command --> domain_event : generates
' command . aggregate : invoked on
' domain_event -> process : starts
```

###### Some Practical Example for User, Commands, Events and Aggreagtes

Next the following are some concrete examples:

```puml-39
Command("AnotherCmd") [
    AnotherComamnd
    --
    packageId   
    --
]

actor Teacher as Teacher


Command("UpdatePackageCmd") [
    UpdatePackageCommand
    --Fields--
    packageId
    numOfClasses
    location
    startTime
    status: LEGIT_ABSENSE | ...
    --Rules--
    1.cannot move class earlier than the command execution current time (i.e., cannot move the class to the past)
    2.upon changing the number of classes, the total mins cannot exceed the total mins of the package
]

DomainEvent("PackageUpdated") [
    PackageUpdatedEvent
    --
    packageId
]


Aggregate("StudentPackage") [
    StudentPackage
    --
    id
    some attribute ...
    --
    some behaviour (helper function within the aggregate)
]


Teacher -down-> UpdatePackageCmd
Teacher -down-> AnotherCmd

UpdatePackageCmd -down-> StudentPackage 
AnotherCmd -down-> StudentPackage
StudentPackage -down-> PackageUpdated

@endum
```

![](/assets/img/2025-08-21-03-36-27.png)


