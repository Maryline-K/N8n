// Get the incoming data from OpenAI node
const data = $input.first().json;

// ============================================
// STEP 1: Extract AI Response
// ============================================
let aiResponse = data.response || data.body || data;

// Parse the AI response if it's a string
if (typeof aiResponse === 'string') {
  try {
    // If it's OpenAI response with choices
    if (aiResponse.includes('choices')) {
      const parsed = JSON.parse(aiResponse);
      aiResponse = parsed.choices[0].message.content;
    }
    // Try to parse as JSON
    aiResponse = JSON.parse(aiResponse);
  } catch (error) {
    // If parsing fails, try to extract JSON from text
    const jsonMatch = aiResponse.match(/\{.*\}/s);
    if (jsonMatch) {
      try {
        aiResponse = JSON.parse(jsonMatch[0]);
      } catch (e) {
        aiResponse = { 
          recommendation: 'review', 
          confidenceScore: 0, 
          reasoning: 'Failed to parse AI response',
          riskLevel: 'unknown'
        };
      }
    }
  }
}

// ============================================
// STEP 2: Extract AI Decision
// ============================================
const ai1Recommendation = aiResponse.recommendation || 'review';
const ai1ConfidenceScore = aiResponse.confidenceScore || 50;
const ai1Reasoning = aiResponse.reasoning || 'No reasoning provided';
const ai1RiskLevel = aiResponse.riskLevel || 'medium';
const ai1SuggestedContainment = aiResponse.suggestedContainment || 'None specified';

// ============================================
// STEP 3: Build Decision Summary
// ============================================
const decisionSummary = `AI Decision: ${ai1Recommendation.toUpperCase()} (${ai1ConfidenceScore}%)\nReasoning: ${ai1Reasoning}\nRisk Level: ${ai1RiskLevel}`;

// ============================================
// STEP 4: Prepare Validation Prompt for AI 2
// ============================================
const validationPrompt = `You are a security validation AI. Your job is to review and validate the decision made by another AI.

=== Original Alert ===
Alert Type: ${data.alertType || 'Unknown'}
Severity: ${data.severity || 0}/10
Provider: ${data.provider || 'unknown'}
Resource Type: ${data.resourceType || 'unknown'}
Resource ID: ${data.resourceId || 'unknown'}
Description: ${data.alertDescription || ''}

=== First AI Decision ===
Recommendation: ${ai1Recommendation}
Confidence Score: ${ai1ConfidenceScore}%
Reasoning: ${ai1Reasoning}
Risk Level: ${ai1RiskLevel}
Suggested Containment: ${ai1SuggestedContainment}

=== Your Task ===
1. Review the first AI's decision
2. Analyze if the reasoning is sound
3. Determine if you agree or disagree

=== Response Format (JSON only) ===
{
  "agreement": true, // true if you agree, false if you disagree
  "validationConfidence": 0-100, // How confident are you in your validation
  "validationReasoning": "Brief explanation of your validation",
  "finalRecommendation": "contain", // "contain", "ignore", or "review"
  "overrideReason": "If you disagree, explain why"
}`;

// ============================================
// STEP 5: Return Data
// ============================================
return [{
  json: {
    ...data,
    // First AI results
    ai1Recommendation: ai1Recommendation,
    ai1ConfidenceScore: ai1ConfidenceScore,
    ai1Reasoning: ai1Reasoning,
    ai1RiskLevel: ai1RiskLevel,
    ai1SuggestedContainment: ai1SuggestedContainment,
    ai1RawResponse: aiResponse,
    decisionSummary: decisionSummary,
    
    // Validation prompt
    validationPrompt: validationPrompt,
    
    // For OpenAI node (AI 2)
    validationMessages: [
      {
        role: "system",
        content: "You are a security validation AI. Respond in valid JSON only."
      },
      {
        role: "user",
        content: validationPrompt
      }
    ],
    
    // For HTTP Request node (if using custom AI)
    validationRequestBody: {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a security validation AI. Respond in valid JSON only."
        },
        {
          role: "user",
          content: validationPrompt
        }
      ],
      temperature: 0.2,
      max_tokens: 300
    }
  }
}];