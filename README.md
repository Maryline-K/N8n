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
Wiz does the heavy detection work. The n8n AI agent is a classifier and decision-maker, not a raw threat detector.

Layer 2: Wiz AI Detection (The Real Detector)
Wiz uses a multi-stage approach to detect security issues across your Microsoft 365 and OpenShift environments. According to Wiz's official documentation, this follows a 4-stage detection model :

Stage 1: Visibility — Discover Everything
Before detection can happen, Wiz must know what exists in your environment.

Detection Activity	What Wiz Finds
AI Bill of Materials (AI BOM)	All AI software, SDKs, libraries, and dependencies across your environment 
Agent Inventory	Every AI agent, model, MCP connection, and data source 
Attack Surface Mapping	External-facing AI endpoints, validated with dynamic scanning 
For your M365 + OpenShift deployment, this means Wiz discovers:

M365 Copilot agents and their data connections

OpenShift workloads running AI models or ML pipelines

MCP (Model Context Protocol) servers that your AI agents might call

Stage 2: AI Misconfigurations — Secure the Foundations
Wiz continuously checks for weak defaults and missing guardrails :

Detection Type	What Wiz Checks
Baseline Enforcement	AI platforms (Bedrock, Vertex AI, OpenAI) follow secure configuration baselines
Guardrail Verification	Provider-native protections (e.g., AWS Bedrock Guardrails) are enabled
Sensitive Data Controls	prevents inadvertent access to PII or regulated data through misconfigured prompts, storage, or APIs
Stage 3: AI Posture — Understand Risk in Context
Wiz connects every finding through the Security Graph to reveal real risk :

Capability	How It Works
Contextual Correlation	Maps agents to identities, workloads, and data to show real attack paths
DSPM for AI	Extends data discovery and classification into AI training and inference pipelines
OWASP LLM Alignment	Addresses prompt injection, data poisoning, and insecure output handling with built-in policies
Stage 4: Runtime Monitoring — Detect Active Threats
This is where Wiz catches real-time attacks :

Detection Type	What Wiz Monitors
Behavioral Drift	AI workloads hosting rogue agents or communicating with suspicious DNS
Threat Correlation	Links live agent behavior to cloud resources and sensitive data
Automated Response	Triggers fixes or tickets based on detected threats
Wiz Detection Scope for Your Environment
Platform	What Wiz Detects
Microsoft 365	CSPM (misconfigurations in Exchange, OneDrive, SharePoint), DSPM (PII, secrets, regulated data), access exposure (externally shared links, guest accounts)
OpenShift	Vulnerability scanning (container images, RHEL VMs), runtime threat detection (suspicious processes, unexpected outbound connections), admission control (block risky deployments)
Layer 3: n8n AI Agent (The Decision Engine)
Once Wiz generates an enriched Issue, it sends a webhook to n8n. The n8n AI Agent does not re-detect the threat—it classifies and decides what to do.

What the n8n AI Agent Analyzes
Using an LLM (OpenAI GPT-4 or Google Gemini), the n8n AI Agent evaluates:

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



Real-World Examples: AI Detection in Action
Example 1: Crypto Miner on OpenShift
Phase	What Happens	Technology Used
Detection	Wiz runtime sensor detects a pod consuming excessive CPU and communicating with a known mining pool	Wiz Threat Detection 
Enrichment	Wiz maps the pod to its namespace, owner, blast radius (other workloads in namespace), and MITRE tactic (TA0040 - Impact)	Wiz Security Graph 
Classification	n8n AI Agent receives enriched issue, confirms high confidence (0.95), recommends ISOLATE	n8n + LLM
Response	n8n calls OpenShift API to kill the pod and apply restrictive SCC	OpenShift API
Example 2: Suspicious M365 File Sharing
Phase	What Happens	Technology Used
Detection	Wiz detects a SharePoint site externally shared containing PII/credit card data	Wiz DSPM for AI 
Enrichment	Wiz identifies the file owner, external users, and classification labels	Wiz Data Security
Classification	n8n AI Agent analyzes: medium confidence (0.65) due to ambiguous intent (could be legitimate business sharing)	n8n AI Agent
Response	Workflow sends Slack alert to security team for approval before revoking access	Slack + Human-in-the-Loop
Example 3: Prompt Injection Attempt on AI Agent
Phase	What Happens	Technology Used
Detection	Wiz detects unsanitized user input reaching an AI agent prompt	Wiz AI-SPM Guardrail Verification 
Enrichment	Wiz maps the agent to its connected data sources and tools (MCP servers)	Wiz Agent Inventory 
Classification	n8n AI Agent assesses: high confidence (0.90), recommends ISOLATE and revoke agent sessions	n8n + LLM
Response	n8n revokes the agent's M365 sessions and quarantines the agent configuration	Microsoft Graph API
Detection Technologies Used by Wiz
Based on patent records and official documentation, Wiz uses several detection methods :

Detection Method	How It Works
Agentless Scanning	Inspects cloned disks of resources without installing agents on running workloads
Dynamic Validation	Actively probes endpoints to validate exploitability (not just theoretical risk) 
Behavioral Analysis	Monitors runtime behavior against established baselines to detect drift
Graph Correlation	Maps relationships between identities, workloads, and data to reveal attack paths
What Your n8n AI Agent Does NOT Detect
It's important to understand the separation of responsibilities:

Detection Type	Who Does It	Why
Cloud misconfigurations	Wiz	Requires deep cloud API integration
Vulnerability scanning	Wiz	Requires container image and registry access
Runtime threats	Wiz	Requires kernel-level or eBPF sensors
Data classification	Wiz	Requires document inspection and NLP
Threat classification	n8n AI Agent	Requires business context and decision logic
Response selection	n8n AI Agent	Requires orchestration and API calling
Your n8n AI Agent is a decision engine, not a detection engine. It relies entirely on Wiz for accurate threat detection.

Summary Table: AI Detection by Component
Component	Primary Function	Detection Techniques
Wiz Security Graph	Cloud and AI workload detection	Agentless scanning, runtime monitoring, graph correlation, DSPM 
Wiz AI-SPM	AI agent and model security	AI BOM inventory, misconfiguration detection, guardrail verification 
Wiz Green Agent	Remediation intelligence	Fix generation, PR creation, code awareness 
Wiz Red Agent	Vulnerability validation	External probing, exploitability verification 
n8n AI Agent (LLM)	Threat classification and response	Prompt-based reasoning, confidence scoring, decision routing 
Would you like me to provide specific examples of the AI prompts used in the n8n AI Agent for threat classification, or more detail on Wiz's detection capabilities for M365 vs. OpenShift?
