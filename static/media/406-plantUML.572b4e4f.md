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

#### Simplification without Cloning Remote Repository
##### The most Important Import
From the previous section for the `puml` file to be compiled successfully, the most important import is the following:

```puml
!include $LIB_BASE_LOCATION/eventstorming/Element/Person.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/System.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/FacadeCommand.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/Command.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/Aggregate.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/DomainEvent.puml
!include $LIB_BASE_LOCATION/eventstorming/Element/Process.puml
```

Which means that as long as we have those code available, it is not necessary to clone the repository as in the previous section, let's take the most important part and put them into a single file:

##### lib_eventstorming.puml

In the following we have defined the following syntax:

The ones we use most of the time:
- `Command`
- `Aggrgate`
- `Policy`
- `Handler`

The remaining comes in handy:
- `EsEntity`
- `Arrow`
- `FacadeCommmand`
- `Result`
- `Event`
- `DomainEvent`
- `IntegrationEvent`
- `Query`
- `ReadeModel`
- `UserInterface`
- `Service`
- `Saga` 
- `Process`
- `Timer`
- `Person`
- `System`
- `Comment`



```puml
!global $ICON_FORMAT="png"
!global $TEXT_WIDTH_MAX=200
!global $MSG_WIDTH_MAX=150
!global $FONT_SIZE_XS=10
!global $FONT_SIZE_SM=12
!global $FONT_SIZE_MD=16
!global $FONT_SIZE_LG=20
!global $FONT_COLOR="#212121"
!global $FONT_COLOR_LIGHT="#757575"

!procedure EsEntity($shape, $stereotype, $id, $label="")
  !if ($label != "")
    $shape "$label" as $id <<$stereotype>>
  !else
    $shape $id <<$stereotype>>
  !endif
!endprocedure

show stereotype

skinparam defaultTextAlignment center
skinparam wrapWidth 400
skinparam maxMessageSize 150



skinparam Arrow {
    Color $FONT_COLOR
    FontColor $FONT_COLOR
    FontSize $FONT_SIZE_SM
}


' definition of the Item eventstorming/Element/FacadeCommand
skinparam file<<FacadeCommand>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #779fae
}

!procedure FacadeCommand($id, $label="")
  EsEntity('file', 'FacadeCommand', $id, $label)
!endprocedure
' definition of the Item eventstorming/Element/Command


skinparam file<<Command>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #aec6cf
}

!procedure Command($id, $label="")
  EsEntity('file', 'Command', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/Result
skinparam file<<Result>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #cfcfc4
}

!procedure Result($id, $label="")
  EsEntity('file', 'Result', $id, $label)
!endprocedure
' definition of the Item eventstorming/Element/Event


skinparam file<<Event>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #ffb853
}

!procedure Event($id, $label="")
  EsEntity('file', 'Event', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/DomainEvent
skinparam file<<DomainEvent>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #ffcb81
}

!procedure DomainEvent($id, $label="")
  EsEntity('file', 'DomainEvent', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/IntegrationEvent
skinparam file<<IntegrationEvent>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #ffdeaf
}

!procedure IntegrationEvent($id, $label="")
  EsEntity('file', 'IntegrationEvent', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/Query
skinparam file<<Query>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #62d862
}

!procedure Query($id, $label="")
  EsEntity('file', 'Query', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/ReadModel
aram file<<ReadModel>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #77dd77
}

!procedure ReadModel($id, $label="")
  EsEntity('file', 'ReadModel', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/UserInterface
skinparam file<<UserInterface>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #a2e8a2
}

!procedure UserInterface($id, $label="")
  EsEntity('file', 'UserInterface', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/Aggregate
skinparam file<<Aggregate>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #fdfd9d
}

!procedure Aggregate($id, $label="")
  EsEntity('file', 'Aggregate', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/Service
skinparam file<<Service>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #fcfc78
}

!procedure Service($id, $label="")
  EsEntity('file', 'Service', $id, $label)
!endprocedure
' definition of the Item eventstorming/Element/Policy


skinparam file<<Policy>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #b6a2db
}

!procedure Policy($id, $label="")
  EsEntity('file', 'Policy', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/Saga
skinparam file<<Saga>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #c9bbe5
}

!procedure Saga($id, $label="")
  EsEntity('file', 'Saga', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/Process
skinparam file<<Process>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #ddd4ee
}

!procedure Process($id, $label="")
  EsEntity('file', 'Process', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/Timer
skinparam file<<Timer>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #cfcfc4
}

!procedure Timer($id, $label="")
  EsEntity('file', 'Timer', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/Person
skinparam actor<<Person>> {
    StereotypeFontSize 0
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #ffd1dc
}

!procedure Person($id, $label="")
  EsEntity('actor', 'Person', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/System
skinparam file<<System>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #ffd1dc
}

!procedure System($id, $label="")
  EsEntity('file', 'System', $id, $label)
!endprocedure

' definition of the Item eventstorming/Element/Comment
skinparam file<<Comment>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor transparent
}

!procedure Comment($id, $label="")
  EsEntity('file', 'Comment', $id, $label)
!endprocedure


skinparam rectangle<<Handler>> {
    StereotypeFontSize $FONT_SIZE_SM
    shadowing false
    FontColor $FONT_COLOR
    BorderColor $FONT_COLOR
    BackgroundColor #e8f4fd
}

!procedure Handler($id, $label="")
  EsEntity('file', 'Handler', $id, $label)
!endprocedure
```


##### timetable.puml
###### The Diagram Result

[![](/assets/img/2025-08-22-06-10-28.png)](/assets/img/2025-08-22-06-10-28.png)

###### The Code Implementation

Let's import the definition (the highlighted line) and draw the diagram as follows:

```puml{2}ss
@startuml
!include lib_eventstorming.puml

actor Teacher as Teacher


Aggregate("Student")

together {
    Command("CreateCourseCommand")
    Command("UpdateCourseCommand")
    Command("DeleteStudentCommand")
}

Command("CreateStudentPackageCommand")

together{
    Command("CreateStudentCommand")
    Command("UpdateStudentCommand")
    Command("CreateCustomHolidayCommand")
    Command("AssignDayAsCustomHolidyCommand")
}

Handler("CreateCourseHandler")
Event("CourseCreatedEvent")
CreateCourseCommand --> CreateCourseHandler : "processed by"
CreateCourseHandler --> CourseCreatedEvent
Handler("UpdateCourseHandler")
Event("CourseUpdatedEvent")
UpdateCourseCommand --> UpdateCourseHandler : "processed by"
UpdateCourseHandler --> CourseUpdatedEvent
Handler("DeleteStudentHandler")
Event("StudentDeletedEvent")
DeleteStudentCommand --> DeleteStudentHandler : "processed by"
DeleteStudentHandler --> StudentDeletedEvent
Handler("UpdateStudentHandler")
Event("StudentUpdatedEvent")
UpdateStudentCommand --> UpdateStudentHandler : "processed by"
UpdateStudentHandler --> StudentUpdatedEvent

CreateCourseCommand-[hidden]down-CreateStudentCommand
Handler("CreateCustomHolidayHandler")
Event("CustomHolidayCreatedEvent")
CreateCustomHolidayCommand --> CreateCustomHolidayHandler : "processed by"
CreateCustomHolidayHandler --> CustomHolidayCreatedEvent
Handler("CreateStudentHandler")
Event("StudentCreatedEvent")
CreateStudentCommand --> CreateStudentHandler : "processed by"
CreateStudentHandler --> StudentCreatedEvent
Event("DayAssignedAsCustomHolidayEvent")

Handler("AssignDayAsCustomHolidyHandler")
AssignDayAsCustomHolidyCommand --> AssignDayAsCustomHolidyHandler : "processed by"
AssignDayAsCustomHolidyHandler --> DayAssignedAsCustomHolidayEvent

together{
    Command("CreateClassesCommand")[
        CreateClassesCommand
        --validations--
        **1.** The new total minutes of all classes cannot exceed the limit of the student package
        **2.** Cannot overlap with existing classes that the student possesses
    ]
    Aggregate("StudentPackage")
    Command("UpdateClassCommand")
    Command("RemoveClassCommand")
    Command("UpdateStudentPackageCommand")
}

CreateClassesCommand-[hidden]down-StudentPackage

Policy("ClassOnHolidayMustExtendPolicy")[
    Class On Holiday Must be Extended Policy
    --
    **1.** A class on a custom holiday must be extended to another day of the same time
    **2.** That day will be the same as the class being extended
]

' Position ExtendClassCommand directly below the policy
Command("ExtendClassCommand")

Policy("ExtendClassPolicy")[
    Extend Class due to Status Change Policy
    --
    **1.** When class status was changed to LEGIT_ABSENSE, an extended class will be created
    **2.** When a class was changed from LEGIT_ABSENSE back to anything else, the corresponding extended class must be removed
]


DayAssignedAsCustomHolidayEvent --> ClassOnHolidayMustExtendPolicy
ClassOnHolidayMustExtendPolicy --> ExtendClassCommand

' Use hidden connection to force vertical alignment
ClassOnHolidayMustExtendPolicy -[hidden]down- ExtendClassCommand

together{
    Event("ClassExtendedEvent")
    Event("ClassUpdatedEvent")
    Event("ClassRemovedEvent")
    Event("StudentPackageUpatedEvent")
}

Student --> StudentPackage

Teacher --> CreateCourseCommand
Teacher --> UpdateCourseCommand
Teacher --> CreateStudentCommand
Teacher --> UpdateStudentCommand
Teacher --> DeleteStudentCommand
Teacher --> CreateStudentPackageCommand
Teacher --> UpdateStudentPackageCommand
Teacher --> CreateClassesCommand
Teacher --> UpdateClassCommand
Teacher --> RemoveClassCommand
Teacher --> ExtendClassCommand
Teacher --> CreateCustomHolidayCommand
Teacher --> AssignDayAsCustomHolidyCommand

UpdateStudentPackageCommand --> StudentPackage
CreateClassesCommand --> StudentPackage
UpdateClassCommand --> StudentPackage
RemoveClassCommand --> StudentPackage
CreateStudentPackageCommand --> Student

UpdateStudentPackageCommand-[hidden]down-StudentPackage

StudentPackage --> ClassExtendedEvent
StudentPackage --> ClassUpdatedEvent
StudentPackage --> ClassRemovedEvent
StudentPackage --> StudentPackageUpatedEvent
ClassUpdatedEvent --> ExtendClassPolicy
ExtendClassPolicy --> ExtendClassCommand
ExtendClassPolicy --> RemoveClassCommand
ExtendClassCommand --> StudentPackage

actor Scheduler as Scheduler 

Command("CreateDeadlineComingNotificationCommand")[
    CreateDeadlineComingNotificationCommand
    --rules--
    **1.** When package official_endDate - today = 1month, a notification should be recorded in a table
    **2.** notification should have an identifier so that repeated notification will not be made again, e.g., {package_id}:deadline_coming:{officiend_endDdate}
]
Handler("CreateDeadlineComingNotificationHandler")
Event("DeadlineComingNotificationCreatedEvent")
CreateDeadlineComingNotificationCommand --> CreateDeadlineComingNotificationHandler
CreateDeadlineComingNotificationHandler --> DeadlineComingNotificationCreatedEvent

Scheduler --> CreateDeadlineComingNotificationCommand

@enduml
```

##### Some Useful Reposition Trick

###### Group Together

```puml
together {
    <element1>
    <element2>
}
```
###### Align Vertically

Note that it is not strictly vertically aligned, the horizontal position is still calculated by the native algorithm

```puml
<element1>-[hidden]down-<element2>
```

#### References

- [DDD秘籍11: 停车黑名单建模（plantuml 对象协作）](https://www.bilibili.com/video/BV1Nc411m7BZ?spm_id_from=333.788.videopod.sections&vd_source=ed60287fd90cfd8c9101587902f829e4)