The Two-Layer AI Detection Architecture
In your architecture, AI detection happens at two distinct layers:

Layer	Component	What It Detects
Layer 2	Wiz (CNAPP + AI-SPM)	Cloud misconfigurations, vulnerabilities, runtime threats, AI agent risks
Layer 3	n8n AI Agent (OpenAI/Gemini)	Threat classification, severity scoring, response decision
Here's how they work together:

text
Wiz (Layer 2 Detection)                    n8n (Layer 3 Classification)
        │                                           │
        ▼                                           ▼
┌───────────────────────┐                 ┌───────────────────────┐
│ Wiz Security Graph    │                 │ AI Agent (LLM)        │
│                       │                 │                       │
│ • Scans cloud configs │  ── Wiz Issue ──►│ • Analyzes Wiz output │
│ • Correlates findings │                 │ • Classifies threat   │
│ • Maps attack paths   │                 │ • Recommends response │
│ • Adds blast radius   │                 │ • Assigns confidence  │
└───────────────────────┘                 └───────────────────────┘

Input from Wiz	What the AI Assesses
Threat name and description	Is this truly malicious or a false positive?
Severity (Critical/High/Medium/Low)	Does severity match organizational risk tolerance?
Affected assets	What is the business impact of this asset being compromised?
MITRE ATT&CK tactics	What stage of the attack kill chain are we in?
Blast radius	How many other assets could be affected?
Asset owner	Is this a production or development workload?
The AI Agent's Output
Based on this analysis, the n8n AI Agent produces a structured verdict :

json
{
    "verdict": "ISOLATE | MONITOR | ESCALATE",
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation of why this decision was made",
    "platform": "m365 | openshift",
    "action": "Specific API command or playbook to execute"
}
How Confidence is Determined
Confidence Level	Meaning	Routing Decision
≥0.8 (High)	AI is very certain about the threat	Auto-execute containment
0.5-0.8 (Medium)	AI is somewhat certain, but ambiguity exists	Human review via Slack/Teams
<0.5 (Low)	AI is uncertain, needs manual investigation	Escalate to Jira ticket
This confidence-based routing approach is standard in production AI workflows .


