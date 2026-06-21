// Get the incoming data from the cloud function/Lambda node
const data = $input.first().json;

// ============================================
// STEP 1: Extract Provider and Response
// ============================================
const provider = data.provider || 'unknown';
const response = data.response || data.body || data;

// ============================================
// STEP 2: Initialize Variables
// ============================================
let executionStatus = 'success';
let errorMessage = null;
let containmentDetails = {};
let parsedResponse = {};
let rawResponse = response;

// ============================================
// STEP 3: Parse Response Based on Provider
// ============================================

// 3a: AWS Lambda Response
if (provider === 'aws') {
  // AWS Lambda returns response in the body
  if (response.body) {
    try {
      parsedResponse = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    } catch (error) {
      parsedResponse = { message: response.body };
    }
  } else {
    parsedResponse = response;
  }
  
  // Check for Lambda errors
  if (response.FunctionError) {
    executionStatus = 'failed';
    errorMessage = response.FunctionError;
  }
}

// 3b: GCP Cloud Function Response
else if (provider === 'gcp') {
  // GCP Cloud Functions return response directly
  if (response.body) {
    try {
      parsedResponse = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    } catch (error) {
      parsedResponse = { message: response.body };
    }
  } else {
    parsedResponse = response;
  }
  
  // Check for GCP errors
  if (response.error || response.status === 'error') {
    executionStatus = 'failed';
    errorMessage = response.error || response.message || 'GCP Cloud Function error';
  }
}

// 3c: Azure Function Response
else if (provider === 'azure') {
  // Azure Functions return response directly
  if (response.body) {
    try {
      parsedResponse = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    } catch (error) {
      parsedResponse = { message: response.body };
    }
  } else {
    parsedResponse = response;
  }
  
  // Check for Azure errors
  if (response.statusCode && response.statusCode >= 400) {
    executionStatus = 'failed';
    errorMessage = 'Azure Function returned status code: ' + response.statusCode;
  }
}

// 3d: Unknown Provider
else {
  // Generic response parsing
  if (response.body) {
    try {
      parsedResponse = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    } catch (error) {
      parsedResponse = { message: response.body };
    }
  } else {
    parsedResponse = response;
  }
}

// ============================================
// STEP 4: Extract Containment Details
// ============================================
const status = parsedResponse.status || parsedResponse.result || parsedResponse.outcome || 'unknown';

if (status === 'success' || status === 'contained' || status === 'completed') {
  executionStatus = 'success';
  containmentDetails = {
    action: parsedResponse.action || parsedResponse.operation || 'contained',
    resourceId: parsedResponse.resourceId || parsedResponse.targetResourceId || data.resourceId,
    resourceType: parsedResponse.resourceType || data.resourceType,
    provider: provider,
    details: parsedResponse.details || parsedResponse.actions || parsedResponse.messages || [],
    timestamp: parsedResponse.timestamp || new Date().toISOString()
  };
} else if (status === 'failed' || status === 'error') {
  executionStatus = 'failed';
  errorMessage = parsedResponse.error || parsedResponse.message || parsedResponse.reason || 'Containment failed';
  containmentDetails = {
    action: parsedResponse.action || 'failed',
    resourceId: parsedResponse.resourceId || data.resourceId,
    resourceType: parsedResponse.resourceType || data.resourceType,
    provider: provider,
    details: parsedResponse.details || [],
    timestamp: new Date().toISOString()
  };
}

// ============================================
// STEP 5: Check for Manual Intervention
// ============================================
let needsManualIntervention = false;
let manualInterventionReason = '';

// Check various fields that might indicate manual intervention
if (parsedResponse.requiresManualIntervention || 
    parsedResponse.manualIntervention ||
    parsedResponse.needsManualIntervention ||
    parsedResponse.requiresHumanAction) {
  needsManualIntervention = true;
  manualInterventionReason = parsedResponse.manualInterventionReason || 
                            parsedResponse.reason || 
                            'Function indicates manual intervention required';
}

// Additional checks based on provider
if (provider === 'aws' && parsedResponse.FunctionError) {
  needsManualIntervention = true;
  manualInterventionReason = 'AWS Lambda error: ' + parsedResponse.FunctionError;
}

if (provider === 'gcp' && parsedResponse.error) {
  needsManualIntervention = true;
  manualInterventionReason = 'GCP Cloud Function error: ' + parsedResponse.error;
}

if (provider === 'azure' && parsedResponse.error) {
  needsManualIntervention = true;
  manualInterventionReason = 'Azure Function error: ' + parsedResponse.error;
}

// ============================================
// STEP 6: Extract Detailed Actions
// ============================================
let actionDetails = [];

// Try to extract detailed actions from various response formats
if (parsedResponse.actions && Array.isArray(parsedResponse.actions)) {
  actionDetails = parsedResponse.actions;
} else if (parsedResponse.details && Array.isArray(parsedResponse.details)) {
  actionDetails = parsedResponse.details;
} else if (parsedResponse.steps && Array.isArray(parsedResponse.steps)) {
  actionDetails = parsedResponse.steps;
} else if (parsedResponse.results && Array.isArray(parsedResponse.results)) {
  actionDetails = parsedResponse.results;
} else if (parsedResponse.messages && Array.isArray(parsedResponse.messages)) {
  actionDetails = parsedResponse.messages;
}

// If we have a single action string, convert to array
if (typeof parsedResponse.action === 'string' && actionDetails.length === 0) {
  actionDetails = [parsedResponse.action];
}

// ============================================
// STEP 7: Build Summary
// ============================================
let summary = '';

if (executionStatus === 'success') {
  summary = `✅ ${provider.toUpperCase()}/${data.resourceType} contained successfully`;
  if (actionDetails.length > 0) {
    summary += ' - ' + actionDetails.join(', ');
  }
} else {
  summary = `❌ Failed to contain ${provider.toUpperCase()}/${data.resourceType}`;
  if (errorMessage) {
    summary += ': ' + errorMessage;
  }
  if (needsManualIntervention) {
    summary += ' ⚠️ Manual intervention required!';
  }
}

// ============================================
// STEP 8: Build Slack Message
// ============================================
let slackText = '🚨 **Security Alert - ' + provider.toUpperCase() + ' Containment Result**\n\n';
slackText += '*SIR ID:* `' + (data.sirtID || 'SIR-UNKNOWN') + '`\n';
slackText += '*Provider:* ' + provider.toUpperCase() + '\n';
slackText += '*Status:* ' + (executionStatus === 'success' ? '✅ Success' : '❌ Failed') + '\n';
slackText += '*Summary:* ' + summary + '\n\n';
slackText += '*Resource Details:*\n';
slackText += '• Type: ' + data.resourceType + '\n';
slackText += '• ID: `' + data.resourceId + '`\n';
slackText += '• Account/Project: ' + data.accountId + '\n';
slackText += '• Region: ' + data.region + '\n';
slackText += '• Severity: ' + data.severity + '\n';
slackText += '• Alert: ' + data.alertType + '\n\n';
slackText += '*Function Details:*\n';
slackText += '• Function: `' + (data.functionName || 'unknown') + '`\n';
slackText += '• Timestamp: ' + new Date().toISOString() + '\n\n';

if (actionDetails.length > 0) {
  slackText += '*Containment Actions:*\n';
  for (let i = 0; i < actionDetails.length; i++) {
    slackText += '• ' + actionDetails[i] + '\n';
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

// Add provider-specific information
if (provider === 'aws') {
  slackText += '*AWS Details:*\n';
  slackText += '• Request ID: ' + (parsedResponse.RequestId || 'N/A') + '\n';
  slackText += '• Function ARN: ' + (parsedResponse.FunctionArn || 'N/A') + '\n\n';
} else if (provider === 'gcp') {
  slackText += '*GCP Details:*\n';
  slackText += '• Function Name: ' + (data.functionName || 'N/A') + '\n';
  slackText += '• Project ID: ' + (data.accountId || 'N/A') + '\n\n';
} else if (provider === 'azure') {
  slackText += '*Azure Details:*\n';
  slackText += '• Function App: ' + (data.functionAppName || 'N/A') + '\n';
  slackText += '• Subscription ID: ' + (data.accountId || 'N/A') + '\n\n';
}

slackText += '🔗 *Containment completed* - Please verify resource is contained.';

// ============================================
// STEP 9: Build Provider-Specific Logs
// ============================================
let providerLog = {
  provider: provider,
  executionStatus: executionStatus,
  functionName: data.functionName,
  resourceId: data.resourceId,
  resourceType: data.resourceType,
  timestamp: new Date().toISOString()
};

// Add provider-specific fields
if (provider === 'aws') {
  providerLog.awsRequestId = parsedResponse.RequestId || 'N/A';
  providerLog.awsFunctionArn = parsedResponse.FunctionArn || 'N/A';
} else if (provider === 'gcp') {
  providerLog.gcpFunctionName = data.functionName;
  providerLog.gcpProjectId = data.accountId;
} else if (provider === 'azure') {
  providerLog.azureFunctionApp = data.functionAppName;
  providerLog.azureSubscriptionId = data.accountId;
}

// ============================================
// STEP 10: Return Data
// ============================================
return [{
  json: {
    // Original data (preserve for downstream nodes)
    ...data,
    
    // Execution results
    executionStatus: executionStatus,
    errorMessage: errorMessage,
    containmentDetails: containmentDetails,
    actionDetails: actionDetails,
    
    // Manual intervention flags
    needsManualIntervention: needsManualIntervention,
    manualInterventionReason: manualInterventionReason,
    
    // Parsed response
    parsedResponse: parsedResponse,
    rawResponse: rawResponse,
    
    // Provider-specific logs
    providerLog: providerLog,
    
    // Slack and summary
    slackText: slackText,
    summary: summary,
    
    // Timestamp
    timestamp: new Date().toISOString(),
    
    // Status for IF nodes
    status: executionStatus
  }
}];