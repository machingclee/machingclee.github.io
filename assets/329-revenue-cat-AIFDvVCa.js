const e=`---
title: RevenueCat Fundamentals
date: 2024-10-10
id: blog0329
tag: payment, react-native, revenue-cat
toc: true
intro: We study the basic steps to enable inapp-purchase.
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Step up an Revenue Cat Account

1. Create an account in [Revenue Cat](https://www.revenuecat.com/)

2. Create a project in revenue cat

3. Inside of the project, create ios/android application with desired name and

4. Click the application and start to setup inapp purchases in your mobile app

   ![](/assets/img/2024-10-21-00-26-31.png)

### InApp Purchase Easy Mode (iOS)

#### iOS: Revenue Cat Setting

Relative to android, iOS is much more straight forward and simple. Let's go through the following one by one:

![](/assets/img/2024-10-21-00-08-14.png)

##### App Store Connect App-Specific Shared Secret

Refer to [Official Documentation](https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret)

##### In-app purchase key configuration

Refer to [Official Documentation](https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret/in-app-purchase-key-configuration)

##### Apple and Apple Store Connect API

Refer to [Official Documentation](https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret/app-store-connect-api-key-configuration)

##### Get the Public ApiKey

Click \`save changes\`, an \`ApiKey\` can be obtained from

![](/assets/img/2024-10-21-00-48-55.png)

With this key we can fetch all our products and subscription list once configuration in app store connect is done.

#### iOS: App Store Connect Setting

##### Go to Susbcription Page and Mange Subscription Group

Click on Subscriptions:

![](/assets/img/2024-10-21-00-23-00.png)

Click on Subscription Groups and create a group (of subscriptions):

![](/assets/img/2024-10-21-00-23-29.png)

##### Create Subscription Plans

Inside of the subscription group manage all your plans (weekly, monthly, yearly, etc). A user will be able to subscribe **_only one_** of them at one period:

![](/assets/img/2024-10-21-00-25-23.png)

##### Order Subscription Plans for Upgrade and Downgrade

Note that subscription plans have a notion of "upgrade" and "downgrade", be sure to read this instruction:

![](/assets/img/2024-10-21-00-29-24.png)

- Superior plan should be placed on top of inferior plans.
- In this way apple knows how to organize payment (upgrade should pay immediately with cost calculated with proration, and downgrade should be scheduled at the end of billing period).

##### Return to Revenue Cat to Manage the Subscriptions

After the subscription list is all set, go back to revenue cat and import the product list:

![](/assets/img/2024-10-21-00-35-26.png)

![](/assets/img/2024-10-21-00-34-28.png)

##### Offerings: the Logical Group of Subscriptions (Subset of a Subscription Group in App Store Connect)

Let's go to offerings and create a group of subscriptions that users can purchase (**_only one subscription_** can be active at a period)

An offering usually looks:

![](/assets/img/2024-10-21-00-38-22.png)

Users can choose which plan they want.

- In short, "offerings" is a logical group of available choices of which you can only choose one.

- And for sure they must be inside of the **_same subscription group_** in app store connect.

##### NPM Package to get all the Subscriptions

Now attach the \`APIKEY\` in your app and you are set to fetch the subscriptions! Since we are using react-native, we will be discussing how to get the list via revenue-cat's [\`react-native-purchases-ui\`](https://www.npmjs.com/package/react-native-purchases-ui)

### InApp Purchase Hard Mode (Android)

#### Android: Revenue Cat Setting

Play console will be another long story.

Compared to app store connect, we just need to provide one credentials JSON of your _service account_ (explain later). But getting this \`JSON\` and getting the mobile build to fetch data successfully will be a bit harder.

![](/assets/img/2024-10-21-00-55-36.png)

#### Android: Google Play Console

#### Bounce Between Google Cloud Platform, Revenue Cat and Google Play Console

First we need to strictly follow [this official documentation](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials), this will include:

- **1.** Enable the Google Developer and Reporting API (GCP)

- **2.** Create a Service Account (GCP), download the **_credential json_** of this account

- **3.** Grant this service account (Play Console) the permissions
- **4.** Paste the credential into revenue cat

- **5.** Upload signed .aab file in both this page:

  ![](/assets/img/2024-10-21-01-47-56.png)

  where you will be redirected to **_Closed Testing_**. Note that the offical docoumentation is out-dated, you are not able to upload apk.

  If you have uploaded an \`.aab\` file before, you can simply choose \`add from library\`:

  ![](/assets/img/2024-10-21-01-49-50.png)

- **6.** Update the tester list:

  ![](/assets/img/2024-10-21-01-56-19.png)

- **7.** Release the internal test, non-dev tester can only test your inapp-purchase via this internal test build. Upon successful submission (no review needed), you will be given an **_URL_**. Share it to android testers, they will be redirected to a hidden page in playstore to download the app.

#### Expo Evil Detail for Android Development Build

- Our local development build must also be signed with the same \`app-signing-key\` used in the \`.abb\` we just uploaded/selected. Therefore it is beneficial to us to store the \`app-signing-key\` locally.

- In \`eas.json\`, set \`build.dev.android.credentialsSource = "local"\`.

- \`expo run\` does not allow \`--profile\`, but it reads \`development\`/\`dev\` profile automatically in \`eas.json\`

  **Remark.** \`expo run\` does read \`eas.json\` (not just by eas-build in the cloud)

- Development build **_cannot be in debug mode_**, set

  \`\`\`json
  { "gradleCommand": ":app:assembleRelease" }
  \`\`\`

  in \`dev\` profile of \`eas.json\`

  **Remark 1.** Otherwise (in debug mode) we get ErrorCode: ITEM_UNAVAILABLE ([reference](https://github.com/RevenueCat/purchases-flutter/issues/93) from flutter developer)

  **Remark 2.** Hot-reload is still available, we can keep developing in \`release\` mode

### React-Native Part

#### Get all Packages

\`\`\`js
const fetchPackages = async () => {
    try {
        dispatch(appSlice.actions.setLoading({ open: true, showOverlay: true }))
        const offerings = await Purchases.getOfferings()
        if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
            setAvailablePackages(offerings.current.availablePackages)
            console.log("offerings.current.availablePackages.length", offerings.current.availablePackages.length)
        }
    } catch (err) {
        console.log(err)
    }
}
\`\`\`
#### Get a Monthly Plan

\`\`\`js
const monthlyHandyPackage = packages.find((package_) => {
    const productIdentifier = package_.productIdentifier
    const isHandyBillie = isHandyRegex.test(productIdentifier)
    const isMonthly = package_.rawPackage.packageType === "MONTHLY"
    return isHandyBillie && isMonthly
})
\`\`\`
#### Get a Annual Plan

\`\`\`js
const yearlyHandyPackage = packages.find((package_) => {
    const productIdentifier = package_.productIdentifier
    const isHandyBillie = isHandyRegex.test(productIdentifier)
    const isYearly = package_.rawPackage.packageType === "ANNUAL"
    return isHandyBillie && isYearly
})
\`\`\`
#### Subscribe a Plan
\`\`\`js
const subscribeItem = async (package: PurchasesPackage, period: Period) => {
    if (package && period) {
        dispatch(appSlice.actions.setLoading({ open: true, showOverlay: true }))
        try {
            const { customerInfo } = await Purchases.purchasePackage(package)
            const { originalAppUserId } = customerInfo
            const platform = (() => {
                if (Platform.OS === "ios") {
                    return MobilePlatform.IOS
                } else if (Platform.OS === "android") {
                    return MobilePlatform.ANDROID
                } else {
                    throw new Error("Only ios and android platform are supported.")
                }
            })()
            // keep a record in our own backend
            dispatch(SeatThunkAction.paymentSucceeded({ period, platform, originalAppUserId }))
        } catch (err) {
            console.log(err)
        } finally {
            dispatch(appSlice.actions.setLoading({ open: false }))
        }
    }
}
\`\`\`

### Potential Issue: This version of the application is not configured for billing through Google Play
We can troubleshoot this problem by elimiating all possibilities listed in [this answer (stackoverflow)](https://stackoverflow.com/questions/11068686/this-version-of-the-application-is-not-configured-for-billing-through-google-pla)
`;export{e as default};
