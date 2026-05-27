# pantry-tracker

## Project Plan

Read ~/AGENTS.md and ~/projects/zero-system/AGENTS.md first.
Read ~/projects/pantry-tracker/onboarding/module_map.md and
~/projects/pantry-tracker/onboarding/system_design.md before
making any changes.

Add predictive recipe caching to Pantry Tracker to reduce
Spoonacular API usage. Currently Spoonacular is called on demand.
Instead, implement a daily cache pre-fetch that spreads API calls
over time and serves most searches from MongoDB cache.

Changes needed:

1. MongoDB cache collection — add a RecipeCache document storing
ingredient set hash as key, Spoonacular response as value, TTL 7 days

2. SpoonacularController / RecipeService — check cache by ingredient
hash before calling Spoonacular API. Only call API on cache miss.
Store result in cache after fetch.

3. Daily pre-fetch job — Spring @Scheduled task at 02:00. Reads
inventory items with consumptionLevel > 0, builds top 10 ingredient
combinations prioritizing staples and items nearing expiry,
pre-fetches and caches results. Max 50 API points per run.

4. Cache hit/miss logging so effectiveness is visible.

Constraints:
- Do not change Recipes.tsx frontend
- Keep existing SpoonacularController endpoints working
- Max 50 Spoonacular points per pre-fetch run

Success: recipes tab no longer calls Spoonacular if inventory
has not changed since last pre-fetch.
