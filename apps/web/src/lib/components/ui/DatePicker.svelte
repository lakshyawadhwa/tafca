<script lang="ts">
	import { Calendar, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { clickOutside } from '$lib/actions/clickOutside';

	let {
		value = null,
		onChange,
		min = null,
		max = null,
		placeholder = 'Select date',
		disabled = false
	}: {
		value?: string | null;
		onChange: (date: string) => void;
		min?: string | null;
		max?: string | null;
		placeholder?: string;
		disabled?: boolean;
	} = $props();

	let isOpen = $state(false);
	let viewYear = $state(new Date().getFullYear());
	let viewMonth = $state(new Date().getMonth()); // 0-indexed

	// Initialize view to selected date or current month
	$effect(() => {
		if (value) {
			const d = new Date(value + 'T00:00:00');
			viewYear = d.getFullYear();
			viewMonth = d.getMonth();
		}
	});

	const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

	let monthLabel = $derived(
		new Date(viewYear, viewMonth).toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric'
		})
	);

	let displayValue = $derived.by(() => {
		if (!value) return '';
		const d = new Date(value + 'T00:00:00');
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	});

	// Today in YYYY-MM-DD format
	let todayStr = $derived.by(() => {
		const now = new Date();
		return formatDate(now.getFullYear(), now.getMonth(), now.getDate());
	});

	// Calendar grid: 6 rows x 7 cols of day objects
	type DayCell = {
		date: number;
		month: number;
		year: number;
		isCurrentMonth: boolean;
		isToday: boolean;
		isSelected: boolean;
		isDisabled: boolean;
		dateStr: string;
	};

	let calendarDays = $derived.by((): DayCell[][] => {
		const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

		const cells: DayCell[] = [];

		// Previous month days
		for (let i = firstDay - 1; i >= 0; i--) {
			const day = daysInPrevMonth - i;
			const month = viewMonth - 1;
			const year = month < 0 ? viewYear - 1 : viewYear;
			const actualMonth = month < 0 ? 11 : month;
			const dateStr = formatDate(year, actualMonth, day);
			cells.push({
				date: day,
				month: actualMonth,
				year,
				isCurrentMonth: false,
				isToday: dateStr === todayStr,
				isSelected: dateStr === value,
				isDisabled: isDateDisabled(dateStr),
				dateStr
			});
		}

		// Current month days
		for (let day = 1; day <= daysInMonth; day++) {
			const dateStr = formatDate(viewYear, viewMonth, day);
			cells.push({
				date: day,
				month: viewMonth,
				year: viewYear,
				isCurrentMonth: true,
				isToday: dateStr === todayStr,
				isSelected: dateStr === value,
				isDisabled: isDateDisabled(dateStr),
				dateStr
			});
		}

		// Next month days to fill grid (6 rows)
		const remaining = 42 - cells.length;
		for (let day = 1; day <= remaining; day++) {
			const month = viewMonth + 1;
			const year = month > 11 ? viewYear + 1 : viewYear;
			const actualMonth = month > 11 ? 0 : month;
			const dateStr = formatDate(year, actualMonth, day);
			cells.push({
				date: day,
				month: actualMonth,
				year,
				isCurrentMonth: false,
				isToday: dateStr === todayStr,
				isSelected: dateStr === value,
				isDisabled: isDateDisabled(dateStr),
				dateStr
			});
		}

		// Chunk into weeks (rows of 7)
		const rows: DayCell[][] = [];
		for (let i = 0; i < cells.length; i += 7) {
			rows.push(cells.slice(i, i + 7));
		}
		return rows;
	});

	function formatDate(year: number, month: number, day: number): string {
		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	function isDateDisabled(dateStr: string): boolean {
		if (min && dateStr < min) return true;
		if (max && dateStr > max) return true;
		return false;
	}

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear--;
		} else {
			viewMonth--;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear++;
		} else {
			viewMonth++;
		}
	}

	function selectDate(day: DayCell) {
		if (day.isDisabled) return;
		onChange(day.dateStr);
		isOpen = false;
	}

	function toggleOpen() {
		if (!disabled) {
			isOpen = !isOpen;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			isOpen = false;
		}
	}

	// Day cell styling — complete class strings for TailwindCSS v4
	const DAY_BASE = 'flex h-9 w-9 items-center justify-center rounded-md text-sm';
	const DAY_CURRENT = 'text-gray-900 hover:bg-gray-100 cursor-pointer';
	const DAY_OTHER = 'text-gray-300';
	const DAY_TODAY = 'font-semibold border border-blue-200';
	const DAY_SELECTED = 'bg-blue-600 text-white hover:bg-blue-700';
	const DAY_DISABLED = 'text-gray-300 cursor-not-allowed';
</script>

<div class="relative" use:clickOutside={() => (isOpen = false)}>
	<!-- Trigger button -->
	<button
		type="button"
		{disabled}
		onclick={toggleOpen}
		onkeydown={handleKeydown}
		class="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm
			{disabled ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'text-gray-900 hover:border-gray-300'}
			focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
	>
		<span class={value ? 'text-gray-900' : 'text-gray-400'}>
			{displayValue || placeholder}
		</span>
		<Calendar size={16} class="text-gray-400" />
	</button>

	<!-- Popup calendar -->
	{#if isOpen}
		<div
			class="absolute left-0 z-20 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
			onkeydown={handleKeydown}
			role="dialog"
			aria-label="Date picker"
		>
			<!-- Calendar header -->
			<div class="mb-3 flex items-center justify-between">
				<button
					type="button"
					onclick={prevMonth}
					class="rounded-md p-1 text-gray-500 hover:bg-gray-100"
					aria-label="Previous month"
				>
					<ChevronLeft size={16} />
				</button>
				<span class="text-sm font-semibold text-gray-900">{monthLabel}</span>
				<button
					type="button"
					onclick={nextMonth}
					class="rounded-md p-1 text-gray-500 hover:bg-gray-100"
					aria-label="Next month"
				>
					<ChevronRight size={16} />
				</button>
			</div>

			<!-- Day headers -->
			<div class="mb-1 grid grid-cols-7 text-center">
				{#each DAY_HEADERS as header}
					<div class="py-1 text-xs font-medium text-gray-500">{header}</div>
				{/each}
			</div>

			<!-- Day grid -->
			{#each calendarDays as week}
				<div class="grid grid-cols-7 text-center">
					{#each week as day}
						<button
							type="button"
							disabled={day.isDisabled}
							onclick={() => selectDate(day)}
							class="{DAY_BASE}
								{day.isSelected ? DAY_SELECTED : day.isDisabled ? DAY_DISABLED : day.isCurrentMonth ? DAY_CURRENT : DAY_OTHER}
								{day.isToday && !day.isSelected ? DAY_TODAY : ''}"
						>
							{day.date}
						</button>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>
