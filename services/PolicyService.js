const axios = require("axios");

class PolicyService {
  constructor(config, accessToken, sessionToken, policyNumber) {
    this.accessToken = accessToken
    this.sessionToken = sessionToken;
    this.policyNumber = policyNumber;
    this.policyEndpoint = config.policyEndpoint

    if (!this.policyEndpoint) {
      console.error("POLICIES_ENDPOINT environment variable is missing.");
      throw new Error("POLICIES_ENDPOINT environment variable is required.");
    }

    console.log("PolicyService initialized with session token and policy number.");
  }

  /**
   * Fetch policy data from the carrier's policies endpoint with retries and logging.
   * @returns {Promise<object>} - Raw policy data from the carrier.
   */

  async fetchPolicies() {
    
    const accessToken = this.accessToken;
    const sessionToken = this.sessionToken;
    const policyNumber = this.policyNumber;
    const endpoint = this.policyEndpoint.replace(/\/$/, ''); // Ensure no trailing slash

    // Define request details
    const url = new URL(`${endpoint}`);

    try {
        const response = await axios.post(url.toString(), {
            policyNumber: policyNumber
        }, {
        headers: {
          'Authorization': accessToken,   
          'X-SESSION-ID': sessionToken,     
          'Content-Type': 'application/json',
          'Host': '6dota27wl8.execute-api.us-east-1.amazonaws.com'
        }, timemout: 5000});
        console.log("Policies fetched successfully");
        return response.data.data;
    } catch (error) {
        console.error("Failed to fetch policies:", error.message);
        throw error;
    }
}
}

module.exports = PolicyService;
