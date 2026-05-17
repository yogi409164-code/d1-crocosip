export function nextDeliveryDate(): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
}
