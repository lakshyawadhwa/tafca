/**
 * Svelte action for click-outside detection.
 * Usage: <div use:clickOutside={handleClose}>...</div>
 */
export function clickOutside(node: HTMLElement, callback: () => void) {
	let handler: (event: MouseEvent) => void;

	// Small delay to avoid catching the click that opened the element
	const timeout = setTimeout(() => {
		handler = (event: MouseEvent) => {
			if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
				callback();
			}
		};
		document.addEventListener('click', handler, true);
	}, 10);

	return {
		destroy() {
			clearTimeout(timeout);
			if (handler) {
				document.removeEventListener('click', handler, true);
			}
		}
	};
}
