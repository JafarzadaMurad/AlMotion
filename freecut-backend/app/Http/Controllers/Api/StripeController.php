<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Stripe;
use Stripe\StripeClient;
use Stripe\Webhook;
use Stripe\Exception\SignatureVerificationException;

class StripeController extends Controller
{
    private function client(): StripeClient
    {
        $secret = config('services.stripe.secret');
        if (empty($secret)) {
            abort(500, 'Stripe is not configured (missing STRIPE_SECRET).');
        }
        Stripe::setApiKey($secret);
        return new StripeClient($secret);
    }

    private function frontendUrl(): string
    {
        return rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5273')), '/');
    }

    /**
     * Create a Stripe Checkout session for the given plan and return its hosted URL.
     * Front-end redirects the browser to this URL.
     */
    public function createCheckout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan_id' => 'required|integer|exists:plans,id',
        ]);

        $user = $request->user();
        $plan = Plan::find($validated['plan_id']);

        if (empty($plan->stripe_price_id)) {
            return response()->json([
                'message' => "Plan '{$plan->name}' has no Stripe price configured.",
            ], 422);
        }

        $stripe = $this->client();

        // Reuse customer if we already have one — keeps a single billing history per user.
        if (empty($user->stripe_customer_id)) {
            $customer = $stripe->customers->create([
                'email' => $user->email,
                'name' => $user->name,
                'metadata' => ['user_id' => (string) $user->id],
            ]);
            $user->stripe_customer_id = $customer->id;
            $user->save();
        }

        $session = $stripe->checkout->sessions->create([
            'mode' => 'subscription',
            'customer' => $user->stripe_customer_id,
            'line_items' => [[
                'price' => $plan->stripe_price_id,
                'quantity' => 1,
            ]],
            'success_url' => $this->frontendUrl() . '/billing?session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => $this->frontendUrl() . '/billing?canceled=1',
            'allow_promotion_codes' => true,
            'metadata' => [
                'user_id' => (string) $user->id,
                'plan_id' => (string) $plan->id,
            ],
        ]);

        return response()->json(['url' => $session->url]);
    }

    /**
     * Create a Stripe Customer Portal session so the user can manage their
     * subscription (cancel, update payment method, view invoices).
     */
    public function createPortal(Request $request): JsonResponse
    {
        $user = $request->user();
        if (empty($user->stripe_customer_id)) {
            return response()->json(['message' => 'No active billing customer.'], 422);
        }

        $stripe = $this->client();
        $portal = $stripe->billingPortal->sessions->create([
            'customer' => $user->stripe_customer_id,
            'return_url' => $this->frontendUrl() . '/billing',
        ]);

        return response()->json(['url' => $portal->url]);
    }

    /**
     * Called by the frontend after Stripe Checkout redirects to /billing/success.
     * Pulls the session + subscription from Stripe and updates the user's plan
     * locally — no webhooks needed for the happy path.
     */
    public function syncSubscription(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'session_id' => 'required|string',
        ]);

        $user = $request->user();
        $stripe = $this->client();

        $session = $stripe->checkout->sessions->retrieve($validated['session_id'], [
            'expand' => ['subscription'],
        ]);

        // Defense in depth — make sure the session actually belongs to this user.
        if (($session->metadata['user_id'] ?? null) !== (string) $user->id
            && $session->customer !== $user->stripe_customer_id) {
            return response()->json(['message' => 'Session does not belong to this user.'], 403);
        }

        $this->applySubscriptionToUser($user, $session->subscription);

        $user->load('plan');
        return response()->json(['user' => $user]);
    }

    /**
     * Webhook endpoint. Optional for dev (no signature verification when
     * STRIPE_WEBHOOK_SECRET is empty), required for production. Handles the few
     * events that actually mutate subscription state.
     */
    public function webhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $webhookSecret = config('services.stripe.webhook_secret');

        try {
            $event = $webhookSecret
                ? Webhook::constructEvent($payload, $sigHeader ?? '', $webhookSecret)
                : json_decode($payload, false);
        } catch (SignatureVerificationException $e) {
            Log::warning('Stripe webhook signature invalid', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Invalid signature'], 400);
        }

        $type = $event->type ?? null;
        $object = $event->data->object ?? null;

        if (!$type || !$object) {
            return response()->json(['message' => 'Malformed event'], 400);
        }

        switch ($type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                $user = \App\Models\User::where('stripe_customer_id', $object->customer ?? null)->first();
                if ($user) {
                    $this->applySubscriptionToUser($user, $object);
                }
                break;
            case 'checkout.session.completed':
                // Most state updates ride on customer.subscription.* events; this is a safety net.
                $stripe = $this->client();
                $session = $stripe->checkout->sessions->retrieve($object->id, ['expand' => ['subscription']]);
                $user = \App\Models\User::where('stripe_customer_id', $session->customer)->first();
                if ($user && $session->subscription) {
                    $this->applySubscriptionToUser($user, $session->subscription);
                }
                break;
        }

        return response()->json(['received' => true]);
    }

    /**
     * Map a Stripe Subscription object onto our local User row. Looks up the
     * matching Plan by stripe_price_id; if no Plan exists for that price, the
     * user keeps their previous plan_id but subscription_status still flips.
     */
    private function applySubscriptionToUser(\App\Models\User $user, $subscription): void
    {
        if (!$subscription) {
            return;
        }

        $priceId = $subscription->items->data[0]->price->id ?? null;
        $status = $subscription->status ?? null;
        $endsAt = isset($subscription->current_period_end)
            ? \Carbon\Carbon::createFromTimestamp($subscription->current_period_end)
            : null;

        $user->stripe_subscription_id = $subscription->id;
        $user->subscription_status = $status;
        $user->subscription_ends_at = $endsAt;

        if (in_array($status, ['active', 'trialing'])) {
            $plan = $priceId ? Plan::where('stripe_price_id', $priceId)->first() : null;
            if ($plan) {
                $user->plan_id = $plan->id;
            }
        } elseif (in_array($status, ['canceled', 'incomplete_expired', 'unpaid'])) {
            // Drop back to default (Free) plan when subscription is gone.
            $default = Plan::where('is_default', true)->first();
            if ($default) {
                $user->plan_id = $default->id;
            }
        }

        $user->save();
    }
}
