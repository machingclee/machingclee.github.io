const n=`---
title: "Long Running Task in Background for Mobile App"
date: 2023-10-17
id: blog0198
tag: react-native
intro: "We discuss How to keep running tasks even when our app is in background state (including screen being locked."
toc: true
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

### The react-native-background-timer

We install by:

\`\`\`text
yarn add react-native-background-timer @types/react-native-background-timer
\`\`\`

### Use Case: Check Idling

In my app I have a third party voice-conferencing service called AgoraRTC which **_is not free_**. I want to kick user off the service if he/she is not actively using our app. Our criterion is: our app is in \`background\` state for 1 minute.

#### AppState Investigation

We can invertigate the changes in \`appState\` by using

\`\`\`js
useEffect(() => {
  const subscription = AppState.addEventListener("change", (nextAppState) => {
    console.log(nextAppState);
  });
});
\`\`\`

Behaviour:

- **Switch to Another app.** appState: \`active\` > \`inactive\` > \`background\`
- **Lock Screen.** appState: \`active\` > \`inactive\` > ...

By using setInterval we can check "lock screen" up to inactive state, and our interval stop working once we turn our screen off.

**_Alternatively_**, by using

\`\`\`js
import BackgroundTimer from "react-native-background-timer";

useEffect(() => {
  BackgroundTimer.setInterval(() => {
    console.log(appStateRef.current);
  });
});

useEffect(() => {
  const subscription = AppState.addEventListener("change", (nextAppState) => {
    appStateRef.current = nextAppState;
  });
});
\`\`\`

our interval can continue running in the background, and we come to the conclusion that

- **Lock Screen.** appState: \`active\` > \`inactive\` > \`background\`

We therefore come up with the following \`setTimeout\` to trigger \`inactiveAction\` (which kicks users out of the service).

#### Finalize to a Hook

\`\`\`js
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import BackgroundTimer from 'react-native-background-timer';

export default ({
    inactiveAction = () => { },
    inactiveTimeout = 1000 * 60
}: {
    inactiveAction?: () => void,
    inactiveTimeout?: number
}) => {
    const appStateRef = useRef<AppStateStatus | null>(null);
    const inactiveTimeoutRef = useRef<ReturnType<typeof BackgroundTimer.setTimeout> | null>(null);
    const timeoutIsSet = useRef(false);

    const startInactiveTimeout = () => {
        inactiveTimeoutRef.current = BackgroundTimer.setTimeout(() => {
            if (appStateRef.current === "inactive" || appStateRef.current === "background") {
                inactiveAction();
                if (inactiveTimeoutRef.current) {
                    timeoutIsSet.current = false;
                    BackgroundTimer.clearTimeout(inactiveTimeoutRef.current);
                }
            }
        }, inactiveTimeout);
    }

    useEffect(() => {
        const subscription = AppState.addEventListener("change", nextAppState => {
            appStateRef.current = nextAppState;

            if (nextAppState === "inactive" && !timeoutIsSet.current) {
                startInactiveTimeout();
                timeoutIsSet.current = true;
            }

            if (nextAppState === "active") {
                if (inactiveTimeoutRef.current) {
                    timeoutIsSet.current = false;
                    BackgroundTimer.clearInterval(inactiveTimeoutRef.current);
                }
            }
        });

        return () => {
            subscription.remove();
        }
    }, []);

    useEffect(() => {
        return () => {
            BackgroundTimer.stopBackgroundTimer();
        }
    }, []);
}
\`\`\`

#### Usage

Inside a component:

\`\`\`js
const completeQuitRoom = () => {
  removeAgora();
};

useAppInactiveChecker({
  inactiveAction: completeQuitRoom,
  inactiveTimeout: 1000 * 60,
});
\`\`\`
`;export{n as default};
