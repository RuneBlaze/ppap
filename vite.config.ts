import { defineConfig } from "vite";
import { ViteToml } from "vite-plugin-toml";
import path from "path";

export default defineConfig({
	plugins: [ViteToml()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
});