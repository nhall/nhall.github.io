import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: {
		baseURL: 'http://localhost:3000',
	},
	webServer: {
		command: 'npx eleventy --serve --port=3000',
		port: 3000,
		reuseExistingServer: true,
	},
	testDir: 'tests',
	testMatch: '**/*.mjs',
});
