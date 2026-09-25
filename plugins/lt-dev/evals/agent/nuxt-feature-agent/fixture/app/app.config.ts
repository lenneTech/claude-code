export default defineAppConfig({
  // ============================================================================
  // Toast Notifications
  // ============================================================================
  toaster: {
    duration: 5000,
    expand: false,
    position: 'bottom-right' as const,
  },

  // ============================================================================
  // NuxtUI Configuration
  // ============================================================================
  ui: {
    // Base component modifications
    button: {
      slots: {
        base: 'cursor-pointer',
      },
    },
    checkbox: {
      slots: {
        base: 'cursor-pointer',
      },
    },

    // Semantic color palette (must match tailwind.css)
    colors: {
      error: 'error',
      info: 'info',
      neutral: 'neutral',
      primary: 'primary',
      secondary: 'secondary',
      success: 'success',
      warning: 'warning',
    },

    // Form field styling
    formField: {
      slots: {
        description: 'text-sm text-neutral-400 dark:text-neutral-500',
      },
    },

    // Dark/Light mode icons
    icons: {
      dark: 'i-lucide-moon',
      light: 'i-lucide-sun-medium',
    },

    // Modal defaults
    modal: {
      slots: {
        content: 'w-full max-w-2xl',
        footer: 'flex justify-end gap-3 px-4 py-3',
      },
    },

    // Toast notifications
    toast: {
      root: 'pointer-events-auto',
      slots: {
        close: 'text-neutral-900 dark:text-white',
      },
    },
  },
});
