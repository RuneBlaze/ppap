import path from "node:path";
import { defineConfig } from "vite";
import { ViteToml } from "vite-plugin-toml";

export default defineConfig({
	plugins: [ViteToml()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
});
