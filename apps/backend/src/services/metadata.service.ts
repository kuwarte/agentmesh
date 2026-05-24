/**
 * metadata.service.ts
 *
 * Off-chain API metadata storage backed by Supabase.
 *
 * The on-chain APIRegistry stores only trust-critical fields:
 *   provider, name, endpoint, pricePerCall, active
 *
 * This service stores the rich discovery/docs fields keyed by apiId:
 *   category, tags, description, longDesc, slug,
 *   params, codeExample, responseSchema
 *
 * Supabase table: api_metadata
 *   api_id        text PRIMARY KEY   — on-chain bytes32 apiId (hex string)
 *   slug          text UNIQUE        — URL-friendly identifier
 *   category      text               — marketplace category
 *   tags          text[]             — searchable tags
 *   description   text               — short description (card)
 *   long_desc     text               — full description (detail page)
 *   params        jsonb              — array of { name, type, required, description }
 *   code_example  text               — agent integration code snippet
 *   response_schema text             — example JSON response
 *   created_at    timestamptz        — auto-set by Supabase
 *   updated_at    timestamptz        — auto-set by Supabase
 *
 * SQL to create the table (run in Supabase SQL editor):
 *
 *   create table api_metadata (
 *     api_id         text primary key,
 *     slug           text unique,
 *     category       text,
 *     tags           text[],
 *     description    text,
 *     long_desc      text,
 *     params         jsonb,
 *     code_example   text,
 *     response_schema text,
 *     created_at     timestamptz default now(),
 *     updated_at     timestamptz default now()
 *   );
 *
 *   -- Auto-update updated_at on row change
 *   create or replace function update_updated_at()
 *   returns trigger as $$
 *   begin new.updated_at = now(); return new; end;
 *   $$ language plpgsql;
 *
 *   create trigger set_updated_at
 *   before update on api_metadata
 *   for each row execute function update_updated_at();
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface ApiParam {
	name:        string;
	type:        string;
	required:    string;  // "Yes" | "No"
	description: string;
}

export interface ApiMetadata {
	apiId:          string;
	slug:           string;
	category:       string;
	tags:           string[];
	description:    string;
	longDesc:       string;
	params:         ApiParam[];
	codeExample:    string;
	responseSchema: string;
}

// Partial version used for upsert — all fields optional except apiId
export type ApiMetadataInput = Partial<Omit<ApiMetadata, "apiId">> & { apiId: string };

class MetadataService {
	private client: SupabaseClient | null = null;
	private ready = false;

	init() {
		const url = process.env.SUPABASE_URL;
		const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

		if (!url || !key) {
			console.warn("[metadata] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — metadata endpoints disabled");
			return;
		}

		this.client = createClient(url, key, {
			auth: { persistSession: false },
		});

		this.ready = true;
		console.log("[metadata] Supabase client initialized");
	}

	isReady() {
		return this.ready;
	}

	// ---------------------------------------------------------------------------
	// Upsert metadata for an API (insert or update by apiId)
	// ---------------------------------------------------------------------------
	async upsert(input: ApiMetadataInput): Promise<ApiMetadata | null> {
		if (!this.client) return null;

		const row = {
			api_id:          input.apiId,
			slug:            input.slug,
			category:        input.category,
			tags:            input.tags,
			description:     input.description,
			long_desc:       input.longDesc,
			params:          input.params,
			code_example:    input.codeExample,
			response_schema: input.responseSchema,
		};

		const { data, error } = await this.client
			.from("api_metadata")
			.upsert(row, { onConflict: "api_id" })
			.select()
			.single();

		if (error) {
			console.error("[metadata] upsert failed:", error.message);
			return null;
		}

		return this.toApiMetadata(data);
	}

	// ---------------------------------------------------------------------------
	// Get metadata for a single API by apiId
	// ---------------------------------------------------------------------------
	async get(apiId: string): Promise<ApiMetadata | null> {
		if (!this.client) return null;

		const { data, error } = await this.client
			.from("api_metadata")
			.select("*")
			.eq("api_id", apiId)
			.single();

		if (error || !data) return null;

		return this.toApiMetadata(data);
	}

	// ---------------------------------------------------------------------------
	// Get metadata for a single API by slug
	// ---------------------------------------------------------------------------
	async getBySlug(slug: string): Promise<ApiMetadata | null> {
		if (!this.client) return null;

		const { data, error } = await this.client
			.from("api_metadata")
			.select("*")
			.eq("slug", slug)
			.single();

		if (error || !data) return null;

		return this.toApiMetadata(data);
	}

	// ---------------------------------------------------------------------------
	// Get metadata for multiple APIs at once (batch fetch by apiId array)
	// ---------------------------------------------------------------------------
	async getBatch(apiIds: string[]): Promise<Map<string, ApiMetadata>> {
		const result = new Map<string, ApiMetadata>();
		if (!this.client || !apiIds.length) return result;

		const { data, error } = await this.client
			.from("api_metadata")
			.select("*")
			.in("api_id", apiIds);

		if (error || !data) return result;

		for (const row of data) {
			result.set(row.api_id, this.toApiMetadata(row));
		}

		return result;
	}

	// ---------------------------------------------------------------------------
	// List all distinct categories that have at least one API
	// ---------------------------------------------------------------------------
	async getCategories(): Promise<string[]> {
		if (!this.client) return [];

		const { data, error } = await this.client
			.from("api_metadata")
			.select("category")
			.not("category", "is", null);

		if (error || !data) return [];

		const categories = [...new Set(data.map((r: any) => r.category).filter(Boolean))];
		return categories.sort();
	}

	// ---------------------------------------------------------------------------
	// Delete metadata for an API (e.g. when deregistered)
	// ---------------------------------------------------------------------------
	async delete(apiId: string): Promise<boolean> {
		if (!this.client) return false;

		const { error } = await this.client
			.from("api_metadata")
			.delete()
			.eq("api_id", apiId);

		return !error;
	}

	// ---------------------------------------------------------------------------
	// Map Supabase snake_case row → camelCase ApiMetadata
	// ---------------------------------------------------------------------------
	private toApiMetadata(row: any): ApiMetadata {
		return {
			apiId:          row.api_id,
			slug:           row.slug           ?? "",
			category:       row.category       ?? "",
			tags:           row.tags           ?? [],
			description:    row.description    ?? "",
			longDesc:       row.long_desc      ?? "",
			params:         row.params         ?? [],
			codeExample:    row.code_example   ?? "",
			responseSchema: row.response_schema ?? "",
		};
	}
}

export const metadataService = new MetadataService();
