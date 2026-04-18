import fs from "node:fs";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
function contributorsMarkdownPlugin() {
    var contributorsPath = fileURLToPath(new URL("../contributors.md", import.meta.url));
    return {
        name: "contributors-markdown",
        resolveId: function (id) {
            if (id === "virtual:contributors-md") {
                return id;
            }
            return null;
        },
        load: function (id) {
            if (id !== "virtual:contributors-md") {
                return null;
            }
            var source = fs.readFileSync(contributorsPath, "utf-8");
            return "export default ".concat(JSON.stringify(source), ";");
        },
    };
}
export default defineConfig({
    plugins: [react(), contributorsMarkdownPlugin()],
    server: {
        fs: {
            allow: [fileURLToPath(new URL("..", import.meta.url))],
        },
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
});
