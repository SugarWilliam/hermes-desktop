/**
 * MRAG (Multi-modal RAG) type definitions.
 * Inspired by Dify's RAG pipeline architecture.
 */

export interface KBInfo {
  key: string;
  name: string;
  path: string;
  docCount: number;
  chunkCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ParentChunk {
  id: number;
  docPath: string;
  content: string;
  startLine: number;
  endLine: number;
  sectionTitle: string;
  contentHash: string;
}

export interface ParentChunkInput {
  docPath: string;
  content: string;
  startLine: number;
  endLine: number;
  sectionTitle: string;
  contentHash: string;
}

export interface SubChunkInput {
  parentIndex: number;
  content: string;
  docPath: string;
  sectionTitle: string;
}

export interface SearchResult {
  score: number;
  parentContent: string;
  subSnippet: string;
  docPath: string;
  sectionTitle: string;
  parentId: number;
}

export interface ChunkingConfig {
  parentSize: number;
  childSize: number;
  overlap: number;
}

export interface IndexResult {
  indexed: number;
  updated: number;
  skipped: number;
  errors: string[];
}
