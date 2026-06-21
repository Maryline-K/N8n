// Get the incoming data
const data = $input.first().json;

// ============================================
// STEP 1: Extract SIR ID from GuardDuty Finding
// ============================================
let sirtID = 'SIR-UNKNOWN';

// Option 1: Use alert type as fallback
sirtID = data.alertType || 'SIR-UNKNOWN';

// Option 2: If there's a finding ID in the original data
if (data.finding && data.finding.detail && data.finding.detail.id) {
  sirtID = 'SIR-' + data.finding.detail.id.substring(0, 8);
}

// Option 3: Use GuardDuty finding ID with timestamp
if (data.finding && data.finding.detail && data.finding.detail.service) {
  const service = data.finding.detail.service;
  if (service.eventFirstSeen) {
    const year = new Date(service.eventFirstSeen).getFullYear();
    const id = data.finding.detail.id.substring(0, 6);
    sirtID = 'SIR-' + year + '-' + id;
  }
}

// Option 4: Use finding ID from Security Hub
if (data.finding && data.finding.Id) {
  sirtID = 'SIR-' + data.finding.Id.substring(0, 8);
}

// ============================================
// STEP 2: Map Resource Types to Lambda Functions
// ============================================
const lambdaConfigs = {
  'ec2-instance': {
    functionName: 'contain-ec2-instance',
    buildPayload: (data) => ({
      targetInstanceId: data.resourceId,
      targetAccount: data.accountId,
      targetRegion: data.region,
      sirtID: sirtID,  // Use the extracted SIR ID
      severity: data.severity,
      alertDescription: data.alertDescription,
      instanceDetails: data.additionalDetails || {}
    })
  },
  
  's3-bucket': {
    functionName: 'contain-s3-bucket',
    buildPayload: (data) => ({
      targetBucketName: data.resourceId,
      sirtID: sirtID,  // Use the extracted SIR ID
      targetAccount: data.accountId,
      targetRegion: data.region,
      severity: data.severity,
      alertDescription: data.alertDescription
    })
  },
  
  'iam-user': {
    functionName: 'contain-iam-user',
    buildPayload: (data) => ({
      targetUserName: data.resourceId,
      targetAccount: data.accountId,
      targetRegion: data.region,
      sirtID: sirtID,  // Use the extracted SIR ID
      severity: data.severity,
      accessKeyId: data.accessKeyId,
      alertDescription: data.alertDescription
    })
  },
  
  'iam-role': {
    functionName: 'contain-iam-role',
    buildPayload: (data) => ({
      targetRoleName: data.resourceId,
      targetAccount: data.accountId,
      targetRegion: data.region,
      sirtID: sirtID,  // Use the extracted SIR ID
      severity: data.severity,
      alertDescription: data.alertDescription
    })
  },
  
  'lambda-function': {
    functionName: 'contain-lambda-function',
    buildPayload: (data) => ({
      targetFunctionName: data.resourceId,
      targetAccount: data.accountId,
      targetRegion: data.region,
      sirtID: sirtID,  // Use the extracted SIR ID
      severity: data.severity,
      alertDescription: data.alertDescription
    })
  },
  
  'rds-instance': {
    functionName: 'contain-rds-instance',
    buildPayload: (data) => ({
      targetDBInstanceIdentifier: data.resourceId,
      targetAccount: data.accountId,
      targetRegion: data.region,
      sirtID: sirtID,  // Use the extracted SIR ID
      severity: data.severity,
      alertDescription: data.alertDescription
    })
  },
  
  'access-key': {
    functionName: 'contain-access-key',
    buildPayload: (data) => ({
      targetAccessKeyId: data.resourceId,
      targetUserName: data.iamUserName,
      targetAccount: data.accountId,
      targetRegion: data.region,
      sirtID: sirtID,  // Use the extracted SIR ID
      severity: data.severity,
      alertDescription: data.alertDescription
    })
  },
  
  'sts-session': {
    functionName: 'contain-sts-session',
    buildPayload: (data) => ({
      targetAccessKeyId: data.accessKeyId,
      targetUserName: data.iamUserName,
      targetSessionId: data.sessionId,
      targetAccount: data.accountId,
      targetRegion: data.region,
      sirtID: sirtID,  // Use the extracted SIR ID
      severity: data.severity,
      alertDescription: data.alertDescription
    })
  },
  
  'sts-temp-credentials': {
    functionName: 'contain-sts-session',
    buildPayload: (data) => ({
      targetAccessKeyId: data.accessKeyId,
      targetUserName: data.iamUserName,
      targetSessionId: data.sessionId,
      targetAccount: data.accountId,
      targetRegion: data.region,
      sirtID: sirtID,  // Use the extracted SIR ID
      severity: data.severity,
      alertDescription: data.alertDescription
    })
  }
};

// ============================================
// STEP 3: Build the Lambda Payload
// ============================================
const resourceType = data.resourceType;
const config = lambdaConfigs[resourceType];

// Default configuration for unknown resource types
let functionName = 'contain-unknown-resource';
let lambdaPayload = {
  targetResourceType: resourceType,
  targetResourceId: data.resourceId,
  targetAccount: data.accountId,
  targetRegion: data.region,
  sirtID: sirtID,  // Use the extracted SIR ID
  severity: data.severity,
  alertDescription: data.alertDescription
};

// If we have a configuration, use it
if (config) {
  functionName = config.functionName;
  lambdaPayload = config.buildPayload(data);
}

// ============================================
// STEP 4: Add Debug Info (Optional)
// ============================================
console.log('SIR ID:', sirtID);
console.log('Resource Type:', resourceType);
console.log('Lambda Function:', functionName);
console.log('Payload:', JSON.stringify(lambdaPayload));

// ============================================
// STEP 5: Return the Data
// ============================================
return [{
  json: {
    ...data,
    functionName: functionName,
    lambdaPayload: lambdaPayload,
    sirtID: sirtID,  // Make SIR ID available for later nodes
    lambdaSummary: 'Invoking ' + functionName + ' for ' + resourceType + ': ' + data.resourceId + ' (SIR: ' + sirtID + ')'
  }
}];