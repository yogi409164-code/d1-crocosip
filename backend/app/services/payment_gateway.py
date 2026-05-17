from app.config import settings


def create_razorpay_order(amount_paise: int, receipt: str) -> dict:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        return {
            "gateway": "razorpay",
            "order_id": f"mock_order_{receipt}",
            "amount": amount_paise,
            "currency": "INR",
            "key_id": "mock_key",
            "mock": True,
        }
    import razorpay

    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    order = client.order.create({"amount": amount_paise, "currency": "INR", "receipt": receipt})
    return {
        "gateway": "razorpay",
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": settings.razorpay_key_id,
        "mock": False,
    }


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    if not settings.razorpay_key_secret:
        return True
    import razorpay

    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    try:
        client.utility.verify_payment_signature(
            {"razorpay_order_id": order_id, "razorpay_payment_id": payment_id, "razorpay_signature": signature}
        )
        return True
    except razorpay.errors.SignatureVerificationError:
        return False
