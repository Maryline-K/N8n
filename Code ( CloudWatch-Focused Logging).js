// Get the incoming data from the previous node
const data = $input.first().json;

// ============================================
// STEP 1: Build Comprehensive Log Entry
// ============================================
const logEntry = {
  // Workflow metadata
  workflowName: 'aws-security-containment',
  workflowVersion: '1.0.0',
  timestamp: new Date().toISOString(),
  executionId: data.executionId || 'unknown',
  
  // Alert details
  sirtID: data.sirtID || 'SIR-UNKNOWN',
  alertType: data.alertType || 'Unknown',
  alertDescription: data.alertDescription || '',
  alertSource: data.findingSource || 'GuardDuty',
  severity: data.severity || 0,
  
  // Resource details
  resourceType: data.resourceType || 'unknown',
  resourceId: data.resourceId || 'unknown',
  resourceArn: data.resourceArn || '',
  accountId: data.accountId || 'unknown',
  region: data.region || 'us-east-1',
  
  // Lambda execution
  lambdaFunction: data.functionName || 'unknown',
  lambdaPayload: data.lambdaPayload || {},
  lambdaResponse: data.lambdaResponse || {},
  lambdaParsedResponse: data.parsedResponse || {},
  
  // Containment details
  containmentStatus: data.executionStatus || 'unknown',
  containmentActions: data.containmentDetails?.details || [],
  needsManualIntervention: data.needsManualIntervention || false,
  manualInterventionReason: data.manualInterventionReason || '',
  
  // Error handling
  errorMessage: data.errorMessage || null,
  
  // Summary
  summary: data.summary || 'No summary available',
  
  // Additional metadata
  slackText: data.slackText || '',
  tags: ['security', 'containment', 'automated-response']
};

// ============================================
// STEP 2: Build CloudWatch Log Formats
// ============================================

// 2a: JSON Log (structured for CloudWatch)
const jsonLog = JSON.stringify(logEntry);

// 2b: Human-Readable Log (for CloudWatch console)
let humanReadableLog = '========================================\n';
humanReadableLog += 'AWS SECURITY - CONTAINMENT LOG\n';
humanReadableLog += '========================================\n\n';
humanReadableLog += 'Timestamp: ' + logEntry.timestamp + '\n';
humanReadableLog += 'SIR ID: ' + logEntry.sirtID + '\n';
humanReadableLog += 'Execution ID: ' + logEntry.executionId + '\n\n';

humanReadableLog += '--- ALERT DETAILS ---\n';
humanReadableLog += 'Type: ' + logEntry.alertType + '\n';
humanReadableLog += 'Source: ' + logEntry.alertSource + '\n';
humanReadableLog += 'Severity: ' + logEntry.severity + '\n';
humanReadableLog += 'Description: ' + logEntry.alertDescription + '\n\n';

humanReadableLog += '--- RESOURCE DETAILS ---\n';
humanReadableLog += 'Type: ' + logEntry.resourceType + '\n';
humanReadableLog += 'ID: ' + logEntry.resourceId + '\n';
humanReadableLog += 'Account: ' + logEntry.accountId + '\n';
humanReadableLog += 'Region: ' + logEntry.region + '\n\n';

humanReadableLog += '--- CONTAINMENT ---\n';
humanReadableLog += 'Status: ' + logEntry.containmentStatus + '\n';
humanReadableLog += 'Lambda: ' + logEntry.lambdaFunction + '\n';
if (logEntry.containmentActions.length > 0) {
  humanReadableLog += 'Actions:\n';
  for (let i = 0; i < logEntry.containmentActions.length; i++) {
    humanReadableLog += '  - ' + logEntry.containmentActions[i] + '\n';
  }
}
humanReadableLog += '\n';

if (logEntry.needsManualIntervention) {
  humanReadableLog += '⚠️ MANUAL INTERVENTION REQUIRED!\n';
  humanReadableLog += 'Reason: ' + logEntry.manualInterventionReason + '\n\n';
}

if (logEntry.errorMessage) {
  humanReadableLog += '❌ ERROR:\n';
  humanReadableLog += logEntry.errorMessage + '\n\n';
}

humanReadableLog += 'Summary: ' + logEntry.summary + '\n';
humanReadableLog += '========================================\n';

// ============================================
// STEP 3: Prepare CloudWatch Log Events
// ============================================
const timestamp = Date.now();

// 3a: Single log event (JSON)
const cloudwatchJsonEvent = {
  logGroupName: '/aws/security/containment',
  logStreamName: logEntry.region + '/' + logEntry.accountId,
  logEvents: [{
    timestamp: timestamp,
    message: jsonLog
  }]
};

// 3b: Multiple log events (JSON + Human-readable)
const cloudwatchEvents = {
  logGroupName: '/aws/security/containment',
  logStreamName: logEntry.region + '/' + logEntry.accountId,
  logEvents: [
    {
      timestamp: timestamp,
      message: jsonLog
    },
    {
      timestamp: timestamp + 1,
      message: humanReadableLog
    }
  ]
};

// 3c: With severity-based filtering (for CloudWatch Insights)
const cloudwatchStructuredLog = {
  logGroupName: '/aws/security/containment',
  logStreamName: logEntry.region + '/' + logEntry.accountId,
  logEvents: [{
    timestamp: timestamp,
    message: JSON.stringify({
      ...logEntry,
      // Add severity level for CloudWatch Logs Insights
      logLevel: logEntry.severity >= 7 ? 'HIGH' : 
                logEntry.severity >= 4 ? 'MEDIUM' : 'LOW',
      status: logEntry.containmentStatus,
      // Add for easier querying
      '@timestamp': logEntry.timestamp,
      '@message': jsonLog
    })
  }]
};

// ============================================
// STEP 4: Return Data for CloudWatch Upload
// ============================================
return [{
  json: {
    // Original data
    ...data,
    
    // Log entries
    logEntry: logEntry,
    jsonLog: jsonLog,
    humanReadableLog: humanReadableLog,
    
    // CloudWatch configurations
    cloudwatch: {
      logGroupName: '/aws/security/containment',
      logStreamName: logEntry.region + '/' + logEntry.accountId,
      region: logEntry.region,
      accountId: logEntry.accountId
    },
    
    // CloudWatch log events (choose one)
    cloudwatchJsonEvent: cloudwatchJsonEvent,
    cloudwatchEvents: cloudwatchEvents,
    cloudwatchStructuredLog: cloudwatchStructuredLog,
    
    // For individual log event (AWS CloudWatch Logs node)
    logGroupName: '/aws/security/containment',
    logStreamName: logEntry.region + '/' + logEntry.accountId,
    logEvent: {
      timestamp: timestamp,
      message: jsonLog
    },
    
    // Status
    logged: true,
    logTimestamp: logEntry.timestamp,
    logSummary: 'Logged containment for ' + logEntry.sirtID + ' (' + logEntry.resourceId + ')'
  }
}];