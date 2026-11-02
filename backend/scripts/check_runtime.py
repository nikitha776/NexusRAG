"""Linux sample workload; run from /app (or backend) after model caching.

Requires normal backend settings or dummy settings for this isolated check.
No database, object storage, or answer-provider calls are made.
"""
import json
import math
import resource
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import app
from app.services.embedding import generate_embeddings, generate_embedding

vectors = generate_embeddings([
    'NexusRAG uses selected documents as evidence.',
    'The project uses FastAPI and LangChain.',
    'Unicode evidence: 数据 café.',
])
query = generate_embedding('What is the project about?')
generate_embeddings(['Long document content and evidence. ' * 200 for _ in range(20)])
assert len(query) == 384 and all(len(vector) == 384 for vector in vectors)
assert all(abs(math.sqrt(sum(x*x for x in vector)) - 1) < 1e-6 for vector in vectors)
assert 'torch' not in sys.modules
print(json.dumps({'dimensions': len(query), 'normalized': True,
                  'peak_memory_mib': round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1),
                  'torch_imported': 'torch' in sys.modules, 'app': app.title}))
