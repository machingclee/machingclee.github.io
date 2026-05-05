const e=`---
title: "Event Storming via PUML (Improved)"
date: 2025-09-28
id: blog0420
tag: DDD, puml, system-design
toc: true
intro: We improved the flow of using \`puml\` by defining custom functions and procedures.
img: /assets/img/2025-09-29-09-17-15.png
scale: 3.5
offsetx: 42
offsety: 84
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
  .download-btn-solid {
    background: #3b82f6;
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 16px;
    font-weight: 600;
    padding: 6px 24px;
    transition: all 0.3s ease;
    text-decoration: none;
    display: inline-block;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    margin-bottom: 20px;
  }

  .download-btn-solid:hover {
    background: #2563eb;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
  }
</style>



### Result

<center>



<a href="/assets/portfolios/pdfs/timetable.pdf">
<button class="download-btn-solid" >Download</button>
</a>

</center>


[![](/assets/img/2025-09-29-09-17-15.png)](/assets/portfolios/pdfs/timetable.pdf)



### \`.puml\`

#### Import Custom Component Definitions

As the definition becomes very long, interested reader can refer to:


- https://raw.githubusercontent.com/machingclee/2025-08-23-plantUML-config/refs/heads/main/lib_eventstorming-v7.puml


This custom definition defines the following components:

- \`Command\`
- \`Aggregate\`
- \`Policy\`
- \`Handler\`
- \`Event\`


#### Simplify the code of path of arrows

In the past if we have 
\`\`\`puml
actor Teacher as Teacher
Command("ACommand")
Aggregate("BAggregate)
Event("CEvent")
Policy("DPolicy")
\`\`\`
We need to write separately:
\`\`\`puml 
Teacher --> ACommand
ACommand --> BAggregate
BAggregate --> CEvent
CEvent --> DPolicy
\`\`\`
Now we can condense them into 

\`\`\`puml
$flow5(Teacher, ACommand, BAggregate, CEvent, DPolicy)
\`\`\`

It is now more clean, succinct and maintainable.

We have provided serveral definitions here:

- \`$flow(...up to 3 args)\`
- \`$flow3(3 args, diverge from 4 onwards)\`
- \`$flow4(4 args, diverge from 5 onwards)\`
- \`$flow5(5 args, diverge from 6 onwards)\`
- \`$flow6(6 args, diverge from 6 onwards)\`

The function \`$flow{n}\` will connect the  first $n$ elements, and $(n+1)$-th, $(n+2)$-th, $(n+3)$-th elements will diverge from the $n$-th element. 

This is used when some command may in turn produce multiple events from an aggregate.


#### Shell Script to Compile \`.puml\` into \`.pdf\`

\`\`\`sh
docker run --rm -v $(pwd):/data machingclee/plantuml-pdf -tpdf timetable.puml
\`\`\`


#### Coding example, the \`timetable.puml\`


We import our custom definition in line 6 below:


\`\`\`puml{6}
@startuml


title <size:30>Timetable System</size>

!includeurl https://raw.githubusercontent.com/machingclee/2025-08-23-plantUML-config/refs/heads/main/lib_eventstorming-v7.puml

skinparam ranksep 150
skinparam nodesep 100
skinparam wrapWidth 400
' skinparam linetype polyline

actor Teacher as Teacher
actor "System Admin" as SystemAdmin
actor Scheduler as Scheduler 


package "Student Schedule System" {
  Command("AttachClassesToAGroupCommand")
  Command("CreateCourseCommand")
  Command("UpdateCourseCommand")
  Command("DeleteStudentCommand")
  Command("CreateStudentPackageCommand")
  Command("DeleteStudentPackageCommand")
  Command("MarkPackageAsPaidCommand")
  Command("CreateStudentCommand")
  Command("UpdateStudentCommand")     
  Command("CreateCustomHolidayCommand")
  Command("UpdateCustomHolidayCommand")
  Command("DeleteCustomHolidayCommand")
  Command("DetachClassFromGroupCommand")
  Command("UpdateStudentPackageCommand")
  Command("CreateUserCommand") 
  Command("ToggleNotificationCommand")
  Command("CreateDeadlineComingNotificationCommand")[
    CreateDeadlineComingNotificationCommand
    --rules--
    **1.** When package official_endDate - today = 1month, a notification should be recorded in a table
    **2.** notification should have an identifier so that repeated notification will not be made again, e.g., {package_id}:deadline_coming:{officiend_endDdate}
    **3.**  We use "studentId:\${student.id}|package_id:\${pkg.id}|end_at:\${oneMonthLaterStrRepresentation}" as the notification code. It is served an ID to avoid repeated generation of the notification
  ]
  Command("CreateClassesCommand")[
      CreateClassesCommand
      --validations--
      **1.** The new total minutes of all classes cannot exceed the limit of the student package
      **2.** Cannot overlap with existing classes that the student possesses
      **3.** When class is inserted before the last lessons, lessons in the package will start to be removed to compensate the insertion. 
  ]
  Command("UpdateClassCommand")[
      UpdateClassCommand
      --fields--
      classId: Int,
      min: Int,
      class_status: ClassStatus,
      remark: String,
      actual_classroom: Classroom
      --validations--
      **1.** Total miniutes cannot exceed package limit
  ]
  Command("RemoveGroupOfClassesCommand")
  Command("RemoveSingleClassCommand")
  Command("DuplicateClassCommand")[
      DuplicateClassCommand
      --
      <size:10><:white_check_mark:></size> Classes should not have overlap with any existing classes of all packages of a student 
  ]
  Command("MoveClassCommand")[
      MoveClassCommand
      --fields--
      classId
      startTime
      endTime
      --validations--
      **1.** Cannot overlap with any existing classes 
      **2.** Cannot move the class to the past (before current time the command takes place)
  ]
  Command("ResetClassNumbersCommand")
  Command("RemoveExtendedClassCommand")
  Command("ExtendClassesCommand")
  Command("RemoveClassesCommand")
  Command("DeleteUserCommand")
  Event("UserDeletedEvent")
  Event("UserCreatedEvent")
  Event("StudentDeletedEvent")
  Event("CourseCreatedEvent")
  Event("CourseUpdatedEvent")
  Event("NotificationWasToggledEvent")
  Event("ClassDetachedFromGroupEvent")
  Event("StudentPackageUpdatedEvent")
  Event("ClassDuplicatedEvent")
  Event("PackageMarkededAsPaidEvent")
  Event("StudentPackageDeletedEvent")
  Event("SingleClassRemovedEvent")
  Event("ClassesExtendedEvent")
  Event("ClassUpdatedEvent")
  Event("GroupOfClassesRemovedEvent")
  Event("StudentPackageUpdatedEvent")
  Event("ClassesCreatedEvent")
  Event("StudentUpdatedEvent")
  Event("CustomHolidayUpdatedEvent")
  Event("CustomHolidayDeletedEvent")
  Event("CustomHolidayCreatedEvent")
  Event("StudentCreatedEvent")
  Event("StudentRenewalStatusUpdatedEvent")
  TransactionalEvent("DeadlineComingNotificationCreatedEvent")
  Event("StudentPackageCreatedEvent")
  Event("ClassMovedEvent")
  Event("ClassNumbersResettedEvent")
  Event("ExtendedClassRemovedEvent")
  Event("ClassesRemovedEvent")
  Event("DeadlineComingNotificationCreated")
  Event("ClassesAttachedToAGroupEvent")


  Policy("AutomaticClassRemovalForNewlyCreatedClassPolicy")[
    Automatic Class Removal for Newly Created Class Policy
    ---
    1. When a class is created before the last few lessons, the last lessons should be removed/shrinkened (in terms of class duration) to match the class total minutes.
    2. Makeup classes should not be affected for simplicity. Namely, only the classes which is not "LEGIT_ABSENCE" nor "EXTENDED class" should participate into the recalculation
  ]

  Policy("CreateGroupForBatchCreatedClassesPolicy")[
    Create Group for Batch Created Classes Policy
    ---
    When a batch of classes (num > 1) is added, a class group should be automatically created for it.
  ]

  Policy("AddOrDeleteClassesOnPackageUpdatedPolicy")[ 
    Add or Delete Class Policy On Package Update Policy
    --
    **1.** When number of class is changed, we should add or remove classes accordingly
    **2.** If the number of classes of a package gets increased, add new classes
    **3.** Otherwise, remove classes from the latest classes,
    **4.** Class duration cannot be smaller than the specified duration defined in the package. When the remaining time is smaller than the predefined duration, keep it added, and display the total min in the frontend to let users adjust
  ]
  
  Policy("ResetClassNumberPolicy")[
    Reset Class Number Policy
    --
    **1.** Whenever a class is edited, try to adjust all the classes index (or class number) in its belonged package
    **2.** For class that is LEGIT_ABSENCE, the class number will be **-1**, indicated as excluded.
  ]

  Policy("ClassOnHolidayMustExtendPolicy")[
      Class On Holiday Must be Extended Policy
      --
      **1.** A class on a custom holiday must be extended to another day of the same time
      **2.** That day will be the same as the class being extended
      **3.** Classes Moved away from a holiday must be returned to normal, namely, makeup class should be removed and the original class should now be "PRESENT" instead of "LEGIT_ABSENCE"
  ]

  ' Position ExtendClassCommand directly below the policy
  Policy("ExtendClassDueToStatusChangePolicy")[
      Extend Class Policy due to Status Change Policy
      --
      **1.** When class status was changed to LEGIT_ABSENSE, an extended class will be created
      **2.** When a class was changed from LEGIT_ABSENSE back to anything else, the corresponding extended class must be removed
  ]
  Policy("StudentResourceReallocationPolicy")[
    Student Resource Reallocation Policy
    --
    **1.** Resource allocated to this teacher should be moved to other default teacher or system admin
  ]

  $flow(SystemAdmin, CreateUserCommand, UserCreatedEvent)
  $flow4(SystemAdmin, DeleteUserCommand, UserDeletedEvent, StudentResourceReallocationPolicy)
  $flow(Teacher, ToggleNotificationCommand, NotificationWasToggledEvent)
  $flow4(Teacher, DeleteStudentCommand, Student, StudentDeletedEvent)
  $flow(Teacher, CreateCourseCommand, CourseCreatedEvent)
  $flow(Teacher, UpdateCourseCommand, CourseUpdatedEvent )
  $flow4(Teacher, UpdateStudentCommand, Student, StudentUpdatedEvent)
  $flow(Teacher, UpdateCustomHolidayCommand, CustomHolidayUpdatedEvent)
  $flow(Teacher, DeleteCustomHolidayCommand, CustomHolidayDeletedEvent)
  $flow4(Teacher, CreateCustomHolidayCommand, CustomHolidayCreatedEvent, ClassOnHolidayMustExtendPolicy)
  $flow(Teacher, CreateStudentCommand, StudentCreatedEvent)
  $flow4(MoveClassCommand, Student, ClassMovedEvent, ClassOnHolidayMustExtendPolicy)
  $flow3(Teacher, CreateClassesCommand, Student, ClassesCreatedEvent, ClassesRemovedEvent, ClassUpdatedEvent)
  $flow(ClassesCreatedEvent, ClassOnHolidayMustExtendPolicy)
  $flow3(Teacher, CreateStudentPackageCommand, Student, StudentPackageCreatedEvent, ClassesCreatedEvent)
  $flow4(Teacher, UpdateClassCommand, Student, ClassUpdatedEvent)
  $flow4(Teacher, RemoveGroupOfClassesCommand, Student, GroupOfClassesRemovedEvent)
  $flow4(Teacher, DetachClassFromGroupCommand, Student, ClassDetachedFromGroupEvent)
  $flow5(Teacher, UpdateStudentPackageCommand, Student, StudentPackageUpdatedEvent, AddOrDeleteClassesOnPackageUpdatedPolicy)
  $flow4(Teacher, DuplicateClassCommand, Student, ClassDuplicatedEvent)
  $flow4(ExtendClassDueToStatusChangePolicy, RemoveExtendedClassCommand, Student, ExtendedClassRemovedEvent)
  $flow4(ClassUpdatedEvent, ExtendClassDueToStatusChangePolicy, ExtendClassesCommand, Student, ClassesExtendedEvent, ClassesCreatedEvent)
  $flow5(Teacher, RemoveSingleClassCommand, Student, SingleClassRemovedEvent, ResetClassNumberPolicy)
  $flow4(Teacher, DeleteStudentPackageCommand, Student, StudentPackageDeletedEvent)
  $flow4(Teacher, MarkPackageAsPaidCommand, Student, PackageMarkededAsPaidEvent)
  $flow4(ResetClassNumberPolicy, ResetClassNumbersCommand, Student, ClassNumbersResettedEvent)
  $flow(ClassMovedEvent, ResetClassNumberPolicy)
  $flow(AddOrDeleteClassesOnPackageUpdatedPolicy, CreateClassesCommand)
  $flow4(AddOrDeleteClassesOnPackageUpdatedPolicy, RemoveClassesCommand, Student, ClassesRemovedEvent)
  $flow(ClassesRemovedEvent, ResetClassNumberPolicy)
  $flow(ClassesCreatedEvent, ResetClassNumberPolicy)
  $flow(GroupOfClassesRemovedEvent, ResetClassNumberPolicy)
  $flow(Teacher, CreateDeadlineComingNotificationCommand, DeadlineComingNotificationCreatedEvent)
  $flow(ClassOnHolidayMustExtendPolicy, ExtendClassesCommand)
  $flow(ClassesCreatedEvent, CreateGroupForBatchCreatedClassesPolicy)
  $flow(ClassDuplicatedEvent, CreateGroupForBatchCreatedClassesPolicy)
  $flow(CreateGroupForBatchCreatedClassesPolicy, AttachClassesToAGroupCommand, ClassesAttachedToAGroupEvent)
  $flow(ClassesCreatedEvent, AutomaticClassRemovalForNewlyCreatedClassPolicy)
}

package "Notification System" {
    Command("CreateSuspiciousAbsenceNotificationCommand")
    Event("SuspiciousAbsenceNotificationCreatedEvent")
   
    Policy("SuspiciousAbsenceNotificationPolicy")[
    Suspicious Absence Policy
    --
    **1.** Upon class status changed, when there are **5** or more suspicious absence classes, we need to create a notification which indicates the number of suspicious classes.
    
    **2.** Each notification will have a notiifcation code to avoid the same notification from being created twice.
  ]
}

    $flow4(ClassUpdatedEvent, SuspiciousAbsenceNotificationPolicy, CreateSuspiciousAbsenceNotificationCommand, SuspiciousAbsenceNotificationCreatedEvent) 
@enduml
\`\`\``;export{e as default};
