<script lang="ts">
	let {
		status,
		type
	}: {
		status: string;
		type: 'task' | 'engagement' | 'client' | 'priority';
	} = $props();

	// Complete class strings — never dynamically interpolated (TailwindCSS v4 requirement)
	const TASK_STATUS_COLORS: Record<string, string> = {
		TO_DO: 'text-gray-700 bg-gray-100 border-gray-200',
		IN_PROGRESS: 'text-blue-700 bg-blue-50 border-blue-200',
		AWAITING_CLIENT: 'text-amber-700 bg-amber-50 border-amber-200',
		UNDER_REVIEW: 'text-purple-700 bg-purple-50 border-purple-200',
		PARTNER_APPROVAL: 'text-indigo-700 bg-indigo-50 border-indigo-200',
		DONE: 'text-green-700 bg-green-50 border-green-200',
		CANCELLED: 'text-gray-500 bg-gray-50 border-gray-200'
	};

	const TASK_PRIORITY_COLORS: Record<string, string> = {
		LOW: 'text-gray-600 bg-gray-50 border-gray-200',
		MEDIUM: 'text-blue-600 bg-blue-50 border-blue-200',
		HIGH: 'text-orange-600 bg-orange-50 border-orange-200',
		URGENT: 'text-red-600 bg-red-50 border-red-200'
	};

	const ENGAGEMENT_STATUS_COLORS: Record<string, string> = {
		ACTIVE: 'text-green-700 bg-green-50 border-green-200',
		ON_HOLD: 'text-amber-700 bg-amber-50 border-amber-200',
		COMPLETED: 'text-blue-700 bg-blue-50 border-blue-200',
		CANCELLED: 'text-gray-500 bg-gray-50 border-gray-200'
	};

	const CLIENT_STATUS_COLORS: Record<string, string> = {
		ACTIVE: 'text-green-700 bg-green-50 border-green-200',
		INACTIVE: 'text-gray-500 bg-gray-50 border-gray-200',
		PROSPECT: 'text-purple-700 bg-purple-50 border-purple-200'
	};

	const COLOR_MAPS: Record<string, Record<string, string>> = {
		task: TASK_STATUS_COLORS,
		priority: TASK_PRIORITY_COLORS,
		engagement: ENGAGEMENT_STATUS_COLORS,
		client: CLIENT_STATUS_COLORS
	};

	const FALLBACK_COLORS = 'text-gray-600 bg-gray-50 border-gray-200';

	let colorClasses = $derived(COLOR_MAPS[type]?.[status] ?? FALLBACK_COLORS);

	let displayText = $derived(
		status
			.replace(/_/g, ' ')
			.toLowerCase()
			.replace(/\b\w/g, (c: string) => c.toUpperCase())
	);
</script>

<span
	class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {colorClasses}"
>
	{displayText}
</span>
