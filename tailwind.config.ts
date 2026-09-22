import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      tv: "1920px",
    },
    extend: {
      fontFamily: {
        sans: ['"Geist Variable"', "system-ui", "sans-serif"],
        mono: ['"Geist Mono Variable"', "ui-monospace", "monospace"],
      },
      fontSize: {
        caption: ["0.6875rem", { lineHeight: "1rem" }],
        kpi: ["1.5rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em" }],
        "tv-label": ["1.25rem", { lineHeight: "1.75rem" }],
        "tv-kpi": ["3.5rem", { lineHeight: "1", letterSpacing: "-0.02em" }],
      },
      transitionDuration: {
        press: "var(--duration-press)",
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        drawer: "var(--ease-drawer)",
      },
      boxShadow: {
        popover: "var(--shadow-popover)",
        modal: "var(--shadow-modal)",
      },
      colors: {
        "surface-2": "hsl(var(--surface-2))",
        "brand-text": "hsl(var(--brand-text))",
        info: "hsl(var(--info))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          grid: "hsl(var(--chart-grid))",
          reference: "hsl(var(--chart-reference))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        weg: {
          navy: "hsl(var(--weg-navy))",
          blue: "hsl(var(--weg-blue))",
          "light-blue": "hsl(var(--weg-light-blue))",
          teal: "hsl(var(--weg-teal))",
          dark: "hsl(var(--weg-dark))",
          50: "hsl(var(--weg-50))",
          100: "hsl(var(--weg-100))",
          200: "hsl(var(--weg-200))",
          300: "hsl(var(--weg-300))",
          400: "hsl(var(--weg-400))",
          500: "hsl(var(--weg-500))",
          600: "hsl(var(--weg-600))",
          700: "hsl(var(--weg-700))",
          800: "hsl(var(--weg-800))",
          900: "hsl(var(--weg-900))",
          950: "hsl(var(--weg-950))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        xl: "var(--radius-xl)",
        lg: "var(--radius)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down var(--duration-base) var(--ease-out)",
        "accordion-up": "accordion-up var(--duration-base) var(--ease-out)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
