<?php

namespace Database\Seeders;

use App\Models\Counter;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (Counter::count() === 0) {
            Counter::create(['name' => 'Contracting Division Counter', 'staff' => 'Contracting Officer']);
            Counter::create(['name' => 'PR Division Counter', 'staff' => 'PR Officer']);
            Counter::create(['name' => 'Technical Division Counter', 'staff' => 'Technical Inspector']);
            Counter::create(['name' => 'Admin Division Counter', 'staff' => 'Admin Officer']);
        }
    }
}
