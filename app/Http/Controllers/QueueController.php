<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Ticket;
use App\Models\Counter;
use Illuminate\Support\Facades\DB;

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

        return $categories[$catId] ?? ['prefix' => $catId, 'name' => 'General Inquiry'];
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

        $totalServed = Ticket::where('status', 'completed')->count();
        $totalSkipped = Ticket::where('status', 'skipped')->count();

        $avgWaitTime = DB::table('tickets')
            ->where('status', 'completed')
            ->whereNotNull('served_at')
            ->whereNotNull('created_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(SECOND, created_at, served_at)) as avg_time')
            ->value('avg_time') ?? 0;

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
            'lastTicketNumber' => Ticket::count(),
            'completedQueues' => $completedTickets,
            'statistics' => [
                'totalServed' => $totalServed,
                'totalSkipped' => $totalSkipped,
                'averageWaitTime' => round((float)$avgWaitTime, 2),
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

        return response()->json(['ticket' => $this->formatTicket($ticket)]);
    }

    public function next(Request $request): JsonResponse
    {
        $counterId = $request->input('counterId', 1);
        $counter = Counter::find($counterId) ?? Counter::first();

        // Complete any ticket currently being served at this counter
        Ticket::where('status', 'serving')
            ->where('counter_id', $counterId)
            ->update([
                'status' => 'completed',
                'completed_at' => now(),
            ]);

        $nextTicket = Ticket::where('status', 'pending')
            ->orderBy('id', 'asc')
            ->first();

        if (!$nextTicket) {
            return response()->json(['error' => 'No tickets in queue'], 400);
        }

        $nextTicket->update([
            'status' => 'serving',
            'counter_id' => $counter ? $counter->id : 1,
            'counter_name' => $counter ? $counter->name : 'Counter 1',
            'staff_name' => $counter ? $counter->staff : 'Officer',
            'served_at' => now(),
        ]);

        return response()->json(['currentQueue' => $this->formatTicket($nextTicket)]);
    }

    public function callBatch(Request $request): JsonResponse
    {
        $ticketIds = $request->input('ticketIds', []);
        $counterId = $request->input('counterId', 1);
        $counter = Counter::find($counterId) ?? Counter::first();

        if (empty($ticketIds)) {
            return response()->json(['error' => 'No tickets selected'], 400);
        }

        // Complete previous tickets for this counter
        Ticket::where('status', 'serving')
            ->where('counter_id', $counterId)
            ->update([
                'status' => 'completed',
                'completed_at' => now(),
            ]);

        // Mark selected tickets as serving for this counter
        Ticket::whereIn('id', $ticketIds)
            ->where('status', 'pending')
            ->update([
                'status' => 'serving',
                'counter_id' => $counter ? $counter->id : 1,
                'counter_name' => $counter ? $counter->name : 'Counter 1',
                'staff_name' => $counter ? $counter->staff : 'Officer',
                'served_at' => now(),
                'recalled_at' => now(),
            ]);

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
        $servingTicket = $query->latest('served_at')->first();

        if (!$servingTicket) {
            return response()->json(['error' => 'No current queue'], 400);
        }

        $servingTicket->update([
            'recalled_at' => now(),
        ]);

        return response()->json(['currentQueue' => $this->formatTicket($servingTicket)]);
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

        $avgWaitTime = DB::table('tickets')
            ->where('status', 'completed')
            ->whereNotNull('served_at')
            ->whereNotNull('created_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(SECOND, created_at, served_at)) as avg_time')
            ->value('avg_time') ?? 0;

        return response()->json([
            'totalServed' => $totalServed,
            'totalSkipped' => $totalSkipped,
            'averageWaitTime' => round((float)$avgWaitTime, 2),
        ]);
    }
}