<?php

namespace App\Services\Billing;

use App\Models\CreditPurchase;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Every movement of a credit balance goes through here.
 *
 * Balances are adjusted with atomic SQL rather than read-modify-write: two
 * chat turns finishing at once would otherwise both read the same balance and
 * the second would overwrite the first's deduction, quietly handing out free
 * credits under exactly the load where it matters.
 */
class CreditLedger
{
    /**
     * Take credits for work already done.
     *
     * Deliberately allows the balance to go negative. The alternative is
     * discarding a completion the user has already waited for because it cost
     * slightly more than was left — charging it and letting the next request
     * be refused is the honest outcome.
     */
    public function charge(User $user, int $credits): void
    {
        if ($credits <= 0) {
            return;
        }

        DB::table('users')->where('id', $user->id)->update([
            'credit_balance' => DB::raw('credit_balance - ' . (int) $credits),
            'credits_used_this_month' => DB::raw('credits_used_this_month + ' . (int) $credits),
        ]);

        $user->refresh();
    }

    /** Add credits and record where they came from. */
    public function grant(
        User $user,
        int $credits,
        string $source = 'purchase',
        float $amountUsd = 0,
        ?string $reference = null,
        ?string $note = null,
    ): CreditPurchase {
        return DB::transaction(function () use ($user, $credits, $source, $amountUsd, $reference, $note) {
            DB::table('users')->where('id', $user->id)->update([
                'credit_balance' => DB::raw('credit_balance + ' . (int) $credits),
            ]);

            $user->refresh();

            return CreditPurchase::create([
                'user_id' => $user->id,
                'credits' => $credits,
                'amount_usd' => $amountUsd,
                'source' => $source,
                'reference' => $reference,
                'note' => $note,
            ]);
        });
    }

    /**
     * Hand out the plan's monthly allowance if it is due.
     *
     * Grants are topped up rather than reset to the plan amount: credits a
     * user paid for must survive the monthly grant, and a reset would delete
     * them on the first of the month.
     */
    public function grantMonthlyIfDue(User $user): void
    {
        $monthly = (int) ($user->plan->monthly_credits ?? 0);
        if ($monthly <= 0) {
            return;
        }

        $grantedAt = $user->credits_granted_at;
        if ($grantedAt && $grantedAt->diffInDays(now()) < 30) {
            return;
        }

        $this->grant($user, $monthly, 'plan_grant', 0, null, 'Monthly allowance for ' . ($user->plan->name ?? 'plan'));

        DB::table('users')->where('id', $user->id)->update([
            'credits_granted_at' => now(),
            'credits_used_this_month' => 0,
        ]);
        $user->refresh();
    }

    /** True when the user has nothing left to spend. */
    public function isExhausted(User $user): bool
    {
        return (int) $user->credit_balance <= 0;
    }
}
