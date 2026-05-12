"""
agents/__init__.py — ClynicxMedicalCrew: CrewAI Multi-Agent Package

4-Agent CrewAI Sequential Pipeline:
  Agent 1 — TriageAgent     (Groq llama-3.3-70b)    : Intent classification
  Agent 2 — RAGAgent        (Mistral mistral-embed)  : Document embedding + retrieval
  Agent 3 — SynthesisAgent  (Groq llama-3.3-70b)    : Medical response generation
  Agent 4 — SafetyAgent     (Groq llama-3.3-70b)    : Safety review & guardrails

Entry point: agents.orchestrator.run_pipeline()
Crew definition: agents.crew.run_crew()
Tools: agents.tools (mistral_rag_tool, safety_tool)
"""
