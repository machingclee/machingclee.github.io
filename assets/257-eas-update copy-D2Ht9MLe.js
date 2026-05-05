const n=`---
title: "EAS Update"
date: 2024-04-17
id: blog0257
tag: eas, expo
intro: "We discuss the technical detail of OTA (Over The Air) update which avoid unnecessary rebuild for updating a mobile application."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>



### Main Reference

- [**Official Documentation**](https://docs.expo.dev/eas-update/introduction/)

### Package Installation

- Install the packages for expo-updates

  \`\`\`text
  npx expo install expo-updates
  \`\`\`

### Config the \`eas.json\`

- Set update config:

  \`\`\`text 
  eas update:configure
  \`\`\`

  it should set the \`channel\` properties in our \`eas.json\` in all environments.

### Channels

- According to [**this documentation**](https://docs.expo.dev/eas-update/eas-cli/) we can check existing channels (the deployment stages) by 

  \`\`\`text
  eas channel:list
  \`\`\`

- We can view a specific channel by 
  \`\`\`text
  eas channel:view production
  \`\`\`

- We can create a channel by 

  \`\`\`text
  eas channel:create [channel-name]
  \`\`\`

  Let's create a channel called \`prod\`:

  ![](/assets/img/2024-04-17-22-03-44.png)

  then in expo-development portal:

  ![](/assets/img/2024-04-17-22-03-38.png)

### Branches

- A ***new branch*** \`version-1.0\` is automatically created and attached to \`prod\` channel

  ![](/assets/img/2024-04-17-22-04-08.png)


### Execution of the OTA Update and Caveat

- We add a script in \`package.json\`:

  \`\`\`text
  env-cmd -f .env-cmdrc -e default,prod eas update --branch uat --message "Update" --clear-cache
  \`\`\`

- Note that by default if no \`env\` variable is declared, all \`env\` variables ***will be erased***.

- This is why we declare all environment variables by 
  \`\`\`text
  env-cmd -f .env-cmdrc -e default,prod
  \`\`\` 
  in the deployment script.`;export{n as default};
