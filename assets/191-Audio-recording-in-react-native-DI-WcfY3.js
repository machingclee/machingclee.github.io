const e=`---
title: "Audio Recording in React-Native"
date: 2023-10-07
id: blog0191
tag: react-native
intro: "An introduction to react-native-audio-recorder-player"
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

### Code Implementation

The following hook is simply a rewrite from the [official documentation](https://github.com/hyochan/react-native-audio-recorder-player#usage) written in class component:

\`\`\`js
import { useRef, useState } from "react";
import AudioRecorderPlayer from "react-native-audio-recorder-player";

export default () => {
  const audioRecorderRef =
    useRef < AudioRecorderPlayer > new AudioRecorderPlayer();
  const [recordSecs, setRecordSecs] = useState(0);
  const [recordTime, setRecordTime] = useState("");
  const [currentPositionSec, setCurrentPositionSec] = useState(0);
  const [currentDurationSec, setCurrentDurationSec] = useState(0);
  const [playTime, setPlayTime] = useState("");
  const [duration, setDuration] = useState("");
  const [audioFileUri, setAudioFileUri] = useState("");

  const onStartRecord = async (path: string) => {
    let result = "";
    if (path) {
      result = await audioRecorderRef.current.startRecorder(path);
    } else {
      result = await audioRecorderRef.current.startRecorder();
    }
    setAudioFileUri(result);
    audioRecorderRef.current.addRecordBackListener((e) => {
      setRecordSecs(e.currentPosition);
      setRecordTime(
        audioRecorderRef.current.mmssss(Math.floor(e.currentPosition))
      );
      return;
    });
    console.log("my defined filepath", path);
    console.log("result filepath", result);
  };

  const onStopRecord = async () => {
    await audioRecorderRef.current.stopRecorder();
    audioRecorderRef.current.removeRecordBackListener();
    setRecordSecs(0);
  };

  const onStartPlay = async () => {
    console.log("onStartPlay");
    const msg = await audioRecorderRef.current.startPlayer(audioFileUri);
    console.log(msg);
    audioRecorderRef.current.addPlayBackListener((e) => {
      setCurrentPositionSec(e.currentPosition);
      setCurrentDurationSec(e.duration);
      setPlayTime(
        audioRecorderRef.current.mmssss(Math.floor(e.currentPosition))
      );
      setDuration(audioRecorderRef.current.mmssss(Math.floor(e.duration)));
      return;
    });
  };

  const onPausePlay = async () => {
    await audioRecorderRef.current.pausePlayer();
  };

  const onStopPlay = async () => {
    console.log("onStopPlay");
    audioRecorderRef.current.stopPlayer();
    audioRecorderRef.current.removePlayBackListener();
  };

  return {
    audioFileUri,
    onStartRecord,
    onStopRecord,
    onStartPlay,
    onPausePlay,
    onStopPlay,
  };
};
\`\`\`

### Usage

\`\`\`js
// component used to record audio

export default () => {
    const {
        audioFileUri,
        onPausePlay,
        onStartPlay,
        onStartRecord,
        onStopPlay,
        onStopRecord,
    } = useAudioRecording();


    const startRecording = () => {
        await onStartRecord("");
        setIsRecording(true);
    };

    const stopRecording =()=>{
        await onStopRecord();
        setIsRecording(false);
        await uploadAudio();
    }

    const uploadAudio = async () => {
        console.log("uploading", audioFileUri)
        const base64EncodedFile = await FileSystem.readAsStringAsync(
            audioFileUri,
            { encoding: FileSystem.EncodingType.Base64 }
        );
        dispatch(chatThunkAction.uploadAudioFile(
            {
                roomOid: selectedRoom._id,
                base64EncodedFile: { current: base64EncodedFile }
            }
        )).unwrap().finally(() => {
            FileSystem.deleteAsync(audioFileUri)
                .catch(() => {
                    msgUtil.error(\`Cannot delete file: \${audioFileUri}\`)
                });
        })
    }

    return (
        ...
    )
};
\`\`\`
`;export{e as default};
