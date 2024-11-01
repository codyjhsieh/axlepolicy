function mapToUniversalSpec(policyData, carrier) {
    const effectiveDate = validateDate(policyData.agreement.effectiveDate);
    const expirationDate = validateDate(policyData.agreement.endDate);
    const currentDate = new Date();
    const policyType = determinePolicyType(policyData.agreement);

    return {
        carrier: carrier || "unknown",
        type: policyType,
        policyNumber: policyData.agreement.displayNumber || "N/A",
        isActive: currentDate >= new Date(effectiveDate) && currentDate <= new Date(expirationDate),
        effectiveDate: effectiveDate,
        expirationDate: expirationDate,
        address: mapAddress(policyData.agreement.policyAddress),
        coverages: Array.isArray(policyData.coverages) ? policyData.coverages.flatMap(mapCoverage) : [],
        properties: [mapVehicle(policyData.vehicle)]
    };
}

// Determine policy type based on product line code or description text
function determinePolicyType(agreement) {
    const typeMapping = {
        'A': 'auto',
        'H': 'home',
        'L': 'life',
        'B': 'business'
    };
    const productLineCode = agreement.productLineCode;
    const descriptionText = agreement.productDescriptionText?.toUpperCase();

    if (typeMapping[productLineCode]) return typeMapping[productLineCode];
    if (descriptionText?.includes("PRIVATE PASSENGER") || agreement.vehicles) return 'auto';
    return 'unknown';
}

// Helper function to validate and format dates
function validateDate(date) {
    const parsedDate = new Date(date);
    return isNaN(parsedDate) ? null : parsedDate.toISOString();
}

// Helper function to map address data
function mapAddress(address = {}) {
    return {
        addressLine1: address.addressLine1 || "N/A",
        addressLine2: address.addressLine2 || null,
        city: formatTitleCase(address.city) || "N/A",
        state: mapStateCode(address.state) || "N/A",
        postalCode: validatePostalCode(address.postalCode),
        country: address.country || "USA" // Assuming 'USA' as default
    };
}

// Format text to Title Case
function formatTitleCase(text) {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

// Postal code validation to enforce only 5-digit format, trimming if longer
function validatePostalCode(postalCode) {
    const postalCodeString = typeof postalCode === "string" ? postalCode : String(postalCode);
    const fiveDigitMatch = postalCodeString.match(/^\d{5}/); // Matches the first 5 digits if present
    return fiveDigitMatch ? fiveDigitMatch[0] : null; // Returns only the 5-digit portion or null
}

// Helper function to map individual coverage items
function mapCoverage(coverage = {}) {
    const coverages = []; // Initialize the main coverages array

    // Special handling for UNINSURED_MOTOR_VEHICLE_CTGRY to create UMBI and UMPD
    if (coverage.name === "UNINSURED_MOTOR_VEHICLE_CTGRY") {
        const lineDetails = coverage.lineDetails || [];
        const umbiDetails = []; // For Uninsured Motorists Bodily Injury Liability
        const umpdDetails = []; // For Uninsured Motorists Property Damage Liability
        let currentContext = null; // Track current context (UMBI or UMPD)

        // Iterate over each lineDetail and assign it based on context
        lineDetails.forEach((detail) => {
            const text = detail.value;

            // Set context based on keywords in the text
            if (text.includes("UE BI ") || text.includes("Bodily Injury")) {
                currentContext = "UMBI";
                umbiDetails.push(detail);
            } else if (text.includes("UE PD ") || text.includes("Property Damage")) {
                currentContext = "UMPD";
                umpdDetails.push(detail);
            } 
            // Assign "Limit Per Accident" based on recent context
            else if (text.includes("Limit Per Accident")) {
                if (currentContext === "UMBI") {
                    umbiDetails.push(detail);
                } else if (currentContext === "UMPD") {
                    umpdDetails.push(detail);
                }
            }
            // Assign "Limit Per Person" and "Deductible" based on context
            else if (text.includes("Limit Per Person") && currentContext === "UMBI") {
                umbiDetails.push(detail);
            } else if (text.includes("Deductible") && currentContext === "UMPD") {
                umpdDetails.push(detail);
            }
        });

        // Create UMBI coverage using filtered line details
        const umbCoverage = {
            code: "UMBI",
            label: "Uninsured Motorists Bodily Injury Liability",
            deductible: extractAmount(umbiDetails, "Deductible"),
            limitPerAccident: extractAmount(umbiDetails, "Limit Per Accident"),
            limitPerPerson: extractAmount(umbiDetails, "Limit Per Person")
        };

        // Create UMPD coverage using filtered line details
        const umpCoverage = {
            code: "UMPD",
            label: "Uninsured Motorists Property Damage Liability",
            deductible: extractAmount(umbiDetails, "Deductible"),
            limitPerAccident: extractAmount(umpdDetails, "Limit Per Accident")
        };

        // Add UMBI and UMPD to the main coverages array only if they contain non-empty values
        if (Object.values(umbCoverage).some(value => value !== null)) coverages.push(umbCoverage);
        if (Object.values(umpCoverage).some(value => value !== null)) coverages.push(umpCoverage);

        return coverages; // Return UMBI and UMPD as individual objects in the array
    }

    
    const deductible = extractDeductible(coverage.lineDetails);
    const limitPerAccident = extractLimit(coverage.lineDetails, "Limit Per Accident");
    const limitPerPerson = extractLimit(coverage.lineDetails, "Limit Per Person");

    // Return other coverages as an array with a single coverage object
    return [{
        code: mapCoverageCode(coverage.name),
        label: mapCoverageLabel(coverage.name),
        deductible: deductible,
        limitPerAccident: limitPerAccident,
        limitPerPerson: limitPerPerson
    }];
}

// Function to extract deductible from lineDetails
function extractDeductible(lineDetails) {
    return extractAmount(lineDetails, "Deductible");
}

// Function to extract limits from lineDetails
function extractLimit(lineDetails, type) {
    return extractAmount(lineDetails, type);
}

// General function to extract an amount based on a key phrase
function extractAmount(lineDetails, type) {
    if (!Array.isArray(lineDetails)) return null;
    
    for (const detail of lineDetails) {
        if (typeof detail.value === 'string' && detail.value.includes(type)) {
            const match = detail.value.match(/\$([0-9,]+)/);
            if (match) {
                return parseFloat(match[1].replace(/,/g, '')); // Remove commas and parse as a number
            }
        }
    }
    return null; // Return null if no matching amount found
}

// Map coverage names to standardized codes
function mapCoverageCode(name) {
    const coverageCodes = {
        'BODILY_INJURY': 'BI',
        'PROPERTY_DAMAGE': 'PD',
        'MEDICAL_PAYMENTS': 'MED',
        'UNINSURED_MOTOR_VEHICLE_CTGRY': 'UMBI',
        'EMERGENCY_ROAD_SERVICE': 'ERS',
        'CAR_RENTAL': 'REN',
        'COMPREHENSIVE': 'COMP',
        'COLLISION': 'COLL'
    };
    return coverageCodes[name] || "UNKNOWN";
}

// Map coverage names to descriptive labels
function mapCoverageLabel(name) {
    const coverageLabels = {
        'BODILY_INJURY': 'Bodily Injury Liability',
        'PROPERTY_DAMAGE': 'Property Damage Liability',
        'MEDICAL_PAYMENTS': 'Medical Payments',
        'UNINSURED_MOTOR_VEHICLE_CTGRY': 'Uninsured Motorists Bodily Injury Liability',
        'EMERGENCY_ROAD_SERVICE': 'Emergency Road Service',
        'CAR_RENTAL': 'Car Rental',
        'COMPREHENSIVE': 'Comprehensive',
        'COLLISION': 'Collision'
    };
    return coverageLabels[name] || "Unknown Coverage";
}


// Helper function to map vehicle properties
function mapVehicle(vehicle = {}) {
    return {
        type: "vehicle",
        data: {
            bodyStyle: vehicle.bodyStyle ? vehicle.bodyStyle.toUpperCase() : "N/A",
            vin: validateVin(vehicle.vin),
            model: vehicle.model ? formatTitleCase(vehicle.model) : "N/A",
            year: validateYear(vehicle.year),
            make: vehicle.make ? formatTitleCase(vehicle.make) : "N/A"
        }
    };
}

// Helper function to validate VINs
function validateVin(vin) {
    return typeof vin === "string" && vin.length === 17 ? vin : "INVALID_VIN";
}

// Helper function to validate and format year values
function validateYear(year) {
    const currentYear = new Date().getFullYear();
    const parsedYear = parseInt(year, 10);
    return parsedYear >= 1886 && parsedYear <= currentYear ? String(parsedYear) : "N/A";
}
// Helper function to map U.S. state codes to full state names
function mapStateCode(stateCode) {
    if (typeof stateCode !== 'string') return 'Invalid State Code';
    
    const stateMappings = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
        'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
        'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
        'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
        'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
        'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
        'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
        'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
    };
    
    // Return full state name or the original code if not found
    return stateMappings[stateCode.toUpperCase()] || stateCode;
}


module.exports = { mapToUniversalSpec };
