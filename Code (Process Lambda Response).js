// Get the incoming data from the AWS Lambda node
const data = $input.first().json;

// ============================================
// STEP 1: Extract Lambda Response
// ============================================
const lambdaResponse = data.response || data.body || data;

// Determine if Lambda execution was successful
let executionStatus = 'success';
let errorMessage = null;
let containmentDetails = {};

// Check for errors in Lambda response
if (lambdaResponse.errorMessage || lambdaResponse.error) {
  executionStatus = 'failed';
  errorMessage = lambdaResponse.errorMessage || lambdaResponse.error || 'Unknown error';
} else if (lambdaResponse.statusCode && lambdaResponse.statusCode >= 400) {
  executionStatus = 'failed';
  errorMessage = 'Lambda returned status code: ' + lambdaResponse.statusCode;
} else if (lambdaResponse.status && lambdaResponse.status === 'failed') {
  executionStatus = 'failed';
  errorMessage = lambdaResponse.reason || 'Lambda execution failed';
}

// ============================================
// STEP 2: Parse Lambda Response Body (if JSON)
// ============================================
let parsedResponse = lambdaResponse;
if (typeof lambdaResponse.body === 'string') {
  try {
    parsedResponse = JSON.parse(lambdaResponse.body);
  } catch (error) {
    // If response body is not JSON, keep it as string
    parsedResponse = { message: lambdaResponse.body };
  }
}

// Extract containment details from the response
if (parsedResponse.status === 'success' || parsedResponse.status === 'contained') {
  containmentDetails = {
    action: parsedResponse.action || 'contained',
    resourceId: parsedResponse.resourceId || data.resourceId,
    resourceType: parsedResponse.resourceType || data.resourceType,
    details: parsedResponse.details || [],
    timestamp: parsedResponse.timestamp || new Date().toISOString()
  };
} else if (parsedResponse.details) {
  containmentDetails = {
    action: parsedResponse.action || 'contained',
    details: parsedResponse.details,
    timestamp: parsedResponse.timestamp || new Date().toISOString()
  };
}

// ============================================
// STEP 3: Determine Next Actions
// ============================================
let needsManualIntervention = false;
let manualInterventionReason = '';

// Check if Lambda indicates manual intervention needed
if (parsedResponse.requiresManualIntervention || parsedResponse.manualIntervention) {
  needsManualIntervention = true;
  manualInterventionReason = parsedResponse.manualInterventionReason || 'Lambda indicates manual intervention required';
}

// Check for specific resource types that might need additional actions
if (data.resourceType === 'ec2-instance' && executionStatus === 'success') {
  // EC2 containment might need additional verification
  if (!parsedResponse.quarantineGroupApplied) {
    needsManualIntervention = true;
    manualInterventionReason = 'EC2 quarantine group may not have been applied';
  }
}

if (data.resourceType === 's3-bucket' && executionStatus === 'success') {
  // S3 containment might need additional verification
  if (!parsedResponse.publicAccessBlocked) {
    needsManualIntervention = true;
    manualInterventionReason = 'S3 public access may not have been blocked';
  }
}

// ============================================
// STEP 4: Build Human-Readable Summary
// ============================================
let summary = '';
if (executionStatus === 'success') {
  summary = '✅ ' + data.resourceType + ' contained successfully';
  if (containmentDetails.details && containmentDetails.details.length > 0) {
    summary += ' - ' + containmentDetails.details.join(', ');
  }
} else {
  summary = '❌ Failed to contain ' + data.resourceType + ': ' + errorMessage;
  if (needsManualIntervention) {
    summary += ' ⚠️ Manual intervention required!';
  }
}

// ============================================
// STEP 5: Build Slack Message Fields
// ============================================
const slackMessage = {
  status: executionStatus,
  summary: summary,
  resourceType: data.resourceType,
  resourceId: data.resourceId,
  sirtID: data.sirtID || 'SIR-UNKNOWN',
  functionName: data.functionName || 'unknown',
  severity: data.severity || 'N/A',
  alertType: data.alertType || 'Unknown',
  accountId: data.accountId || 'N/A',
  region: data.region || 'us-east-1',
  containmentDetails: containmentDetails,
  needsManualIntervention: needsManualIntervention,
  manualInterventionReason: manualInterventionReason,
  errorMessage: errorMessage,
  timestamp: new Date().toISOString(),
  // Raw data for debugging
  lambdaResponse: lambdaResponse,
  parsedResponse: parsedResponse
};

// ============================================
// STEP 6: Build Slack Notification Text
// ============================================
let slackText = '🚨 **AWS Security - Lambda Containment Result**\n\n';
slackText += '*SIR ID:* `' + slackMessage.sirtID + '`\n';
slackText += '*Status:* ' + (executionStatus === 'success' ? '✅ Success' : '❌ Failed') + '\n';
slackText += '*Summary:* ' + summary + '\n\n';

slackText += '*Resource Details:*\n';
slackText += '• Type: ' + slackMessage.resourceType + '\n';
slackText += '• ID: `' + slackMessage.resourceId + '`\n';
slackText += '• Account: ' + slackMessage.accountId + '\n';
slackText += '• Region: ' + slackMessage.region + '\n';
slackText += '• Severity: ' + slackMessage.severity + '\n';
slackText += '• Alert: ' + slackMessage.alertType + '\n\n';

slackText += '*Lambda Details:*\n';
slackText += '• Function: `' + slackMessage.functionName + '`\n';
slackText += '• Timestamp: ' + slackMessage.timestamp + '\n\n';

if (containmentDetails.details && containmentDetails.details.length > 0) {
  slackText += '*Containment Actions:*\n';
  for (let i = 0; i < containmentDetails.details.length; i++) {
    slackText += '• ' + containmentDetails.details[i] + '\n';
  }
  slackText += '\n';
}

if (needsManualIntervention) {
  slackText += '⚠️ **Manual Intervention Required!**\n';
  slackText += '*Reason:* ' + manualInterventionReason + '\n\n';
}

if (errorMessage) {
  slackText += '*Error:* ' + errorMessage + '\n\n';
}

slackText += '🔗 *Containment completed* - Please verify resource is contained.';

// ============================================
// STEP 7: Prepare Output
// ============================================
return [{
  json: {
    // Original data
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    accountId: data.accountId,
    region: data.region,
    severity: data.severity,
    alertType: data.alertType,
    alertDescription: data.alertDescription,
    sirtID: data.sirtID || 'SIR-UNKNOWN',
    functionName: data.functionName,
    
    // Lambda execution results
    executionStatus: executionStatus,
    errorMessage: errorMessage,
    lambdaResponse: lambdaResponse,
    parsedResponse: parsedResponse,
    
    // Containment details
    containmentDetails: containmentDetails,
    needsManualIntervention: needsManualIntervention,
    manualInterventionReason: manualInterventionReason,
    
    // Slack message
    slackText: slackText,
    slackMessage: slackMessage,
    
    // Summary for logging
    summary: summary,
    timestamp: new Date().toISOString()
  }
}];