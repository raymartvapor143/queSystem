<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number');
            $table->string('category_id')->default('GEN');
            $table->string('category_name')->default('General Procurement Inquiry');
            $table->enum('status', ['pending', 'serving', 'completed', 'skipped'])->default('pending');
            $table->unsignedBigInteger('counter_id')->nullable();
            $table->string('counter_name')->nullable();
            $table->string('staff_name')->nullable();
            $table->timestamp('served_at')->nullable();
            $table->timestamp('recalled_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
