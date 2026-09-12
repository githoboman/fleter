import json
import os

MEMORY_FILE = "episodic_memory.json"

def get_episodic_memory():
    """
    Retrieves the agent's memory of past market outcomes.
    """
    if not os.path.exists(MEMORY_FILE):
        return []
    with open(MEMORY_FILE, "r") as f:
        return json.load(f)

def add_to_memory(market_id: str, direction: str, outcome: str, was_accurate: bool):
    """
    Saves a market result to episodic memory.
    """
    memory = get_episodic_memory()
    memory.append({
        "market_id": market_id,
        "predicted_direction": direction,
        "actual_outcome": outcome,
        "was_accurate": was_accurate
    })
    
    # Keep only the last 50 entries to avoid context bloat
    memory = memory[-50:]
    
    with open(MEMORY_FILE, "w") as f:
        json.dump(memory, f, indent=2)
