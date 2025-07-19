/**
 * JSX-like streaming XML parser for extracting structured data from text streams.
 * Supports both self-closing and content tags with type-safe handlers and Zod validation.
 *
 * @example
 * ```typescript
 * const parser = new StreamingXMLParser<BattleEvent>()
 *   .registerSelfClosing("topic", z.object({ characterId: z.string() }),
 *     (attrs) => ({ type: "topic", characterId: attrs.characterId }))
 *   .registerContent("damage", z.object({ targetId: z.string() }),
 *     z.string().transform(v => parseInt(v, 10)),
 *     (attrs, amount) => ({ type: "damage", targetId: attrs.targetId, amount }));
 *
 * const result = parser.parse("Text with <topic characterId='hero' /> and <damage targetId='enemy'>25</damage>");
 * // result.results contains parsed objects, result.errors contains validation failures
 * ```
 */

import type { z } from "zod";

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Handler definition for XML tags with Zod validation schemas
 */
export interface XMLTagHandler<T = any> {
	/** Zod schema for validating tag attributes */
	attributeSchema: z.ZodSchema<any>;
	/** Optional Zod schema for validating tag content (content tags only) */
	contentSchema?: z.ZodSchema<any>;
	/** Handler function called with validated data, returns parsed result or null to ignore */
	handle(attributes: any, content?: any): T | null;
}

/** Error information for failed XML tag parsing */
export interface XMLParsingError {
	tagName: string /** Tag name that failed */;
	rawTag: string /** Original tag text */;
	error: Error /** Underlying validation/parsing error */;
}

/** Result of parsing operation with extracted data and errors */
export interface XMLParserResult<T> {
	results: T[] /** Successfully parsed and validated objects */;
	remainingText: string /** Input text with processed tags removed */;
	terminated: boolean /** True if termination condition was met */;
	errors: XMLParsingError[] /** Validation/parsing failures (non-blocking) */;
}

/** Internal tag definition with handler and metadata */
export interface XMLTagDefinition<T = any> {
	name: string /** Tag name (e.g., "hp_damage") */;
	selfClosing: boolean /** True for <tag />, false for <tag>content</tag> */;
	handler: XMLTagHandler<T> /** Handler with validation schemas */;
	terminates?: boolean /** If true, stops parsing when this tag is found */;
}

/**
 * JSX-like streaming XML parser with Zod validation.
 *
 * @template T - Base type for all parsed results
 */
export class StreamingXMLParser<T = any> {
	private tagDefinitions = new Map<string, XMLTagDefinition<T>>();

	// ========================================================================
	// REGISTRATION METHODS
	// ========================================================================

	/** Register a tag handler manually with full XMLTagDefinition */
	public registerTag<U extends T>(definition: XMLTagDefinition<U>): this {
		this.tagDefinitions.set(definition.name, definition as XMLTagDefinition<T>);
		return this;
	}

	/** Register self-closing tag: `<tag attr="value" />` */
	public registerSelfClosing<A extends Record<string, any>, U extends T>(
		name: string,
		attributeSchema: z.ZodSchema<A>,
		handler: (attributes: A) => U | null,
		terminates = false,
	): this {
		return this.registerTag({
			name,
			selfClosing: true,
			handler: { attributeSchema, handle: handler } as XMLTagHandler<T>,
			terminates,
		});
	}

	/** Register content tag: `<tag attr="value">content</tag>` */
	public registerContent<A extends Record<string, any>, C, U extends T>(
		name: string,
		attributeSchema: z.ZodSchema<A>,
		contentSchema: z.ZodSchema<C>,
		handler: (attributes: A, content: C) => U | null,
	): this {
		return this.registerTag({
			name,
			selfClosing: false,
			handler: {
				attributeSchema,
				contentSchema,
				handle: handler,
			} as XMLTagHandler<T>,
		});
	}

	// ========================================================================
	// PARSING METHODS
	// ========================================================================

	/** Parse text and extract all registered tags with validation */
	public parse(text: string): XMLParserResult<T> {
		const results: T[] = [];
		const errors: XMLParsingError[] = [];
		let remainingText = text;
		let terminated = false;

		// Process each registered tag type
		for (const [_tagName, definition] of this.tagDefinitions) {
			const parseResult = this.parseTag(remainingText, definition);

			// Add successful results
			results.push(...parseResult.results);

			// Collect errors
			errors.push(...parseResult.errors);

			// Update remaining text
			remainingText = parseResult.remainingText;

			// Check for termination
			if (parseResult.terminated) {
				terminated = true;
				break;
			}
		}

		return {
			results,
			remainingText,
			terminated,
			errors,
		};
	}

	/**
	 * Parse a specific tag type from text
	 */
	private parseTag(
		text: string,
		definition: XMLTagDefinition<T>,
	): XMLParserResult<T> {
		const results: T[] = [];
		const errors: XMLParsingError[] = [];
		let remainingText = text;
		let terminated = false;

		const pattern = definition.selfClosing
			? this.createSelfClosingPattern(definition.name)
			: this.createContentPattern(definition.name);

		let match;
		while ((match = pattern.exec(remainingText)) !== null) {
			const rawTag = match[0];

			try {
				// Extract raw attributes and content
				const rawAttributes = this.parseAttributes(match[1] || "");
				const rawContent = definition.selfClosing ? undefined : match[2];

				// Validate attributes with Zod
				const validatedAttributes =
					definition.handler.attributeSchema.parse(rawAttributes);

				// Validate content with Zod (if schema provided)
				let validatedContent = rawContent;
				if (!definition.selfClosing && definition.handler.contentSchema) {
					validatedContent = definition.handler.contentSchema.parse(rawContent);
				}

				// Call handler with validated data
				const result = definition.handler.handle(
					validatedAttributes,
					validatedContent,
				);

				if (result !== null) {
					results.push(result);
				}

				// Check for termination
				if (definition.terminates) {
					terminated = true;
				}

				// Remove the matched tag from text
				remainingText = remainingText.replace(match[0], "");

				// Reset pattern index since we modified the string
				pattern.lastIndex = 0;
			} catch (error) {
				// Collect parsing error but continue processing
				errors.push({
					tagName: definition.name,
					rawTag,
					error: error instanceof Error ? error : new Error(String(error)),
				});

				// Remove the invalid tag from text anyway to prevent infinite loops
				remainingText = remainingText.replace(match[0], "");
				pattern.lastIndex = 0;
			}
		}

		return {
			results,
			remainingText,
			terminated,
			errors,
		};
	}

	/**
	 * Create regex pattern for self-closing tags
	 */
	private createSelfClosingPattern(tagName: string): RegExp {
		return new RegExp(`<${tagName}\\s*([^>]*)\\s*\\/>`, "g");
	}

	/**
	 * Create regex pattern for content tags
	 */
	private createContentPattern(tagName: string): RegExp {
		return new RegExp(`<${tagName}\\s*([^>]*)>([^<]*)<\\/${tagName}>`, "g");
	}

	/**
	 * Parse attribute string into key-value pairs
	 */
	private parseAttributes(attributeString: string): Record<string, string> {
		const attributes: Record<string, string> = {};

		// Match attribute="value" or attribute='value' patterns
		const attributePattern = /(\w+)=["']([^"']*)["']/g;
		let match;

		while ((match = attributePattern.exec(attributeString)) !== null) {
			attributes[match[1]] = match[2];
		}

		return attributes;
	}

	// ========================================================================
	// UTILITY METHODS
	// ========================================================================

	/** Clear all registered tag handlers */
	public clear(): this {
		this.tagDefinitions.clear();
		return this;
	}

	/** Get list of registered tag names */
	public getRegisteredTags(): string[] {
		return Array.from(this.tagDefinitions.keys());
	}
}

// ============================================================================
// FACTORY & UTILITY TYPES
// ============================================================================

/** Factory function for creating a typed XML parser */
export function createXMLParser<T>(): StreamingXMLParser<T> {
	return new StreamingXMLParser<T>();
}

/** Utility type for inferring handler result types */
export type InferHandlerResult<H> = H extends XMLTagHandler<infer T>
	? T
	: never;
