import {
	getMe,
	loginEmail,
	loginMobileSendOtp,
	loginMobileVerify,
	register,
	registerVerifyPhone,
	sendOtp,
	smsStatus,
	updateMe,
	verifyOtp,
} from "./handlers/auth";
import { analytics, dailyOrders, orderReports, paymentReports } from "./handlers/admin";
import { calendarOrders } from "./handlers/calendar";
import { createCoupon, listCoupons, validateCoupon } from "./handlers/coupons";
import { todayDeliveries, trackOrder, updateTracking } from "./handlers/delivery";
import {
	createPlan,
	deletePlan,
	getPlan,
	listPlans,
	updatePlan,
} from "./handlers/plans";
import { createPayment, getPayment, verifyPayment } from "./handlers/payments";
import {
	createProduct,
	deleteProduct,
	getProduct,
	listProducts,
	updateProduct,
} from "./handlers/products";
import { createOrder, getOrder, skipOrder, userOrders } from "./handlers/orders";
import {
	activeSubscription,
	pauseSubscription,
	resumeSubscription,
	skipSubscriptionDate,
	subscribe,
} from "./handlers/subscription";
import { corsPreflight, json } from "./lib/http";

export async function handleApi(request: Request, env: Env): Promise<Response | null> {
	const url = new URL(request.url);
	const { pathname } = url;
	const method = request.method;

	if (method === "OPTIONS" && pathname.startsWith("/api/")) {
		return corsPreflight();
	}

	// Auth — Register
	if (pathname === "/api/auth/register" && method === "POST") return register(request, env);
	if (pathname === "/api/auth/register/verify-phone" && method === "POST") {
		return registerVerifyPhone(request, env);
	}

	// Auth — Login
	if (pathname === "/api/auth/login/mobile/send-otp" && method === "POST") {
		return loginMobileSendOtp(request, env);
	}
	if (pathname === "/api/auth/login/mobile/verify" && method === "POST") {
		return loginMobileVerify(request, env);
	}
	if (pathname === "/api/auth/login/email" && method === "POST") return loginEmail(request, env);

	// Legacy aliases
	if (pathname === "/api/auth/send-otp" && method === "POST") return sendOtp(request, env);
	if (pathname === "/api/auth/verify-otp" && method === "POST") return verifyOtp(request, env);

	if (pathname === "/api/auth/sms-status" && method === "GET") return smsStatus(request, env);
	if (pathname === "/api/auth/me" && method === "GET") return getMe(request, env);
	if (pathname === "/api/auth/me" && method === "PUT") return updateMe(request, env);

	// Products
	if (pathname === "/api/products" && method === "GET") return listProducts(env);
	if (pathname === "/api/products" && method === "POST") return createProduct(request, env);
	const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
	if (productMatch) {
		const id = Number(productMatch[1]);
		if (method === "GET") return getProduct(env, id);
		if (method === "PUT") return updateProduct(request, env, id);
		if (method === "DELETE") return deleteProduct(request, env, id);
	}

	// Plans
	if (pathname === "/api/plans" && method === "GET") return listPlans(env);
	if (pathname === "/api/plans" && method === "POST") return createPlan(request, env);
	const planMatch = pathname.match(/^\/api\/plans\/(\d+)$/);
	if (planMatch) {
		const id = Number(planMatch[1]);
		if (method === "GET") return getPlan(env, id);
		if (method === "PUT") return updatePlan(request, env, id);
		if (method === "DELETE") return deletePlan(request, env, id);
	}

	// Orders
	if (pathname === "/api/orders/create" && method === "POST") return createOrder(request, env);
	const userOrdersMatch = pathname.match(/^\/api\/orders\/user\/(\d+)$/);
	if (userOrdersMatch && method === "GET") {
		return userOrders(request, env, Number(userOrdersMatch[1]));
	}
	const orderMatch = pathname.match(/^\/api\/orders\/(\d+)$/);
	if (orderMatch) {
		const id = Number(orderMatch[1]);
		if (method === "GET") return getOrder(request, env, id);
	}
	const skipMatch = pathname.match(/^\/api\/orders\/(\d+)\/skip$/);
	if (skipMatch && method === "POST") return skipOrder(request, env, Number(skipMatch[1]));

	// Payments
	if (pathname === "/api/payment/create" && method === "POST") return createPayment(request, env);
	if (pathname === "/api/payment/verify" && method === "POST") return verifyPayment(request, env);
	const paymentMatch = pathname.match(/^\/api\/payment\/order\/(\d+)$/);
	if (paymentMatch && method === "GET") return getPayment(request, env, Number(paymentMatch[1]));

	// Calendar
	if (pathname === "/api/calendar/orders" && method === "GET") return calendarOrders(request, env);

	// Subscription
	if (pathname === "/api/subscription/subscribe" && method === "POST") return subscribe(request, env);
	if (pathname === "/api/subscription/active" && method === "GET") return activeSubscription(request, env);
	if (pathname === "/api/subscription/pause" && method === "POST") return pauseSubscription(request, env);
	if (pathname === "/api/subscription/resume" && method === "POST") return resumeSubscription(request, env);
	if (pathname === "/api/subscription/skip-date" && method === "POST") {
		return skipSubscriptionDate(request, env);
	}

	// Coupons
	if (pathname === "/api/coupons/validate" && method === "POST") return validateCoupon(request, env);
	if (pathname === "/api/coupons" && method === "GET") return listCoupons(env);
	if (pathname === "/api/coupons" && method === "POST") return createCoupon(request, env);

	// Delivery
	const trackMatch = pathname.match(/^\/api\/delivery\/track\/(\d+)$/);
	if (trackMatch) {
		const id = Number(trackMatch[1]);
		if (method === "GET") return trackOrder(request, env, id);
		if (method === "PUT") return updateTracking(request, env, id);
	}
	if (pathname === "/api/delivery/today" && method === "GET") return todayDeliveries(request, env);

	// Admin
	if (pathname === "/api/admin/analytics" && method === "GET") return analytics(request, env);
	if (pathname === "/api/admin/orders/daily" && method === "GET") return dailyOrders(request, env);
	if (pathname === "/api/admin/reports/payments" && method === "GET") {
		return paymentReports(request, env);
	}
	if (pathname === "/api/admin/reports/orders" && method === "GET") return orderReports(request, env);

	if (pathname.startsWith("/api/")) {
		return json({ error: "Not found", path: pathname, method }, 404);
	}

	return null;
}
