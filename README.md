# Policy Management API

The Policy Management API is a service designed to handle user authentication, policy retrieval, and data transformation across different insurance carriers. Built with **Express.js**, this API provides a modular, extensible structure that enables seamless integration with multiple carriers while maintaining data consistency and security.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Instructions](#setup-and-installation)
4. [Design Decisions](#design-decisions)

---

## Overview

This API is developed to standardize the interaction with various insurance carriers by providing a unified interface for authentication and policy retrieval. Each carrier may have unique endpoints and data formats, but the Policy Management API standardizes these differences, transforming carrier-specific data into a universal format for consistency across services.

## Features

- **Carrier-Specific Configuration**: Supports multiple insurance carriers by loading configurations dynamically.
- **User Authentication**: Uses an `AuthService` module to handle secure user authentication.
- **Policy Retrieval**: Fetches policy data through the `PolicyService` and applies data transformations.
- **Data Transformation**: Transforms carrier-specific policy data into a universal format.
- **Error Handling and Retry Logic**: Comprehensive error handling for resilience in network-reliant environments.

## Instructions

1. **Call the API**:
    The API is currently deployed here: `https://axlepolicy-2b11096325c6.herokuapp.com`
   ```bash
   curl --location --request POST 'https://axlepolicy-2b11096325c6.herokuapp.com/mock-carrier/policies' \
    --header 'Content-Type: application/json' \
    --data-raw '{
        "username": "axle",
        "password": "2023"
    }'

2. **Example Output**
```json
{
  "carrier": "mock-carrier",
  "type": "auto",
  "policyNumber": "123 4678-C10-34Q",
  "isActive": false,
  "effectiveDate": "2022-06-10T00:00:00.000Z",
  "expirationDate": "2022-12-10T00:00:00.000Z",
  "address": {
    "addressLine1": "123 Cherry Lane",
    "addressLine2": null,
    "city": "Atlanta",
    "state": "Georgia",
    "postalCode": "30318",
    "country": "USA"
  },
  "coverages": [
    {
      "code": "BI",
      "label": "Bodily Injury Liability",
      "deductible": null,
      "limitPerAccident": 500000,
      "limitPerPerson": 250000
    },
    {
      "code": "PD",
      "label": "Property Damage Liability",
      "deductible": null,
      "limitPerAccident": 100000,
      "limitPerPerson": null
    },
    {
      "code": "MED",
      "label": "Medical Payments",
      "deductible": null,
      "limitPerAccident": null,
      "limitPerPerson": null
    },
    {
      "code": "COMP",
      "label": "Comprehensive",
      "deductible": 100,
      "limitPerAccident": null,
      "limitPerPerson": null
    },
    {
      "code": "COLL",
      "label": "Collision",
      "deductible": 1000,
      "limitPerAccident": null,
      "limitPerPerson": null
    },
    {
      "code": "UMBI",
      "label": "Uninsured Motorists Bodily Injury Liability",
      "deductible": null,
      "limitPerAccident": 500000,
      "limitPerPerson": 250000
    },
    {
      "code": "UMPD",
      "label": "Uninsured Motorists Property Damage Liability",
      "deductible": null,
      "limitPerAccident": 100000
    },
    {
      "code": "ERS",
      "label": "Emergency Road Service",
      "deductible": null,
      "limitPerAccident": null,
      "limitPerPerson": null
    },
    {
      "code": "REN",
      "label": "Car Rental",
      "deductible": null,
      "limitPerAccident": null,
      "limitPerPerson": null
    }
  ],
  "properties": [
    {
      "type": "vehicle",
      "data": {
        "bodyStyle": "4DR",
        "vin": "2NM3E123D37398562",
        "model": "Model 3",
        "year": "2019",
        "make": "Tesla"
      }
    }
  ]
}
```


## Design Decisions

### 1. Dynamic Carrier-Specific Configuration and Routing

   - **Objective**: Support multiple carriers, each with unique endpoints, authentication methods, and data formats, without duplicating code or configurations.
   - **Solution**: Implemented dynamic routing with carrier-based path parameters (e.g., `/:carrier/policies`). Each carrier is associated with a distinct configuration loaded based on the route parameter.
   - **Benefits**:
     - **Extensibility**: New carriers can be added with minimal changes by simply adding their configuration data.
     - **Reduced Complexity**: By dynamically loading configurations, the API avoids hardcoding logic for each carrier, making it adaptable and maintainable.


### 2. Service-Oriented Architecture (SOA) with Encapsulated Modules

   - **Objective**: Separate the concerns of authentication, policy retrieval, and data transformation to ensure modularity and reusability.
   - **Solution**: 
     - **`AuthService.js`**: Dedicated to handling user authentication. It encapsulates all functionality related to obtaining and refreshing session tokens, making it reusable across carriers.
     - **`PolicyService.js`**: Focused solely on retrieving and formatting policy data based on session tokens and carrier specifications.
   - **Benefits**:
     - **Single Responsibility**: Each module is responsible for one aspect of the application, enhancing maintainability and simplifying debugging.
     - **Reusability**: Modules are isolated and can be reused for additional carriers or expanded to support different policy types.

### 3. Unified Data Transformation via `mapToUniversalSpec`

#### 1. `mapToUniversalSpec` - Main Transformation Function

   - **Objective**: Convert carrier-specific policy data to a universal format that maintains consistency across all carriers and allows easy integration with downstream services.
   - **Approach**:
     - **Dynamic Policy Type Mapping**: The `determinePolicyType` function derives the policy type based on `productLineCode` or `productDescriptionText`. This eliminates the need for hardcoded types, allowing the API to remain flexible for new carriers and policy types.
     - **Date Validation and Formatting**: `validateDate` ensures date fields (e.g., `effectiveDate` and `expirationDate`) are correctly parsed and formatted in ISO format, preventing downstream parsing issues.
     - **Active Policy Status**: The `isActive` field is computed based on current date validation against the effective and expiration dates, indicating if a policy is currently active.

#### 2. Policy Type Derivation (`determinePolicyType`)

   - **Objective**: Infer the policy type (e.g., "auto," "home") to support downstream data consistency.
   - **Approach**:
     - A `typeMapping` dictionary uses `productLineCode` to map codes to standard types (e.g., `'A'` maps to `"auto"`).
     - Additionally, `productDescriptionText` provides an alternate way to determine type for carriers that may not use standardized codes, increasing flexibility and robustness.
   - **Fallback to Default**: If no matching type is found, the function returns `"unknown"` to handle undefined types without breaking functionality.

#### 3. Address Mapping and Validation (`mapAddress`)

   - **Objective**: Standardize address fields to maintain a consistent format across carriers.
   - **Design**:
     - **Default Values**: Sets `addressLine1`, `city`, and `state` to `"N/A"` if missing, ensuring these fields are always present in the response.
     - **Postal Code Validation**: `validatePostalCode` enforces a 5-digit postal code format to standardize across U.S. addresses, which simplifies parsing and validation for downstream applications.
     - **Title Case Formatting**: City names are formatted to title case for uniformity in presentation, using `formatTitleCase`.

#### 4. Coverage Mapping and Handling (`mapCoverage`)

   - **Objective**: Normalize and structure coverage details for various policy types.
   - **Approach**:
     - **Special Coverage Handling**: Recognizes specific cases like `UNINSURED_MOTOR_VEHICLE_CTGRY`, creating two separate coverages (`UMBI` and `UMPD`) based on context. This decomposition improves clarity in coverage data, especially for complex coverages.
     - **Dynamic Context Assignment**: Iterates over line details to assign fields (e.g., "Limit Per Accident") to the correct context (UMBI or UMPD), supporting nuanced data structures from carriers.
   - **Result**: Ensures that coverages, including edge cases, are handled comprehensively, offering precise and accessible coverage information in a single standardized format.

#### 5. Flexible Data Extraction (`extractAmount`, `extractDeductible`, `extractLimit`)

   - **Objective**: Accurately parse and return amounts for various fields (e.g., deductible, limits) while handling varied formats.
   - **Approach**:
     - **Pattern Matching**: Uses regex to parse amounts in strings (e.g., `$500,000`), ensuring compatibility with different currency formats.
     - **Null Handling**: If no matching amount is found, functions return `null`, ensuring that missing data does not cause errors downstream.
   - **Benefit**: This modular approach allows for consistent handling of financial values across different carriers without requiring manual intervention.

#### 6. VIN and Year Validation (`validateVin`, `validateYear`)

   - **Objective**: Ensure vehicle details are validated to prevent incorrect data entry and enforce consistency.
   - **Design**:
     - **VIN Validation**: Checks that Vehicle Identification Numbers (VINs) are 17 characters long. Non-compliant VINs are flagged as `"INVALID_VIN"`, highlighting potential data issues.
     - **Year Validation**: Limits the vehicle’s model year to the range between 1886 (the invention of cars) and the current year, ensuring reasonable values.
   - **Result**: These validations prevent erroneous vehicle data from being processed and alert the system to potential data inconsistencies.

#### 7. State Code Mapping (`mapStateCode`)

   - **Objective**: Convert state abbreviations to full state names, ensuring a standardized format.
   - **Design**:
     - **Mapping Dictionary**: A `stateMappings` object provides a reference to map abbreviations (e.g., `"GA"`) to full state names (e.g., `"Georgia"`).
     - **Fallback Behavior**: If a state code is not found, the function defaults to returning the original state code, allowing flexibility for non-U.S. addresses.
   - **Benefit**: Supports uniformity across different carriers and simplifies display for end-users.


### 4. Retry Mechanism with Exponential Backoff

   - **Objective**: Improve resilience to transient network errors and rate-limiting issues from carrier APIs.
   - **Solution**: Implemented a retry strategy with exponential backoff in `AuthService`. Transient errors (e.g., HTTP 503) trigger retries with increasing delays, while permanent errors (e.g., HTTP 400) are logged and handled without retries.
   - **Benefits**:
     - **Reliability**: Reduces the impact of temporary network issues and increases the chance of successful requests.
     - **Efficient Resource Use**: Exponential backoff prevents excessive load on carrier APIs and conserves resources by spacing out retries.

### 5. Centralized Error Handling and Logging

   - **Objective**: Ensure consistent error handling and comprehensive logging for easier debugging and monitoring.
   - **Solution**: Used a centralized error-handling middleware to log errors uniformly and respond to clients with structured error messages. Logs are enriched with contextual information like carrier name and request details.
   - **Benefits**:
     - **Observability**: Consistent logging provides insights into application behavior and simplifies troubleshooting.
     - **Error Transparency**: Clients receive clear, consistent error responses, improving the user experience and aiding in external error tracking.

### 6. Stateless Architecture for Scalability

   - **Objective**: Ensure that the API can scale horizontally to handle varying loads without session management complexities.
   - **Solution**: The API is stateless, meaning each request is self-contained and does not rely on previous requests. Session tokens are handled within request headers, supporting load balancing and distributed architectures.
   - **Benefits**:
     - **Horizontal Scalability**: The API can be scaled across multiple servers or containers easily.
     - **Flexibility**: Stateless design simplifies deployment on cloud platforms like Heroku, supporting auto-scaling.

