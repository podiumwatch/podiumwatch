export const site = {
  name: "Podium Watch",
  shortName: "Podium Watch",
  description: "Ohio high school cross country and track and field rankings, stories, interviews, and athlete coverage.",
  siteUrl: "https://podiumwatch.vercel.app",
  defaultAuthor: "Podium Watch",
  contactEmail: "podiumwatchohio@gmail.com",
  instagramUrl: "https://www.instagram.com/podiumwatch/",
  youtubeUrl: "https://www.youtube.com/@podiumwatchohio",
  logo: "/images/branding/podium_watch_logo_dark.png",
  logoLight: "/images/branding/podium_watch_logo_light.png",
  logoMark: "/images/branding/podium_watch_logo_light.png",
  defaultSocialImage: "/images/social/podium_watch_default_social.png",
  copyrightText: "Podium Watch",
  navigation: [
    { label: "Home", href: "/" },
    { label: "Rankings", href: "/rankings/" },
    { label: "Meets", href: "/meets/" },
    { label: "Athlete Spotlights", href: "/athlete-spotlights/" },
    { label: "Athlete of the Week", href: "/athlete-of-the-week/" },
    { label: "Team of the Week", href: "/team-of-the-week/" },
    { label: "Stories", href: "/stories/" },
    { label: "About", href: "/about/" }
  ],
  footerLinks: {
    Coverage: [
      { label: "Rankings", href: "/rankings/" },
      { label: "Meets", href: "/meets/" },
      { label: "Cross Country", href: "/rankings/cross-country/" },
      { label: "Track and Field", href: "/rankings/track-and-field/" }
    ],
    "Podium Watch": [
      { label: "Stories", href: "/stories/" },
      { label: "Athlete Spotlights", href: "/athlete-spotlights/" },
      { label: "Athlete of the Week", href: "/athlete-of-the-week/" },
      { label: "Team of the Week", href: "/team-of-the-week/" },
      { label: "About", href: "/about/" }
    ],
    Connect: [
      { label: "Instagram", href: "https://www.instagram.com/podiumwatch/", external: true },
      { label: "YouTube", href: "https://www.youtube.com/@podiumwatchohio", external: true },
      { label: "Contact", href: "/contact/" }
    ]
  },
  brand: {
    black: "#090909",
    ink: "#171717",
    muted: "#626262",
    paper: "#f6f4ee",
    white: "#ffffff",
    green: "#0faf68",
    greenDark: "#08784a"
  },
  replaceBeforeLaunch: []
};