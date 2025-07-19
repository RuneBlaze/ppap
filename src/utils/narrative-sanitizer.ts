/**
 * Utility for sanitizing narrative text by removing or replacing XML-like tags
 * This is part of the "functional core" - pure function, easily testable
 */

/**
 * Sanitizes narrative text by removing XML tags and replacing placeholders
 * @param text Raw narrative text with XML tags
 * @param characterMap Optional map of character IDs to names for placeholder replacement
 * @returns Clean text ready for display
 */
export function sanitizeNarrativeText(
	text: string,
	characterMap?: Map<string, string>,
): string {
	if (!text) return "";

	let sanitized = text;

	// Remove self-closing XML tags first (e.g., <topic characterId="hero" />)
	sanitized = sanitized.replace(/<[^>]+\/>/g, "");

	// Remove specific XML tags that should be stripped with their content
	// (e.g., <hp_damage targetId="enemy">25</hp_damage>)
	const tagsToStripWithContent = [
		"hp_damage",
		"hp_heal",
		"mp_cost",
		"mp_heal",
		"status_change",
	];

	for (const tag of tagsToStripWithContent) {
		const regex = new RegExp(`<${tag}[^>]*>[^<]*<\\/${tag}>`, "g");
		sanitized = sanitized.replace(regex, "");
	}

	// Remove remaining opening/closing tags but preserve content
	// (e.g., <source_name>content</source_name> becomes "content")
	sanitized = sanitized.replace(/<([^>/]+)>([^<]*)<\/[^>]+>/g, "$2");

	// Remove any remaining simple tags
	sanitized = sanitized.replace(/<[^>]*>/g, "");

	// Replace character ID placeholders if characterMap is provided
	if (characterMap) {
		// Look for patterns like {characterId} or ${characterId}
		sanitized = sanitized.replace(/\{([^}]+)\}/g, (match, id) => {
			return characterMap.get(id) || match;
		});

		sanitized = sanitized.replace(/\$\{([^}]+)\}/g, (match, id) => {
			return characterMap.get(id) || match;
		});
	}

	// Clean up extra whitespace
	sanitized = sanitized.trim();
	sanitized = sanitized.replace(/\s+/g, " ");

	return sanitized;
}

/**
 * Creates a character map from an array of battle characters
 * @param characters Array of battle characters
 * @returns Map of character IDs to names
 */
export function createCharacterMap(
	characters: { id: string; name: string }[],
): Map<string, string> {
	return new Map(characters.map((char) => [char.id, char.name]));
}
