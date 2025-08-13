import { TinyFTS } from "@/base/TinyFTS";
import iconCaptionsRaw from "@/assets/data/icon_captions.jsonl?raw";

interface IconCaption {
	ix: number;
	caption: string;
	tags: string[];
}

let fts: TinyFTS | null = null;

function parseJsonL(jsonl: string): IconCaption[] {
	return jsonl
		.trim()
		.split("\n")
		.map((line) => {
			try {
				const data = JSON.parse(line);
				// Basic validation
				if (
					typeof data.ix === "number" &&
					typeof data.caption === "string" &&
					Array.isArray(data.tags)
				) {
					return data as IconCaption;
				}
				return null;
			} catch (e) {
				console.error("Failed to parse JSON line:", line, e);
				return null;
			}
		})
		.filter((item): item is IconCaption => item !== null);
}

/**
 * Initializes the icon search index. Must be called once at startup.
 */
export function initializeIconSearch() {
	if (fts) {
		return;
	}

	fts = new TinyFTS();
	const iconCaptions = parseJsonL(iconCaptionsRaw);

	for (const caption of iconCaptions) {
		// The document text will be a combination of the caption and tags for better searchability.
		const searchText = `${caption.caption} ${caption.tags.join(" ")}`;
		fts.addDocument(searchText, { ix: caption.ix });
	}
	console.log(`[IconSearch] Indexed ${fts.size()} icon captions.`);
}

/**
 * Finds the best icon frame for a given query string.
 * @param query The text to search for (e.g., "fireball spell").
 * @param defaultIcon The icon frame to return if no match is found.
 * @returns The zero-based icon frame index.
 */
export function findIcon(query: string, defaultIcon = 0): number {
	if (!fts) {
		console.warn(
			"Icon search not initialized. Initializing on-demand. Please call initializeIconSearch() in BootScene for better performance.",
		);
		initializeIconSearch();
	}

	// This check is necessary because initialization could have failed.
	if (!fts) {
		return defaultIcon;
	}

	const results = fts.search(query, { limit: 1 });

	if (results.length > 0) {
		const ix = results[0].document.metadata?.ix;
		// The ix from JSONL is 1-based, Phaser frames are 0-based
		if (typeof ix === "number" && ix > 0) {
			return ix - 1;
		}
	}

	return defaultIcon;
} 