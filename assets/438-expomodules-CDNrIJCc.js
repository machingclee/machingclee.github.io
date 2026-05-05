const e=`---
title: Native Module in Android for React-Native
date: 2025-11-18
id: blog0438
tag: react-native
toc: true
intro: Record the creation of custom android module for react-native
img: react-native
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>

### Expo Modules (Kotlin Only)

#### Module Structure {#module}



\`\`\`text
modules/expo-audio-converter/
├── android/                          # Android native code
│   ├── build.gradle                  # Android build config
│   └── src/main/java/expo/modules/audioconverter/
│       └── ExpoAudioConverterModule.kt  # Native implementation
├── ios/                              # iOS native code (if needed)
│   └── ExpoAudioConverterModule.swift
├── src/
│   └── ExpoAudioConverterModule.ts   # TypeScript interface
├── index.ts                          # Public API
└── expo-module.config.json           # Module configuration
\`\`\`


##### \`build.gradle\` Template


The following build configuration is a boilerplate for android plugin in react-native:

\`\`\`groovy
apply plugin: 'com.android.library'

group = 'expo.modules.audioconverter'
version = '0.6.3'

def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()
useCoreDependencies()
useExpoPublishing()

// If you want to use the managed Android SDK versions from expo-modules-core, set this to true.
// The Android SDK versions will be bumped from time to time in SDK releases and may introduce breaking changes in your module code.
// Most of the time, you may like to manage the Android SDK versions yourself.
def useManagedAndroidSdkVersions = false
if (useManagedAndroidSdkVersions) {
  useDefaultAndroidSdkVersions()
} else {
  buildscript {
    // Simple helper that allows the root project to override versions declared by this library.
    ext.safeExtGet = { prop, fallback ->
      rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
    }
  }
  project.android {
    compileSdkVersion safeExtGet("compileSdkVersion", 34)
    defaultConfig {
      minSdkVersion safeExtGet("minSdkVersion", 21)
      targetSdkVersion safeExtGet("targetSdkVersion", 34)
    }
  }
}

android {
  namespace "expo.modules.audioconverter"
  defaultConfig {
    versionCode 1
    versionName "0.6.3"
  }
  lintOptions {
    abortOnError false
  }
}

\`\`\`


##### Define Native Module in Kotlin

\`\`\`kotlin-1{14}
package expo.modules.audioconverter

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile

class ExpoAudioConverterModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoAudioConverter")

        AsyncFunction("convertToWav") { inputPath: String, outputPath: String ->
            try {
                // Remove file:// prefix if present
                val cleanInputPath = inputPath.removePrefix("file://")
                val cleanOutputPath = outputPath.removePrefix("file://")
                
                val inputFile = File(cleanInputPath)
                val outputFile = File(cleanOutputPath)
                
                if (!inputFile.exists()) {
                    throw Error("Input file does not exist: $cleanInputPath")
                }
                
                val converter = AudioConverter()
                converter.convertToWav(inputFile, outputFile)
                
                if (!outputFile.exists()) {
                    throw Error("Output file was not created: $cleanOutputPath")
                }
                
                mapOf(
                    "outputPath" to outputFile.absolutePath
                )
            } catch (e: Exception) {
                throw Error("Conversion failed: \${e.message}")
            }
        }
    } 
}
\`\`\`


- Note that in line 14 we register the name of the module (the class), in typescript (only within this plugin project) we will call 
  \`\`\`ts
  const theInstance = requireNativeModule<ExpoAudioConverterModule>(
      "ExpoAudioConverter"
  )
  \`\`\`
  to instantiate the registered instance. 

- Also in \`expo-module.config.json\` (go [#module] to see where it is located) we record the module that we want to export:

  \`\`\`json
  {
    "platforms": ["android"],
    "android": {
      "modules": ["expo.modules.audioconverter.ExpoAudioConverterModule"]
    }
  }
  \`\`\`
  On starting the application, Expo will scan for the \`ExpoAudioConverterModule\` and bridge our typescript code to this kotlin instance.

  <Example>

  **Remark.** Note that we provide the ***full classpath*** in the json, not the filename.

  </Example>

- Here \`Module\`, \`ModuleDefinition\` are all provided by the dependencies injected by \`useCoreDependencies()\`. 

- Within the scope (trailing closure) of \`ModuleDefinition\`, \`AsyncFunction\` is one of the ***method*** provided by the class \`ModuleDefinition\` via ***function literal*** (for detail, refer to my article [Function Literals with Receiver](/blog/article/Function-Literals-with-Receiver)).


- For synchrouous operations we can implement \`Function\` in place of \`AsyncFunction\`.

##### Create TypeScript Interface and Wrapper for the Module

\`\`\`typescript
import { NativeModule, requireNativeModule } from "expo"
import { Platform } from "react-native"

export interface ConvertToWavResult {
    outputPath: string
}

declare class ExpoAudioConverterModule extends NativeModule {
    convertToWav(inputPath: string, outputPath: string): Promise<ConvertToWavResult>
}

// This call loads the native module object from the JSI.
let AudioConverterModule: ExpoAudioConverterModule | null = null
try {
    // Only attempt to load on Android
    if (Platform.OS === "android") {
        AudioConverterModule = requireNativeModule<ExpoAudioConverterModule>("ExpoAudioConverter")
    }
} catch (e) {
    // Module failed to load
    console.warn("ExpoAudioConverter native module not available")
}
export async function convertToWav(inputPath: string, outputPath: string): Promise<ConvertToWavResult> {
    if (!AudioConverterModule) {
        throw new Error("ExpoAudioConverter native module not available")
    }
    return await AudioConverterModule.convertToWav(inputPath, outputPath)
}
\`\`\`

So basically we don't export the class \`ExpoAudioConverter\`, we simply instantiate it in the typescript file and export the execution \`convertToWav\` for use.


#### Key Expo Modules Concepts


##### AsyncFunction

- **Purpose**: Define async native functions callable from JavaScript
- **Syntax**: \`AsyncFunction("name") { param1: Type, param2: Type -> ... }\`
- **Returns**: Automatically wrapped in a Promise
- **Errors**: Thrown errors become rejected Promises

\`\`\`kotlin
// Native
AsyncFunction("myFunction") { input: String ->
    if (input.isEmpty()) throw Error("Input is empty")
    return "Success"
}

// JavaScript
try {
    const result = await myFunction("")  // Throws error
} catch (e) {
    console.error(e.message)  // "Input is empty"
}
\`\`\`

##### Type Conversion

Expo automatically converts between JavaScript and native types:

<div style="overflow-x: auto; margin: 20px 0; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">

| JavaScript | Kotlin              | Swift            |
| ---------- | ------------------- | ---------------- |
| \`string\`   | \`String\`            | \`String\`         |
| \`number\`   | \`Int\`, \`Double\`     | \`Int\`, \`Double\`  |
| \`boolean\`  | \`Boolean\`           | \`Bool\`           |
| \`object\`   | \`Map<String, Any?>\` | \`[String: Any?]\` |
| \`array\`    | \`List<Any?>\`        | \`[Any?]\`         |
| \`Promise\`  | \`suspend fun\`       | \`async\`          |

</div>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    background: #ffffff;
  }
  
  table thead {
    background: #667eea;
    color: white;
  }
  
  table th {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  
  table td {
    padding: 10px 16px;
    border-bottom: 1px solid #e0e0e0;
    color: #333;
  }
  
  table tbody tr:nth-child(even) {
    background-color: #f8f9fa;
  }
  
  table tbody tr:hover {
    background-color: #f0f3ff;
    transition: background-color 0.2s ease;
  }
  
  table code {
    background-color: rgba(102, 126, 234, 0.1) !important;
    padding: 3px 6px !important;
    border-radius: 3px !important;
    border: none !important;
  }
</style>

##### Module Configuration

\`\`\`json
// expo-module.config.json
{
    "platforms": ["android", "ios"],
    "android": {
        "modules": ["expo.modules.audioconverter.ExpoAudioConverterModule"]
    },
    "ios": {
        "modules": ["ExpoAudioConverterModule"]
    }
}
\`\`\`


### Full Implementation of AudioConverer (Not Related to Expo Modules)

#### Implementation

\`\`\`kotlin 
class AudioConverter {
    fun convertToWav(inputFile: File, outputFile: File) {
        val extractor = MediaExtractor()
        var format: MediaFormat? = null
        
        try {
            extractor.setDataSource(inputFile.absolutePath)
            
            // Find the audio track
            for (i in 0 until extractor.trackCount) {
                format = extractor.getTrackFormat(i)
                if (format.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
                    extractor.selectTrack(i)
                    break
                }
            }

            if (format == null) {
                throw IllegalArgumentException("No audio track found")
            }

            // Get audio properties
            val sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            println("sampleRate: $sampleRate")
            val channelCount = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            println("channelCount: $channelCount")
            // Create decoder
            val mime = format.getString(MediaFormat.KEY_MIME)
            val decoder = MediaCodec.createDecoderByType(mime!!)
            decoder.configure(format, null, null, 0)
            decoder.start()

            // Prepare output stream and write WAV header
            val outputStream = FileOutputStream(outputFile)
            writeWavHeader(outputStream, 0, sampleRate, channelCount)
            
            // Start decoding
            val info = MediaCodec.BufferInfo()
            var totalBytes = 0
            
            while (true) {
                val inputBufferId = decoder.dequeueInputBuffer(10000)
                if (inputBufferId >= 0) {
                    val inputBuffer = decoder.getInputBuffer(inputBufferId)!!
                    val sampleSize = extractor.readSampleData(inputBuffer, 0)
                    
                    if (sampleSize < 0) {
                        decoder.queueInputBuffer(inputBufferId, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                    } else {
                        decoder.queueInputBuffer(inputBufferId, 0, sampleSize, extractor.sampleTime, 0)
                        extractor.advance()
                    }
                }

                val outputBufferId = decoder.dequeueOutputBuffer(info, 10000)
                if (outputBufferId >= 0) {
                    val outputBuffer = decoder.getOutputBuffer(outputBufferId)!!
                    val chunk = ByteArray(info.size)
                    outputBuffer.get(chunk)
                    outputBuffer.clear()
                    
                    if (chunk.isNotEmpty()) {
                        outputStream.write(chunk)
                        totalBytes += chunk.size
                    }
                    
                    decoder.releaseOutputBuffer(outputBufferId, false)
                    
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                        break
                    }
                }
            }

            // Clean up
            outputStream.close()
            decoder.stop()
            decoder.release()
            extractor.release()

            // Update WAV header with final size
            updateWavHeader(outputFile, totalBytes)

        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun writeWavHeader(
        outputStream: FileOutputStream,
        totalAudioLen: Int,
        sampleRate: Int,
        channels: Int
    ) {
        val totalDataLen = totalAudioLen + 36
        val byteRate = sampleRate * channels * 2 // 16 bits per sample

        val header = ByteArray(44).apply {
            // RIFF header
            this[0] = 'R'.code.toByte()
            this[1] = 'I'.code.toByte()
            this[2] = 'F'.code.toByte()
            this[3] = 'F'.code.toByte()
            // Total file size - 8
            this[4] = (totalDataLen and 0xff).toByte()
            this[5] = (totalDataLen shr 8 and 0xff).toByte()
            this[6] = (totalDataLen shr 16 and 0xff).toByte()
            this[7] = (totalDataLen shr 24 and 0xff).toByte()
            // WAVE
            this[8] = 'W'.code.toByte()
            this[9] = 'A'.code.toByte()
            this[10] = 'V'.code.toByte()
            this[11] = 'E'.code.toByte()
            // fmt chunk
            this[12] = 'f'.code.toByte()
            this[13] = 'm'.code.toByte()
            this[14] = 't'.code.toByte()
            this[15] = ' '.code.toByte()
            // fmt chunk size
            this[16] = 16
            this[17] = 0
            this[18] = 0
            this[19] = 0
            // Audio format (PCM)
            this[20] = 1
            this[21] = 0
            // Number of channels
            this[22] = channels.toByte()
            this[23] = 0
            // Sample rate
            this[24] = (sampleRate and 0xff).toByte()
            this[25] = (sampleRate shr 8 and 0xff).toByte()
            this[26] = (sampleRate shr 16 and 0xff).toByte()
            this[27] = (sampleRate shr 24 and 0xff).toByte()
            // Byte rate
            this[28] = (byteRate and 0xff).toByte()
            this[29] = (byteRate shr 8 and 0xff).toByte()
            this[30] = (byteRate shr 16 and 0xff).toByte()
            this[31] = (byteRate shr 24 and 0xff).toByte()
            // Block align
            this[32] = (channels * 2).toByte()
            this[33] = 0
            // Bits per sample
            this[34] = 16
            this[35] = 0
            // data chunk
            this[36] = 'd'.code.toByte()
            this[37] = 'a'.code.toByte()
            this[38] = 't'.code.toByte()
            this[39] = 'a'.code.toByte()
            // Data size
            this[40] = (totalAudioLen and 0xff).toByte()
            this[41] = (totalAudioLen shr 8 and 0xff).toByte()
            this[42] = (totalAudioLen shr 16 and 0xff).toByte()
            this[43] = (totalAudioLen shr 24 and 0xff).toByte()
        }
        
        outputStream.write(header, 0, 44)
    }

    private fun updateWavHeader(file: File, totalAudioLen: Int) {
        RandomAccessFile(file, "rw").use { raf ->
            // Update file size
            raf.seek(4)
            val totalDataLen = totalAudioLen + 36
            raf.write((totalDataLen and 0xff).toByte().toInt())
            raf.write((totalDataLen shr 8 and 0xff).toByte().toInt())
            raf.write((totalDataLen shr 16 and 0xff).toByte().toInt())
            raf.write((totalDataLen shr 24 and 0xff).toByte().toInt())
            
            // Update data size
            raf.seek(40)
            raf.write((totalAudioLen and 0xff).toByte().toInt())
            raf.write((totalAudioLen shr 8 and 0xff).toByte().toInt())
            raf.write((totalAudioLen shr 16 and 0xff).toByte().toInt())
            raf.write((totalAudioLen shr 24 and 0xff).toByte().toInt())
        }
    }
}
\`\`\`
#### Code Breakdown and Learning Resources
##### STEP 1: Extract audio metadata

Reference: https://developer.android.com/reference/android/media/MediaExtractor
\`\`\`kotlin
val extractor = MediaExtractor()
extractor.setDataSource(inputFile.absolutePath)
val format = extractor.getTrackFormat(0)  // Get audio format info
\`\`\`

##### STEP 2: Create decoder

Reference: https://developer.android.com/reference/android/media/MediaCodec

\`\`\`kotlin
val decoder = MediaCodec.createDecoderByType(mime)  // AAC, MP3, etc.
decoder.configure(format, null, null, 0)
decoder.start()
\`\`\`
##### STEP 3: Decode loop (Producer-Consumer pattern)

\`\`\`kotlin
while (true) {
    // Producer: Feed compressed data
    val inputBufferId = decoder.dequeueInputBuffer(10000)
    extractor.readSampleData(inputBuffer, 0)
    decoder.queueInputBuffer(...)
    
    // Consumer: Get decoded PCM
    val outputBufferId = decoder.dequeueOutputBuffer(info, 10000)
    outputStream.write(pcmData)
}
\`\`\`
##### STEP 4: WAV header
Reference: http://soundfile.sapp.org/doc/WaveFormat/

\`\`\`kotlin
writeWavHeader(outputStream, totalBytes, sampleRate, channels)
\`\`\`     `;export{e as default};
