/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx}",     // Includes all files in the 'pages' folder
        "./components/**/*.{js,ts,jsx,tsx}", // Includes all files in the 'components' folder
        "./styles/**/*.css",                 // Corrected glob pattern for all CSS files in the 'styles' folder
    ],
    theme: {
        extend: {},
    },
    plugins: [],
};
