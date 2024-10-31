const axios = require("axios");

class AuthService {
  constructor(config) {
    this.authEndpoint = config.authEndpoint;
    this.handshakeEndpoint = config.handshakeEndpoint;
    console.log("AuthService initialized with endpoints:", config);
  }

  async getSessionToken(username, password) {
    console.log("Starting authentication process for user:", username);
    const authToken = await this.authenticateWithRetry(username, password);
    console.log("Authentication successful. Received auth token:", authToken);

    const [sessionToken, policyNumber] = await this.performHandshakeWithRetry(authToken);
    console.log("Handshake successful. Received session token:", sessionToken);
    return [authToken, sessionToken, policyNumber];
  }

  async authenticateWithRetry(username, password) {
    console.log(`Authenticating user ${username} at endpoint: ${this.authEndpoint}`);
    return await this.retry(async () => {
      const response = await axios.post(this.authEndpoint, { username, password });
      if (!response.data || !response.data.data || !response.data.data.accessToken) {
        throw new Error("Authentication failed: auth token missing in response.");
      }
      console.log("Received auth token from authentication endpoint.");
      return response.data.data.accessToken;
    });
  }

  async performHandshakeWithRetry(authToken) {
    console.log("Performing handshake with auth token at endpoint:", this.handshakeEndpoint);

    // Extract userId from authToken using custom function
    const userId = extractUserIdFromToken(authToken);
    console.log(`Extracted userId from token: ${userId}`);

    return await this.retry(async () => {
      try {
        console.log(`Attempting handshake with userId: ${userId}`);
        const response = await axios.post(this.handshakeEndpoint, { userId }, {
          headers: { Authorization:  authToken },
        });

        if (!response.data || !response.data || !response.data.data.session || !response.data.data.policyNumber) {
          throw new Error("Handshake failed: session token missing in response.");
        }
        console.log("Received session token from handshake endpoint.");
        return [response.data.data.session, response.data.data.policyNumber];
      } catch (error) {
        if (error.response) {
          console.error("Handshake error response data:", error.response.data);
        }
        throw error; // Re-throw to trigger retry logic if configured
      }
    });
  }

  async retry(fn, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} of ${maxRetries}...`);
        return await fn();
      } catch (error) {
        const status = error.response?.status;
        console.error(`Error on attempt ${attempt}:`, error.message);

        if (status === 401) {
          console.error("Authentication failed: invalid username or password.");
          throw new Error("Authentication failed: invalid username or password.");
        }

        if (status === 429) {
          const retryAfter = error.response.headers["retry-after"];
          const delayTime = retryAfter ? parseInt(retryAfter) * 1000 : attempt * 1000;
          console.log(`Rate limited. Retrying after ${delayTime}ms.`);
          await this.delay(delayTime);
          continue;
        }

        if ([502, 503, 504].includes(status)) {
          if (attempt === maxRetries) {
            console.error("Max retries reached. Service unavailable.");
            throw new Error("Service temporarily unavailable. Please try again later.");
          }
          const backoffTime = attempt * 1000;
          console.log(`Transient error (${status}). Retrying after ${backoffTime}ms.`);
          await this.delay(backoffTime);
          continue;
        }

        console.error(`Non-retryable error occurred: ${error.message}`);
        throw error;
      }
    }
  }

  delay(ms) {
    console.log(`Delaying for ${ms} milliseconds...`);
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Extracts the userId from a JWT token.
 * @param {string} token - JWT token
 * @returns {string} userId
 */
function extractUserIdFromToken(token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
      return payload.userId || payload.sub; // Adjust based on your token's structure
    } catch (error) {
      console.error("Error decoding token payload:", error.message);
      throw new Error("Invalid token format. Could not extract userId.");
    }
  }

module.exports = AuthService;
