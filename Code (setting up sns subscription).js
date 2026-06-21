// Get the incoming data from the webhook
const data = $input.first().json;

// Parse the body if it's a string
let snsData = data;
if (typeof data.body === 'string') {
  try {
    snsData = JSON.parse(data.body);
  } catch (error) {
    // If parsing fails, use the raw data
  }
}

// Handle subscription confirmation
if (snsData.Type === 'SubscriptionConfirmation') {
  return [{
    json: {
      messageType: 'SubscriptionConfirmation',
      subscribeURL: snsData.SubscribeURL,
      request: {
        method: 'GET',
        url: snsData.SubscribeURL
      }
    }
  }];
}

// Process the actual notification (alert)
if (snsData.Type === 'Notification') {
  // Parse the Message field which contains the actual finding
  let finding = snsData.Message;
  if (typeof finding === 'string') {
    try {
      finding = JSON.parse(finding);
    } catch (error) {
      // If it's not JSON, use it as is
    }
  }
  
  // Initialize variables
  let resourceId = null;
  let resourceType = null;
  let resourceArn = null;
  let accountId = null;
  let severity = null;
  let alertType = null;
  let alertDescription = null;
  let region = 'us-east-1';
  let findingSource = 'Unknown';
  let iamUserName = null;
  let roleName = null;
  let functionName = null;
  let accessKeyId = null;
  let sessionId = null;
  let additionalDetails = {};
  
  // --- Parse GuardDuty Finding ---
  if (finding.detail && finding.detail.resource) {
    findingSource = 'GuardDuty';
    const resource = finding.detail.resource;
    accountId = finding.account;
    severity = finding.detail.severity;
    alertType = finding.detail.type;
    alertDescription = finding.detail.description || '';
    region = finding.region || 'us-east-1';
    
    // EC2 Instance
    if (resource.instanceDetails) {
      resourceType = 'ec2-instance';
      resourceId = resource.instanceDetails.instanceId;
      resourceArn = resource.instanceDetails.instanceArn;
      additionalDetails = {
        instanceType: resource.instanceDetails.instanceType,
        privateIp: resource.instanceDetails.privateIpAddress,
        publicIp: resource.instanceDetails.publicIp
      };
    }
    // S3 Bucket
    else if (resource.s3BucketDetails) {
      resourceType = 's3-bucket';
      resourceId = resource.s3BucketDetails[0].bucketName;
      resourceArn = 'arn:aws:s3:::' + resourceId;
    }
    // RDS Instance
    else if (resource.rdsDbInstanceDetails) {
      resourceType = 'rds-instance';
      resourceId = resource.rdsDbInstanceDetails.dbInstanceIdentifier;
      resourceArn = resource.rdsDbInstanceDetails.dbInstanceArn;
    }
    // IAM Role (GuardDuty can detect compromised roles)
    else if (resource.roleDetails) {
      resourceType = 'iam-role';
      roleName = resource.roleDetails.roleName;
      resourceId = roleName;
      resourceArn = resource.roleDetails.arn;
    }
    // IAM User
    else if (resource.userDetails) {
      resourceType = 'iam-user';
      iamUserName = resource.userDetails.userName;
      resourceId = iamUserName;
      resourceArn = resource.userDetails.arn;
    }
    // Lambda Function
    else if (resource.lambdaFunctionDetails) {
      resourceType = 'lambda-function';
      functionName = resource.lambdaFunctionDetails.functionName;
      resourceId = functionName;
      resourceArn = resource.lambdaFunctionDetails.functionArn;
      region = resource.lambdaFunctionDetails.functionRegion || region;
    }
    // Access Key (IAM User credentials)
    else if (resource.accessKeyDetails) {
      resourceType = 'access-key';
      accessKeyId = resource.accessKeyDetails.accessKeyId;
      resourceId = accessKeyId;
      iamUserName = resource.accessKeyDetails.userName;
      resourceArn = resource.accessKeyDetails.arn;
    }
  }
  
  // --- Parse Security Hub Finding ---
  else if (finding.Resources && finding.Resources.length > 0) {
    findingSource = 'SecurityHub';
    accountId = finding.AwsAccountId;
    severity = finding.Severity && finding.Severity.Normalized;
    alertType = finding.Title;
    alertDescription = finding.Description || '';
    region = finding.Region || 'us-east-1';
    
    for (let i = 0; i < finding.Resources.length; i++) {
      const res = finding.Resources[i];
      if (res.Type === 'AwsEc2Instance') {
        resourceType = 'ec2-instance';
        resourceId = res.Id;
        resourceArn = res.Arn;
      } else if (res.Type === 'AwsS3Bucket') {
        resourceType = 's3-bucket';
        resourceId = res.Id;
        resourceArn = 'arn:aws:s3:::' + res.Id;
      } else if (res.Type === 'AwsIamUser') {
        resourceType = 'iam-user';
        iamUserName = res.Id;
        resourceId = iamUserName;
        resourceArn = res.Arn;
      } else if (res.Type === 'AwsIamRole') {
        resourceType = 'iam-role';
        roleName = res.Id;
        resourceId = roleName;
        resourceArn = res.Arn;
      } else if (res.Type === 'AwsRdsDbInstance') {
        resourceType = 'rds-instance';
        resourceId = res.Id;
        resourceArn = res.Arn;
      } else if (res.Type === 'AwsLambdaFunction') {
        resourceType = 'lambda-function';
        functionName = res.Id;
        resourceId = functionName;
        resourceArn = res.Arn;
      }
    }
  }
  
  // --- Parse AWS Config Compliance Change ---
  else if (finding.configurationItem) {
    findingSource = 'Config';
    const config = finding.configurationItem;
    resourceType = config.resourceType ? config.resourceType.toLowerCase().replace('aws::', '') : null;
    resourceId = config.resourceId;
    resourceArn = config.arn;
    accountId = config.awsAccountId;
    alertType = 'Config Compliance Change';
    alertDescription = 'Resource ' + resourceId + ' is non-compliant';
    region = config.awsRegion || 'us-east-1';
    
    // Map Config resource types to our standard types
    if (resourceType === 'ec2::instance') {
      resourceType = 'ec2-instance';
    } else if (resourceType === 's3::bucket') {
      resourceType = 's3-bucket';
    } else if (resourceType === 'iam::user') {
      resourceType = 'iam-user';
    } else if (resourceType === 'iam::role') {
      resourceType = 'iam-role';
    } else if (resourceType === 'lambda::function') {
      resourceType = 'lambda-function';
    } else if (resourceType === 'iam::accesskey') {
      resourceType = 'access-key';
    }
  }
  
  // --- Parse STS Temporary Credential Events ---
  // Check for STS-related findings in the alert
  if (finding.detail && finding.detail.sessionIssuer) {
    const session = finding.detail.sessionIssuer;
    if (session.userName && session.userType) {
      resourceType = 'sts-session';
      iamUserName = session.userName;
      resourceId = session.sessionId || session.userName;
      resourceArn = session.arn;
      sessionId = session.sessionId;
      additionalDetails.sessionDetails = {
        sessionId: sessionId,
        principalId: session.principalId,
        type: session.userType
      };
    }
  }
  
  // Check for temporary credentials in the finding
  if (finding.detail && finding.detail.awsCredentials) {
    const creds = finding.detail.awsCredentials;
    accessKeyId = creds.accessKeyId;
    additionalDetails.credentials = {
      accessKeyId: accessKeyId,
      expiration: creds.expiration,
      sessionToken: creds.sessionToken ? '[REDACTED]' : null
    };
    // If this is an STS session, mark it
    if (resourceType === 'sts-session' || !resourceType) {
      resourceType = 'sts-temp-credentials';
    }
  }
  
  // Determine if containment is needed based on severity and type
  let needsContainment = false;
  let containmentReason = '';
  
  if (severity) {
    if (severity >= 7) { // GuardDuty
      needsContainment = true;
      containmentReason = 'High severity alert (GuardDuty severity: ' + severity + ')';
    } else if (severity >= 70) { // Security Hub
      needsContainment = true;
      containmentReason = 'High severity alert (Security Hub severity: ' + severity + ')';
    }
  }
  
  // If no severity but we have a finding, still contain if it's a critical alert type
  if (!needsContainment && alertType) {
    const criticalTypes = ['UnauthorizedAccess', 'Compromised', 'Malicious', 'Breach', 'Attack', 'Anomaly', 'Suspicious'];
    for (let i = 0; i < criticalTypes.length; i++) {
      if (alertType.indexOf(criticalTypes[i]) !== -1) {
        needsContainment = true;
        containmentReason = 'Critical alert type: ' + alertType;
        break;
      }
    }
  }
  
  // Prepare output for the workflow
  return [{
    json: {
      messageType: 'Notification',
      resourceType: resourceType,
      resourceId: resourceId,
      resourceArn: resourceArn,
      accountId: accountId,
      severity: severity,
      needsContainment: needsContainment,
      containmentReason: containmentReason,
      alertType: alertType,
      alertDescription: alertDescription,
      region: region,
      findingSource: findingSource,
      iamUserName: iamUserName,
      roleName: roleName,
      functionName: functionName,
      accessKeyId: accessKeyId,
      sessionId: sessionId,
      additionalDetails: additionalDetails,
      finding: finding,
      originalMessage: snsData.Message,
      alertSummary: '[ALERT] ' + findingSource + ' - ' + alertType + ' on ' + resourceType + ' (' + resourceId + ')'
    }
  }];
}

// Fallback for unknown message types
return [{
  json: {
    messageType: 'Unknown',
    data: snsData
  }
}];