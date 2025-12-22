import { prisma } from "../../lib/prisma";
import { generateEmbedding } from "./openaiClient";
import { Role, Country, ServiceScope, canAccessDocument } from "./rbac";
import crypto from "crypto";

export interface KBSearchResult {
  id: string;
  documentId: string;
  title: string;
  chunkText: string;
  similarity: number;
}

export interface KBSearchMetadata {
  cacheHit: boolean;
  cacheKind?: "EMBEDDING" | "KB_RESULTS";
  embeddingTimeMs?: number;
  searchTimeMs?: number;
}

const EMBEDDING_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KB_RESULTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function generateCacheKey(prefix: string, ...parts: string[]): string {
  const normalized = parts.map(p => (p || "").toLowerCase().trim().replace(/\s+/g, " ")).join("|");
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");
  return `${prefix}:${hash}`;
}

async function getEmbeddingFromCache(query: string): Promise<number[] | null> {
  const cacheKey = generateCacheKey("EMB", query);
  try {
    const cached = await prisma.$queryRaw<Array<{ payload_json: any; expires_at: Date }>>`
      SELECT payload_json, expires_at FROM safepilot_cache 
      WHERE cache_key = ${cacheKey} AND kind = 'EMBEDDING' AND expires_at > NOW()
      LIMIT 1
    `;
    if (cached.length > 0 && cached[0].payload_json) {
      return cached[0].payload_json as number[];
    }
  } catch (e) {
    console.error("[SafePilot Cache] Embedding get error:", e);
  }
  return null;
}

async function setEmbeddingCache(query: string, embedding: number[]): Promise<void> {
  const cacheKey = generateCacheKey("EMB", query);
  const expiresAt = new Date(Date.now() + EMBEDDING_CACHE_TTL_MS);
  try {
    await prisma.$executeRaw`
      INSERT INTO safepilot_cache (id, cache_key, kind, payload_json, created_at, expires_at)
      VALUES (gen_random_uuid(), ${cacheKey}, 'EMBEDDING', ${JSON.stringify(embedding)}::jsonb, NOW(), ${expiresAt})
      ON CONFLICT (cache_key) DO UPDATE SET payload_json = ${JSON.stringify(embedding)}::jsonb, expires_at = ${expiresAt}, created_at = NOW()
    `;
  } catch (e) {
    console.error("[SafePilot Cache] Embedding set error:", e);
  }
}

async function getKBResultsFromCache(query: string, country: string, role: string, service: string): Promise<KBSearchResult[] | null> {
  const cacheKey = generateCacheKey("KB", query, country, role, service);
  try {
    const cached = await prisma.$queryRaw<Array<{ payload_json: any; expires_at: Date }>>`
      SELECT payload_json, expires_at FROM safepilot_cache 
      WHERE cache_key = ${cacheKey} AND kind = 'KB_RESULTS' AND expires_at > NOW()
      LIMIT 1
    `;
    if (cached.length > 0 && cached[0].payload_json) {
      return cached[0].payload_json as KBSearchResult[];
    }
  } catch (e) {
    console.error("[SafePilot Cache] KB results get error:", e);
  }
  return null;
}

async function setKBResultsCache(query: string, country: string, role: string, service: string, results: KBSearchResult[]): Promise<void> {
  const cacheKey = generateCacheKey("KB", query, country, role, service);
  const expiresAt = new Date(Date.now() + KB_RESULTS_CACHE_TTL_MS);
  try {
    await prisma.$executeRaw`
      INSERT INTO safepilot_cache (id, cache_key, kind, payload_json, created_at, expires_at)
      VALUES (gen_random_uuid(), ${cacheKey}, 'KB_RESULTS', ${JSON.stringify(results)}::jsonb, NOW(), ${expiresAt})
      ON CONFLICT (cache_key) DO UPDATE SET payload_json = ${JSON.stringify(results)}::jsonb, expires_at = ${expiresAt}, created_at = NOW()
    `;
  } catch (e) {
    console.error("[SafePilot Cache] KB results set error:", e);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

export async function searchKB(params: {
  query: string;
  country: Country;
  role: Role;
  service: ServiceScope;
  limit?: number;
}): Promise<KBSearchResult[]> {
  const { results } = await searchKBWithMetadata(params);
  return results;
}

export async function searchKBWithMetadata(params: {
  query: string;
  country: Country;
  role: Role;
  service: ServiceScope;
  limit?: number;
}): Promise<{ results: KBSearchResult[]; metadata: KBSearchMetadata }> {
  const { query, country, role, service, limit = 6 } = params;
  const metadata: KBSearchMetadata = { cacheHit: false };

  try {
    const cachedResults = await getKBResultsFromCache(query, country, role, service);
    if (cachedResults) {
      metadata.cacheHit = true;
      metadata.cacheKind = "KB_RESULTS";
      return { results: cachedResults.slice(0, limit), metadata };
    }

    const embeddingStart = Date.now();
    let queryEmbedding = await getEmbeddingFromCache(query);
    
    if (queryEmbedding) {
      metadata.cacheHit = true;
      metadata.cacheKind = "EMBEDDING";
    } else {
      queryEmbedding = await generateEmbedding(query);
      await setEmbeddingCache(query, queryEmbedding);
    }
    metadata.embeddingTimeMs = Date.now() - embeddingStart;

    const searchStart = Date.now();
    const documents = await prisma.safePilotKBDocument.findMany({
      where: {
        isActive: true,
        OR: [
          { countryScope: "GLOBAL" },
          { countryScope: country },
        ],
      },
      include: {
        embeddings: true,
      },
    });

    const filteredDocs = documents.filter((doc) =>
      canAccessDocument(
        role,
        country,
        doc.roleScope as Role | "ALL",
        doc.countryScope as Country | "GLOBAL",
        doc.serviceScope as ServiceScope,
        service
      )
    );

    const results: KBSearchResult[] = [];

    for (const doc of filteredDocs) {
      for (const embedding of doc.embeddings) {
        const similarity = cosineSimilarity(queryEmbedding, embedding.embedding);
        results.push({
          id: embedding.id,
          documentId: doc.id,
          title: doc.title,
          chunkText: embedding.chunkText,
          similarity,
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    const finalResults = results.slice(0, limit);
    metadata.searchTimeMs = Date.now() - searchStart;

    await setKBResultsCache(query, country, role, service, finalResults);

    return { results: finalResults, metadata };
  } catch (error) {
    console.error("[SafePilot] KB search error:", error);
    return { results: [], metadata };
  }
}

export async function getDocumentById(documentId: string): Promise<{
  id: string;
  title: string;
  body: string;
  tags: string[];
  countryScope: string;
  roleScope: string;
  serviceScope: string;
  source: string;
  version: number;
  isActive: boolean;
} | null> {
  const doc = await prisma.safePilotKBDocument.findUnique({
    where: { id: documentId },
  });
  
  if (!doc) return null;
  
  return {
    id: doc.id,
    title: doc.title,
    body: doc.body,
    tags: doc.tags,
    countryScope: doc.countryScope,
    roleScope: doc.roleScope,
    serviceScope: doc.serviceScope,
    source: doc.source,
    version: doc.version,
    isActive: doc.isActive,
  };
}

function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length - overlap) break;
  }
  
  return chunks;
}

export async function createDocumentWithEmbeddings(params: {
  title: string;
  body: string;
  tags: string[];
  countryScope: Country | "GLOBAL";
  roleScope: Role | "ALL";
  serviceScope: ServiceScope;
  source: "admin_upload" | "policy" | "faq" | "runbook";
  createdByAdminId?: string;
}): Promise<string> {
  const { title, body, tags, countryScope, roleScope, serviceScope, source, createdByAdminId } = params;

  const document = await prisma.safePilotKBDocument.create({
    data: {
      title,
      body,
      tags,
      countryScope,
      roleScope,
      serviceScope,
      source,
      createdByAdminId,
    },
  });

  const chunks = chunkText(body);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkContent = `${title}\n\n${chunks[i]}`;
    const embedding = await generateEmbedding(chunkContent);
    
    await prisma.safePilotKBEmbedding.create({
      data: {
        documentId: document.id,
        chunkIndex: i,
        chunkText: chunks[i],
        embedding,
      },
    });
  }

  return document.id;
}

export async function reembedDocument(documentId: string): Promise<boolean> {
  const document = await prisma.safePilotKBDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) return false;

  await prisma.safePilotKBEmbedding.deleteMany({
    where: { documentId },
  });

  const chunks = chunkText(document.body);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkContent = `${document.title}\n\n${chunks[i]}`;
    const embedding = await generateEmbedding(chunkContent);
    
    await prisma.safePilotKBEmbedding.create({
      data: {
        documentId: document.id,
        chunkIndex: i,
        chunkText: chunks[i],
        embedding,
      },
    });
  }

  return true;
}

export async function updateDocumentStatus(documentId: string, isActive: boolean): Promise<boolean> {
  try {
    await prisma.safePilotKBDocument.update({
      where: { id: documentId },
      data: { 
        isActive,
        version: { increment: 1 },
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function listDocuments(filters?: {
  countryScope?: Country | "GLOBAL";
  roleScope?: Role | "ALL";
  serviceScope?: ServiceScope;
  isActive?: boolean;
  source?: string;
}): Promise<Array<{
  id: string;
  title: string;
  tags: string[];
  countryScope: string;
  roleScope: string;
  serviceScope: string;
  source: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>> {
  const where: any = {};
  
  if (filters?.countryScope) where.countryScope = filters.countryScope;
  if (filters?.roleScope) where.roleScope = filters.roleScope;
  if (filters?.serviceScope) where.serviceScope = filters.serviceScope;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;
  if (filters?.source) where.source = filters.source;

  const documents = await prisma.safePilotKBDocument.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      tags: true,
      countryScope: true,
      roleScope: true,
      serviceScope: true,
      source: true,
      version: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return documents;
}
