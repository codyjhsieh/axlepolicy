const express = require("express");
const bodyParser = require("body-parser");
const AuthService = require("./services/AuthService");
const PolicyService = require("./services/PolicyService");
const { mapToUniversalSpec } = require("./transformations");
const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");

require('dotenv').config();

// Check if dotenv is loading the environment variables
console.log("Loaded environment variables:");
console.log("MOCK_CARRIER_AUTH_ENDPOINT:", process.env.AUTH_ENDPOINT || "Not defined");
console.log("MOCK_CARRIER_HANDSHAKE_ENDPOINT:", process.env.HANDSHAKE_ENDPOINT || "Not defined");
console.log("POLICIES_ENDPOINT:", process.env.POLICIES_ENDPOINT || "Not defined");
console.log("PORT:", process.env.PORT || "Using default (3000)");

const app = express();
app.use(bodyParser.json());
app.use(logger);

// Define configuration for each carrier in a dictionary
const carrierConfigs = {
    "mock-carrier": {
      authEndpoint: process.env.AUTH_ENDPOINT,
      handshakeEndpoint: process.env.HANDSHAKE_ENDPOINT,
      policyEndpoint: process.env.POLICIES_ENDPOINT
    },
    "other-carrier": {
      authEndpoint: process.env.OTHER_CARRIER_AUTH_ENDPOINT,
      handshakeEndpoint: process.env.OTHER_CARRIER_HANDSHAKE_ENDPOINT,
      policyEndpoint: process.env.OTHER_CARRIER_POLICIES_ENDPOINT
    }
    // Add more carriers as needed
  };

// Helper function to get configuration for a specific carrier
function getCarrierConfig(carrier) {
    return carrierConfigs[carrier];
  }

// Main endpoint for fetching and mapping policies
app.post("/:carrier/policies", async (req, res) => {
    const { carrier } = req.params;
    console.log(`Received request on /${carrier}/policies`);

    // Get configuration for the specified carrier
    const carrierConfig = getCarrierConfig(carrier);
    if (!carrierConfig) {
      console.log(`Configuration for carrier '${carrier}' not found.`);
      return res.status(404).json({ error: `Unsupported carrier: ${carrier}` });
    }

  const { username, password } = req.body;
  console.log(`Request body - Username: ${username}, Password: ${password ? "****" : "Not provided"}`);

  // Input Validation
  if (!username || !password) {
    console.log("Missing username or password in request.");
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    // Initialize AuthService with configuration
    const authService = new AuthService(carrierConfig);
    console.log("AuthService initialized.");

    // Authenticate and perform handshake to get session token
    let sessionToken;
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Attempt ${attempt} to get session token...`);
        [accessToken, sessionToken, policyNumber]  = await authService.getSessionToken(username, password);
        console.log("Session token received successfully.");
        break;
      } catch (error) {
        console.error(`Failed to get session token on attempt ${attempt}:`, error.message);
        
        if (attempt === MAX_RETRIES || !isTransientError(error)) {
          console.error("Max retries reached or non-transient error. Aborting...");
          throw error; // Re-throw if it's a permanent error or max retries reached
        }

        const backoffTime = attempt * 1000;
        console.log(`Retrying after ${backoffTime}ms...`);
        await delay(backoffTime); // Exponential backoff
      }
    }

    // Initialize PolicyService with session token
    const policyService = new PolicyService(carrierConfig, accessToken, sessionToken, policyNumber);
    console.log("PolicyService initialized with session token.");

    // Fetch policies using session token
    let policyData;
    try {
      console.log("Fetching policies from PolicyService...");
      policyData = await policyService.fetchPolicies();
      console.log("Policies fetched successfully.");
    } catch (error) {
      console.error("Error fetching policies:", error.message);
    }

    // Transform policy data to universal spec
    console.log("Transforming policy data to universal spec...");
    const mappedData = mapToUniversalSpec(policyData, carrier);
    console.log("Data transformation complete. Sending response to client.");
    res.json(mappedData);
  } catch (error) {
    console.error("An error occurred:", error.message);
    // Pass the error to centralized error handler with response
    errorHandler(error, req, res);
  }
});

// Utility to delay with promise (for retries with backoff)
function delay(ms) {
  console.log(`Delaying for ${ms} milliseconds...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to check if an error is transient (e.g., network issues, 503 errors)
function isTransientError(error) {
  const isTransient = error.response && [502, 503, 504].includes(error.response.status);
  console.log(`Checking if error is transient: ${isTransient}`);
  return isTransient;
}

// Environment Configuration and App Initialization
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Export app for testing purposes
module.exports = app;
