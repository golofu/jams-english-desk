/**
 * GoDigit brand — logo from the official file (public/brand/logo.png, white-text
 * version logo-white.png). Colors sampled from the logo: near-black wordmark and
 * the orange gradient accent. Every color in the app derives from these tokens.
 */
export const BRAND = {
  company: 'GoDigit',
  appName: "Jam's English Desk",
  logo: '/brand/logo.png',
  logoOnDark: '/brand/logo-white.png',
  colors: {
    primary: '#F26A24', // logo orange: primary buttons, active tab
    primaryInk: '#0B0107', // black on orange passes WCAG; white text did not
    accent: '#F7931E', // gradient start (amber): streaks, highlights
    accentEnd: '#F2513A', // gradient end (red-orange)
    deep: '#0B0107', // wordmark black: headings
  },
};
