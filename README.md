# Investec Bank Transaction Monitor

A Node.js application that monitors your Investec bank account for new transactions and sends notifications to your mobile device via Pushover. This application is designed to run as a Google Cloud Function and can be scheduled using Google Cloud Scheduler.

## Features

- 🏦 Monitors Investec bank account transactions  
- 📱 Sends push notifications for new deposits via Pushover  
- 🔄 Prevents duplicate notifications using Google Firestore  
- ⚡ Runs serverless on Google Cloud Functions  
- ⏰ Can be scheduled to run automatically  

## Prerequisites

Before you begin, you'll need:

- An Investec Private Bank Account  
- Investec Programmable Banking enabled  
- A Google Cloud Platform account  
- A Pushover account  
- Node.js installed on your local machine  

## Setup Instructions

### 1. Investec API Setup

- Log into your Investec Online Banking  
- Navigate to Programmable Banking  
- Generate your API keys (save the `CLIENT_ID`, `CLIENT_SECRET`, and `API_KEY`)  

### 2. Pushover Setup

- Create a Pushover account at [pushover.net](https://pushover.net)
- Create a new application to get your `APP_TOKEN`  
- Note down your `USER_KEY`  
- Download the pushover app to your mobile device and configure it using the account you created  

### 3. Google Cloud Setup

- Create a new Google Cloud Project (You may name it however you please)  
- Enable the following APIs:  
  - Cloud Functions  
  - Cloud Scheduler  
  - Firestore  
  - Cloud Build  
  
### 4. Cloning this project

Clone this repository:

```shell
git clone https://github.com/cole-miles/InvestecPushNotifications.git
cd investec-transaction-monitor
```
  
Install dependencies:

```shell
npm install
```

### 4. Configuration

#### Environment Variables

Create a `.env` file in the cloned project with the following variables:

```env
INVESTEC_API_BASE=https://openapi.investec.com
CLIENT_ID=your_investec_client_id
CLIENT_SECRET=your_investec_client_secret
API_KEY=your_investec_api_key
PUSHOVER_USER_KEY=your_pushover_user_key
PUSHOVER_APP_TOKEN=your_pushover_app_token
```

#### Customizable Parameters

You can customize the following parameters in `index.js`:

```javascript
// Customizable Variables
const CREDIT_FACILITY = 15000;    // Your credit facility amount
const DEVICE_NAME = 'iphone';     // Your Pushover device name
const NOTIFICATION_PRIORITY = 1;   // Pushover notification priority (1 is default)
const TRANSACTION_TYPE = 'Deposits'; // Type of transactions to monitor
```
**NB:** It is vital that you change the CREDIT_FACILITY variable to the credit facility amount that you have on your personal account.
#### Account Selection

By default, the application uses the first account returned by the Investec API. If you need to use a different account, modify the following line in `main()`:

```javascript
const mainAccountID = accounts[0].accountId;  // Change index if needed
```

### 5. Deployment

Deploy the cloned project to Google Cloud Functions:

- Install gcloud-cli by following [this guide](https://cloud.google.com/sdk/docs/install) (This allows you to deploy to gcloud from the command line/terminal within your IDE)

Once you've installed and setup gcloud cli, switch to your project by using this command in the terminal:
```shell
gcloud config set project `PROJECT ID`
```
Replace 'PROJECT ID' with the ID of your created gcloud project.  
  
**NB:** The project id is not the same as the project name, you can find the project id by clicking on the select project button at the top of the google cloud console where the project name is listed, or you can use ctrl+o from your project page and it should open).  
  
Run this command to deploy the application to your google cloud project.
```shell
gcloud functions deploy transferHandler \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region us-central1
```
**NB:** you must use the region that you set your gcloud project to.  

### 6. Setting up Cloud Scheduler

- Go to Google Cloud Console > Cloud Scheduler  
- Create a new job  
- Set the frequency (e.g., `*/5 * * * *` for every 5 minutes, I have mine set to every 30 minutes but this is personal preference)  
- Set the target as HTTP  
- Use the Cloud Function URL as the endpoint  
- Set the HTTP method to POST  

## Related Projects

**Firestore Cleanup Function** – A companion application that periodically cleans up the Firestore database. You can find this on my page as a public repo as well.  
  
**I highly recommend that you clone and push the Cleanup Function to the same gcloud project as this function to avoid going over free cost caps**

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License – see the LICENSE file for details.

## Support

If you encounter any problems or have questions, please open an issue in this repository.
