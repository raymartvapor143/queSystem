import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.jsx',
            ],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],

    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
});

// import { defineConfig } from 'vite';
// import laravel from 'laravel-vite-plugin';
// import react from '@vitejs/plugin-react';
// import tailwindcss from '@tailwindcss/vite';

// export default defineConfig({
//     server: {
//         host: '0.0.0.0',
//         port: 5173,
//         strictPort: true,
//         cors: true,
//         hmr: {
//             host: '10.163.33.1',
//         },
//     },

//     plugins: [
//         laravel({
//             input: [
//                 'resources/css/app.css',
//                 'resources/js/app.jsx',
//             ],
//             refresh: true,
//         }),
//         react(),
//         tailwindcss(),
//     ],

//     resolve: {
//         alias: {
//             '@': '/resources/js',
//         },
//     },
// });