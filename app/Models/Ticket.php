<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ticket extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_number',
        'category_id',
        'category_name',
        'status',
        'counter_id',
        'counter_name',
        'staff_name',
        'served_at',
        'recalled_at',
        'completed_at',
    ];

    protected $casts = [
        'served_at' => 'datetime',
        'recalled_at' => 'datetime',
        'completed_at' => 'datetime',
    ];
}
