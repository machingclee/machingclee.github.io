const n=`---
title: "Voice Chat on Mobile Using AgoraRTC"
date: 2023-09-23
id: blog0183
tag: react-native
intro: "We create a voice chat application on mobile using third party API called AgoraRTC."
toc: true
---

### Frontend: React Native

Since we are dealing with audio, there is **_no_** UI element needed and hence we will have a bunch of configurations without elements like \`<audio />\` and object of \`AudioTrack\`.

\`\`\`js
import { useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../redux/app/hooks";
import {
    ChannelProfileType,
    ClientRoleType,
    IRtcEngine,
    RtcConnection,
    UserOfflineReasonType,
    createAgoraRtcEngine,
} from "react-native-agora";
import { PermissionsAndroid } from "react-native";
import appSlice from "../redux/slices/appSlice";
import msgUtil from "../util/msgUtil";
import chatSlice, { ChatSliceState } from "../redux/slices/chatSlice";

const appId = process.env.EXPO_PUBLIC_ALGORA_APPID!;
// also get host userid in the joinroom function

export default () => {
    const dispatch = useAppDispatch();
    const channelId = useAppSelector(s => s.chat.selectedRoomOid);
    const userId = useAppSelector(s => s.auth.userId);
    const engine = useRef<{ instance: IRtcEngine | null }>({ instance: null });
    const {
        speakerphoneEnabled,
        joinSucceeded,
        localMuted,
        peerIds,
        rtcToken
    } = useAppSelector(s => s.chat.AgoraRtcConnection);

    const updateAgora = (update: Partial<ChatSliceState["AgoraRtcConnection"]>) => {
        dispatch(chatSlice.actions.updateAgoraRtcConnection(update));
    }

    const requestAudioPermission = async () => {
        const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        ]);
        if (granted["android.permission.RECORD_AUDIO"]
            !== PermissionsAndroid.RESULTS.GRANTED
        ) {
            dispatch(appSlice.actions.updateAppDialog({
                open: true,
                title: "Permission Error",
                desc: "Microphone access has not been granted",
                ok: { label: "OK" }
            }));
        };
    }

    const initRTC = async () => {
        const client = createAgoraRtcEngine();
        engine.current.instance = client;

        client.enableAudio();
        client.setEnableSpeakerphone(true);
        client.muteLocalAudioStream(false);
        // enableSpeakerphone is initialized to ture in useState
        client.setDefaultAudioRouteToSpeakerphone(true);
        client.muteLocalAudioStream(true);


        client.initialize({
            appId,
            channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting
        });

        client.addListener(
            "onJoinChannelSuccess",
            (channel, elapsed) => {
                try {
                    console.log("[onJoinChannelSuccess] AgoraRTC Join Success", channel, elapsed);
                    msgUtil.success(\`"AgoraRTC Join Success", \${channel}, \${elapsed}\`)
                    updateAgora({
                        joinSucceeded: true,
                        peerIds: [channel.localUid!, ...peerIds]
                    })
                } catch (err) {
                    console.log("[onJoinChannelSuccess]" + JSON.stringify(err));
                }
            }
        );

        client.addListener(
            "onUserJoined",
            (_, remoteUid, __) => {
                try {
                    console.log(\`[onUserJoined] new remote uid: \${remoteUid}\`)
                    if (peerIds.indexOf(remoteUid) > -1) {
                        return;
                    }
                    // setPeerIds(ids => [...ids, remoteUid]);
                } catch (err) {
                    console.log("[onUserJoined]" + JSON.stringify(err));
                }
            }
        );


        client.addListener(
            "onUserOffline",
            (_, remoteUid, __) => {
                try {
                    console.log(\`[onUserOffline] \${remoteUid} offlined\`)
                    updateAgora({ peerIds: peerIds.filter(id => id !== remoteUid) })
                    // if (remoteUid === hostUserId) {
                    //     leaveChannel();
                    // }
                } catch (err) {
                    console.log("[onUserOffline]" + JSON.stringify(err));
                }
            }
        );

    };

    const joinChannel = () => {
        console.log("join channel")
        engine.current.instance?.joinChannel(
            rtcToken, channelId, userId,
            { clientRoleType: ClientRoleType.ClientRoleBroadcaster }
        );
    };

    const leaveChannel = () => {
        console.log("leave channel")
        engine.current.instance?.leaveChannel();
        updateAgora({ peerIds: [], joinSucceeded: false });
    };

    const toggleMute = () => {
        engine.current.instance?.muteLocalAudioStream(!localMuted);
        updateAgora({ localMuted: !localMuted });
    };

    const toggleSpeakerphoneEnabled = () => {
        engine.current.instance?.setEnableSpeakerphone(!speakerphoneEnabled);
        updateAgora({ speakerphoneEnabled: !speakerphoneEnabled });
    }

    const destroyAgora = () => {
        engine.current.instance?.removeAllListeners();
        engine.current.instance = null;
    }

    return {
        requestAudioPermission,
        initRTC,
        joinChannel,
        leaveChannel,
        toggleMute,
        toggleSpeakerphoneEnabled,
        destroyAgora,
        peerIds,
        localMuted,
        speakerphoneEnabled,
        joinSucceeded
    }
}
\`\`\`

Here state needed for UI representation (muted, unmuted, connection success, etc) are all bound to redux store.

Note that in \`joinChannel\` we need to provide \`rtcToken\`, \`channelId\` and \`userId\`.

- \`rtcToken\` will be generated by our token server in the next section.
- \`channelId\` will be a \`roomOid\` that we create in a database.
- \`userId\` will be a serialized columns of integer \`id\` in our database.

### Backend: Token Server

\`\`\`text
yarn add react-native-agora
\`\`\`

Our token is generated by sending \`POST\` request to:

\`\`\`js
chatRouter.post("/voice-token", (req, res) => {
    const { roomOid } = req.body as { roomOid: string };
    const userId = req.user?.userId!;
    const rtcToken = chatService.generateRtcToken(roomOid, userId);
    res.json({
        success: true,
        result: { rtcToken }
    })
})
\`\`\`

Here:

\`\`\`js
const generateRtcToken = (channelId: string, uid: number) => {
    const appID = process.env.AGORARTC_APP_ID!;
    const appCertificate = process.env.AGORARTC_APP_CERT!;
    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds

    // Build token with uid
    const token = RtcTokenBuilder.buildTokenWithUid(appID, appCertificate, channelId, uid, role, privilegeExpiredTs, 600);
    return token;
}
\`\`\`

- \`appId\`, \`appCertificate\` can be obtained from \`https://console.agora.io/projects\`.
- The first person calling this api with this \`channelId\` will be the host of this channel.
- Once the host leaves, the channel will be closed.

### Reference

- [Agora.io Official Repo in Nodejs](https://github.com/AgoraIO/Tools/blob/master/DynamicKey/AgoraDynamicKey/nodejs/sample.js)
- [Voice Calling in React Native using Agora - Aryan Agarwal](https://www.youtube.com/watch?v=OBW96M_fafk)
- [AgoraIO Official Example in Class Component](https://github.com/AgoraIO-Extensions/react-native-agora/tree/main/example/src/examples/basic)
`;export{n as default};
