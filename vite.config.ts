import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tanstackRouter(), react(), tailwindcss(), tsconfigPaths()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
	server: {
		host: true,   // bind to 0.0.0.0 so LAN devices (tablets) can connect
		port: 5173,
	},
	preview: {
		allowedHosts: ["ecareafrica.net", "www.ecareafrica.net"],
	},
});
