# Test Transaction Samples (AED Currency)

40 real-world user messages for testing transaction extraction across different categories.

---

## Test Messages (Copy & Paste to Telegram Bot)

Spent 45 AED at McDonald's for lunch

Coffee at Starbucks 25 AED

Paid 180 dirhams at Zuma for dinner

Delivery from Talabat 67.50 AED

Careem Now order from Texas Chicken 89 dirhams

Grocery shopping at Carrefour 456 AED

Bought vegetables from Spinneys 234.75 AED

Lulu Hypermarket 623 dirhams

Choithrams milk and eggs 78 AED

Careem ride to Marina 38 AED

Uber from airport 125 dirhams

Dubai Metro ticket 15 AED

Filled petrol at ENOC 180 AED

Parking at Dubai Mall 25 dirhams

Nike shoes at Dubai Mall 450 AED

H&M summer clothes 289 dirhams

Zara jeans 199 AED

Sephora makeup 345.50 dirhams

Bought iPhone case from Sharaf DG 129 AED

Amazon order 567 dirhams

Doctor consultation at Mediclinic 350 AED

Pharmacy from Life Pharmacy 145 dirhams

Dental checkup 600 AED

VOX Cinema tickets 120 AED

Netflix subscription 29 AED

Ski Dubai pass 250 dirhams

Gym membership at Fitness First 350 AED

Massage at Talise Spa 450 dirhams

DEWA electricity bill 456 AED

Du internet bill 299 dirhams

Etisalat mobile bill 150 AED

Haircut at Toni & Guy 180 AED

Barbershop 60 AED

Car wash at Emarat 50 AED

Oil change at AutoPro 280 dirhams

Cheesecake at Jones the Grocer 48 AED

Ice cream at Baskin Robbins 28 AED

Drinks at Barasti 280 dirhams

Coworking space day pass 150 AED

Cleaning service 180 dirhams

---

## Quick Test

**Send any message above to your bot and verify:**
- ✅ Amount extracted correctly
- ✅ Currency is AED
- ✅ Merchant identified
- ✅ Category assigned properly

**Check database:**
```sql
SELECT merchant, amount, currency, category, transaction_date
FROM transactions
ORDER BY created_at DESC
LIMIT 10;
```
