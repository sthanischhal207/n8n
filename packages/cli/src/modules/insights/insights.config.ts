import { Config, Env } from '@n8n/config';

@Config
export class InsightsConfig {
	/**
	 * The interval in minutes at which the insights data should be compacted.
	 * Default: 60
	 */
	@Env('N8N_INSIGHTS_COMPACTION_INTERVAL_MINUTES')
	compactionIntervalMinutes: number = 60;

	/**
	 * The number of raw insights data to compact in a single batch.
	 * Default: 500
	 */
	@Env('N8N_INSIGHTS_COMPACTION_BATCH_SIZE')
	compactionBatchSize: number = 500;

	/**
	 * The maximum age in days for all insights data before pruning.
	 * Default: -1 (no pruning)
	 */
	@Env('N8N_INSIGHTS_MAX_AGE_DAYS')
	maxAgeDays: number = -1;

	/**
	 * The interval in hours at which the insights data should be checked for pruning.
	 * Default: 24
	 */
	@Env('N8N_INSIGHTS_PRUNE_CHECK_INTERVAL_HOURS')
	pruneCheckIntervalHours: number = 24;
}
