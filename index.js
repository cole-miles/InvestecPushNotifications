// Import required modules
const axios = require("axios");
const qs = require('qs');
require("dotenv").config();
const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();

// Required Environment Variables (from your .env file, see below how to structure it)
    // INVESTEC_API_BASE=https://openapi.investec.com
    // CLIENT_ID=your_investec_client_id
    // CLIENT_SECRET=your_investec_client_secret
    // API_KEY=your_investec_api_key
    // PUSHOVER_USER_KEY=your_pushover_user_key
    // PUSHOVER_APP_TOKEN=your_pushover_app_token
const { CLIENT_ID, CLIENT_SECRET, API_KEY, INVESTEC_API_BASE } = process.env;

// --- BELOW ARE CUSTOMISABLE VARIABLES THAT YOU CAN CHANGE ---

const CREDIT_FACILITY = 15000; // *NB | Set your credit facility amount here (This is used to calculate the actual cash amount)

const DEVICE_NAME = 'iphone'; // *NB | Pushover device name (When you setup your Pushover account, you can set a device name to send notifications to a specific device)

const NOTIFICATION_PRIORITY = 1; // Pushover notification priority (Default is 1, you do not need to change this unless you want to set a different priority)

const TRANSACTION_TYPE = 'Deposits'; // Type of transactions to monitor (Default is 'Deposits', but can be changed to suit your needs)

// --- END OF CUSTOMISABLE VARIABLES ---

if (CREDIT_FACILITY < 0) throw new Error('CREDIT_FACILITY must be a positive number');
if (!DEVICE_NAME) throw new Error('DEVICE_NAME must be specified');
if (![1, 2, 0, -1, -2].includes(NOTIFICATION_PRIORITY)) throw new Error('Invalid NOTIFICATION_PRIORITY value');

// Exports main function to be used in the Cloud Function
exports.notificationHandler = async (req, res) => {
    try {
        await main();
        res.status(200).send("Deposits check completed.");
    } catch (error) {
        res.status(500).send("Error executing deposits check.");
    }
};

const processedDepositsRef = db.collection('processed_deposits');

// Function to get the OAuth2 token
async function getAuthToken() {
    try {
        // Base64 encode CLIENT_ID:CLIENT_SECRET
        const authString = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

        // Prepare data for POST request
        const data = qs.stringify({
            'grant_type': 'client_credentials',
        });

        // Configure axios request
        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${INVESTEC_API_BASE}/identity/v2/oauth2/token`,
            headers: {
                'x-api-key': API_KEY, // Add API Key
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${authString}`, // Add authorization header with base64 string
            },
            data: data
        };

        // Make the request
        const response = await axios.request(config);

        // Return the token from the response
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting auth token:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with Investec API.');
    }
}

// This function retrieves the user's bank accounts from the Investec API
async function getAccounts(authToken) {
    try {
        const response = await axios.get(
            `${INVESTEC_API_BASE}/za/pb/v1/accounts`,
            {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "x-api-key": API_KEY,
                },
            }
        );
        console.log("Accounts Response:", response.data); // Log response data
        return response.data.data.accounts;
    } catch (error) {
        console.error("Error fetching accounts:", error.response?.status, error.response?.data || error.message);
        throw new Error("Failed to retrieve accounts.");
    }
}

// This function retrieves the deposits for a specific account from the Investec API
async function getAccountDeposits(authToken, accountID) {
    const date = new Date();

    // Date format: YYYY/MM/DD as required by Investec API
    const yesterday =
        date.getFullYear() + '/' + String(date.getMonth() + 1).padStart(2, '0') + '/' + String(date.getDate() - 1).padStart(2, '0');

    const today =
        date.getFullYear() + '/' + String(date.getMonth() + 1).padStart(2, '0') + '/' + String(date.getDate()).padStart(2, '0');

    console.log(yesterday + ' ' + today);

    try {
        const response = await axios.get(
            `${INVESTEC_API_BASE}/za/pb/v1/accounts/${accountID}/transactions?fromDate=${today}&toDate=${today}&transactionType=${TRANSACTION_TYPE}`,
            {
                headers: {
                    Authorization: `Bearer ${authToken}`, // Use the OAuth2 Bearer token
                    'x-api-key': API_KEY, // Include your API key
                },
            }
        );

        // The account balance is typically in the response under the 'balance' field
        const deposits = response.data.data.transactions;
        return deposits; // Return the balance value

    } catch (error) {
        console.error("Error fetching account deposits:", error.response?.data || error.message);
        throw new Error("Failed to retrieve account deposits.");
    }
}

// This function retrieves the account balance for a specific account from the Investec API
async function getAccountBalance(authToken, accountId) {
    try {
      const response = await axios.get(
        `${INVESTEC_API_BASE}/za/pb/v1/accounts/${accountId}/balance`, // Endpoint to get account details
        {
          headers: {
            Authorization: `Bearer ${authToken}`, // Use the OAuth2 Bearer token
            'x-api-key': API_KEY, // Include your API key
          },
        }
      );
  
      // The account balance is typically in the response under the 'balance' field
      const accountBalance = response.data.data.availableBalance;
      console.log(`Account Balance: ${accountBalance}`);
      return accountBalance; // Return the balance value
  
    } catch (error) {
      console.error("Error fetching account balance:", error.response?.data || error.message);
      throw new Error("Failed to retrieve account balance.");
    }
}

// This function sends a Pushover notification
async function sendPushoverNotification(description, amount, actualCashAmount) {
    const { PUSHOVER_USER_KEY, PUSHOVER_APP_TOKEN } = process.env;

    try {
        const response = await axios.post("https://api.pushover.net/1/messages.json", {
            token: PUSHOVER_APP_TOKEN, // Your Pushover app token
            user: PUSHOVER_USER_KEY, // Your Pushover user key
            device: DEVICE_NAME, // The name of your device
            message: `Amount: R${amount.toFixed(2)}\nReference: ${description}\nBalance: R${actualCashAmount}`,
            title: "Bank Deposit",
            priority: NOTIFICATION_PRIORITY,
        });
        console.log("Pushover notification sent:", response.data);
    } catch (error) {
        console.error("Error sending Pushover notification:", error.response?.data || error.message);
        throw new Error("Failed to send Pushover notification.");
    }
}

// Function to check if transaction is already processed
async function isTransactionProcessed(uuid) {
    const docRef = processedDepositsRef.doc(uuid);
    const doc = await docRef.get();
    if (doc.exists) {
        console.log(`Transaction ${uuid} is already processed.`);
    } else {
        console.log(`Transaction ${uuid} is not processed.`);
    }
    return doc.exists;
}

// Main function to handle the deposits check
async function main() {
    try {
        console.log("Authenticating...");
        const authToken = await getAuthToken();
        console.log("Authentication successful.");

        const accounts = await getAccounts(authToken);

        // Main Private Bank Account is typically the first account in the list, if this is not the case, you can change this
        const mainAccountID = accounts[0].accountId;

        const deposits = await getAccountDeposits(authToken, mainAccountID);

        if (deposits && deposits.length > 0) {
            console.log("Processing deposits...");
            for (const deposit of deposits) {
                const { description, amount, uuid } = deposit;
                console.log(`Description: ${description}, Amount: ${amount}`);

                // Check if the deposit has already been processed
                const alreadyProcessed = await isTransactionProcessed(uuid);

                if (!alreadyProcessed) {
                    var pbBalance = await getAccountBalance(authToken, mainAccountID);
                    console.log(pbBalance);
                
                    const actualCashAmount = (pbBalance-CREDIT_FACILITY).toFixed(2);

                    // Send a notification for each deposit
                    await sendPushoverNotification(description, amount, actualCashAmount);

                    // Mark the transaction as processed by storing it in Firestore
                    await processedDepositsRef.doc(uuid).set({
                        uuid: uuid,
                        timestamp: new Date().toISOString(),
                    });
                } else {
                    console.log(`Transaction ${uuid} already processed.`);
                }
            }
            console.log("Notifications sent for all deposits.");
        } else {
            console.log("No deposits found.");
        }
    } catch (error) {
        console.error("Error:", error.message);
        console.error("Error details:", error.response?.status, error.response?.data || error.message);
    }
}