const n=`---
id: portfolio014
title: "Mobile Application with Custom Animated Components and Deployment Experience"
wip: true
intro: Demontrate the ability to create custom animated components to fulfill complicated requirements.
thumbnail: /assets/portfolios/thumbnails/mobileapp.png
tech: React-Native, expo-cli
thumbWidth: 600
thumbTransX: -300
thumbTransY: -420
hoverImageHeight: 200
date: 2024-06-11
---
<style>
    td {
      b {
        padding-left: 10px;
        border-left: 4px solid #7bb9d1;
        font-weight: 600;
        padding: 2px 8px 2px 8px;
      }
    }
    table td {
      background-color: white;
      vertical-align: top;
      padding-top: 20px !important;
    }
    table tr {
      border-bottom: 3px solid rgba(0,0,0,0.15);
    }
    table td:nth-child(2), table th:nth-child(2) {
      padding-left: 20px !important;
      text-align: center
    }
    table th, table td {
      padding-left: 0px !important;
    }
    img, .custom-video{
      position: relative;
      transition: box-shadow 0.1s ease-in-out;
      box-shadow: rgba(9, 30, 66, 0.25) 0px 4px 8px -2px,rgba(9, 30, 66, 0.08) 0px 0px 0px 1px;
      cursor: pointer;
      border-radius:8px;
      overflow: hidden;
      border: 1px solid rgba(0,0,0,0.2);
    }
    img:hover, video:hover{
      box-shadow: rgba(9, 30, 66, 0.25) 0px 4px 8px -2px,rgba(9, 30, 66, 0.08) 0px 0px 10px 10px;
    }
    img, .custom-video{
        max-width: 660px;
        margin-bottom: 10px;
    }
    table{
      width: 100%;
      td, th {
        padding: 5px 10px;
      }
      tr:nth-child(2n){
        background-color: rgba(0,0,0,0.05);
      }
      td:nth-child(1) {
        vertical-align: top;
        width:170px;
      }
    }
</style>

### My Role to This Project

This is a full-stack project for Wonderbricks Limited in which I am in charge of **85% ~ 90%** of the work including 

- All visual effects for frontend 

- All business logic in backend with appropriate data model for the frontend
- DevOps for frontend and backend deployments

### Custom Animated Components and Components Wrapped as a Class


<table>
 <thead>
    <tr>
      <th style="width: 320px">Description</th>
      <th> Video Demo</th>
    </tr>
<tbody>

<tr>
<td>
<b>Swipe to Dispatch Action.</b>

Custom component to trigger an action when we slide over a threshold
</td>
<td>
    <customvideo src="/assets/react-native-app-demo/001_swipe_to_dispatch.mp4" width="340"/>
</td>
</tr>

<tr>
<td>
<b>Swipe to show Hidden Buttons.</b>

Custom component to show hidden buttons when we slide over a threshold
</td>
<td>
<customvideo src="/assets/react-native-app-demo/002_swipe_to_show.mp4" width="340"/>
</td>
</tr>

<tr>
<td>
<b>3-Pages Transition Component.</b>

Custom Component to transit over 3 pages freely. It is implemented as a class with the following
- scroll lock
- scroll left/right
- scroll center
- onScrollCenter 
etc functionalites.
</td>
<td>
  <customvideo src="/assets/react-native-app-demo/003_custom_page_transitioning_component.mp4" width="340"/>
</td>
</tr>

<tr>
<td>
<b>2-Pages Transition Component.</b>

It is the same component as  above without providing left/right page as a props.
</td>
<td>
<customvideo src="/assets/react-native-app-demo/006_custom_page_transition_usecase.mp4" width="340"/>
</td>
</tr>

<tr>
<td>
<b>Custom Top Tab Navigation.</b>

For sure there is an alternative called *Material Top Tabs Navigator*, we decide to ***make our own one*** because

- This area is supposed to be scrollable only by our 3-pages transition component

  <a href="/assets/img/2024-05-03-01-32-52.png"><img src="/assets/img/2024-05-03-01-32-52.png" width="180"/></a>

- We want this part to be scrollable instead:

  <a href="/assets/img/2024-05-03-01-37-25.png"><img src="/assets/img/2024-05-03-01-37-25.png" width="180"/></a>

</td>
<td>
<customvideo src="/assets/react-native-app-demo/008_transitoin_pages.MP4" width="340">
</td>
</tr>

<tr>
<td>
<b>Reusable Bottomsheet Class and Communication Among Them.</b>

In JS each \`const = T * const\` in \`C\` sense with auto-deferencing, we instantiate our bottomsheet in this way:

\`\`\`js
const CameraBottomSheet = new WbBottomSheet({
    index: 0,
    nullHandle: true,
    noRoundedCorner: true,
    enableBackdrop: false,
    snapPoints: ["100%"],
});

export CameraBottomSheet;
\`\`\`
All the actions related to this bottomsheet will be controlled by this export (which is cached thanks to the \`nodejs\` mechanism for each export).

We have 4 main methods exposed by \`WbBottomSheet\`:
- \`render: () => JSX.Element\`
- \`open: () => void\`
- \`close: () => void\`
- \`setContent: (content: () => () => JSX.Element) => void\`
Therefore the effect in the video is achieved by \`open()\` and \`close()\` within two bottomsheets (with redux to update the state).
</td>

<td>
<customvideo src="/assets/react-native-app-demo/005_communicate_among_bottom_sheets.mp4" width="340"/>
</td>
</tr>
<tr>


<tr>
<td><b>Voice Recording, Native Voice Recognition and File Uploading.</b></td>
<td>
<customvideo src="/assets/react-native-app-demo/004_native_file_uploading.mp4" width="340"/>
</td>
</tr>

</tbody>
</table>

### Enforce Good Labeling Practice to let Developers Contribute Easily

As in web development, targeting the component in codebase for modification is a tedious and frustrating task as everyone has their (or even weird) naming convention. 

By enforcing the rule to display a hint (component name, indicative string, etc) for all major components, we have reduced huge amount of time in development.


<a href="/assets/img/2024-05-01-19-20-20.png"><img src="/assets/img/2024-05-01-19-20-20.png" width="340" style="margin-top: 20px"/></a>



### Deployment and App Distribution Experience
#### Different Stages with TestFlight for Internal and External Tests
<a href="/assets/img/2024-05-01-19-06-19.png"><img src="/assets/img/2024-05-01-19-06-19.png" width="340"/></a>

#### App Store Distribution
<a href="/assets/img/2024-05-04-17-34-14.png">![](/assets/img/2024-05-04-17-34-14.png)</a>

#### Goolge Play Distribution
<a href="/assets/img/2024-05-04-17-35-09.png">![](/assets/img/2024-05-04-17-35-09.png)</a>

#### OTA Update

<a href="/assets/img/2024-05-04-17-34-38.png">![](/assets/img/2024-05-04-17-34-38.png)</a>

### Lessons After this Project

#### First Time to Manage a Database from Scratch
[My self-reflection on the work I have done so far](/blog/article/Self-Reflection-on-Database-Schema-Design#What-I-failed).

#### Native Knowledge is Essential
##### Description of our Encountered Problem
Since images in react-native flicker when their parent component gets rerendered, we need to make use of a package [react-native-fast-image](https://github.com/DylanVann/react-native-fast-image) to avoid this phenomenon. 

However, this package has not been maintained for 2 years, and some native API has been deprecated in iOS17.
I have spent tones of time browsing the discussion on github issues, folk the repo of possible solution, and make my own changes in my folked repository.

Finally I adopt my repository as the source of the package:


\`\`\`json
{
    ...
    "react-native-fast-image": "https://github.com/Ching-Cheong-Lee/react-native-fast-image#fa4a38e",
}
\`\`\`
in order to solve this error.

<a href="/assets/img/2024-05-04-21-03-30.png">![](/assets/img/2024-05-04-21-03-30.png)</a>

What we have solved:

- We need to run \`npx tsc\` to build a \`/dist\` folder with target in \`CommonJS\`, for which the error complains about. 

- Existing solutions that aim at solving iOS17 SDK problem have skipped the step of building \`CommonJS\` entrypoint for unknown reason.

##### Lessons

In this lesson my problem can be solved timely because

- We have someone who has the native knowledge to ***change the native code***, this will be the field of knowledge to which I have to enrich.

- We can manage our own npm package, solid knowledge in \`npm\` ecosystem is essential.
`;export{n as default};
