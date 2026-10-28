/**
 * App identity. The orange palette was sampled from the first customer's logo and kept;
 * the app itself is now open to anyone, so the icon stands in for a company logo.
 * Every color in the app derives from these tokens.
 */
export const BRAND = {
  company: 'Gen AI Space',
  appName: 'English Desk',
  logo: '/icon-192.png',
  logoOnDark: '/icon-192.png',
  colors: {
    primary: '#F26A24', // logo orange: primary buttons, active tab
    primaryInk: '#0B0107', // black on orange passes WCAG; white text did not
    accent: '#F7931E', // gradient start (amber): streaks, highlights
    accentEnd: '#F2513A', // gradient end (red-orange)
    deep: '#0B0107', // wordmark black: headings
  },
};
