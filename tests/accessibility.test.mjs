import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { Playwright } from '@siteimprove/alfa-playwright';
import { Audit, Logging, Rules } from '@siteimprove/alfa-test-utils';

test('axe: page has no accessibility violations', async ({ page }) => {
	await page.goto('/');

	const results = await new AxeBuilder({ page })
		.exclude('#__bs_notify__')
		.analyze();

	expect(results.violations).toEqual([]);
});

test('siteimprove: page passes WCAG 2.2 AA checks', async ({ page }) => {
	await page.goto('/');

	const document = await page.evaluateHandle(() => window.document);
	const alfaPage = await Playwright.toPage(document);

	let alfaResult;

	try {
		alfaResult = await Audit.run(alfaPage, {
			rules: {
				include: Rules.aaFilter,
			},
		});
	} catch (error) {
		// Siteimprove alfa cannot resolve CSS clamp() with viewport units in
		// line-height. This is a library limitation, not an accessibility issue.
		// https://github.com/Siteimprove/alfa/issues
		if (error.message?.includes('Could not fully resolve clamp')) {
			console.warn(`Skipping siteimprove test: ${error.message}`);
			test.skip();
			return;
		}

		throw error;
	}

	Logging.fromAudit(alfaResult).print();

	const failingRules = alfaResult.resultAggregates.filter(
		(aggregate) => aggregate.failed > 0,
	);

	expect(failingRules.size, `${failingRules.size} failing accessibility rules`).toBe(0);
});
