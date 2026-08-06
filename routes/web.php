<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\QueueController;

Route::prefix('api')->group(function () {
    Route::get('/queue', [QueueController::class, 'index']);
    Route::post('/queue/generate', [QueueController::class, 'generate']);
    Route::post('/queue/next', [QueueController::class, 'next']);
    Route::post('/queue/call-batch', [QueueController::class, 'callBatch']);
    Route::post('/queue/recall', [QueueController::class, 'recall']);
    Route::post('/queue/skip', [QueueController::class, 'skip']);
    Route::post('/queue/complete', [QueueController::class, 'complete']);
    Route::post('/queue/reset', [QueueController::class, 'reset']);
    Route::post('/counters', [QueueController::class, 'storeCounter']);
    Route::put('/counters/{id}', [QueueController::class, 'updateCounter']);
    Route::delete('/counters/{id}', [QueueController::class, 'deleteCounter']);
    Route::get('/statistics', [QueueController::class, 'statistics']);
});

// SPA fallback route for React Router (handles /, /display, /admin, etc.)
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api).*$');

