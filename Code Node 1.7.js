// Get the incoming data from AI Node 2
const data = $input.first().json;

// ============================================
// STEP 1: Extract Validation AI Response
// ============================================
let validationResponse = data.response || data.body || data;

// Parse the validation response
if (typeof validationResponse === 'string') {
  try {
    if (validationResponse.includes('choices')) {
      const parsed = JSON.parse(validationResponse);
      validationResponse = parsed.choices[0].message.content;
    }
    validationResponse = JSON.parse(validationResponse);
  } catch (error) {
    const jsonMatch = validationResponse.match(/\{.*\}/s);
    if (jsonMatch) {
      try {
        validationResponse = JSON.parse(jsonMatch[0]);
      } catch (e) {
        validationResponse = { 
          agreement: false, 
          validationConfidence: 0,
          validationReasoning: 'Failed to parse validation response',
          finalRecommendation: 'review',
          overrideReason: 'Parsing error'
        };
      }
    }
  }
}

// ============================================
// STEP 2: Extract Validation Results
// ============================================
const agreement = validationResponse.agreement !== undefined ? validationResponse.agreement : false;
const validationConfidence = validationResponse.validationConfidence || 50;
const validationReasoning = validationResponse.validationReasoning || 'No validation reasoning provided';
const ai2FinalRecommendation = validationResponse.finalRecommendation || 'review';
const overrideReason = validationResponse.overrideReason || '';

// ============================================
// STEP 3: Make Final Decision Based on Both AIs
// ============================================
let finalAction = 'review';
let finalConfidence = 0;
let finalReasoning = '';
let decisionMatrix = '';

const ai1Rec = data.ai1Recommendation || 'review';
const ai2Rec = ai2FinalRecommendation;

// Case 1: Both AIs agree on contain
if (ai1Rec === 'contain' && ai2Rec === 'contain') {
  finalAction = 'contain';
  finalConfidence = Math.min(data.ai1ConfidenceScore || 50, validationConfidence);
  finalReasoning = `Both AIs agree on containment. AI1: ${data.ai1Reasoning || 'No reasoning'}. AI2: ${validationReasoning}`;
  decisionMatrix = 'Agree: Contain';
}

// Case 2: Both AIs agree on ignore
else if (ai1Rec === 'ignore' && ai2Rec === 'ignore') {
  finalAction = 'ignore';
  finalConfidence = Math.min(data.ai1ConfidenceScore || 50, validationConfidence);
  finalReasoning = `Both AIs agree on ignoring. AI1: ${data.ai1Reasoning || 'No reasoning'}. AI2: ${validationReasoning}`;
  decisionMatrix = 'Agree: Ignore';
}

// Case 3: Both AIs agree on review
else if (ai1Rec === 'review' && ai2Rec === 'review') {
  finalAction = 'review';
  finalConfidence = Math.min(data.ai1ConfidenceScore || 50, validationConfidence);
  finalReasoning = `Both AIs recommend review. AI1: ${data.ai1Reasoning || 'No reasoning'}. AI2: ${validationReasoning}`;
  decisionMatrix = 'Agree: Review';
}

// Case 4: AI1 says contain, AI2 says review
else if (ai1Rec === 'contain' && ai2Rec === 'review') {
  finalAction = 'review';
  finalConfidence = Math.max(data.ai1ConfidenceScore || 50, validationConfidence);
  finalReasoning = `AI1 recommends contain (${data.ai1ConfidenceScore || 50}%), AI2 recommends review (${validationConfidence}%). ${validationReasoning}`;
  decisionMatrix = 'Disagree: Contain/Review → Review';
}

// Case 5: AI1 says ignore, AI2 says review
else if (ai1Rec === 'ignore' && ai2Rec === 'review') {
  finalAction = 'review';
  finalConfidence = Math.max(data.ai1ConfidenceScore || 50, validationConfidence);
  finalReasoning = `AI1 recommends ignore (${data.ai1ConfidenceScore || 50}%), AI2 recommends review (${validationConfidence}%). ${validationReasoning}`;
  decisionMatrix = 'Disagree: Ignore/Review → Review';
}

// Case 6: AI1 says review, AI2 says contain
else if (ai1Rec === 'review' && ai2Rec === 'contain') {
  finalAction = 'review';
  finalConfidence = Math.max(data.ai1ConfidenceScore || 50, validationConfidence);
  finalReasoning = `AI1 recommends review (${data.ai1ConfidenceScore || 50}%), AI2 recommends contain (${validationConfidence}%). ${validationReasoning}`;
  decisionMatrix = 'Disagree: Review/Contain → Review';
}

// Case 7: AI1 says review, AI2 says ignore
else if (ai1Rec === 'review' && ai2Rec === 'ignore') {
  finalAction = 'review';
  finalConfidence = Math.max(data.ai1ConfidenceScore || 50, validationConfidence);
  finalReasoning = `AI1 recommends review (${data.ai1ConfidenceScore || 50}%), AI2 recommends ignore (${validationConfidence}%). ${validationReasoning}`;
  decisionMatrix = 'Disagree: Review/Ignore → Review';
}

// Case 8: AI1 says contain, AI2 says ignore
else if (ai1Rec === 'contain' && ai2Rec === 'ignore') {
  finalAction = 'review';
  finalConfidence = Math.max(data.ai1ConfidenceScore || 50, validationConfidence);
  finalReasoning = `AI disagreement: AI1 recommends contain (${data.ai1ConfidenceScore || 50}%), AI2 recommends ignore (${validationConfidence}%). Manual review required. ${validationReasoning}`;
  decisionMatrix = 'Disagree: Contain/Ignore → Review';
}

// Case 9: AI1 says ignore, AI2 says contain
else if (ai1Rec === 'ignore' && ai2Rec === 'contain') {
  finalAction = 'review';
  finalConfidence = Math.max(data.ai1ConfidenceScore || 50, validationConfidence);
  finalReasoning = `AI disagreement: AI1 recommends ignore (${data.ai1ConfidenceScore || 50}%), AI2 recommends contain (${validationConfidence}%). Manual review required. ${validationReasoning}`;
  decisionMatrix = 'Disagree: Ignore/Contain → Review';
}

// Fallback
else {
  finalAction = 'review';
  finalConfidence = 50;
  finalReasoning = `Unexpected AI decisions: AI1=${ai1Rec}, AI2=${ai2Rec}. Manual review required.`;
  decisionMatrix = 'Error: Unknown combination';
}

// ============================================
// STEP 4: Build Slack Summary
// ============================================
let slackSummary = '🤖 **Dual AI Validation Complete**\n\n';
slackSummary += `*Alert:* ${data.alertType || 'Unknown'}\n`;
slackSummary += `*Severity:* ${data.severity || 0}/10\n`;
slackSummary += `*Resource:* ${data.resourceType || 'unknown'} - ${data.resourceId || 'unknown'}\n`;
slackSummary += `*Provider:* ${data.provider || 'unknown'}\n\n`;
slackSummary += `*AI 1 Decision:* ${ai1Rec.toUpperCase()} (${data.ai1ConfidenceScore || 50}%)\n`;
slackSummary += `*AI 1 Reasoning:* ${data.ai1Reasoning || 'No reasoning provided'}\n\n`;
slackSummary += `*AI 2 Decision:* ${ai2Rec.toUpperCase()} (${validationConfidence}%)\n`;
slackSummary += `*AI 2 Reasoning:* ${validationReasoning}\n\n`;
slackSummary += `*Agreement:* ${agreement ? '✅ YES' : '❌ NO'}\n`;
slackSummary += `*Decision Matrix:* ${decisionMatrix}\n`;
slackSummary += `*Final Action:* **${finalAction.toUpperCase()}** (${Math.round(finalConfidence)}%)\n\n`;
slackSummary += `*Final Reasoning:* ${finalReasoning}`;

// ============================================
// STEP 5: Return Data
// ============================================
return [{
  json: {
    ...data,
    
    // AI 1 results
    ai1Recommendation: ai1Rec,
    ai1ConfidenceScore: data.ai1ConfidenceScore || 50,
    ai1Reasoning: data.ai1Reasoning || 'No reasoning provided',
    ai1RiskLevel: data.ai1RiskLevel || 'unknown',
    ai1SuggestedContainment: data.ai1SuggestedContainment || 'None specified',
    
    // AI 2 validation results
    validationAgreement: agreement,
    validationConfidence: validationConfidence,
    validationReasoning: validationReasoning,
    ai2FinalRecommendation: ai2Rec,
    ai2OverrideReason: overrideReason,
    
    // Decision matrix
    decisionMatrix: decisionMatrix,
    
    // Final decision
    finalAction: finalAction, // 'contain', 'ignore', 'review'
    finalConfidence: Math.round(finalConfidence),
    finalReasoning: finalReasoning,
    
    // Slack message
    slackSummary: slackSummary,
    
    // Override original needsContainment
    needsContainment: finalAction === 'contain',
    
    // Raw responses for debugging
    ai1RawResponse: data.ai1RawResponse || {},
    ai2RawResponse: validationResponse
  }
}];