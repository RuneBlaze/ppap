import path from "path";
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
