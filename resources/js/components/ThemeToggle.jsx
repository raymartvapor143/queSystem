import { motion } from 'framer-motion';
import { FaMoon, FaSun } from 'react-icons/fa';
import { useTheme } from './ThemeProvider';

function ThemeToggle() {
    const { isDark, toggleTheme } = useTheme();

    return (
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
            {isDark ? (
                <FaSun className="text-yellow-400 text-xl" />
            ) : (
                <FaMoon className="text-blue-800 text-xl" />
            )}
        </motion.button>
    );
}

export default ThemeToggle;