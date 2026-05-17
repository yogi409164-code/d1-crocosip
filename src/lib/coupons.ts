export async function calculateDiscount(
	env: Env,
	code: string,
	orderAmount: number,
): Promise<{ valid: boolean; discount: number; message: string }> {
	const coupon = await env.DB.prepare<{
		discount_percent: number | null;
		discount_amount: number | null;
		min_order_amount: number;
		max_uses: number | null;
		used_count: number;
		is_active: number;
	}>("SELECT * FROM coupons WHERE code = ? AND is_active = 1")
		.bind(code)
		.first();

	if (!coupon) {
		return { valid: false, discount: 0, message: "Invalid coupon code" };
	}
	if (orderAmount < Number(coupon.min_order_amount)) {
		return { valid: false, discount: 0, message: `Minimum order amount is ${coupon.min_order_amount}` };
	}
	if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
		return { valid: false, discount: 0, message: "Coupon usage limit reached" };
	}

	let discount = 0;
	if (coupon.discount_percent) {
		discount = (orderAmount * Number(coupon.discount_percent)) / 100;
	} else if (coupon.discount_amount) {
		discount = Number(coupon.discount_amount);
	}
	discount = Math.min(discount, orderAmount);
	return { valid: true, discount, message: "Coupon applied" };
}
