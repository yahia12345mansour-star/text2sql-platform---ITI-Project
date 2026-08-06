from fastembed import TextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import uuid

# This model runs locally on your CPU — no internet call, no API key.
# It downloads once (a few hundred MB) the first time it's used, then
# is cached on disk for future runs.
_embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
EMBEDDING_SIZE = 384  # this model always outputs vectors of this length

qdrant = QdrantClient(url="http://localhost:6333")

COLLECTION_NAME = "document_chunks"


def ensure_collection_exists():
    # Qdrant needs a "collection" created once before you can store
    # vectors in it — like creating a table before inserting rows.
    existing = [c.name for c in qdrant.get_collections().collections]
    if COLLECTION_NAME not in existing:
        qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=EMBEDDING_SIZE, distance=Distance.COSINE),
        )


def embed_texts(texts: list[str]) -> list[list[float]]:
    # Converts each piece of text into a list of numbers ("vector")
    # representing its meaning. Similar meanings end up as similar vectors.
    return [vec.tolist() for vec in _embedding_model.embed(texts)]


def store_chunks(tenant_id: str, knowledge_base_id: str, file_id: str, chunks: list[str]):
    ensure_collection_exists()
    vectors = embed_texts(chunks)

    points = [
        PointStruct(
            id=str(uuid.uuid4()),  # Qdrant requires a plain integer or a real UUID as the point id
            vector=vectors[i],
            payload={
                "tenant_id": tenant_id,
                "knowledge_base_id": knowledge_base_id,
                "file_id": file_id,
                "chunk_index": i,
                "content": chunks[i],
            },
        )
        for i in range(len(chunks))
    ]
    qdrant.upsert(collection_name=COLLECTION_NAME, points=points)


def search_chunks(tenant_id: str, knowledge_base_id: str, query: str, top_k: int = 5) -> list[dict]:
    ensure_collection_exists()
    query_vector = embed_texts([query])[0]

    results = qdrant.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        query_filter={
            "must": [
                {"key": "tenant_id", "match": {"value": tenant_id}},
                {"key": "knowledge_base_id", "match": {"value": knowledge_base_id}},
            ]
        },
        limit=top_k,
    ).points

    return [
        {
            "content": r.payload["content"],
            "file_id": r.payload["file_id"],
            "chunk_index": r.payload["chunk_index"],
            "score": r.score,
        }
        for r in results
    ]
