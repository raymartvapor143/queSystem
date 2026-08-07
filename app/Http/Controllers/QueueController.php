<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Ticket;
use App\Models\Counter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class QueueController extends Controller
{
    private function formatTicket(Ticket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'number' => $ticket->ticket_number,
            'category' => $ticket->category_name,
            'categoryId' => $ticket->category_id,
            'status' => $ticket->status,
            'counterId' => $ticket->counter_id,
            'counterName' => $ticket->counter_name,
            'staffName' => $ticket->staff_name,
            'createdAt' => $ticket->created_at ? $ticket->created_at->toISOString() : null,
            'servedAt' => $ticket->served_at ? $ticket->served_at->toISOString() : null,
            'recalledAt' => $ticket->recalled_at ? $ticket->recalled_at->toISOString() : null,
            'completedAt' => $ticket->completed_at ? $ticket->completed_at->toISOString() : null,
        ];
    }

    private function getCategoryDetails(string $catId): array
    {
        $categories = [
            'CON' => ['prefix' => 'CON', 'name' => 'Contracting Division'],
            'PR'  => ['prefix' => 'PR',  'name' => 'PR Division'],
            'TEC' => ['prefix' => 'TEC', 'name' => 'Technical Division'],
            'ADM' => ['prefix' => 'ADM', 'name' => 'Admin Division'],
        ];

        if (isset($categories[$catId])) {
            return $categories[$catId];
        }

        if (str_starts_with($catId, 'CTR-')) {
            $counterId = (int) str_replace('CTR-', '', $catId);
            $counter = Counter::find($counterId);
            if ($counter) {
                $cleanName = preg_replace('/[^A-Za-z0-9]/', '', $counter->name) ?: 'CTR';
                $prefix = strtoupper(substr($cleanName, 0, 3));
                return ['prefix' => $prefix, 'name' => $counter->name];
            }
        }

        $counter = Counter::find($catId);
        if ($counter) {
            $cleanName = preg_replace('/[^A-Za-z0-9]/', '', $counter->name) ?: 'CTR';
            $prefix = strtoupper(substr($cleanName, 0, 3));
            return ['prefix' => $prefix, 'name' => $counter->name];
        }

        return ['prefix' => strtoupper(substr($catId, 0, 3)), 'name' => $catId];
    }

    public function index(): JsonResponse
    {
        $pendingTickets = Ticket::where('status', 'pending')
            ->orderBy('id', 'asc')
            ->get()
            ->map(fn($t) => $this->formatTicket($t));

        $servingTickets = Ticket::where('status', 'serving')
            ->orderBy('served_at', 'desc')
            ->get()
            ->map(fn($t) => $this->formatTicket($t));

        $servingTicket = $servingTickets->first();

        $counters = Counter::orderBy('id', 'asc')->get();
        if ($counters->isEmpty()) {
            Counter::create(['name' => 'Contracting Division Counter', 'staff' => 'Contracting Officer']);
            Counter::create(['name' => 'PR Division Counter', 'staff' => 'PR Officer']);
            Counter::create(['name' => 'Technical Division Counter', 'staff' => 'Technical Inspector']);
            Counter::create(['name' => 'Admin Division Counter', 'staff' => 'Admin Officer']);
            $counters = Counter::orderBy('id', 'asc')->get();
        }

        $completedTickets = Ticket::whereIn('status', ['completed', 'skipped'])
            ->orderBy('id', 'desc')
            ->take(20)
            ->get()
            ->map(fn($t) => $this->formatTicket($t));

        // Short term 2-second cache for heavy count queries under multi-user polling
        $stats = Cache::remember('queue_stats_counts', 2, function () {
            return [
                'totalServed' => Ticket::where('status', 'completed')->count(),
                'totalSkipped' => Ticket::where('status', 'skipped')->count(),
                'lastTicketNumber' => Ticket::count(),
            ];
        });

        $avgWaitTime = $this->getAverageWaitTime();

        $data = [
            'queue' => $pendingTickets,
            'currentQueue' => $servingTicket,
            'servingQueues' => $servingTickets,
            'counters' => $counters->map(fn($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'staff' => $c->staff,
            ]),
            'activeCounter' => 1,
            'lastTicketNumber' => $stats['lastTicketNumber'],
            'completedQueues' => $completedTickets,
            'statistics' => [
                'totalServed' => $stats['totalServed'],
                'totalSkipped' => $stats['totalSkipped'],
                'averageWaitTime' => $avgWaitTime,
            ],
        ];

        return response()->json($data);
    }

    public function generate(Request $request): JsonResponse
    {
        $catId = $request->input('categoryId', 'GEN');
        $catInfo = $this->getCategoryDetails($catId);

        $lastId = Ticket::max('id') ?? 0;
        $nextNum = $lastId + 1;
        $ticketNumber = sprintf('%s-%03d', $catInfo['prefix'], $nextNum);

        $ticket = Ticket::create([
            'ticket_number' => $ticketNumber,
            'category_id' => $catId,
            'category_name' => $catInfo['name'],
            'status' => 'pending',
        ]);

        Cache::forget('queue_stats_counts');

        return response()->json(['ticket' => $this->formatTicket($ticket)]);
    }

    private function getAverageWaitTime(): float
    {
        return Cache::remember('queue_avg_wait_time', 5, function () {
            try {
                $driver = DB::connection()->getDriverName();
                if ($driver === 'sqlite') {
                    $avg = DB::table('tickets')
                        ->where('status', 'completed')
                        ->whereNotNull('served_at')
                        ->whereNotNull('created_at')
                        ->selectRaw('AVG(strftime("%s", served_at) - strftime("%s", created_at)) as avg_time')
                        ->value('avg_time');
                } else {
                    $avg = DB::table('tickets')
                        ->where('status', 'completed')
                        ->whereNotNull('served_at')
                        ->whereNotNull('created_at')
                        ->selectRaw('AVG(TIMESTAMPDIFF(SECOND, created_at, served_at)) as avg_time')
                        ->value('avg_time');
                }
                return round((float)($avg ?? 0), 2);
            } catch (\Throwable $e) {
                return 0.0;
            }
        });
    }

    private function getCounterForCategory(?string $catId, ?int $requestedCounterId = null): Counter
    {
        if ($requestedCounterId) {
            $counter = Counter::find($requestedCounterId);
            if ($counter) return $counter;
        }

        if ($catId) {
            // 1. Check if catId starts with CTR- (e.g., CTR-5)
            if (str_starts_with($catId, 'CTR-')) {
                $cId = (int) str_replace('CTR-', '', $catId);
                $counter = Counter::find($cId);
                if ($counter) return $counter;
            }

            // 2. Check if catId is a numeric counter ID
            if (is_numeric($catId)) {
                $counter = Counter::find((int) $catId);
                if ($counter) return $counter;
            }

            // 3. Standard category code mapping
            $map = [
                'CON' => 'Contracting',
                'PR'  => 'PR',
                'TEC' => 'Technical',
                'ADM' => 'Admin',
            ];
            $keyword = $map[$catId] ?? $catId;

            // Search by name or staff officer
            $counter = Counter::where('name', 'LIKE', "%{$keyword}%")
                ->orWhere('staff', 'LIKE', "%{$keyword}%")
                ->first();
            if ($counter) {
                return $counter;
            }
        }

        return Counter::first() ?? Counter::create(['name' => 'General Counter', 'staff' => 'Officer']);
    }

    public function next(Request $request): JsonResponse
    {
        $requestedCounterId = $request->input('counterId');
        $counter = null;
        if ($requestedCounterId) {
            $counter = Counter::find($requestedCounterId);
        }

        $nextTicket = null;
        if ($counter) {
            $ctrCode = "CTR-{$counter->id}";
            // Prioritize finding pending tickets created for this specific division counter
            $nextTicket = Ticket::where('status', 'pending')
                ->where(function ($q) use ($counter, $ctrCode) {
                    $q->where('category_id', $ctrCode)
                      ->orWhere('category_id', (string) $counter->id)
                      ->orWhere('counter_id', $counter->id)
                      ->orWhere('category_name', 'LIKE', "%{$counter->name}%");
                })
                ->orderBy('id', 'asc')
                ->first();
        }

        // Fallback to oldest pending ticket overall
        if (!$nextTicket) {
            $nextTicket = Ticket::where('status', 'pending')
                ->orderBy('id', 'asc')
                ->first();
        }

        if (!$nextTicket) {
            return response()->json(['error' => 'No tickets in queue'], 400);
        }

        // Automatic counter selection based on ticket category if counter wasn't requested
        if (!$counter) {
            $counter = $this->getCounterForCategory($nextTicket->category_id, $requestedCounterId);
        }

        // Complete any ticket currently being served at this specific counter
        Ticket::where('status', 'serving')
            ->where('counter_id', $counter->id)
            ->update([
                'status' => 'completed',
                'completed_at' => now(),
            ]);

        $now = now();
        $nextTicket->update([
            'status' => 'serving',
            'counter_id' => $counter->id,
            'counter_name' => $counter->name,
            'staff_name' => $counter->staff,
            'served_at' => $now,
            'recalled_at' => $now,
        ]);

        return response()->json(['currentQueue' => $this->formatTicket($nextTicket)]);
    }

    public function callBatch(Request $request): JsonResponse
    {
        $ticketIds = $request->input('ticketIds', []);
        $requestedCounterId = $request->input('counterId');

        if (empty($ticketIds)) {
            return response()->json(['error' => 'No tickets selected'], 400);
        }

        $tickets = Ticket::whereIn('id', $ticketIds)
            ->where('status', 'pending')
            ->get();

        if ($tickets->isEmpty()) {
            return response()->json(['error' => 'Selected tickets are no longer pending'], 400);
        }

        $now = now();
        $counterMap = [];

        // 1. Resolve counter for each ticket and collect unique counters to clear
        foreach ($tickets as $ticket) {
            $counter = $this->getCounterForCategory($ticket->category_id, $requestedCounterId);
            $counterMap[$ticket->id] = $counter;
        }

        // Extract unique counter IDs that need previous serving tickets cleared
        $uniqueCounterIds = array_unique(array_map(fn($c) => $c->id, array_values($counterMap)));

        // 2. Complete previous tickets for affected counters ONCE
        Ticket::where('status', 'serving')
            ->whereIn('counter_id', $uniqueCounterIds)
            ->update([
                'status' => 'completed',
                'completed_at' => $now,
            ]);

        // 3. Mark ALL selected tickets in batch as serving
        foreach ($tickets as $ticket) {
            $counter = $counterMap[$ticket->id];

            $ticket->update([
                'status' => 'serving',
                'counter_id' => $counter->id,
                'counter_name' => $counter->name,
                'staff_name' => $counter->staff,
                'served_at' => $now,
                'recalled_at' => $now,
            ]);
        }

        $servingTickets = Ticket::whereIn('id', $ticketIds)
            ->get()
            ->map(fn($t) => $this->formatTicket($t));

        return response()->json([
            'servingTickets' => $servingTickets,
            'currentQueue' => $servingTickets->first(),
        ]);
    }

    public function recall(Request $request): JsonResponse
    {
        $counterId = $request->input('counterId');

        $query = Ticket::where('status', 'serving');
        if ($counterId) {
            $query->where('counter_id', $counterId);
        }
        $servingTickets = $query->get();

        if ($servingTickets->isEmpty()) {
            return response()->json(['error' => 'No current queue'], 400);
        }

        $now = now();
        foreach ($servingTickets as $t) {
            $t->update([
                'recalled_at' => $now,
            ]);
        }

        return response()->json([
            'currentQueue' => $this->formatTicket($servingTickets->first()),
            'servingTickets' => $servingTickets->map(fn($t) => $this->formatTicket($t)),
        ]);
    }

    public function skip(Request $request): JsonResponse
    {
        $nextTicket = Ticket::where('status', 'pending')
            ->orderBy('id', 'asc')
            ->first();

        if (!$nextTicket) {
            return response()->json(['error' => 'No tickets in queue'], 400);
        }

        $nextTicket->update([
            'status' => 'skipped',
        ]);

        return response()->json(['skippedTicket' => $this->formatTicket($nextTicket)]);
    }

    public function complete(Request $request): JsonResponse
    {
        $counterId = $request->input('counterId');

        $query = Ticket::where('status', 'serving');
        if ($counterId) {
            $query->where('counter_id', $counterId);
        }

        $servingCount = (clone $query)->count();
        if ($servingCount === 0) {
            return response()->json(['error' => 'No active tickets serving for this counter'], 400);
        }

        $query->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        return response()->json(['message' => 'Completed all active serving tickets for counter']);
    }

    public function reset(Request $request): JsonResponse
    {
        Ticket::query()->delete();
        try {
            DB::statement('ALTER TABLE tickets AUTO_INCREMENT = 1');
        } catch (\Throwable $e) {
            // Ignore if driver doesn't support alter table auto increment
        }

        return response()->json(['message' => 'Queue reset successfully']);
    }

    public function storeCounter(Request $request): JsonResponse
    {
        $name = $request->input('name', 'New Counter Station');
        $staff = $request->input('staff', 'Duty Officer');

        Counter::create([
            'name' => $name,
            'staff' => $staff,
        ]);

        $counters = Counter::orderBy('id', 'asc')->get();

        return response()->json(['counters' => $counters]);
    }

    public function updateCounter(Request $request, $id): JsonResponse
    {
        $counter = Counter::find($id);
        if ($counter) {
            $data = [];
            if ($request->has('name')) {
                $data['name'] = $request->input('name');
            }
            if ($request->has('staffName') || $request->has('staff')) {
                $data['staff'] = $request->input('staffName') ?? $request->input('staff');
            }
            if (!empty($data)) {
                $counter->update($data);
            }
        }

        $counters = Counter::orderBy('id', 'asc')->get();

        return response()->json(['counters' => $counters]);
    }

    public function deleteCounter($id): JsonResponse
    {
        Counter::destroy($id);

        $counters = Counter::orderBy('id', 'asc')->get();

        return response()->json(['counters' => $counters]);
    }

    public function statistics(): JsonResponse
    {
        $totalServed = Ticket::where('status', 'completed')->count();
        $totalSkipped = Ticket::where('status', 'skipped')->count();
        $avgWaitTime = $this->getAverageWaitTime();

        return response()->json([
            'totalServed' => $totalServed,
            'totalSkipped' => $totalSkipped,
            'averageWaitTime' => $avgWaitTime,
        ]);
    }
}